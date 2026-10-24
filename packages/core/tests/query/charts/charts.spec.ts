import { test as base, expect } from "@playwright/test";
import { Service, ServiceHooks, Query, QueryResultItem } from "@vidyano/core";
import { startBackend, stopBackend, BackendProcess } from "../../_helpers/backend";

/**
 * Sales (3 rows) has a bar chart and the result tag "Sales"; a text search returns its rows without charts.
 */

const ERROR = "Row hook failed";

/** Makes the row hook throw while failing is set */
class RowHooks extends ServiceHooks {
    failing = false;

    override onConstructQueryResultItem(service: Service, item: any, query: Query, isSelected?: boolean): QueryResultItem {
        if (this.failing)
            throw new Error(ERROR);

        return super.onConstructQueryResultItem(service, item, query, isSelected);
    }
}

type Fixtures = {
    hooks: RowHooks;
    query: Query;
};

let backend: BackendProcess;

const test = base.extend<Fixtures>({
    hooks: async ({}, use) => {
        await use(new RowHooks());
    },

    query: async ({ hooks }, use) => {
        const service = new Service(backend.url, hooks, false);
        await service.initialize(true);
        await service.signInUsingDefaultCredentials();

        const query = await service.getQuery("Sales");
        await query.search();
        await use(query);
    },
});

test.beforeAll(async ({}, testInfo) => {
    backend = await startBackend(testInfo);
});

test.afterAll(async () => {
    await stopBackend(backend);
});

test.describe("A result without charts", () => {
    test("drops the charts of the previous result", async ({ query }) => {
        expect(query.charts.map(c => c.name)).toEqual(["ByRegion"]);

        query.textSearch = "North";
        await query.search();

        expect(query.totalItems).toBe(2);
        expect(query.charts).toEqual([]);
    });
});

test.describe("A result whose rows cannot be built", () => {
    // The row hook error goes to the console, kept out of the test output
    test.beforeEach(async ({ query, hooks }) => {
        expect(query.charts.map(c => c.name)).toEqual(["ByRegion"]);
        expect(query.tag).toBe("Sales");

        const consoleError = console.error;
        console.error = () => {};
        try {
            hooks.failing = true;
            expect(await query.search()).toBeNull();
        }
        finally {
            console.error = consoleError;
        }

        expect(query.totalItems).toBe(0);
    });

    test("drops the charts of the previous result", async ({ query }) => {
        expect(query.charts).toBeNull();
    });

    test("drops the tag of the previous result", async ({ query }) => {
        expect(query.tag).toBeNull();
    });
});
