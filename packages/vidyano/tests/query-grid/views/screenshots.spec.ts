import { test, expect, Locator, Page } from '@playwright/test';
import { nextFrames, openView, waitForGridReady } from '../_helpers/query-grid';
import { box, rowForItem, settle, VIEW_MATRIX, wheelGrid } from '../_helpers/views';

/**
 * Screenshots of the app views against per-platform baselines. The mouse is parked
 * outside the grid (hover recolors rows), animations and the caret are disabled.
 */
const SCREENSHOT = { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.002 } as const;

async function ready(page: Page, grid: Locator) {
    await page.evaluate(() => document.fonts.ready);
    await waitForGridReady(grid);
    await page.mouse.move(0, 0);
    await nextFrames(page, 2);
}

async function resize(page: Page, grid: Locator, width: number, height: number) {
    await page.setViewportSize({ width, height });
    await expect.poll(async () => {
        const b = await box(grid);
        return [b.x + b.width, b.y + b.height];
    }).toEqual([width, height]);
    await settle(grid);
}

test.describe('Screenshots', () => {
    test.skip(process.platform !== 'win32', 'Baselines exist for Windows only');

    for (const view of VIEW_MATRIX) {
        test(`${view.name} grid screenshot at 1280x720`, { annotation: [{ type: 'case', description: 'views.all-screenshot-1280' }] }, async ({ page }) => {
            const grid = await openView(page, view.path);
            await ready(page, grid);

            await expect(grid).toHaveScreenshot(`${view.name}-1280.png`, SCREENSHOT);
        });

        test(`${view.name} grid screenshot at 1920x1080`, { annotation: [{ type: 'case', description: 'views.all-screenshot-1920' }] }, async ({ page }) => {
            const grid = await openView(page, view.path, { width: 1920, height: 1080 });
            await ready(page, grid);

            // Every column fits: no more-columns buttons, and the filler track takes the rest
            await expect(grid.locator('.more.right vi-button[icon=ChevronRight]')).toBeHidden();
            await expect(grid.locator('.more.left vi-button[icon=ChevronLeft]')).toBeHidden();
            const filler = await (await rowForItem(grid, 0)).evaluate(r => parseFloat(getComputedStyle(r).gridTemplateColumns.trim().split(/\s+/).at(-1)!));
            expect(filler).toBeGreaterThan(0);

            await expect(grid).toHaveScreenshot(`${view.name}-1920.png`, SCREENSHOT);
        });
    }

    for (const name of ['People', 'QueryGrid_None'] as const) {
        const view = VIEW_MATRIX.find(v => v.name === name)!;

        test(`${name} state screenshots`, { annotation: [{ type: 'case', description: 'views.all-screenshot-states' }] }, async ({ page }) => {
            let grid = await openView(page, view.path);

            // Grouped by BirthDate, through the model so no column menu is part of the picture
            await grid.evaluate(async (g: any) => { await g.query.group('BirthDate'); });
            await expect(grid).toHaveAttribute('has-grouping', '');
            await ready(page, grid);
            await expect(grid).toHaveScreenshot(`${name}-grouped.png`, SCREENSHOT);

            if (name === 'People') {
                grid = await openView(page, view.path);
                for (const index of [0, 2])
                    await (await rowForItem(grid, index)).locator('[part=selector]').click();
                await expect(await rowForItem(grid, 2)).toHaveAttribute('selected', '');
                await ready(page, grid);
                await expect(grid).toHaveScreenshot(`${name}-selected.png`, SCREENSHOT);
            }

            grid = await openView(page, view.path);
            await wheelGrid(page, grid, 300, 0);
            await settle(grid);
            await ready(page, grid);
            await expect(grid).toHaveScreenshot(`${name}-scrolled.png`, SCREENSHOT);

            grid = await openView(page, view.path);
            await resize(page, grid, 800, 600);
            await expect(grid.locator('.more.right vi-button[icon=ChevronRight]')).toBeVisible();
            await ready(page, grid);
            await expect(grid).toHaveScreenshot(`${name}-800.png`, SCREENSHOT);
        });
    }
});
