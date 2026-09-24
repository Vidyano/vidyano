import { test, expect, Page } from '@playwright/test';
import { setupPage } from '../_helpers/page';
import { startBackend, stopBackend, BackendProcess } from '../_helpers/backend';

let backend: BackendProcess | undefined;

test.describe.serial('Streaming action from a client operation', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }, testInfo) => {
        backend = await startBackend(testInfo);
        sharedPage = await browser.newPage();
        await setupPage(sharedPage, '', backend.port);

        // A real app, so everything between the click and the dialog is the app's own code.
        // Only the two things a person would do are supplied, answering a prompt and being shown a dialog.
        await sharedPage.evaluate(() => {
            (window as any).startApp = async () => {
                const app = document.createElement('vi-app') as any;

                document.body.appendChild(app);
                await new Promise<void>(resolve => {
                    const ready = () => app.service ? resolve() : setTimeout(ready, 50);
                    ready();
                });

                const seen: { asked: string | null; dialog: any; service: any } = { asked: null, dialog: null, service: app.service };
                
                (window as any).seen = seen;
                app.showMessageDialog = (options: any) => {
                    seen.asked = options.title;
                    // Return the position of the answer.
                    return Promise.resolve(options.actions.indexOf('Yes'));
                };
                app.showDialog = (shown: any) => seen.dialog = shown;
                await app.service.signInUsingDefaultCredentials();
                return app.service;
            };

            (window as any).run = async (action: string) => {
                const service = await (window as any).startApp();
                const query = await service.getQuery('Tickets');

                await query.search();
                await service.executeAction(action, null, query, [], undefined);
            };
        });
    });

    test.afterAll(async () => {
        await sharedPage?.close();
        await stopBackend(backend);
    });

    test('confirming the action streams to a success notification', async () => {
        await sharedPage.evaluate(() => (window as any).run('Query.Confirm'));
        // The operation is queued, drained a turn later, and the action it names takes a second.
        await sharedPage.waitForFunction(() => !!(window as any).seen?.dialog?.notificationObject?.notification, null, { timeout: 20000 });

        const result = await sharedPage.evaluate(() => {
            const { asked, dialog } = (window as any).seen;

            return {
                asked,
                content: dialog.content,
                notification: dialog.notificationObject.notification,
                notificationType: dialog.notificationObject.notificationType
            };
        });

        expect(result.asked).toBe('Confirm');
        expect(result.content).toBe('Working\n');
        expect(result.notification).toBe('All done');
        expect(result.notificationType).toBe('OK');
    });

    test('an operation sent inside the stream is routed, not rendered', async () => {
        await sharedPage.evaluate(() => (window as any).run('Query.StreamThenAct'));
        await sharedPage.waitForFunction(() => !!(window as any).seen?.dialog?.notificationObject?.notification, null, { timeout: 20000 });

        // The operation frame is consumed rather than shown, so only the real message reaches the dialog.
        expect(await sharedPage.evaluate(() => (window as any).seen.dialog.content)).toBe('Working\n');

        // The action the operation named runs on its own, so its effect is polled for rather than awaited.
        await expect.poll(async () => sharedPage.evaluate(async () => {
            const query = await (window as any).seen.service.getQuery('Tickets');
            await query.search();

            return (await query.items.atAsync(0)).getValue('Title');
        }), { timeout: 20000 }).toBe('Flagged');
    });
});
