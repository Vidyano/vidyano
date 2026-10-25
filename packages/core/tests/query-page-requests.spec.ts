import { test as base, expect } from "@playwright/test";
import { Service, ServiceHooks, Query } from "@vidyano/core";
import { devBackendUrl } from "./_helpers/dev-backend";

/**
 * People (10,000 rows, 100 per page): a page is requested once, also when a range that crosses it was asked for
 * while its own request was still waiting for the server.
 */

/** Records the skip and top of every ExecuteQuery request and holds the responses until the gate opens. */
class PageHooks extends ServiceHooks {
    sent: [skip: number, top: number][] = [];
    gate: Promise<void> | null = null;

    override async onFetch(request: Request): Promise<Response> {
        if (!request.url.endsWith("/ExecuteQuery"))
            return super.onFetch(request);

        const body = await request.clone().json();
        this.sent.push([body.query.skip ?? 0, body.query.top]);

        if (this.gate)
            await this.gate;

        return super.onFetch(request);
    }
}

type Fixtures = {
    hooks: PageHooks;
    query: Query;
};

const test = base.extend<Fixtures>({
    hooks: async ({}, use) => {
        await use(new PageHooks());
    },

    query: async ({ hooks }, use) => {
        const service = new Service(devBackendUrl(), hooks, false);
        await service.initialize(true);
        await service.signInUsingCredentials("admin", "admin");

        const query = await service.getQuery("People");
        await query.search();
        hooks.sent = [];
        await use(query);
    },
});

/** Holds every page response until the returned function is called */
function hold(hooks: PageHooks): () => void {
    let open: () => void;
    hooks.gate = new Promise<void>(resolve => open = resolve);

    return () => {
        hooks.gate = null;
        open();
    };
}

test.describe("Ranges asked for while a page is on its way", () => {
    test("a range that starts on a requested page only requests the next one", async ({ query, hooks }) => {
        const release = hold(hooks);
        const loads = [
            query.items.atAsync(150),
            query.items.atAsync([180, 230]),
            query.items.atAsync([280, 330]),
        ];
        await expect.poll(() => hooks.sent.length).toBe(1);
        release();
        await Promise.all(loads);

        expect(hooks.sent).toEqual([[100, 100], [200, 100], [300, 100]]);
        expect(query.items.slice(100, 400).every(item => item != null)).toBe(true);
    });

    test("a range that ends on a requested page only requests the one before it", async ({ query, hooks }) => {
        const release = hold(hooks);
        const loads = [
            query.items.atAsync(350),
            query.items.atAsync([250, 350]),
        ];
        await expect.poll(() => hooks.sent.length).toBe(1);
        release();
        await Promise.all(loads);

        expect(hooks.sent).toEqual([[300, 100], [200, 100]]);
        expect(query.items.slice(200, 400).every(item => item != null)).toBe(true);
    });

    test("a range of loaded pages requests nothing", async ({ query, hooks }) => {
        const release = hold(hooks);
        const loads = [
            query.items.atAsync([150, 250]),
            query.items.atAsync(150),
            query.items.atAsync(250),
        ];
        await expect.poll(() => hooks.sent.length).toBe(1);
        release();
        await Promise.all(loads);

        expect(hooks.sent).toEqual([[100, 200]]);
    });

    test("indexes on pages apart load each page once", async ({ query, hooks }) => {
        const release = hold(hooks);
        const loads = [
            query.items.atAsync(150),
            query.items.atAsync([150, 550]),
        ];
        await expect.poll(() => hooks.sent.length).toBe(1);
        release();
        await Promise.all(loads);

        expect(hooks.sent).toEqual([[100, 100], [500, 100]]);
        expect(query.items[550]).not.toBeNull();
    });
});
