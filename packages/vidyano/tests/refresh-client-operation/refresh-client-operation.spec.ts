import { test, expect, Page } from '@playwright/test';
import { setupPage } from '../_helpers/page';
import { startBackend, stopBackend, BackendProcess } from '../_helpers/backend';

let backend: BackendProcess | undefined;

test.describe.serial('Refresh client operation', () => {
    let sharedPage: Page;
    let executeQueries: number[] = [];
    let getPersistentObjects = 0;

    test.beforeAll(async ({ browser }, testInfo) => {
        backend = await startBackend(testInfo);
        sharedPage = await browser.newPage();
        await setupPage(sharedPage, '', backend.url);

        sharedPage.on('request', request => {
            if (request.url().endsWith('/ExecuteQuery'))
                executeQueries.push(Date.now());
            else if (request.url().endsWith('/GetPersistentObject'))
                getPersistentObjects++;
        });

        // A real app that shows the Tickets list, as if the user opened it
        await sharedPage.evaluate(async () => {
            const app = document.createElement('vi-app') as any;
            // Absolute, so the service is not reached relative to the path the app navigates to
            app.uri = location.origin;
            document.body.appendChild(app);
            await new Promise<void>(resolve => {
                const ready = () => app.service ? resolve() : setTimeout(ready, 50);
                ready();
            });

            await app.service.signInUsingDefaultCredentials();
            const queryId = (await app.service.getQuery('Tickets')).id;
            const project = await app.service.getPersistentObject(null, 'Mock_Project', '1');

            const until = (check: () => any) => new Promise<void>(resolve => {
                const poll = () => check() ? resolve() : setTimeout(poll, 50);
                poll();
            });
            const shown = (presenter: string) => app.shadowRoot.querySelector(`vi-app-route.active > ${presenter}`);

            // Opening a list or a persistent object navigates to it, closing navigates away
            (window as any).openList = async () => {
                app.changePath(`query.${queryId}`);
                await until(() => shown('vi-query-presenter')?.query?.hasSearched);
                (window as any).query = shown('vi-query-presenter').query;
            };
            (window as any).openProject = async () => {
                app.changePath(`persistent-object.${project.id}/${project.objectId}`);
                await until(() => shown('vi-persistent-object-presenter')?.persistentObject);
                const q = (window as any).projectTickets = shown('vi-persistent-object-presenter').persistentObject.queries[0];
                await until(() => q.hasSearched);
            };
            (window as any).goHome = async () => {
                app.changePath('');
                await until(() => !shown('vi-query-presenter') && !shown('vi-persistent-object-presenter'));
            };
            (window as any).signOut = () => app.service.signOut();

            (window as any).refresh = (delay?: number) => app.service.hooks.onClientOperation({ type: 'Refresh', queryId, delay });
            (window as any).refreshProjectTickets = (delay?: number) => app.service.hooks.onClientOperation({ type: 'Refresh', queryId: (window as any).projectTickets.id, delay });
            (window as any).refreshProject = (delay?: number) => app.service.hooks.onClientOperation({ type: 'Refresh', fullTypeName: project.fullTypeName, objectId: project.objectId, delay });
            // Starts a search without waiting for it; settled() waits for the last one
            (window as any).search = () => { (window as any).lastSearch = (window as any).query.search(); };
            (window as any).settled = () => (window as any).lastSearch.then(() => { });

            await (window as any).openList();
        });
    });

    test.beforeEach(() => {
        executeQueries = [];
        getPersistentObjects = 0;
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

    test('a delayed refresh also searches a list closed during the delay', async () => {
        await sharedPage.evaluate(() => (window as any).openList());
        executeQueries = [];

        await sharedPage.evaluate(() => (window as any).refresh(1000));
        await sharedPage.evaluate(() => (window as any).goHome());

        await expect.poll(() => executeQueries.length, { timeout: 5000 }).toBe(1);
    });

    test('a delayed refresh searches a list in a persistent object once the delay ends', async () => {
        await sharedPage.evaluate(() => (window as any).openProject());
        executeQueries = [];

        await sharedPage.evaluate(() => (window as any).refreshProjectTickets(1000));

        await sharedPage.waitForTimeout(500);
        expect(executeQueries).toHaveLength(0);

        await expect.poll(() => executeQueries.length, { timeout: 5000 }).toBe(1);

        await sharedPage.waitForTimeout(500);
        expect(executeQueries).toHaveLength(1);
    });

    test('a delayed refresh also searches a list whose persistent object was closed during the delay', async () => {
        await sharedPage.evaluate(() => (window as any).openProject());
        executeQueries = [];

        await sharedPage.evaluate(() => (window as any).refreshProjectTickets(1000));
        await sharedPage.evaluate(() => (window as any).goHome());

        await expect.poll(() => executeQueries.length, { timeout: 5000 }).toBe(1);
    });

    test('a delayed refresh of a persistent object reloads it once the delay ends', async () => {
        await sharedPage.evaluate(() => (window as any).openProject());
        getPersistentObjects = 0;

        await sharedPage.evaluate(() => (window as any).refreshProject(1000));

        await sharedPage.waitForTimeout(500);
        expect(getPersistentObjects).toBe(0);

        await expect.poll(() => getPersistentObjects, { timeout: 5000 }).toBe(1);
    });

    test('a delayed refresh of a persistent object also reloads it when it was closed during the delay', async () => {
        await sharedPage.evaluate(() => (window as any).openProject());
        getPersistentObjects = 0;

        await sharedPage.evaluate(() => (window as any).refreshProject(1000));
        await sharedPage.evaluate(() => (window as any).goHome());

        await expect.poll(() => getPersistentObjects, { timeout: 5000 }).toBe(1);
    });

    // Signs out, so it runs last
    test('a delayed refresh does not search after signing out during the delay', async () => {
        await sharedPage.evaluate(() => (window as any).openList());
        executeQueries = [];

        await sharedPage.evaluate(() => (window as any).refresh(1000));
        await sharedPage.evaluate(() => (window as any).signOut());

        await sharedPage.waitForTimeout(2000);
        expect(executeQueries).toHaveLength(0);
    });

});
