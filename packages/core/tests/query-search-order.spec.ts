import { test as base, expect } from "@playwright/test";
import { Service, ServiceHooks, Query } from "@vidyano/core";
import { devBackendUrl } from "./_helpers/dev-backend";

/**
 * People (10,000 rows): searches that follow each other quickly, e.g. two clicks on a column header.
 * Every search must end with a result for the query's latest state, and every caller gets an outcome that fits its own options.
 */

/** Records the sort options and skip of every ExecuteQuery request, delays its response and can make it fail like a network error. */
class SearchHooks extends ServiceHooks {
    sorts: string[] = [];
    skips: number[] = [];
    delay = 0;
    fail = false;

    override async onFetch(request: Request): Promise<Response> {
        if (!request.url.endsWith("/ExecuteQuery"))
            return super.onFetch(request);

        const body = await request.clone().json();
        this.sorts.push(body.query.sortOptions);
        this.skips.push(body.query.skip ?? 0);

        const fail = this.fail;
        if (this.delay)
            await new Promise(resolve => setTimeout(resolve, this.delay));

        if (fail)
            throw new TypeError("Failed to fetch");

        return super.onFetch(request);
    }
}

type Fixtures = {
    hooks: SearchHooks;
    query: Query;
    unhandled: unknown[];
};

const test = base.extend<Fixtures>({
    hooks: async ({}, use) => {
        await use(new SearchHooks());
    },

    query: async ({ hooks }, use) => {
        const service = new Service(devBackendUrl(), hooks, false);
        await service.initialize(true);
        await service.signInUsingCredentials("admin", "admin");
        const query = await service.getQuery("People");
        hooks.sorts = [];
        hooks.skips = [];
        hooks.delay = 300;
        await use(query);
    },

    unhandled: async ({}, use) => {
        const unhandled: unknown[] = [];
        const listener = (reason: unknown) => unhandled.push(reason);
        process.on("unhandledRejection", listener);
        await use(unhandled);
        process.off("unhandledRejection", listener);
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

/** The last names of the loaded first page */
function lastNames(query: Query) {
    return Array.from({ length: query.pageSize }, (_, i) => loadedItem(query, i).values["LastName"] as string);
}

/** Selects the first rows of the loaded result and returns their ids */
function selectFirst(query: Query, count: number) {
    query.selectedItems = Array.from({ length: count }, (_, i) => loadedItem(query, i));
    return query.selectedItems.map(item => item.id);
}

test.describe("Searches that follow each other", () => {
    test("a search started while another one runs sends its own request and wins", async ({ query, hooks }) => {
        query.sortOptions = [{ name: "LastName", direction: "ASC" }];
        const first = query.search();
        await expect.poll(() => hooks.sorts.length).toBe(1);

        query.sortOptions = [{ name: "LastName", direction: "DESC" }];
        const second = query.search();
        await Promise.all([first, second]);

        expect(hooks.sorts).toEqual(["LastName", "LastName DESC"]);
        expect(query.sortOptions).toEqual([{ name: "LastName", direction: "DESC" }]);

        const names = lastNames(query);
        expect(names).toEqual([...names].sort((a, b) => b.localeCompare(a)));
    });

    test("a replaced search resolves with the result of the search that replaced it", async ({ query, hooks }) => {
        query.sortOptions = [{ name: "LastName", direction: "ASC" }];
        const first = query.search();
        await expect.poll(() => hooks.sorts.length).toBe(1);

        query.sortOptions = [{ name: "LastName", direction: "DESC" }];
        query.search();
        await first;

        expect(query.hasSearched).toBe(true);
        expect(hooks.sorts).toEqual(["LastName", "LastName DESC"]);

        const names = lastNames(query);
        expect(names).toEqual([...names].sort((a, b) => b.localeCompare(a)));
    });

    test("searches queued behind a running one send one request for the latest state", async ({ query, hooks }) => {
        query.sortOptions = [{ name: "LastName", direction: "ASC" }];
        const first = query.search();
        await expect.poll(() => hooks.sorts.length).toBe(1);

        query.sortOptions = [{ name: "FirstName", direction: "ASC" }];
        const second = query.search();
        query.sortOptions = [{ name: "LastName", direction: "DESC" }];
        const third = query.search();
        await Promise.all([first, second, third]);

        expect(hooks.sorts).toEqual(["LastName", "LastName DESC"]);
        expect(query.sortOptions).toEqual([{ name: "LastName", direction: "DESC" }]);
    });

    test("a replaced search keeps its selection", async ({ query, hooks }) => {
        const ids = selectFirst(query, 3);

        const first = query.search({ keepSelection: true });
        await expect.poll(() => hooks.sorts.length).toBe(1);

        const second = query.search();
        await Promise.all([first, second]);

        expect(hooks.sorts).toHaveLength(2);
        expect(query.selectedItems.map(item => item.id)).toEqual(ids);
    });
});

test.describe("A search started while a result is applied", () => {
    test("resolves with its own result", async ({ query, hooks }) => {
        query.sortOptions = [{ name: "LastName", direction: "ASC" }];
        let second: Promise<unknown> = null;
        query.propertyChanged.attach((_, args) => {
            // An items listener that starts a new search while the first result is applied
            if (args.propertyName === "items" && query.hasSearched && !second) {
                query.sortOptions = [{ name: "LastName", direction: "DESC" }];
                second = query.search();
            }
        });

        await query.search();
        expect(second).not.toBeNull();
        await second;

        expect(hooks.sorts).toEqual(["LastName", "LastName DESC"]);
        expect(query.hasSearched).toBe(true);
        const names = lastNames(query);
        expect(names).toEqual([...names].sort((a, b) => b.localeCompare(a)));
    });
});

test.describe("Searches that fail", () => {
    test("a failing search that keeps the selection resolves with null", async ({ query, hooks, unhandled }) => {
        selectFirst(query, 3);
        hooks.fail = true;

        await expect(query.search({ keepSelection: true })).resolves.toBeNull();
        expect(query.notification).toBe("Failed to fetch");
        expect(unhandled.map(String)).toEqual([]);
    });

    test("a replaced search does not reject when the search that replaced it fails", async ({ query, hooks, unhandled }) => {
        query.sortOptions = [{ name: "LastName", direction: "ASC" }];
        const first = query.search();
        await expect.poll(() => hooks.sorts.length).toBe(1);

        hooks.fail = true;
        query.sortOptions = [{ name: "LastName", direction: "DESC" }];
        const second = query.search({ throwExceptions: true });

        await expect(second).rejects.toThrow("Failed to fetch");
        await expect(first).resolves.toBeNull();
        expect(unhandled.map(String)).toEqual([]);
    });

    test("a replaced search that asks for exceptions rejects when the search that replaced it fails", async ({ query, hooks, unhandled }) => {
        query.sortOptions = [{ name: "LastName", direction: "ASC" }];
        const first = query.search({ throwExceptions: true });
        await expect.poll(() => hooks.sorts.length).toBe(1);

        hooks.fail = true;
        query.sortOptions = [{ name: "LastName", direction: "DESC" }];
        const second = query.search();

        await expect(second).resolves.toBeNull();
        await expect(first).rejects.toThrow("Failed to fetch");
        expect(unhandled.map(String)).toEqual([]);
    });
});

test.describe("A single search", () => {
    // search() has no delay option any more, the Refresh client operation waits itself
    test("is sent at once, also when an older caller still passes a delay", async ({ query, hooks }) => {
        hooks.delay = 0;
        const search = query.search({ delay: 2000 } as any);
        await expect.poll(() => hooks.sorts.length, { timeout: 500 }).toBe(1);
        await search;
        expect(query.hasSearched).toBe(true);
    });
});

test.describe("Rows read during a search", () => {
    test("wait for the search instead of starting another one", async ({ query, hooks }) => {
        const search = query.search();
        await expect.poll(() => hooks.sorts.length).toBe(1);

        expect(query.items[150]).toBeNull();
        await search;
        await expect.poll(() => loadedItem(query, 150) != null).toBe(true);

        expect(hooks.skips).toEqual([0, 100]);
    });

    test("send no second search when the search fails", async ({ query, hooks, unhandled }) => {
        hooks.fail = true;
        const search = query.search();
        await expect.poll(() => hooks.sorts.length).toBe(1);

        expect(query.items[150]).toBeNull();
        await expect(search).resolves.toBeNull();

        // Give a second search the time to go out
        await new Promise(resolve => setTimeout(resolve, 500));
        expect(hooks.sorts).toHaveLength(1);
        expect(query.notification).toBe("Failed to fetch");
        expect(unhandled.map(String)).toEqual([]);
    });

    test("fail an awaited read when the search fails", async ({ query, hooks, unhandled }) => {
        hooks.fail = true;
        const search = query.search();
        await expect.poll(() => hooks.sorts.length).toBe(1);

        const read = query.items.sliceAsync(150, 160);
        await expect(read).rejects.toThrow("Failed to fetch");
        await expect(search).resolves.toBeNull();

        expect(hooks.sorts).toHaveLength(1);
        expect(unhandled.map(String)).toEqual([]);
    });
});
