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

interface TestDialogOptions {
    title?: string;
    content?: string;
    showCloseButton?: boolean;
    noCancelOnOutsideClick?: boolean;
    noCancelOnEscKey?: boolean;
    anchorTag?: string;
}

async function setupPage(page: Page) {
    await page.setContent(dialogHtml);
    await page.addScriptTag({ path: "dev/wwwroot/index.js", type: 'module' });
    await page.waitForFunction(() => !!customElements.get('vi-test-dialog'), { timeout: 10000 });
}

async function createTestDialog(page: Page, options: TestDialogOptions = {}): Promise<Locator> {
    const componentId = `dialog-${Math.random().toString(36).substring(2, 15)}`;

    await page.evaluate(({ componentId, options }) => {
        const container = document.getElementById('test-container');
        if (!container)
            throw new Error('Test container not found');

        const TestDialog = customElements.get('vi-test-dialog') as any;
        const dialog = new TestDialog();
        dialog.id = componentId;

        if (options.title !== undefined)
            dialog.title = options.title;
        if (options.content !== undefined)
            dialog.content = options.content;
        if (options.showCloseButton !== undefined)
            dialog.showCloseButton = options.showCloseButton;
        if (options.noCancelOnOutsideClick !== undefined)
            dialog.noCancelOnOutsideClick = options.noCancelOnOutsideClick;
        if (options.noCancelOnEscKey !== undefined)
            dialog.noCancelOnEscKey = options.noCancelOnEscKey;
        if (options.anchorTag !== undefined)
            dialog.anchorTag = options.anchorTag;

        container.appendChild(dialog);
    }, { componentId, options });

    return page.locator(`#${componentId}`);
}

async function openDialog(dialog: Locator): Promise<void> {
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

test.describe.serial('Dialog', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test('opens and displays content', async () => {
        const dialog = await createTestDialog(sharedPage, {
            title: 'Test Title',
            content: 'Test Content'
        });

        await openDialog(dialog);

        const header = dialog.locator('header h4');
        await expect(header).toHaveText('Test Title');

        const main = dialog.locator('main');
        await expect(main).toHaveText('Test Content');

        await closeDialog(dialog);
    });

    test('open() returns promise that resolves when dialog closes', async () => {
        const dialog = await createTestDialog(sharedPage);

        const resultPromise = dialog.evaluate(node => (node as any).open());
        await dialog.locator('dialog').waitFor({ state: 'visible' });

        await dialog.locator('#close-btn').click();

        const result = await resultPromise;
        expect(result).toBe('closed');
    });

    test('close() resolves open promise with provided result', async () => {
        const dialog = await createTestDialog(sharedPage);

        const resultPromise = dialog.evaluate(node => (node as any).open());
        await dialog.locator('dialog').waitFor({ state: 'visible' });

        await dialog.evaluate(node => (node as any).close('custom-result'));

        const result = await resultPromise;
        expect(result).toBe('custom-result');
    });

    test('cancel() resolves open promise with undefined', async () => {
        const dialog = await createTestDialog(sharedPage);

        const resultPromise = dialog.evaluate(node => (node as any).open());
        await dialog.locator('dialog').waitFor({ state: 'visible' });

        await dialog.locator('#cancel-btn').click();

        const result = await resultPromise;
        expect(result).toBeUndefined();
    });

    test('renders close button when showCloseButton is true', async () => {
        const dialog = await createTestDialog(sharedPage, {
            showCloseButton: true
        });

        await openDialog(dialog);

        const closeButton = dialog.locator('header vi-button.close');
        await expect(closeButton).toBeVisible();

        await closeDialog(dialog);
    });

    test('close button calls cancel()', async () => {
        const dialog = await createTestDialog(sharedPage, {
            showCloseButton: true
        });

        const resultPromise = dialog.evaluate(node => (node as any).open());
        await dialog.locator('dialog').waitFor({ state: 'visible' });

        const closeButton = dialog.locator('header vi-button.close');
        const box = await closeButton.boundingBox();
        await sharedPage.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

        const result = await resultPromise;
        expect(result).toBeUndefined();
    });

    test('ESC key cancels dialog when noCancelOnEscKey is false', async () => {
        const dialog = await createTestDialog(sharedPage, {
            noCancelOnEscKey: false
        });

        const resultPromise = dialog.evaluate(node => (node as any).open());
        await dialog.locator('dialog').waitFor({ state: 'visible' });

        await sharedPage.keyboard.press('Escape');

        const result = await resultPromise;
        expect(result).toBeUndefined();
    });

    test('ESC key does not cancel dialog when noCancelOnEscKey is true', async () => {
        const dialog = await createTestDialog(sharedPage, {
            noCancelOnEscKey: true
        });

        await openDialog(dialog);

        await sharedPage.keyboard.press('Escape');

        // Dialog should still be open
        const dialogElement = dialog.locator('dialog');
        await expect(dialogElement).toBeVisible();

        await closeDialog(dialog);
    });

    test('outside click closes dialog when noCancelOnOutsideClick is false', async () => {
        const dialog = await createTestDialog(sharedPage, {
            noCancelOnOutsideClick: false
        });

        const resultPromise = dialog.evaluate(node => (node as any).open());
        await dialog.locator('dialog').waitFor({ state: 'visible' });

        // Click on the backdrop (outside the dialog content)
        const dialogElement = dialog.locator('dialog');
        const box = await dialogElement.boundingBox();
        // Click at position 1,1 which should be on the backdrop
        await sharedPage.mouse.click(1, 1);

        const result = await resultPromise;
        expect(result).toBeUndefined();
    });

    test('outside click does not close dialog when noCancelOnOutsideClick is true (default)', async () => {
        const dialog = await createTestDialog(sharedPage, {
            noCancelOnOutsideClick: true
        });

        await openDialog(dialog);

        // Click on the backdrop
        await sharedPage.mouse.click(1, 1);

        // Dialog should still be open
        const dialogElement = dialog.locator('dialog');
        await expect(dialogElement).toBeVisible();

        await closeDialog(dialog);
    });

    test('can drag dialog by header', async () => {
        const dialog = await createTestDialog(sharedPage, {
            title: 'Draggable Dialog'
        });

        await openDialog(dialog);

        const header = dialog.locator('header h4');
        const dialogEl = dialog.locator('dialog');

        const initialBox = await dialogEl.boundingBox();
        const headerBox = await header.boundingBox();

        const startX = headerBox!.x + headerBox!.width / 2;
        const startY = headerBox!.y + headerBox!.height / 2;

        await sharedPage.mouse.move(startX, startY);
        await sharedPage.mouse.down();
        await sharedPage.mouse.move(startX + 100, startY + 50, { steps: 10 });
        await sharedPage.mouse.up();

        const finalBox = await dialogEl.boundingBox();

        // Dialog should have moved approximately 100px right and 50px down
        expect(finalBox!.x).toBeGreaterThanOrEqual(initialBox!.x + 50);
        expect(finalBox!.y).toBeGreaterThanOrEqual(initialBox!.y + 25);

        await closeDialog(dialog);
    });

    test('dialog stays sticky to mouse pointer during drag', async () => {
        const dialog = await createTestDialog(sharedPage, {
            title: 'Sticky Dialog'
        });

        await openDialog(dialog);

        const header = dialog.locator('header h4');
        const headerBox = await header.boundingBox();

        const startX = headerBox!.x + 20;
        const startY = headerBox!.y + 10;

        await sharedPage.mouse.move(startX, startY);
        await sharedPage.mouse.down();

        const moves = [
            { x: startX + 50, y: startY + 30 },
            { x: startX + 100, y: startY + 60 },
            { x: startX + 150, y: startY + 20 },
        ];

        for (const move of moves) {
            await sharedPage.mouse.move(move.x, move.y);
            const currentHeaderBox = await header.boundingBox();

            const actualX = currentHeaderBox!.x + 20;
            const actualY = currentHeaderBox!.y + 10;

            // Allow 1px tolerance for rounding
            expect(Math.abs(actualX - move.x)).toBeLessThanOrEqual(1);
            expect(Math.abs(actualY - move.y)).toBeLessThanOrEqual(1);
        }

        await sharedPage.mouse.up();
        await closeDialog(dialog);
    });

    test('sets isDragging state during drag', async () => {
        const dialog = await createTestDialog(sharedPage);

        await openDialog(dialog);

        const header = dialog.locator('header h4');
        const headerBox = await header.boundingBox();

        const startX = headerBox!.x + headerBox!.width / 2;
        const startY = headerBox!.y + headerBox!.height / 2;

        // Before drag
        let isDragging = await dialog.evaluate(node => (node as any).isDragging);
        expect(isDragging).toBe(false);

        await sharedPage.mouse.move(startX, startY);
        await sharedPage.mouse.down();

        // During drag
        isDragging = await dialog.evaluate(node => (node as any).isDragging);
        expect(isDragging).toBe(true);

        await sharedPage.mouse.up();

        // After drag
        isDragging = await dialog.evaluate(node => (node as any).isDragging);
        expect(isDragging).toBe(false);

        await closeDialog(dialog);
    });

    test('does not start drag when clicking interactive elements in header', async () => {
        const dialog = await createTestDialog(sharedPage, {
            showCloseButton: true
        });

        await openDialog(dialog);

        const dialogEl = dialog.locator('dialog');
        const initialBox = await dialogEl.boundingBox();

        const closeButton = dialog.locator('header vi-button.close');
        const buttonBox = await closeButton.boundingBox();

        // Start a drag from the close button position
        const startX = buttonBox!.x + buttonBox!.width / 2;
        const startY = buttonBox!.y + buttonBox!.height / 2;

        await sharedPage.mouse.move(startX, startY);
        await sharedPage.mouse.down();
        await sharedPage.mouse.move(startX + 100, startY + 50, { steps: 5 });
        await sharedPage.mouse.up();

        const finalBox = await dialogEl.boundingBox();

        // Dialog should NOT have moved because we clicked on a button
        expect(finalBox!.x).toBeCloseTo(initialBox!.x, 0);
        expect(finalBox!.y).toBeCloseTo(initialBox!.y, 0);
    });

    test('anchorTag property controls which element is draggable', async () => {
        const dialog = await createTestDialog(sharedPage, {
            anchorTag: 'footer'
        });

        await openDialog(dialog);

        const dialogEl = dialog.locator('dialog');
        const initialBox = await dialogEl.boundingBox();

        // Try dragging by header (should not work)
        const header = dialog.locator('header h4');
        const headerBox = await header.boundingBox();

        await sharedPage.mouse.move(headerBox!.x + 10, headerBox!.y + 10);
        await sharedPage.mouse.down();
        await sharedPage.mouse.move(headerBox!.x + 110, headerBox!.y + 60, { steps: 5 });
        await sharedPage.mouse.up();

        let afterHeaderDragBox = await dialogEl.boundingBox();
        // Should not have moved
        expect(afterHeaderDragBox!.x).toBeCloseTo(initialBox!.x, 0);
        expect(afterHeaderDragBox!.y).toBeCloseTo(initialBox!.y, 0);

        await closeDialog(dialog);
    });
});
