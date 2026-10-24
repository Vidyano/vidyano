import { test as base, expect } from "@playwright/test";
import { Service, Query, QueryResultItem } from "@vidyano/core";
import { ContinuationHooks, PEOPLE, referenceIds } from "./_helpers/continuation";
import { devBackendUrl } from "./_helpers/dev-backend";

/**
 * A row hook (ServiceHooks.onConstructQueryResultItem) that throws while a result or a page is applied.
 * A result that cannot be applied leaves an empty result and reports the error in the console (a row hook error is a bug for the developer, not news for the user),
 * a page that cannot be applied leaves the query as it was, so the page can be loaded again.
 */

const ERROR = "Row hook failed";

/** Makes the row hook throw for one query and counts the ExecuteQuery requests; can simulate continuation paging on People. */
class RowHooks extends ContinuationHooks {
    executeQueries = 0;
    /** Called for every row that is built */
    onRow: ((query: Query) => void) | null = null;
    #query: Query = null;
    #rowsBeforeFailure = 0;
    #failures = 0;

    /** Makes the row hook throw for the query once the given number of rows was built, for the given number of rows */
    failFor(query: Query, rowsBeforeFailure: number = 0, failures: number = Infinity) {
        this.#query = query;
        this.#rowsBeforeFailure = rowsBeforeFailure;
        this.#failures = failures;
    }

    stopFailing() {
        this.#query = null;
    }

    override onConstructQueryResultItem(service: Service, item: any, query: Query, isSelected?: boolean): QueryResultItem {
        this.onRow?.(query);
        if (query === this.#query && this.#rowsBeforeFailure-- <= 0 && this.#failures-- > 0)
            throw new Error(ERROR);

        return super.onConstructQueryResultItem(service, item, query, isSelected);
    }

    override async onFetch(request: Request): Promise<Response> {
        if (request.url.endsWith("/ExecuteQuery"))
            this.executeQueries++;

        return super.onFetch(request);
    }
}

type Fixtures = {
    hooks: RowHooks;
    service: Service;
    reorderQuery: Query;
};

const test = base.extend<Fixtures>({
    hooks: async ({}, use) => {
        const hooks = new RowHooks();
        hooks.simulate = false;
        await use(hooks);
    },

    service: async ({ hooks }, use) => {
        const service = new Service(devBackendUrl(), hooks, false);
        await service.initialize(true);
        await service.signInUsingCredentials("admin", "admin");
        await use(service);
    },

    // Reordering changes the in-memory dev data, so it is reset before and after
    reorderQuery: async ({ service }, use) => {
        await service.executeAction("PersistentObject.ResetTest", service.application);
        await use(await service.getQuery("QueryGrid_ReorderLarge"));
        await service.executeAction("PersistentObject.ResetTest", service.application);
    },
});

/** Reads an item without starting a lazy load */
function loadedItem(query: Query, index: number) {
    query.disableLazyLoading = true;
    try {
        return query.items[index];
    }
    finally {
        query.disableLazyLoading = false;
    }
}

/** The sort options as "Name DIRECTION" strings */
function sorts(query: Query) {
    return query.sortOptions.map(option => `${option.name} ${option.direction}`);
}

/** Expects the query to show an empty result with the hook's error */
function expectEmptyResult(query: Query) {
    expect(query.hasSearched).toBe(true);
    expect(query.totalItems).toBe(0);
    expect(query.hasMore).toBe(false);
    expect(query.items.length).toBe(0);
    expect(query.totalItem).toBeNull();
    expect(query.notification).toBeFalsy();
}

test.describe("A search whose rows cannot be built", () => {
    test("reports the error in the console", async ({ service, hooks }) => {
        const query = await service.getQuery("People");
        const logged: unknown[][] = [];
        const consoleError = console.error;
        console.error = (...args: unknown[]) => { logged.push(args); };
        try {
            hooks.failFor(query);
            await query.search();
        }
        finally {
            console.error = consoleError;
        }

        expect(logged.some(args => args.some(a => a instanceof Error && a.message === ERROR))).toBe(true);
    });

    test("leaves an empty result", async ({ service, hooks }) => {
        const query = await service.getQuery("People");
        expect(query.totalItems).toBe(10_000);

        query.sortOptions = [{ name: "LastName", direction: "DESC" }];
        hooks.failFor(query);
        expect(await query.search()).toBeNull();

        expectEmptyResult(query);
        expect(sorts(query)).toEqual(["LastName DESC"]);

        // Reading a row of the empty result does not search again
        const executeQueries = hooks.executeQueries;
        expect(query.items[5000]).toBeUndefined();
        await new Promise(resolve => setTimeout(resolve, 200));
        expect(hooks.executeQueries).toBe(executeQueries);

        hooks.stopFailing();
        await query.search();
        expect(query.totalItems).toBe(10_000);
        expect(loadedItem(query, 0)).toBeTruthy();
        expect(query.notification).toBeFalsy();
        expect(sorts(query)).toEqual(["LastName DESC"]);
    });

    test("drops the groups of the previous result", async ({ service, hooks }) => {
        const query = await service.getQuery("People");
        await query.group("Gender");
        expect(query.groupingInfo.groups.length).toBeGreaterThan(1);

        hooks.failFor(query);
        await query.search();

        expectEmptyResult(query);
        expect(query.groupingInfo.groupedBy).toBe("Gender");
        expect(query.groupingInfo.groups).toEqual([]);

        hooks.stopFailing();
        await query.search();
        expect(query.groupingInfo.groups.reduce((n, g) => n + g.count, 0)).toBe(10_000);
    });
});

test.describe("A lazy page whose rows cannot be built", () => {
    test("can be loaded again on a query with a known total", async ({ service, hooks }) => {
        const query = await service.getQuery("People");

        hooks.failFor(query);
        await expect(query.items.atAsync(5000)).rejects.toThrow(ERROR);
        expect(query.notification).toBe(ERROR);
        expect(query.totalItems).toBe(10_000);
        expect(loadedItem(query, 5000)).toBeFalsy();

        hooks.stopFailing();
        expect((await query.items.atAsync(5000))?.id).toBeTruthy();
    });

    test("is loaded again when a row is read again", async ({ service, hooks }) => {
        const query = await service.getQuery("People");

        hooks.failFor(query);
        expect(query.items[5000]).toBeNull();
        await expect.poll(() => query.notification).toBe(ERROR);
        expect(loadedItem(query, 5000)).toBeFalsy();

        hooks.stopFailing();
        expect(query.items[5000]).toBeNull();
        await expect.poll(() => loadedItem(query, 5000) != null).toBe(true);
    });

    test("lets the row hook read rows of other pages", async ({ service, hooks }) => {
        const query = await service.getQuery("People");

        // The hook reads a row of another page once, which loads that page
        let read = false;
        hooks.onRow = (rowQuery: Query) => {
            if (rowQuery === query && !read) {
                read = true;
                rowQuery.items[9000];
            }
        };

        await query.items.atAsync(5000);
        await expect.poll(() => loadedItem(query, 9000) != null).toBe(true);
    });

    test("keeps the rows built before the throw out of the query", async ({ service, hooks }) => {
        const query = await service.getQuery("People");

        hooks.failFor(query, 50);
        await expect(query.items.atAsync(5000)).rejects.toThrow(ERROR);
        expect(loadedItem(query, 5000)).toBeFalsy();
        expect(loadedItem(query, 5049)).toBeFalsy();

        hooks.stopFailing();
        const rows = await query.items.sliceAsync(5000, 5100);
        expect(rows.filter(row => row != null)).toHaveLength(100);
        expect(new Set(rows.map(row => row.id)).size).toBe(100);
    });

    test("can be loaded again with the same token on a continuation query", async ({ service, hooks }) => {
        hooks.simulate = true;
        const reference = await referenceIds(service, hooks);
        const query = await service.getQuery(PEOPLE);
        expect(query.hasMore).toBe(true);
        expect(query.totalItems).toBe(100);

        hooks.failFor(query);
        await expect(query.items.atAsync(150)).rejects.toThrow(ERROR);
        expect(query.totalItems).toBe(100);
        expect(query.hasMore).toBe(true);
        expect(loadedItem(query, 100)).toBeFalsy();

        hooks.stopFailing();
        expect((await query.items.atAsync(150))?.id).toBe(reference[150]);
        expect(hooks.pages.map(p => p.continuation)).toEqual(["offset:100", "offset:100"]);
        expect(query.totalItems).toBe(200);
    });
});

test.describe("A reorder whose rows cannot be built", () => {
    test("leaves an empty result", async ({ reorderQuery: query, hooks }) => {
        expect(query.totalItems).toBe(250);
        expect(query.pageSize).toBeLessThan(150);
        const first = loadedItem(query, 0), moved = loadedItem(query, 1);

        // Only the rows of the reordered result fail, a page load after it would build its rows
        hooks.failFor(query, 0, 1);
        const executeQueries = hooks.executeQueries;
        const reorder = query.reorder(null, moved, first);
        const page = query.items.sliceAsync(150, 160);

        expect(await reorder).toEqual([]);
        await page;

        expectEmptyResult(query);
        expect(hooks.executeQueries).toBe(executeQueries);

        hooks.stopFailing();
        await query.search();
        expect(query.totalItems).toBe(250);
        expect(loadedItem(query, 0).id).toBe(moved.id);
        expect(loadedItem(query, 1).id).toBe(first.id);
    });
});
