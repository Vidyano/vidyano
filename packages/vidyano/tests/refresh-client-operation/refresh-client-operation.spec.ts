import { test, expect, Page } from '@playwright/test';
import { setupPage } from '../_helpers/page';
import { startBackend, stopBackend, BackendProcess } from '../_helpers/backend';

let backend: BackendProcess | undefined;

test.describe.serial('Refresh client operation for a query', () => {
    let sharedPage: Page;
    let executeQueries: number[] = [];

    test.beforeAll(async ({ browser }, testInfo) => {
        backend = await startBackend(testInfo);
        sharedPage = await browser.newPage();
        await setupPage(sharedPage, '', backend.url);

        sharedPage.on('request', request => {
            if (request.url().endsWith('/ExecuteQuery'))
                executeQueries.push(Date.now());
        });

        // A real app with the Tickets query in its cache, as if the user opened it
        await sharedPage.evaluate(async () => {
            const app = document.createElement('vi-app') as any;
            document.body.appendChild(app);
            await new Promise<void>(resolve => {
                const ready = () => app.service ? resolve() : setTimeout(ready, 50);
                ready();
            });

            await app.service.signInUsingDefaultCredentials();
            const query = await app.service.getQuery('Tickets');
            await query.search();

            // The app's cache entry classes are not on window, so take the one a refresh looks up with (a refresh starts with that lookup)
            let AppCacheEntryQuery: any;
            const cachePing = app.cachePing;
            app.cachePing = (entry: any) => (AppCacheEntryQuery = entry.constructor, null);
            app.service.hooks.onClientOperation({ type: 'Refresh', queryId: query.id });
            app.cachePing = cachePing;

            const entry = new AppCacheEntryQuery(query.id);
            entry.query = query;
            app.cache(entry);

            (window as any).refresh = (delay?: number) => app.service.hooks.onClientOperation({ type: 'Refresh', queryId: query.id, delay });
            // Starts a search without waiting for it; settled() waits for the last one
            (window as any).search = () => { (window as any).lastSearch = query.search(); };
            (window as any).settled = () => (window as any).lastSearch.then(() => { });
        });
    });

    test.beforeEach(() => {
        executeQueries = [];
    });

    test.afterAll(async () => {
        await sharedPage?.close();
        await stopBackend(backend);
    });

    test('a refresh without a delay searches at once, once', async () => {
        await sharedPage.evaluate(() => (window as any).refresh());
        await expect.poll(() => executeQueries.length).toBe(1);

        await sharedPage.waitForTimeout(500);
        expect(executeQueries).toHaveLength(1);
    });

    test('a refresh with a delay searches once the delay ends', async () => {
        const start = Date.now();
        await sharedPage.evaluate(() => (window as any).refresh(1000));

        await sharedPage.waitForTimeout(500);
        expect(executeQueries).toHaveLength(0);

        await expect.poll(() => executeQueries.length, { timeout: 5000 }).toBe(1);
        expect(executeQueries[0] - start).toBeGreaterThanOrEqual(900);

        await sharedPage.waitForTimeout(500);
        expect(executeQueries).toHaveLength(1);
    });

    test('a search during the delay does not drop the refresh', async () => {
        // Long enough for the search to finish first, also on a busy backend
        await sharedPage.evaluate(() => (window as any).refresh(3000));
        await sharedPage.evaluate(() => (window as any).search());
        await sharedPage.evaluate(() => (window as any).settled());
        await expect.poll(() => executeQueries.length).toBe(1);

        await expect.poll(() => executeQueries.length, { timeout: 5000 }).toBe(2);
    });

    test('a refresh still searches when its query is searching as the delay ends', async () => {
        // The search started during the delay takes long, so it is still running when the refresh is due
        await sharedPage.route('**/ExecuteQuery', async route => {
            await new Promise(resolve => setTimeout(resolve, 2500));
            await route.continue();
        }, { times: 1 });

        // The search starts well before the refresh is due and is held past it
        await sharedPage.evaluate(() => (window as any).refresh(2000));
        await sharedPage.waitForTimeout(500);
        await sharedPage.evaluate(() => (window as any).search());

        await expect.poll(() => executeQueries.length, { timeout: 5000 }).toBe(2);
        await sharedPage.evaluate(() => (window as any).settled());
    });

});
