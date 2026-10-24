import { test as base, expect } from "@playwright/test";
import { Service, Query, _internal } from "@vidyano/core";
import { ContinuationHooks, LIMIT, PEOPLE, referenceIds } from "./_helpers/continuation";
import { devBackendUrl } from "./_helpers/dev-backend";

/**
 * Queries with an unknown total that page with continuation tokens.
 * The dev backend has no such query, so ContinuationHooks makes People (10.000 rows) answer as one:
 * the first 1.234 rows in pages of 100, with the token "offset:<n>" while rows follow and the real total on the last page.
 * The reference ids are the rows the backend returns for the same sort with skip 0 and top 1.234.
 */

const SEARCH = "Lemmens";

type WorkerFixtures = {
    reference: { all: string[]; search: string[] };
};

type Fixtures = {
    hooks: ContinuationHooks;
    query: Query;
};

const test = base.extend<Fixtures, WorkerFixtures>({
    reference: [async ({}, use) => {
        const hooks = new ContinuationHooks();
        const service = new Service(devBackendUrl(), hooks, false);
        await service.initialize(true);
        await service.signInUsingCredentials("admin", "admin");

        await use({ all: await referenceIds(service, hooks), search: await referenceIds(service, hooks, SEARCH) });
    }, { scope: "worker" }],

    hooks: async ({}, use) => {
        await use(new ContinuationHooks());
    },

    query: async ({ hooks }, use) => {
        const service = new Service(devBackendUrl(), hooks, false);
        await service.initialize(true);
        await service.signInUsingCredentials("admin", "admin");
        await use(await service.getQuery(PEOPLE));
    },
});

const ids = (items: { id: string }[]) => items.map(item => item.id);

test.describe("Continuation paging simulation", () => {
    test("starts with the first page and an open total", async ({ query, hooks, reference }) => {
        expect(query).toBeInstanceOf(Query);
        expect(reference.all).toHaveLength(LIMIT);
        expect(query.hasMore).toBe(true);
        expect(query.totalItems).toBe(100);
        expect(query.items.length).toBe(100);
        expect(ids(query.items)).toEqual(reference.all.slice(0, 100));
        expect(query.labelWithTotalItems).toBe("100+ People");
        expect(hooks.pages).toEqual([]);
    });
});

test.describe("Items past the loaded rows of a continuation query", () => {
    test("lazy loads an item past the loaded rows with the token", async ({ query, hooks, reference }) => {
        expect(query.items[150]).toBe(null);

        await expect.poll(() => query.items.length).toBeGreaterThan(150);
        expect(query.items[150].id).toBe(reference.all[150]);
        expect(hooks.pages[0].continuation).toBe("offset:100");
    });

    test("atAsync past the loaded rows loads the next page with the token", async ({ query, hooks, reference }) => {
        const item = await query.items.atAsync(150);

        expect(item.id).toBe(reference.all[150]);
        expect(hooks.pages.map(p => p.continuation)).toEqual(["offset:100"]);
        expect(query.hasMore).toBe(true);
        expect(query.totalItems).toBe(200);
    });

    test("sliceAsync across the loaded end loads the next page", async ({ query, hooks, reference }) => {
        const items = await query.items.sliceAsync(95, 105);

        expect(ids(items)).toEqual(reference.all.slice(95, 105));
        expect(hooks.pages.map(p => p.continuation)).toEqual(["offset:100"]);
    });

    test("sliceAsync without an end walks every token to the real end", async ({ query, hooks, reference }) => {
        const items = await query.items.sliceAsync(0);

        expect(ids(items)).toEqual(reference.all);
        expect(new Set(hooks.pages.map(p => p.continuation)).size).toBe(hooks.pages.length);
        expect(query.hasMore).toBe(false);
        expect(query.totalItems).toBe(LIMIT);
    });

    test("toArrayAsync walks every token to the real end", async ({ query, hooks, reference }) => {
        const items = await query.items.toArrayAsync();

        expect(ids(items)).toEqual(reference.all);
        expect(new Set(hooks.pages.map(p => p.continuation)).size).toBe(hooks.pages.length);
        expect(query.hasMore).toBe(false);
        expect(query.totalItems).toBe(LIMIT);
        expect(query.labelWithTotalItems).toBe("1.234 People");
    });
});

test.describe("Pages up to a requested row of a continuation query", () => {
    test("atAsync far ahead loads every row up to it in one request", async ({ query, hooks, reference }) => {
        const item = await query.items.atAsync(1000);

        expect(item.id).toBe(reference.all[1000]);
        expect(hooks.pages).toEqual([{ continuation: "offset:100", top: 1000 }]);
        expect(query.hasMore).toBe(true);
        expect(query.totalItems).toBe(1100);
        expect(ids(query.items.slice(0, 1100))).toEqual(reference.all.slice(0, 1100));
    });

    test("concurrent atAsync calls never send a token twice", async ({ query, hooks, reference }) => {
        const items = await Promise.all([150, 250, 350].map(i => query.items.atAsync(i)));

        expect(ids(items)).toEqual([reference.all[150], reference.all[250], reference.all[350]]);
        expect(new Set(hooks.pages.map(p => p.continuation)).size).toBe(hooks.pages.length);
        expect(query.totalItems).toBe(400);
        expect(ids(query.items.slice(0, 400))).toEqual(reference.all.slice(0, 400));
    });

    test("clears the token once the last page arrived", async ({ query, hooks }) => {
        await query.items.toArrayAsync();
        hooks.pages.length = 0;

        await query.service.executeQuery(query.parent, query);

        expect(hooks.pages).toHaveLength(1);
        expect(hooks.pages[0].continuation).toBe(null);
    });

    test("atAsync past the real end resolves to undefined and closes the total", async ({ query, hooks, reference }) => {
        const item = await query.items.atAsync(5000);

        expect(item).toBe(undefined);
        expect(hooks.pages.map(p => p.continuation)).toEqual(["offset:100"]);
        expect(query.hasMore).toBe(false);
        expect(query.totalItems).toBe(LIMIT);
        expect(query.items.length).toBe(LIMIT);
        expect(ids(query.items)).toEqual(reference.all);
    });
});

test.describe("getItems of a continuation query", () => {
    test("resolves far ahead to the requested window", async ({ query, hooks, reference }) => {
        const items = await _internal(query).getItems(500, 100);

        expect(ids(items)).toEqual(reference.all.slice(500, 600));
        expect(hooks.pages).toEqual([{ continuation: "offset:100", top: 500 }]);
        expect(query.totalItems).toBe(600);
    });
});

test.describe("A search while a continuation page loads", () => {
    test("keeps the old page out of the search result", async ({ query, hooks, reference }) => {
        const held = hooks.hold("offset:100");
        const pageLoad = query.items.atAsync(150);
        await held.requested;

        query.textSearch = SEARCH;
        const search = query.search();
        held.release();
        await Promise.all([pageLoad, search]);

        expect(hooks.pages.map(p => p.continuation)).toEqual(["offset:100", null]);
        expect(query.hasMore).toBe(true);
        expect(query.totalItems).toBe(100);
        expect(query.items.length).toBe(100);
        expect(ids(query.items)).toEqual(reference.search.slice(0, 100));
    });

    test("pages the search from its own token", async ({ query, hooks, reference }) => {
        const held = hooks.hold("offset:100");
        const pageLoad = query.items.atAsync(150);
        await held.requested;

        query.textSearch = SEARCH;
        const search = query.search();
        held.release();
        await Promise.all([pageLoad, search]);

        const items = await query.items.toArrayAsync();

        expect(ids(items)).toEqual(reference.search);
        expect(hooks.pages.slice(0, 3).map(p => p.continuation)).toEqual(["offset:100", null, "offset:100"]);
        expect(new Set(hooks.pages.slice(2).map(p => p.continuation)).size).toBe(hooks.pages.length - 2);
        expect(query.hasMore).toBe(false);
        expect(query.totalItems).toBe(reference.search.length);
    });
});

test.describe("An empty last page of a continuation query", () => {
    test("drops the + from the total label", async ({ query, hooks }) => {
        // The rows end after the full page that handed out the token "offset:1200", so that token answers an empty last page
        hooks.rewrite = (continuation, result) => {
            if (continuation === "offset:1200") {
                result.items = [];
                result.totalItems = 1200;
                result.continuation = null;
            }
        };

        const items = await query.items.toArrayAsync();

        expect(items).toHaveLength(1200);
        expect(hooks.pages.slice(-2).map(p => p.continuation)).toEqual(["offset:1100", "offset:1200"]);
        expect(query.hasMore).toBe(false);
        expect(query.totalItems).toBe(1200);
        expect(query.labelWithTotalItems).toBe("1.200 People");
    });
});

test.describe("Select-all on a query with an unknown total", () => {
    test("is not available while the total is unknown", async ({ query }) => {
        expect(query.hasMore).toBe(true);
        expect(query.selectAll.isAvailable).toBe(false);

        query.selectAll.allSelected = true;
        expect(query.selectAll.allSelected).toBe(false);
    });

    test("becomes available, and says so, once the last page is in", async ({ query }) => {
        const changes: string[] = [];
        (query.selectAll as any).propertyChanged.attach((_, args) => changes.push(args.propertyName));

        await query.items.toArrayAsync();
        expect(query.hasMore).toBe(false);
        expect(query.selectAll.isAvailable).toBe(true);
        expect(changes).toContain("isAvailable");

        query.selectAll.allSelected = true;
        expect(query.selectAll.allSelected).toBe(true);
    });

    test("turns off when a search makes the total unknown again", async ({ query }) => {
        await query.items.toArrayAsync();
        query.selectAll.allSelected = true;

        await query.search();
        expect(query.hasMore).toBe(true);
        expect(query.selectAll.isAvailable).toBe(false);
        expect(query.selectAll.allSelected).toBe(false);
        expect(query.selectedItems).toHaveLength(0);
    });

    test("becomes available once, when both the limit is gone and the total is known", async ({ query }) => {
        const changes: [unknown, unknown][] = [];
        (query.selectAll as any).propertyChanged.attach((_, args) => {
            if (args.propertyName === "isAvailable")
                changes.push([args.newValue, args.oldValue]);
        });

        query.maxSelectedItems = 1;
        query.maxSelectedItems = undefined;
        expect(changes).toEqual([]);

        query.maxSelectedItems = 1;
        await query.items.toArrayAsync();
        expect(query.hasMore).toBe(false);
        expect(changes).toEqual([]);

        query.maxSelectedItems = undefined;
        expect(changes).toEqual([[true, false]]);
    });
});

test.describe("Select-all and a refresh that keeps the selection", () => {
    test("keeps the selected rows when the new result has an unknown total", async ({ query }) => {
        await query.items.toArrayAsync();
        query.selectAll.allSelected = true;

        // The refresh answers with the first page again, so the total is unknown
        await query.search({ keepSelection: true });
        expect(query.hasMore).toBe(true);
        expect(query.selectAll.allSelected).toBe(false);
        expect(ids(query.selectedItems)).toEqual(ids(query.items.slice(0, 100)));
    });

    test("does not announce an availability it does not have", async ({ query }) => {
        const changes: string[] = [];
        (query.selectAll as any).propertyChanged.attach((_, args) => changes.push(args.propertyName));

        expect(query.hasMore).toBe(true);
        query.selectAll.isAvailable = false;
        query.selectAll.isAvailable = true;
        expect(changes).not.toContain("isAvailable");
    });
});

test.describe("Select-all when a page makes the total unknown", () => {
    test("turns off without a new search", async ({ query, hooks }) => {
        // The search answers its first page with a known total, the next page with a token again
        let first = true;
        hooks.rewrite = (_, result) => {
            if (!first)
                return;

            first = false;
            result.totalItems = 1000;
            result.continuation = null;
        };

        await query.search();
        expect(query.hasMore).toBe(false);
        query.selectAll.allSelected = true;
        expect(query.selectAll.allSelected).toBe(true);

        await query.items.atAsync(150);
        expect(query.hasMore).toBe(true);
        expect(query.selectAll.isAvailable).toBe(false);
        expect(query.selectAll.allSelected).toBe(false);
        expect(query.selectedItems).toHaveLength(0);
    });
});

test.describe("Select-all after a result without paging", () => {
    test("is available again once a result has every row", async ({ query, hooks }) => {
        expect(query.hasMore).toBe(true);

        // The next search answers all its rows at once, without paging
        hooks.rewrite = (_, result) => {
            result.pageSize = 0;
            result.continuation = null;
            result.totalItems = result.items.length;
        };

        const changes: string[] = [];
        (query.selectAll as any).propertyChanged.attach((_, args) => changes.push(args.propertyName));

        await query.search();
        expect(query.hasMore).toBe(false);
        expect(query.selectAll.isAvailable).toBe(true);
        expect(changes).toContain("isAvailable");

        query.selectAll.allSelected = true;
        expect(query.selectAll.allSelected).toBe(true);
    });
});
