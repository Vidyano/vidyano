import { test as base, expect } from "@playwright/test";
import { Service, ServiceHooks, Query } from "@vidyano/core";
import { devBackendUrl } from "./_helpers/dev-backend";

/**
 * QueryGrid_ReorderLarge (250 rows in Offset order, more than one page): reordering replaces the result.
 * Reordering changes the in-memory dev data, so every test resets it with PersistentObject.ResetTest.
 */

/** Records the skip and text search of every ExecuteQuery request, and can run code while an ExecuteAction request is sent. */
class ReorderHooks extends ServiceHooks {
    skips: number[] = [];
    textSearches: string[] = [];
    duringAction: (() => void) | null = null;

    override async onFetch(request: Request): Promise<Response> {
        if (request.url.endsWith("/ExecuteQuery")) {
            const query = (await request.clone().json()).query;
            this.skips.push(query.skip ?? 0);
            this.textSearches.push(query.textSearch || "");
        }
        else if (request.url.endsWith("/ExecuteAction"))
            this.duringAction?.();

        return super.onFetch(request);
    }
}

type Fixtures = {
    hooks: ReorderHooks;
    query: Query;
};

const test = base.extend<Fixtures>({
    hooks: async ({}, use) => {
        await use(new ReorderHooks());
    },

    query: async ({ hooks }, use) => {
        const service = new Service(devBackendUrl(), hooks, false);
        await service.initialize(true);
        await service.signInUsingCredentials("admin", "admin");
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

test.describe("Reordering a query with more than one page", () => {
    test("loads the other pages of the new order again", async ({ query, hooks }) => {
        expect(query.canReorder).toBe(true);
        expect(query.totalItems).toBe(250);
        expect(query.pageSize).toBeLessThan(150);

        // Every page is loaded before the reorder
        await query.items.sliceAsync(0, 250);
        const first = loadedItem(query, 0), moved = loadedItem(query, 200), oldRow149 = loadedItem(query, 149);

        // Move row 200 to the top: every row before it moves down by one
        await query.reorder(null, moved, first);
        expect(loadedItem(query, 0).id).toBe(moved.id);
        expect(loadedItem(query, 1).id).toBe(first.id);

        hooks.skips = [];
        const row = await query.items.atAsync(150);
        expect(row.id).toBe(oldRow149.id);
        expect(hooks.skips).toEqual([Math.floor(150 / query.pageSize) * query.pageSize]);
    });

    test("loads the other pages with the text search sent with the reorder", async ({ query, hooks }) => {
        await query.search();
        const first = loadedItem(query, 0), moved = await query.items.atAsync(1);

        // A text search typed while the reorder runs is not part of its result
        hooks.duringAction = () => query.textSearch = "zzzzqqq";
        await query.reorder(null, moved, first);
        hooks.duringAction = null;
        expect(query.textSearch).toBe("zzzzqqq");

        hooks.textSearches = [];
        await query.items.atAsync(150);
        expect(hooks.textSearches).toEqual([""]);
    });
});
