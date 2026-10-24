import { test as base, expect } from "@playwright/test";
import { Service, ServiceHooks, Query, Action } from "@vidyano/core";
import { devBackendUrl } from "./_helpers/dev-backend";

/**
 * People (10,000 rows): an action on the current result acts on the rows of that result.
 * A sort, text search or filter changed without a search yet is not sent with it.
 */

/** Records the query of every ExecuteAction and GetStream request. */
class ActionHooks extends ServiceHooks {
    sent: any[] = [];

    override async onFetch(request: Request): Promise<Response> {
        if (request.url.endsWith("/ExecuteAction"))
            this.sent.push((await request.clone().json()).query);
        else if (request.url.endsWith("/GetStream"))
            this.sent.push(JSON.parse((await request.clone().formData()).get("data") as string).query);

        return super.onFetch(request);
    }
}

type Fixtures = {
    hooks: ActionHooks;
    query: Query;
};

const test = base.extend<Fixtures>({
    hooks: async ({}, use) => {
        await use(new ActionHooks());
    },

    query: async ({ hooks }, use) => {
        const service = new Service(devBackendUrl(), hooks, false);
        await service.initialize(true);
        await service.signInUsingCredentials("admin", "admin");

        // The user settings are shared by every test, don't save them
        service.application.saveUserSettings = async () => {};

        const query = await service.getQuery("People");
        await query.search();
        expect(query.totalItems).toBe(10000);
        await use(query);
    },
});

/** Runs TestCount and waits for the refresh it starts */
async function testCount(query: Query) {
    await (query.actions.find(a => a.name === "TestCount") as Action).execute();
    while (query.isBusy)
        await new Promise(resolve => setTimeout(resolve, 50));
}

test.describe("An action on the current result before the search of a changed state", () => {
    test("runs on select-all with the text search of the last result", async ({ query, hooks }) => {
        query.textSearch = "FirstName:A*";
        query.selectAll.allSelected = true;

        await testCount(query);

        expect(hooks.sent.length).toBe(1);
        expect(hooks.sent[0].allSelected).toBe(true);
        expect(hooks.sent[0].textSearch || "").toBe("");
        expect(query.notification).toBe("10000");
        expect(query.textSearch).toBe("FirstName:A*");
    });

    test("runs on select-all with the filter of the last result", async ({ query, hooks }) => {
        query.getColumn("Gender").selectedDistincts = ["|Female"];
        query.selectAll.allSelected = true;

        await testCount(query);

        expect(hooks.sent.length).toBe(1);
        expect(hooks.sent[0].columns.find(c => c.name === "Gender").includes).toEqual([]);
        expect(query.notification).toBe("10000");
        expect(query.getColumn("Gender").selectedDistincts).toEqual(["|Female"]);
    });

    test("runs on selected items with the sort of the last result", async ({ query, hooks }) => {
        query.sortOptions = [{ name: "FirstName", direction: "ASC" }];
        await query.search();
        hooks.sent = [];
        query.sortOptions = [{ name: "LastName", direction: "DESC" }];
        query.items[0].isSelected = true;

        await testCount(query);

        expect(hooks.sent.length).toBe(1);
        expect(hooks.sent[0].sortOptions).toBe("FirstName");
        expect(query.notification).toBe("1");
        expect(query.sortOptions).toEqual([{ name: "LastName", direction: "DESC" }]);
    });

    test("exports with the text search and filter of the last result", async ({ query, hooks }) => {
        query.textSearch = "FirstName:A*";
        query.getColumn("Gender").selectedDistincts = ["|Female"];

        await query.service.getStream(null, { action: "Query.ExportToCsv", query, onSuccess: () => {}, onError: () => {} });

        expect(hooks.sent.length).toBe(1);
        expect(hooks.sent[0].textSearch || "").toBe("");
        expect(hooks.sent[0].columns.find(c => c.name === "Gender").includes).toEqual([]);
    });

    test("exports with the excluding filter and content of the last result", async ({ query, hooks }) => {
        const gender = query.getColumn("Gender");
        gender.selectedDistincts = ["|Female"];
        gender.selectedDistinctsInversed = true;
        query.getColumn("FirstName").includeAllContent = true;

        await query.service.getStream(null, { action: "Query.ExportToCsv", query, onSuccess: () => {}, onError: () => {} });

        expect(hooks.sent.length).toBe(1);
        expect(hooks.sent[0].columns.find(c => c.name === "Gender").excludes).toEqual([]);
        expect(hooks.sent[0].columns.find(c => c.name === "FirstName").includeAllContent).toBe(undefined);
    });

    test("runs with the changed state once its search ran", async ({ query, hooks }) => {
        query.textSearch = "FirstName:A*";
        await query.search();
        const total = query.totalItems;
        query.selectAll.allSelected = true;

        await testCount(query);

        expect(hooks.sent.length).toBe(1);
        expect(hooks.sent[0].textSearch).toBe("FirstName:A*");
        expect(query.notification).toBe(String(total));
    });
});
