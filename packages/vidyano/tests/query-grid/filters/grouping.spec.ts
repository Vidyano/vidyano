import { expect, Locator, Page } from '@playwright/test';
import { getScrollOffset, gridPage, mountGrid, scrollGrid, test, waitForGridReady, waitForQueryIdle } from '../_helpers/query-grid';
import { rows, scrollerBox, settle } from '../_helpers/grid';
import { distinctItem, openFilter, totalItems } from '../_helpers/filters';

async function setup(page: Page) {
    await gridPage(page);
    return mountGrid(page);
}

/** Groups the grid by a column through the column header menu. */
async function groupBy(grid: Locator, column: string, label: string) {
    const header = grid.locator(`vi-query-grid-column-header[name="${column}"]`);
    await header.locator('vi-button[icon="CaretDown"]').filter({ visible: true }).first().click();
    await header.getByText(`Group by ${label}`, { exact: true }).click();
    await expect(grid).toHaveAttribute('has-grouping');
    await waitForGridReady(grid);
}

function grouping(grid: Locator) {
    return grid.locator('vi-query-grid-grouping');
}

/** Opens the grouping menu and clicks an item by its label. */
async function chooseGrouping(grid: Locator, label: 'Collapse all' | 'Expand all' | 'Remove grouping') {
    await grouping(grid).locator('vi-button[icon="QueryGrid_Group"]').click();
    const item = grouping(grid).getByText(label, { exact: true });
    await expect(item).toBeVisible();
    await item.click();
}

/** isCollapsed of every group in the model, in group order. */
async function collapsedGroups(grid: Locator) {
    return grid.evaluate((g: any) => g.query.groupingInfo.groups.map((gr: any) => gr.isCollapsed as boolean));
}

/** The visible group rows as { label, collapsed }. */
async function groupRows(grid: Locator) {
    return (await rows(grid)).filter(r => r.isGroup).map(r => ({ label: r.groupLabel, collapsed: r.collapsed }));
}

/** Clicks the visible group header row of the group with this name. */
async function clickGroup(grid: Locator, name: string) {
    await grid.locator('vi-query-grid-row[is-group] vi-query-grid-row-group').filter({ visible: true }).filter({ hasText: new RegExp(`^\\s*${name} \\(`) }).click();
}

test.describe('Rendering', () => {
    test('grouping control is hidden until the query is grouped', { annotation: [{ type: 'case', description: 'filters.gr-absent-without-grouping' }] }, async ({ page }) => {
        const grid = await setup(page);
        await expect(grid.locator('vi-query-grid-grouping')).toBeHidden();
        await expect(grid).not.toHaveAttribute('has-grouping');

        await groupBy(grid, 'Gender', 'Gender');
        await expect(grid.locator('vi-query-grid-grouping')).toBeVisible();

        const firstGroup = grid.locator('vi-query-grid-row-group').filter({ visible: true }).first();
        await expect(firstGroup).toHaveText(/^\s*Female \(4587\)\s*$/);
    });

    test('menu lists Collapse all, Expand all, separator, Remove grouping', { annotation: [{ type: 'case', description: 'filters.gr-menu-items' }] }, async ({ page }) => {
        const grid = await setup(page);
        await groupBy(grid, 'Gender', 'Gender');

        const grouping = grid.locator('vi-query-grid-grouping');
        await grouping.locator('vi-button[icon="QueryGrid_Group"]').click();
        await expect(grouping.getByText('Collapse all', { exact: true })).toBeVisible();

        const items = await grouping.evaluate((host: Element) => {
            const deep = (root: ParentNode, out: Element[] = []): Element[] => {
                for (const el of root.querySelectorAll('*')) {
                    out.push(el);
                    if (el.shadowRoot)
                        deep(el.shadowRoot, out);
                }

                return out;
            };

            return deep(host.shadowRoot!)
                .filter(el => /^VI-POPUP-MENU-ITEM/.test(el.tagName) && el.checkVisibility())
                .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
                .map(el => el.tagName === 'VI-POPUP-MENU-ITEM-SEPARATOR' ? 'separator' : `${(el as any).label}|${el.getAttribute('icon')}`);
        });

        // The labels are rendered literally (no translation keys)
        for (const label of ['Collapse all', 'Expand all', 'Remove grouping'])
            await expect(grouping.getByText(label, { exact: true })).toBeVisible();

        expect(items).toEqual([
            'Collapse all|QueryGrid_Group_Collapse',
            'Expand all|QueryGrid_Group_Expand',
            'separator',
            'Remove grouping|Remove'
        ]);
    });

    test('grouping button is a row-height square with the group icon', { annotation: [{ type: 'case', description: 'filters.gr-button-render' }] }, async ({ page }) => {
        const grid = await setup(page);
        await groupBy(grid, 'Gender', 'Gender');

        const rowHeight = await grid.evaluate((g: Element) => parseFloat(getComputedStyle(g).getPropertyValue('--vi-query-grid-row-height')));
        expect(rowHeight).toBeGreaterThan(0);

        const button = grouping(grid).locator('vi-button[icon="QueryGrid_Group"]');
        const box = (await button.boundingBox())!;
        expect(Math.abs(box.width - rowHeight)).toBeLessThanOrEqual(1);
        expect(Math.abs(box.height - rowHeight)).toBeLessThanOrEqual(1);
        await expect(button.locator('vi-icon[source="QueryGrid_Group"]')).toBeVisible();
    });

    test('every menu item closes the menu', { annotation: [{ type: 'case', description: 'filters.gr-menu-closes-after-item' }] }, async ({ page }) => {
        const grid = await setup(page);
        await groupBy(grid, 'Gender', 'Gender');

        // The grid stays at scrollTop 0, so the scroll reset of Collapse/Expand all cannot close the menu by itself
        const grouping = grid.locator('vi-query-grid-grouping');
        const collapsed = () => grid.evaluate((g: any) => g.query.groupingInfo.groups.map((gr: any) => gr.isCollapsed));
        const choose = async (label: string) => {
            await grouping.locator('vi-button[icon="QueryGrid_Group"]').click();
            await expect(grouping.getByText(label, { exact: true })).toBeVisible();
            await grouping.getByText(label, { exact: true }).click();
        };
        const expectClosed = async () => {
            await expect(grouping.locator('vi-popup-menu-item').filter({ visible: true })).toHaveCount(0);
            await expect(page.locator('vi-popup[open]')).toHaveCount(0);
        };

        await choose('Collapse all');
        await expectClosed();
        expect(await collapsed()).toEqual([true, true, true]);
        expect((await getScrollOffset(grid)).top).toBe(0);

        await choose('Expand all');
        await expectClosed();
        expect(await collapsed()).toEqual([false, false, false]);

        await choose('Remove grouping');
        await expectClosed();
        await expect(grid).not.toHaveAttribute('has-grouping');
    });
});

test.describe('Collapse and expand', () => {
    test('Collapse/Expand all override individual group toggles', { annotation: [{ type: 'case', description: 'filters.gr-partial-collapse' }] }, async ({ page }) => {
        const grid = await setup(page);
        await groupBy(grid, 'Gender', 'Gender');

        await chooseGrouping(grid, 'Collapse all');
        await expect.poll(() => collapsedGroups(grid)).toEqual([true, true, true]);
        await settle(grid);

        await clickGroup(grid, 'Male');
        await expect.poll(() => collapsedGroups(grid)).toEqual([true, false, true]);
        await settle(grid);
        expect((await groupRows(grid)).slice(0, 2)).toEqual([{ label: 'Female (4587)', collapsed: true }, { label: 'Male (4506)', collapsed: false }]);

        await chooseGrouping(grid, 'Collapse all');
        await expect.poll(() => collapsedGroups(grid)).toEqual([true, true, true]);
        await settle(grid);
        expect(await groupRows(grid)).toEqual([
            { label: 'Female (4587)', collapsed: true },
            { label: 'Male (4506)', collapsed: true },
            { label: 'Unknown (907)', collapsed: true }
        ]);

        await clickGroup(grid, 'Female');
        await expect.poll(() => collapsedGroups(grid)).toEqual([false, true, true]);
        await settle(grid);

        await chooseGrouping(grid, 'Expand all');
        await expect.poll(() => collapsedGroups(grid)).toEqual([false, false, false]);
        await settle(grid);
        const visible = await groupRows(grid);
        expect(visible[0]).toEqual({ label: 'Female (4587)', collapsed: false });
        expect(visible.every(r => !r.collapsed)).toBe(true);
    });

    test('Expand all while scrolled resets the grid to the top', { annotation: [{ type: 'case', description: 'filters.gr-expand-scroll-top' }] }, async ({ page }) => {
        const grid = await setup(page);
        await groupBy(grid, 'Gender', 'Gender');

        await chooseGrouping(grid, 'Collapse all');
        await expect.poll(() => collapsedGroups(grid)).toEqual([true, true, true]);
        await settle(grid);
        await clickGroup(grid, 'Female');
        await expect.poll(() => collapsedGroups(grid)).toEqual([false, true, true]);
        await settle(grid);

        await scrollGrid(grid, { top: 2000 });
        await expect.poll(async () => (await getScrollOffset(grid)).top).toBe(2000);
        await settle(grid);

        await chooseGrouping(grid, 'Expand all');
        await expect.poll(() => collapsedGroups(grid)).toEqual([false, false, false]);
        await expect.poll(async () => (await getScrollOffset(grid)).top).toBe(0);
    });

    test('collapsed groups stay collapsed after a filter re-query', { annotation: [{ type: 'case', description: 'filters.gr-collapse-preserved-search' }] }, async ({ page }) => {
        const grid = await setup(page);
        await groupBy(grid, 'Gender', 'Gender');
        await chooseGrouping(grid, 'Collapse all');
        await expect.poll(() => collapsedGroups(grid)).toEqual([true, true, true]);
        await settle(grid);

        const cf = await openFilter(grid, 'IsActive');
        await distinctItem(cf, 'Yes').click();
        await expect.poll(() => grid.evaluate((g: any) => g.query.getColumn('IsActive').selectedDistincts.length)).toBe(1);
        await waitForQueryIdle(grid);
        await expect(cf).not.toHaveAttribute('loading');
        const total = await totalItems(grid);
        expect(total).toBeLessThan(10000);

        await expect.poll(() => collapsedGroups(grid)).toEqual([true, true, true]);
        await expect(grouping(grid)).toBeVisible();
        await expect(grid).toHaveAttribute('has-grouping');

        const groups = await grid.evaluate((g: any) => g.query.groupingInfo.groups.map((gr: any) => ({ name: gr.name as string, count: gr.count as number })));
        expect(groups.map(gr => gr.name)).toEqual(['Female', 'Male', 'Unknown']);
        expect(groups.reduce((sum, gr) => sum + gr.count, 0)).toBe(total);
        expect(groups.map(gr => gr.count)).not.toEqual([4587, 4506, 907]);

        await page.keyboard.press('Escape');
        await settle(grid);
        expect(await groupRows(grid)).toEqual(groups.map(gr => ({ label: `${gr.name} (${gr.count})`, collapsed: true })));
    });
});

test.describe('Regroup and remove', () => {
    test('regrouping resets the collapsed state', { annotation: [{ type: 'case', description: 'filters.gr-change-grouping' }] }, async ({ page }) => {
        const grid = await setup(page);
        await groupBy(grid, 'Gender', 'Gender');
        await chooseGrouping(grid, 'Collapse all');
        await expect.poll(() => collapsedGroups(grid)).toEqual([true, true, true]);
        await settle(grid);

        await groupBy(grid, 'BirthDate', 'Birth date');
        await expect.poll(() => grid.evaluate((g: any) => g.query.groupingInfo?.groupedBy)).toBe('BirthDate');
        await settle(grid);

        const groups = await grid.evaluate((g: any) => g.query.groupingInfo.groups.map((gr: any) => ({ label: `${gr.name} (${gr.count})`, collapsed: !!gr.isCollapsed })));
        expect(groups).toHaveLength(56);
        expect(groups[0].label).toBe('1945 (166)');
        expect(groups[groups.length - 1].label).toBe('2000 (207)');
        expect(groups.every(gr => !gr.collapsed)).toBe(true);

        expect((await groupRows(grid))[0]).toEqual({ label: '1945 (166)', collapsed: false });
        await expect(grouping(grid)).toBeVisible();
    });

    test('removing a collapsed grouping shows all rows', { annotation: [{ type: 'case', description: 'filters.gr-remove-while-collapsed' }] }, async ({ page }) => {
        const grid = await setup(page);
        await groupBy(grid, 'Gender', 'Gender');
        await chooseGrouping(grid, 'Collapse all');
        await expect.poll(() => collapsedGroups(grid)).toEqual([true, true, true]);
        await settle(grid);

        await chooseGrouping(grid, 'Remove grouping');
        await expect(grid).not.toHaveAttribute('has-grouping');
        await waitForGridReady(grid);
        await settle(grid);

        expect(await totalItems(grid)).toBe(10000);
        const visible = await rows(grid);
        expect(visible.some(r => r.isGroup)).toBe(false);
        expect(visible.length).toBeGreaterThan(10);
        expect(visible.every(r => r.index >= 0)).toBe(true);
        expect(visible[0].index).toBe(0);

        // The plain rows reach the bottom of the viewport
        const view = await scrollerBox(grid);
        expect(visible[visible.length - 1].bottom).toBeGreaterThanOrEqual(view.bottom - 1);
    });
});

test.describe('Busy state and popups', () => {
    test('grouping menu is disabled while the query is busy', { annotation: [{ type: 'case', description: 'filters.gr-busy' }] }, async ({ page }) => {
        const grid = await setup(page);
        await groupBy(grid, 'Gender', 'Gender');
        const cf = await openFilter(grid, 'IsActive');

        let release!: () => void;
        const held = new Promise<void>(resolve => release = resolve);
        let holding = false;
        await page.route('**/ExecuteQuery', async route => {
            holding = true;
            await held;
            await route.continue();
        });

        const button = grouping(grid).locator('vi-button[icon="QueryGrid_Group"]');
        try {
            // The click starts the search, which is held until release()
            await distinctItem(cf, 'Yes').click();
            await expect.poll(() => holding).toBe(true);
            expect(await grid.evaluate((g: any) => g.query.isBusy)).toBe(true);
            await page.keyboard.press('Escape');
            await expect(cf.locator('vi-popup[open]')).toHaveCount(0);

            await expect(button).toHaveAttribute('disabled');
            await button.click({ force: true });
            await expect(grouping(grid).getByText('Collapse all', { exact: true })).toBeHidden();
        }
        finally {
            release();
        }

        await waitForQueryIdle(grid);
        await page.unroute('**/ExecuteQuery');

        await expect(button).not.toHaveAttribute('disabled');
        await button.click();
        await expect(grouping(grid).getByText('Collapse all', { exact: true })).toBeVisible();
    });
});
