import { test, expect, Locator } from '@playwright/test';
import { BASE, nextFrames, openView, requestLog } from '../_helpers/query-grid';
import { clickQueryHeader, itemDisplay, openPopups, rowForItem, VIEW_MATRIX } from '../_helpers/views';

const selectedLabel = (grid: Locator) => grid.page().locator('vi-query vi-action-bar .selected-items vi-button');

async function selectedIds(grid: Locator) {
    return grid.evaluate((g: any) => g.query.selectedItems.map((i: any) => i.id));
}

async function displayedRowsSelected(grid: Locator) {
    return grid.evaluate((g: any) => [...g.shadowRoot.querySelectorAll('vi-query-grid-row:not([is-group])')]
        .filter((r: any) => getComputedStyle(r).display !== 'none' && !r.classList.contains('hidden'))
        .map((r: any) => r.hasAttribute('selected')));
}

/** The names of the action buttons in a row's open inline actions popup. */
async function inlineActions(row: Locator) {
    const popup = row.locator('[part=actions]');
    await expect(popup).toHaveAttribute('open', '');
    // Only the popup's own buttons: the children of an action group render inside the group button
    return popup.evaluate(p => [...p.querySelectorAll('vi-action-button:not([hidden])')]
        .filter(b => !b.parentElement?.closest('vi-action-button'))
        .map(b => `${b.getAttribute('name')}${b.hasAttribute('disabled') ? ' (disabled)' : ''}`));
}

test.describe('Selection, actions and row open', () => {
    for (const view of VIEW_MATRIX.filter(v => v.canSelect)) {
        test(`${view.name} selector clicks select rows and select-all clears them`, { annotation: [{ type: 'case', description: 'gap.views-all-selection-flow' }] }, async ({ page }) => {
            const grid = await openView(page, view.path);
            const first = (await itemDisplay(grid, 0, []))!.id;
            const third = (await itemDisplay(grid, 2, []))!.id;
            const selectAll = grid.locator('vi-query-grid-select-all');

            await (await rowForItem(grid, 0)).locator('[part=selector]').click();
            await (await rowForItem(grid, 2)).locator('[part=selector]').click();

            await expect(await rowForItem(grid, 0)).toHaveAttribute('selected', '');
            await expect(await rowForItem(grid, 2)).toHaveAttribute('selected', '');
            await expect(await rowForItem(grid, 1)).not.toHaveAttribute('selected');
            expect((await selectedIds(grid)).sort()).toEqual([first, third].sort());
            await expect(selectAll).toHaveAttribute('partial', '');
            await expect(selectedLabel(grid)).toHaveAttribute('label', '2 selected');

            const actionBar = page.locator('vi-query vi-action-bar');
            if (view.actionBar?.includes('MoreThanOne'))
                await expect(actionBar.locator('vi-action-button[name=MoreThanOne]')).not.toHaveAttribute('disabled');

            if (view.actionBar?.includes('One'))
                await expect(actionBar.locator('vi-action-button[name=One]')).toHaveAttribute('disabled', '');

            // A second click deselects
            await (await rowForItem(grid, 0)).locator('[part=selector]').click();
            await expect(await rowForItem(grid, 0)).not.toHaveAttribute('selected');
            expect(await selectedIds(grid)).toEqual([third]);

            await selectAll.click();
            await expect.poll(() => selectedIds(grid)).toEqual([]);
            await expect.poll(() => displayedRowsSelected(grid)).not.toContain(true);
            await expect(selectAll).not.toHaveAttribute('partial');
            await expect(selectedLabel(grid)).toBeHidden();

            if (view.selectAll === 'unavailable') {
                // Clicking an unavailable select-all with nothing selected only clears
                await selectAll.click();
                expect(await grid.evaluate((g: any) => [g.query.selectAll.allSelected, g.query.selectedItems.length])).toEqual([false, 0]);
                await expect(selectAll).not.toHaveAttribute('selected');
            }
        });
    }

    for (const view of VIEW_MATRIX.filter(v => v.inline)) {
        test(`${view.name} inline actions popup lists the view's actions`, { annotation: [{ type: 'case', description: 'views.all-inline-popup-contents' }] }, async ({ page }) => {
            const grid = await openView(page, view.path);
            const id = (await itemDisplay(grid, 3, []))!.id;
            const row = await rowForItem(grid, 3);

            await row.locator('[part=actions]').click();

            // Never click the buttons: they would run real actions on People
            expect(await inlineActions(row)).toEqual(view.inline);
            await expect(row).toHaveAttribute('actions-open', '');
            expect(await selectedIds(grid)).toEqual([id]);

            await page.keyboard.press('Escape');
            await expect(row).not.toHaveAttribute('actions-open');
        });
    }

    // Without a selection no action of these views qualifies for a single row
    for (const view of VIEW_MATRIX.filter(v => !v.inline)) {
        test(`${view.name} right-click without qualifying actions opens nothing`, { annotation: [{ type: 'case', description: 'views.all-ctx-no-qualifying-actions' }] }, async ({ page }) => {
            const grid = await openView(page, view.path);

            const row = await rowForItem(grid, 2);
            await row.locator('.column').first().click({ button: 'right' });
            await page.evaluate(() => new Promise(requestAnimationFrame));

            await expect(page.locator('vi-popup[open]')).toHaveCount(0);
            expect(await selectedIds(grid)).toEqual([]);
            await expect(row).not.toHaveAttribute('selected');
        });
    }
});

/** The actions popups the rows open on right-click: the grid hosts them in its own shadow root. */
async function contextPopups(grid: Locator) {
    return grid.evaluate((g: any) => [...g.shadowRoot.children].filter((e: Element) => e.tagName === 'VI-POPUP').map((p: any) => {
        const b = p.getBoundingClientRect();
        return {
            open: p.hasAttribute('open'),
            x: b.x,
            y: b.y,
            actions: [...p.querySelectorAll('vi-action-button:not([hidden])')].filter((a: Element) => !a.parentElement?.closest('vi-action-button')).map((a: Element) => a.getAttribute('name'))
        };
    }));
}

/** Right-clicks the middle of a row's LastName cell and returns the pointer position. */
async function rightClick(row: Locator) {
    const cell = await row.locator('.column').nth(1).boundingBox();
    const point = { x: Math.round(cell!.x + cell!.width / 2), y: Math.round(cell!.y + cell!.height / 2) };
    await row.page().mouse.click(point.x, point.y, { button: 'right' });
    return point;
}

test.describe('Context menu', () => {
    for (const view of VIEW_MATRIX) {
        if (view.inline) {
            test(`${view.name} right-click opens the actions popup at the pointer`, { annotation: [{ type: 'case', description: 'views.all-contextmenu-contents' }] }, async ({ page }) => {
                const grid = await openView(page, view.path);
                const id = (await itemDisplay(grid, 2, []))!.id;
                const row = await rowForItem(grid, 2);

                const point = await rightClick(row);

                await expect.poll(async () => (await contextPopups(grid)).filter(p => p.open).length).toBe(1);
                const popup = (await contextPopups(grid)).find(p => p.open)!;
                // Never click the buttons: they would run real actions on People
                expect(popup.actions).toEqual(view.inline);
                expect(Math.abs(popup.x - point.x)).toBeLessThanOrEqual(2);
                expect(Math.abs(popup.y - point.y)).toBeLessThanOrEqual(2);
                await expect(row).toHaveAttribute('actions-open', '');
                expect(await selectedIds(grid)).toEqual([id]);

                await page.keyboard.press('Escape');
                await expect.poll(async () => (await contextPopups(grid)).filter(p => p.open).length).toBe(0);
                await expect(row).not.toHaveAttribute('actions-open');
            });
        }
        else {
            test(`${view.name} right-click without qualifying actions opens nothing`, { annotation: [{ type: 'case', description: 'views.all-contextmenu-contents' }, { type: 'case', description: 'views.all-contextmenu-no-actions' }] }, async ({ page }) => {
                const grid = await openView(page, view.path);
                const row = await rowForItem(grid, 2);

                await rightClick(row);
                await nextFrames(page, 3);

                expect(await openPopups(grid)).toEqual([]);
                expect(await contextPopups(grid)).toEqual([]);
                await expect(row).not.toHaveAttribute('actions-open');
                await expect(row).not.toHaveAttribute('selected');
                expect(await selectedIds(grid)).toEqual([]);
            });
        }
    }
});

test.describe('QueryGrid_Filter', () => {
    test('QueryGrid_Filter clicking the empty prefix opens the row', { annotation: [{ type: 'case', description: 'views.filter-prefix-click' }] }, async ({ page }) => {
        const grid = await openView(page, 'components/query-grid_filter');
        const item = (await itemDisplay(grid, 0, []))!;
        expect(item.id).toBe('3');

        const row = await rowForItem(grid, 0);
        await row.locator('[part=filter]').click();

        await expect(page).toHaveURL(`${BASE}/components/person/3`);
        expect(await grid.evaluate((g: any) => g.query.selectedItems.length)).toBe(0);
    });
});

test.describe('People', () => {
    for (const name of ['People', 'PeopleTop10'] as const) {
        const view = VIEW_MATRIX.find(v => v.name === name)!;
        const total = view.totalItems;
        const formatted = total.toLocaleString('nl-BE');

        test(`${name} select-all selects all, inverts and clears`, { annotation: [{ type: 'case', description: 'views.people-select-all' }] }, async ({ page }) => {
            const log = requestLog(page);
            const grid = await openView(page, view.path);
            await log.quiet();
            log.clear();

            const selectAll = grid.locator('vi-query-grid-select-all');
            await selectAll.click();

            await expect.poll(() => grid.evaluate((g: any) => [g.query.selectAll.allSelected, g.query.selectAll.inverse, g.query.selectedItemCount])).toEqual([true, false, total]);
            await expect.poll(() => displayedRowsSelected(grid)).not.toContain(false);
            await expect(selectAll).toHaveAttribute('selected', '');
            await expect(selectAll).not.toHaveAttribute('partial');
            await expect(selectedLabel(grid)).toHaveAttribute('label', `${formatted} selected`);

            await (await rowForItem(grid, 1)).locator('[part=selector]').click();
            await expect.poll(() => grid.evaluate((g: any) => [g.query.selectAll.inverse, g.query.selectedItemCount])).toEqual([true, total - 1]);
            await expect(await rowForItem(grid, 1)).not.toHaveAttribute('selected');
            await expect(selectAll).toHaveAttribute('partial', '');
            await expect(selectedLabel(grid)).toHaveAttribute('label', `${(total - 1).toLocaleString('nl-BE')} selected`);

            await selectAll.click();
            await expect.poll(() => grid.evaluate((g: any) => [g.query.selectAll.allSelected, g.query.selectAll.inverse, g.query.selectedItemCount])).toEqual([false, false, 0]);
            await expect.poll(() => displayedRowsSelected(grid)).not.toContain(true);
            await expect(selectAll).not.toHaveAttribute('selected');
            await expect(selectAll).not.toHaveAttribute('partial');

            await log.quiet();
            expect(log.of('ExecuteQuery')).toEqual([]);
        });
    }

    test('People inline actions popup opens, selects the row and closes', { annotation: [{ type: 'case', description: 'views.people-inline-popup' }] }, async ({ page }) => {
        const grid = await openView(page, 'home/people');
        const id = (await itemDisplay(grid, 3, []))!.id;
        const row = await rowForItem(grid, 3);

        for (const close of ['Escape', 'header'] as const) {
            await row.locator('[part=actions]').click();
            expect(await inlineActions(row), close).toEqual(['BulkEdit', 'Delete', 'TestActionsGroup']);
            await expect(row).toHaveAttribute('actions-open', '');
            expect(await selectedIds(grid)).toEqual([id]);

            if (close === 'Escape')
                await page.keyboard.press('Escape');
            else
                await clickQueryHeader(page);

            await expect(row.locator('[part=actions]'), close).not.toHaveAttribute('open');
            await expect(row, close).not.toHaveAttribute('actions-open');
            expect(await selectedIds(grid), close).toEqual([id]);
        }
    });
});
