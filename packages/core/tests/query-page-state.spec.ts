import { test as base, expect } from "@playwright/test";
import { Service, ServiceHooks, Query } from "@vidyano/core";
import { devBackendUrl } from "./_helpers/dev-backend";

/**
 * People (10,000 rows, 100 per page): a page load fetches rows for the result it belongs to.
 * A sort, text search or filter changed without a search yet uses the state of the last result, so its rows stay in one order.
 */

interface ISentQuery {
    sortOptions: string;
    textSearch: string;
    skip: number;
    columnOverrides: any[];
}

/** Records the query state of every ExecuteQuery request and can hold its response until a gate opens. */
class StateHooks extends ServiceHooks {
    sent: ISentQuery[] = [];
    gate: Promise<void> | null = null;
    /** Called once a request is recorded */
    onSent: (() => void) | null = null;

    override async onFetch(request: Request): Promise<Response> {
        if (!request.url.endsWith("/ExecuteQuery"))
            return super.onFetch(request);

        const body = await request.clone().json();
        this.sent.push({
            sortOptions: body.query.sortOptions || "",
            textSearch: body.query.textSearch || "",
            skip: body.query.skip ?? 0,
            columnOverrides: body.columnOverrides || []
        });

        this.onSent?.();
        if (this.gate)
            await this.gate;

        return super.onFetch(request);
    }
}

type Fixtures = {
    hooks: StateHooks;
    service: Service;
    query: Query;
};

const test = base.extend<Fixtures>({
    hooks: async ({}, use) => {
        await use(new StateHooks());
    },

    service: async ({ hooks }, use) => {
        const service = new Service(devBackendUrl(), hooks, false);
        await service.initialize(true);
        await service.signInUsingCredentials("admin", "admin");

        // The user settings are shared by every test, don't save them
        service.application.saveUserSettings = async () => {};

        await use(service);
    },

    query: async ({ service, hooks }, use) => {
        const query = await service.getQuery("People");
        await query.search();
        hooks.sent = [];
        await use(query);
    },
});

/** The id of row 500 of People in its default sort, from a separate query */
async function referenceId(service: Service): Promise<string> {
    const reference = await service.getQuery("People");
    await reference.search();
    return (await reference.items.atAsync(500)).id;
}

test.describe("A page load before the search of a changed state", () => {
    test("uses the sort of the last result", async ({ service, query, hooks }) => {
        query.sortOptions = [{ name: "LastName", direction: "DESC" }];

        const item = await query.items.atAsync(500);

        expect(hooks.sent.length).toBe(1);
        expect(hooks.sent[0].skip).toBe(500);
        expect(hooks.sent[0].sortOptions).not.toContain("LastName");
        expect(query.sortOptions).toEqual([{ name: "LastName", direction: "DESC" }]);
        expect(item.id).toBe(await referenceId(service));
    });

    test("uses the text search of the last result", async ({ query, hooks }) => {
        query.textSearch = "FirstName:A*";

        await query.items.atAsync(500);

        expect(hooks.sent.length).toBe(1);
        expect(hooks.sent[0].textSearch).toBe("");
        expect(query.textSearch).toBe("FirstName:A*");
    });

    test("uses the filter of the last result", async ({ query, hooks }) => {
        query.getColumn("Gender").selectedDistincts = ["|Female"];

        await query.items.atAsync(500);

        expect(hooks.sent.length).toBe(1);
        expect(hooks.sent[0].columnOverrides).toEqual([]);
        expect(query.getColumn("Gender").selectedDistincts).toEqual(["|Female"]);
    });

    test("uses the new state once its search ran", async ({ query, hooks }) => {
        query.sortOptions = [{ name: "LastName", direction: "DESC" }];
        query.textSearch = "FirstName:A*";
        await query.search();
        hooks.sent = [];

        await query.items.atAsync(150);

        expect(hooks.sent.length).toBe(1);
        expect(hooks.sent[0].sortOptions).toBe("LastName DESC");
        expect(hooks.sent[0].textSearch).toBe("FirstName:A*");
    });

    test("uses the text search that was sent, not one changed while the search ran", async ({ query, hooks }) => {
        query.textSearch = "FirstName:A*";
        let open: () => void;
        hooks.gate = new Promise<void>(resolve => open = resolve);
        const sent = new Promise<void>(resolve => hooks.onSent = resolve);
        const search = query.search();
        await sent;
        query.textSearch = "FirstName:B*";
        hooks.gate = null;
        hooks.onSent = null;
        open();
        await search;
        hooks.sent = [];

        await query.items.atAsync(150);

        expect(hooks.sent.length).toBe(1);
        expect(hooks.sent[0].textSearch).toBe("FirstName:A*");
    });

    test("uses the new sort for a page load started while the result is applied", async ({ query, hooks }) => {
        query.sortOptions = [{ name: "LastName", direction: "DESC" }];

        let page: Promise<unknown> = null;
        const disposer = query.propertyChanged.attach((_, args) => {
            if (args.propertyName === "items" && !page && query.items.length > 0)
                page = query.items.atAsync(500);
        });

        try {
            await query.search();
            expect(page).not.toBeNull();
            await page;
        }
        finally {
            disposer();
        }

        expect(hooks.sent.map(s => s.sortOptions)).toEqual(["LastName DESC", "LastName DESC"]);
        expect(hooks.sent[1].skip).toBe(500);
    });

    test("uses the filter of the last result when its values are changed in place", async ({ query, hooks }) => {
        const gender = query.getColumn("Gender");
        gender.selectedDistincts = ["|Female"];
        await query.search();
        hooks.sent = [];

        gender.selectedDistincts.push("|Male");
        await query.items.atAsync(500);

        expect(hooks.sent.length).toBe(1);
        expect(hooks.sent[0].columnOverrides).toEqual([{ name: "Gender", includes: ["|Female"] }]);
    });
});
