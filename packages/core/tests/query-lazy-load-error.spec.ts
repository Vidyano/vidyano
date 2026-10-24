import { test as base, expect } from "@playwright/test";
import { Service, ServiceHooks, Query } from "@vidyano/core";
import { devBackendUrl } from "./_helpers/dev-backend";

/**
 * People (10,000 rows, pageSize 100): a lazy page load that fails.
 * The failure is reported through the query's notification, so it must not also escape as an unhandled rejection.
 */

/** Counts the ExecuteQuery requests and can make them fail like a network error. */
class FailingHooks extends ServiceHooks {
    executeQueries = 0;
    fail = false;

    override async onFetch(request: Request): Promise<Response> {
        if (request.url.endsWith("/ExecuteQuery")) {
            this.executeQueries++;
            if (this.fail)
                throw new TypeError("Failed to fetch");
        }

        return super.onFetch(request);
    }
}

type Fixtures = {
    hooks: FailingHooks;
    query: Query;
    unhandled: unknown[];
};

const test = base.extend<Fixtures>({
    hooks: async ({}, use) => {
        await use(new FailingHooks());
    },

    query: async ({ hooks }, use) => {
        const service = new Service(devBackendUrl(), hooks, false);
        await service.initialize(true);
        await service.signInUsingCredentials("admin", "admin");
        await use(await service.getQuery("People"));
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

test.describe("A failed lazy page load", () => {
    test("sets the notification without an unhandled rejection", async ({ query, hooks, unhandled }) => {
        const executeQueries = hooks.executeQueries;
        hooks.fail = true;

        expect(query.items[5000]).toBeNull();
        await expect.poll(() => hooks.executeQueries).toBe(executeQueries + 1);
        await expect.poll(() => query.notification).toBe("Failed to fetch");

        // An unhandled rejection is reported after the rejected promise settles
        await new Promise(resolve => setTimeout(resolve, 100));
        expect(unhandled.map(String)).toEqual([]);
        expect(loadedItem(query, 5000)).toBeUndefined();
    });

    test("loads the page on the next access", async ({ query, hooks, unhandled }) => {
        const executeQueries = hooks.executeQueries;
        hooks.fail = true;

        expect(query.items[5000]).toBeNull();
        await expect.poll(() => query.notification).toBe("Failed to fetch");

        hooks.fail = false;
        expect(query.items[5000]).toBeNull();
        await expect.poll(() => loadedItem(query, 5000) != null).toBe(true);
        expect(hooks.executeQueries).toBe(executeQueries + 2);
        expect(unhandled.map(String)).toEqual([]);
    });
});
