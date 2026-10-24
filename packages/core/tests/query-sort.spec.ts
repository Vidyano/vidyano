import { test as base, expect } from "@playwright/test";
import { Service, ServiceHooks, Query } from "@vidyano/core";
import { devBackendUrl } from "./_helpers/dev-backend";

/**
 * People: sorting by a column.
 * A sort that fails goes back to the sort of the last result, so the column icons and the next request follow that sort.
 */

/** Counts the ExecuteQuery requests, can hold them until a gate opens and can make them fail like a network error. */
class FailingHooks extends ServiceHooks {
    requests = 0;
    fail = false;
    gate: Promise<void> | null = null;

    override async onFetch(request: Request): Promise<Response> {
        if (request.url.endsWith("/ExecuteQuery")) {
            this.requests++;
            const fail = this.fail;
            if (this.gate)
                await this.gate;

            if (fail)
                throw new TypeError("Failed to fetch");
        }

        return super.onFetch(request);
    }
}

type Fixtures = {
    hooks: FailingHooks;
    service: Service;
    query: Query;
    saves: { count: number };
};

const test = base.extend<Fixtures>({
    hooks: async ({}, use) => {
        await use(new FailingHooks());
    },

    saves: async ({}, use) => {
        await use({ count: 0 });
    },

    service: async ({ hooks, saves }, use) => {
        const service = new Service(devBackendUrl(), hooks, false);
        await service.initialize(true);
        await service.signInUsingCredentials("admin", "admin");

        // The user settings are shared by every test, don't save them
        service.application.saveUserSettings = async () => { saves.count++; };

        await use(service);
    },

    query: async ({ service }, use) => {
        const query = await service.getQuery("People");
        await query.search();
        await use(query);
    },
});

/** The sort options as "Name DIRECTION" strings */
function sorts(query: Query) {
    return query.sortOptions.map(option => `${option.name} ${option.direction}`);
}

test.describe("A sort that fails", () => {
    test("keeps the previous sort", async ({ query, hooks, saves }) => {
        await query.getColumn("FirstName").sort("ASC");
        expect(sorts(query)).toEqual(["FirstName ASC"]);
        expect(saves.count).toBe(1);

        hooks.fail = true;
        await query.getColumn("LastName").sort("ASC");

        expect(query.notification).toBeTruthy();
        expect(sorts(query)).toEqual(["FirstName ASC"]);
        expect(query.getColumn("FirstName").sortDirection).toBe("ASC");
        expect(query.getColumn("LastName").sortDirection).toBe("");
        expect(saves.count).toBe(1);
    });

    test("keeps the previous direction of a multi-sort column", async ({ query, hooks, saves }) => {
        await query.getColumn("FirstName").sort("ASC");
        await query.getColumn("LastName").sort("ASC", true);
        expect(sorts(query)).toEqual(["FirstName ASC", "LastName ASC"]);

        hooks.fail = true;
        await query.getColumn("LastName").sort("DESC", true);

        expect(sorts(query)).toEqual(["FirstName ASC", "LastName ASC"]);
        expect(query.getColumn("LastName").sortDirection).toBe("ASC");
        expect(saves.count).toBe(2);
    });

    test("keeps the sort of the last result when an overlapping sort also fails", async ({ query, hooks }) => {
        await query.getColumn("FirstName").sort("ASC");

        hooks.fail = true;
        const first = query.getColumn("LastName").sort("ASC");
        const second = query.getColumn("Gender").sort("DESC");
        await Promise.all([first, second]);

        expect(sorts(query)).toEqual(["FirstName ASC"]);
        expect(query.getColumn("FirstName").sortDirection).toBe("ASC");
        expect(query.getColumn("LastName").sortDirection).toBe("");
        expect(query.getColumn("Gender").sortDirection).toBe("");
    });

    test("keeps the sort of the last result when a sort started during a failing one also fails", async ({ query, hooks }) => {
        await query.getColumn("FirstName").sort("ASC");

        hooks.fail = true;
        let open: () => void;
        hooks.gate = new Promise(resolve => open = resolve);
        const requests = hooks.requests;
        const first = query.getColumn("LastName").sort("ASC");
        await expect.poll(() => hooks.requests).toBe(requests + 1);

        // The first request is on its way, the second sort sends its own once the first is answered
        const second = query.getColumn("Gender").sort("DESC");
        open();
        await Promise.all([first, second]);
        expect(hooks.requests).toBe(requests + 2);

        expect(sorts(query)).toEqual(["FirstName ASC"]);
        expect(query.getColumn("LastName").sortDirection).toBe("");
        expect(query.getColumn("Gender").sortDirection).toBe("");
    });

    test("keeps a multi-sort column it tried to remove", async ({ query, hooks }) => {
        await query.getColumn("FirstName").sort("ASC");
        await query.getColumn("LastName").sort("ASC", true);

        hooks.fail = true;
        await query.getColumn("LastName").sort("", true);

        expect(sorts(query)).toEqual(["FirstName ASC", "LastName ASC"]);
        expect(query.getColumn("LastName").sortDirection).toBe("ASC");
    });

    test("does not keep a multi-sort column it tried to add", async ({ query, hooks }) => {
        await query.getColumn("FirstName").sort("ASC");

        hooks.fail = true;
        await query.getColumn("LastName").sort("ASC", true);

        expect(sorts(query)).toEqual(["FirstName ASC"]);
        expect(query.getColumn("LastName").sortDirection).toBe("");
    });

    test("a multi-sort after a failed one builds on the previous sort", async ({ query, hooks }) => {
        await query.getColumn("FirstName").sort("ASC");

        hooks.fail = true;
        await query.getColumn("LastName").sort("ASC", true);

        hooks.fail = false;
        await query.getColumn("Gender").sort("ASC", true);
        expect(sorts(query)).toEqual(["FirstName ASC", "Gender ASC"]);
    });

    test("set directly on the query keeps the previous sort", async ({ query, hooks }) => {
        await query.getColumn("FirstName").sort("ASC");

        hooks.fail = true;
        query.sortOptions = [{ name: "LastName", direction: "DESC" }];
        expect(await query.search()).toBeNull();

        expect(sorts(query)).toEqual(["FirstName ASC"]);
        expect(query.getColumn("LastName").sortDirection).toBe("");
    });

    test("keeps a sort set while the failing request was on its way", async ({ query, hooks }) => {
        await query.getColumn("FirstName").sort("ASC");

        hooks.fail = true;
        let open: () => void;
        hooks.gate = new Promise(resolve => open = resolve);
        const requests = hooks.requests;
        const search = query.search();
        await expect.poll(() => hooks.requests).toBe(requests + 1);

        // Set for a later search, without searching
        query.sortOptions = [{ name: "LastName", direction: "DESC" }];
        open();
        expect(await search).toBeNull();

        expect(sorts(query)).toEqual(["LastName DESC"]);
    });

    test("does not announce the sort when a search with the same sort fails", async ({ query, hooks }) => {
        await query.getColumn("FirstName").sort("ASC");

        const changes: string[] = [];
        query.propertyChanged.attach((_, args) => changes.push(args.propertyName));

        hooks.fail = true;
        query.textSearch = "zzz";
        expect(await query.search()).toBeNull();

        expect(sorts(query)).toEqual(["FirstName ASC"]);
        expect(changes).not.toContain("sortOptions");
    });

    test("keeps a sort set before the first search", async ({ query: people, hooks }) => {
        // A clone has no result yet
        const query = people.clone();
        expect(query.hasSearched).toBeFalsy();

        hooks.fail = true;
        query.sortOptions = [{ name: "LastName", direction: "DESC" }];
        expect(await query.search()).toBeNull();

        expect(sorts(query)).toEqual(["LastName DESC"]);
    });

    test("can be tried again", async ({ query, hooks }) => {
        await query.getColumn("FirstName").sort("ASC");

        hooks.fail = true;
        await query.getColumn("LastName").sort("ASC");
        expect(query.getColumn("LastName").sortDirection).toBe("");

        hooks.fail = false;
        await query.getColumn("LastName").sort("ASC");
        expect(sorts(query)).toEqual(["LastName ASC"]);
        expect(query.getColumn("LastName").sortDirection).toBe("ASC");
    });
});
