import { test, expect, Page, Locator } from '@playwright/test';

const dialogHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          :not(:defined) { display: none; }
        </style>
      </head>
      <body>
        <div id="test-container"></div>
      </body>
    </html>
`;

interface MessageDialogOptions {
    noClose?: boolean;
    title?: string;
    titleIcon?: string;
    actions?: string[];
    actionTypes?: string[];
    defaultAction?: number;
    cancelAction?: number;
    message: string;
    extraClasses?: string[];
    rich?: boolean;
}

async function setupPage(page: Page) {
    await page.setContent(dialogHtml);
    await page.addScriptTag({ path: "dev/wwwroot/index.js", type: 'module' });
    await page.waitForFunction(() => !!customElements.get('vi-message-dialog'), { timeout: 10000 });
}

async function createMessageDialog(page: Page, options: MessageDialogOptions): Promise<Locator> {
    const componentId = `dialog-${Math.random().toString(36).substring(2, 15)}`;

    await page.evaluate(({ componentId, options }) => {
        const container = document.getElementById('test-container');
        if (!container)
            throw new Error('Test container not found');

        const MessageDialog = customElements.get('vi-message-dialog') as any;
        const dialog = new MessageDialog(options);
        dialog.id = componentId;
        container.appendChild(dialog);
    }, { componentId, options });

    return page.locator(`#${componentId}`);
}

async function openDialog(dialog: Locator): Promise<void> {
    // Don't await open() as it only resolves when dialog closes
    await dialog.evaluate(node => { (node as any).open(); });
    await dialog.locator('dialog').waitFor({ state: 'visible' });
}

async function closeDialog(dialog: Locator): Promise<void> {
    await dialog.evaluate(node => {
        const nativeDialog = (node as any).shadowRoot?.querySelector('dialog');
        if (nativeDialog)
            nativeDialog.close();
    });
}

test.describe.serial('MessageDialog', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test('renders with title and message', async () => {
        const dialog = await createMessageDialog(sharedPage, {
            title: 'Test Title',
            message: 'Test message content',
            actions: ['OK']
        });

        await openDialog(dialog);

        const header = dialog.locator('header h4');
        await expect(header).toHaveText('Test Title');

        const message = dialog.locator('main pre');
        await expect(message).toHaveText('Test message content');

        await closeDialog(dialog);
    });

    test('renders multiple action buttons', async () => {
        const dialog = await createMessageDialog(sharedPage, {
            title: 'Confirm',
            message: 'Are you sure?',
            actions: ['Cancel', 'OK']
        });

        await openDialog(dialog);

        const buttons = dialog.locator('footer vi-button');
        await expect(buttons).toHaveCount(2);
        await expect(buttons.nth(0)).toHaveAttribute('label', 'Cancel');
        await expect(buttons.nth(1)).toHaveAttribute('label', 'OK');

        await closeDialog(dialog);
    });

    test('returns action index when clicking action button', async () => {
        const dialog = await createMessageDialog(sharedPage, {
            title: 'Choose',
            message: 'Pick one',
            actions: ['First', 'Second', 'Third']
        });

        const resultPromise = dialog.evaluate(node => (node as any).open());
        await dialog.locator('dialog').waitFor({ state: 'visible' });

        const secondButton = dialog.locator('footer vi-button').nth(1);
        await secondButton.click();

        const result = await resultPromise;
        expect(result).toBe(1);
    });

    test('shows close button when noClose is false', async () => {
        const dialog = await createMessageDialog(sharedPage, {
            title: 'Closeable',
            message: 'Has close button',
            actions: ['OK'],
            noClose: false,
            cancelAction: 0
        });

        await openDialog(dialog);

        const closeButton = dialog.locator('header vi-button.close');
        await expect(closeButton).toBeVisible();

        await closeDialog(dialog);
    });

    test('closes dialog when clicking close button', async () => {
        const dialog = await createMessageDialog(sharedPage, {
            title: 'Click Close',
            message: 'Click the X to close',
            actions: ['OK'],
            noClose: false,
            cancelAction: 0
        });

        const resultPromise = dialog.evaluate(node => (node as any).open());
        await dialog.locator('dialog').waitFor({ state: 'visible' });

        const closeButton = dialog.locator('header vi-button.close');
        const box = await closeButton.boundingBox();
        await sharedPage.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

        const result = await resultPromise;
        expect(result).toBe(0);
    });

    test('hides close button when noClose is true', async () => {
        const dialog = await createMessageDialog(sharedPage, {
            title: 'Not Closeable',
            message: 'No close button',
            actions: ['OK'],
            noClose: true
        });

        await openDialog(dialog);

        const closeButton = dialog.locator('header vi-button.close');
        await expect(closeButton).toHaveCount(0);

        await closeDialog(dialog);
    });

    test('renders title icon when provided', async () => {
        const dialog = await createMessageDialog(sharedPage, {
            title: 'With Icon',
            titleIcon: 'Notification_Warning',
            message: 'Warning message',
            actions: ['OK']
        });

        await openDialog(dialog);

        const icon = dialog.locator('header > vi-icon');
        await expect(icon).toBeVisible();
        await expect(icon).toHaveAttribute('source', 'Notification_Warning');

        await closeDialog(dialog);
    });

    test('renders rich content with markdown', async () => {
        const dialog = await createMessageDialog(sharedPage, {
            title: 'Rich Content',
            message: '**Bold** and *italic*',
            actions: ['OK'],
            rich: true
        });

        await openDialog(dialog);

        const marked = dialog.locator('main vi-marked');
        await expect(marked).toBeVisible();

        await closeDialog(dialog);
    });

    test('sets default action on construction', async () => {
        const dialog = await createMessageDialog(sharedPage, {
            title: 'Default Action',
            message: 'Second button is default',
            actions: ['Cancel', 'OK'],
            defaultAction: 1
        });

        const activeAction = await dialog.evaluate(node => (node as any).activeAction);
        expect(activeAction).toBe(1);
    });

    test('returns cancelAction when calling cancel()', async () => {
        const dialog = await createMessageDialog(sharedPage, {
            title: 'Cancel Test',
            message: 'Cancel should return cancel action',
            actions: ['No', 'Yes'],
            cancelAction: 0
        });

        const resultPromise = dialog.evaluate(node => (node as any).open());
        await dialog.locator('dialog').waitFor({ state: 'visible' });

        await dialog.evaluate(node => (node as any).cancel());

        const result = await resultPromise;
        expect(result).toBe(0);
    });

    test('navigates actions with arrow keys', async () => {
        const dialog = await createMessageDialog(sharedPage, {
            title: 'Navigation',
            message: 'Use arrow keys',
            actions: ['One', 'Two', 'Three'],
            defaultAction: 0
        });

        await openDialog(dialog);

        // Simulate arrow right key navigation
        await dialog.evaluate(node => {
            (node as any)._keyboardNextAction();
        });

        const activeAction = await dialog.evaluate(node => (node as any).activeAction);
        expect(activeAction).toBe(1);

        await closeDialog(dialog);
    });

    test('wraps navigation at boundaries', async () => {
        const dialog = await createMessageDialog(sharedPage, {
            title: 'Wrap Navigation',
            message: 'Arrow wraps around',
            actions: ['One', 'Two', 'Three'],
            defaultAction: 2
        });

        await openDialog(dialog);

        // Navigate right from last action (should wrap to first)
        await dialog.evaluate(node => {
            (node as any)._keyboardNextAction();
        });

        const activeAction = await dialog.evaluate(node => (node as any).activeAction);
        expect(activeAction).toBe(0);

        await closeDialog(dialog);
    });

    test('closes dialog with ESC key when cancelAction is set', async () => {
        const dialog = await createMessageDialog(sharedPage, {
            title: 'ESC Test',
            message: 'Press ESC to cancel',
            actions: ['Cancel', 'OK'],
            cancelAction: 0,
            noClose: false
        });

        const resultPromise = dialog.evaluate(node => (node as any).open());
        await dialog.locator('dialog').waitFor({ state: 'visible' });

        await sharedPage.keyboard.press('Escape');

        const result = await resultPromise;
        expect(result).toBe(0);
    });

    test('closes dialog with ESC key without explicit cancelAction', async () => {
        const dialog = await createMessageDialog(sharedPage, {
            title: 'ESC Test No Cancel Action',
            message: 'Press ESC to cancel',
            actions: ['OK'],
            noClose: false
        });

        const resultPromise = dialog.evaluate(node => (node as any).open());
        await dialog.locator('dialog').waitFor({ state: 'visible' });

        await sharedPage.keyboard.press('Escape');

        const result = await resultPromise;
        expect(result).toBeUndefined();
    });

    test('navigates backwards with arrow left', async () => {
        const dialog = await createMessageDialog(sharedPage, {
            title: 'Back Navigation',
            message: 'Arrow left goes back',
            actions: ['One', 'Two', 'Three'],
            defaultAction: 1
        });

        await openDialog(dialog);

        // Navigate left
        await dialog.evaluate(node => {
            (node as any)._keyboardPreviousAction();
        });

        const activeAction = await dialog.evaluate(node => (node as any).activeAction);
        expect(activeAction).toBe(0);

        await closeDialog(dialog);
    });

});
