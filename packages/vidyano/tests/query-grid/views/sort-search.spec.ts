import { test, expect, Locator } from '@playwright/test';
import { getScrollOffset, openView, savedSettings, visibleRows, waitForGridReady } from '../_helpers/query-grid';
import { box, clickQueryHeader, expectAligned, hostVar, PEOPLE_COLUMNS, rowHeight, settle, VIEW_MATRIX, wheelGrid } from '../_helpers/views';
import { clickDistinct, columnFilter, filterLabel, filtersControl, openFilter, openFiltersMenu, totalItems } from '../_helpers/filters';

/** Counts every time the host gets [initializing] from now on. */
async function watchInitializing(grid: Locator) {
    await grid.evaluate((g: any) => {
        g.__pwInitializingAdds = 0;
        new MutationObserver(records => records.forEach(r => g.hasAttribute('initializing') && r.oldValue === null && g.__pwInitializingAdds++))
            .observe(g, { attributes: true, attributeFilter: ['initializing'], attributeOldValue: true });
    });

    return () => grid.evaluate((g: any) => g.__pwInitializingAdds as number);
}

async function search(grid: Locator, hasSearchBox: boolean, text: string) {
    if (hasSearchBox) {
        const input = grid.page().locator('vi-query vi-action-bar vi-input-search input');
        await input.fill(text);
        await input.press('Enter');
    }
    else {
        await grid.evaluate(async (g: any, text) => {
            g.query.textSearch = text;
            await g.query.search();
        }, text);
    }
}

test.describe('Sort, search and filter', () => {
    for (const view of VIEW_MATRIX) {
        test(`${view.name} header click sorts descending and keeps the layout`, { annotation: [{ type: 'case', description: 'views.all-sort-header-click' }] }, async ({ page }) => {
            const grid = await openView(page, view.path);
            const queryId = await grid.evaluate((g: any) => g.query.id);
            const columns = await hostVar(grid, '--vi-query-grid-columns');
            const controls = await hostVar(grid, '--vi-query-grid-controls-width');

            if (view.totalItems > 100) {
                await wheelGrid(page, grid, 0, 3200);
                await settle(grid);
                expect((await getScrollOffset(grid)).top).toBeGreaterThan(0);
            }

            const initializingAdds = await watchInitializing(grid);
            await grid.locator('vi-query-grid-column-header[name=FirstName] .label').click();

            await expect.poll(() => grid.evaluate((g: any) => g.query.sortOptions.map((o: any) => `${o.name} ${o.direction}`))).toEqual(['FirstName DESC']);
            await waitForGridReady(grid);

            // The sort icon shows SortDesc
            await expect(grid.locator('vi-query-grid-column-header[name=FirstName] vi-icon[source=SortDesc]')).toBeVisible();

            expect((await getScrollOffset(grid)).top).toBe(0);
            const rows = await visibleRows(grid);
            expect(rows[0].index).toBe(0);
            // PeopleTop10 sorts its own 10 rows, so its first row differs from the other views
            expect(rows[0].texts.slice(0, 2)).toEqual(view.name === 'PeopleTop10' ? ['Siebe', 'Claes'] : ['Zoë', 'Decoster']);

            expect(await hostVar(grid, '--vi-query-grid-columns')).toBe(columns);
            expect(await hostVar(grid, '--vi-query-grid-controls-width')).toBe(controls);
            await expectAligned(grid, 'sorted');
            expect(await initializingAdds()).toBe(0);

            const saves = await savedSettings(page);
            expect(saves).toHaveLength(1);
            expect(saves[0].QuerySettings[queryId].sortOptions).toBe('FirstName DESC');
        });

        test(`${view.name} ctrl+click adds a secondary sort`, { annotation: [{ type: 'case', description: 'views.all-sort-multisort' }] }, async ({ page }) => {
            const grid = await openView(page, view.path);
            const queryId = await grid.evaluate((g: any) => g.query.id);
            const columns = await hostVar(grid, '--vi-query-grid-columns');
            const sortOptions = () => grid.evaluate((g: any) => g.query.sortOptions.map((o: any) => `${o.name} ${o.direction}`));

            await grid.locator('vi-query-grid-column-header[name=FirstName] .label').click();
            await expect.poll(sortOptions).toEqual(['FirstName DESC']);
            await waitForGridReady(grid);

            await grid.locator('vi-query-grid-column-header[name=LastName] .label').click({ modifiers: ['Control'] });
            await expect.poll(sortOptions).toEqual(['FirstName DESC', 'LastName ASC']);
            await waitForGridReady(grid);

            const rows = await visibleRows(grid);
            expect(rows[0].index).toBe(0);
            if (view.name === 'PeopleTop10')
                expect(rows[0].texts.slice(0, 2)).toEqual(['Siebe', 'Claes']);
            else
                expect(rows[0].texts.slice(0, 2)).toEqual(['Zoë', 'Claes']);

            expect(await hostVar(grid, '--vi-query-grid-columns')).toBe(columns);
            await expectAligned(grid, 'multi-sorted');

            const saves = await savedSettings(page);
            expect(saves).toHaveLength(2);
            expect(saves[1].QuerySettings[queryId].sortOptions).toMatch(/^FirstName DESC;\s*LastName ASC$/);
        });

        if (view.canFilter) {
            test(`${view.name} filtering Gender = Female narrows rows and keeps the layout`, { annotation: [{ type: 'case', description: 'gap.views-all-column-filter-flow' }] }, async ({ page }) => {
                const grid = await openView(page, view.path);
                const columns = await hostVar(grid, '--vi-query-grid-columns');

                const gender = await openFilter(grid, 'Gender');
                await clickDistinct(gender, 'Female');
                await expect.poll(() => filterLabel(gender)).toBe('= Female');
                await clickQueryHeader(page);
                await expect(gender.locator('vi-popup[open]')).toHaveCount(0);

                const total = await totalItems(grid);
                expect(total).toBeGreaterThan(0);
                expect(total).toBeLessThan(view.totalItems);
                await waitForGridReady(grid);

                const genders = (await visibleRows(grid)).map(r => r.texts[PEOPLE_COLUMNS.indexOf('Gender')]);
                expect(genders.length).toBeGreaterThan(0);
                expect(new Set(genders)).toEqual(new Set(['Female']));

                for (const name of PEOPLE_COLUMNS)
                    await expect(columnFilter(grid, name), name).toHaveAttribute('query-filtering', '');

                expect(await hostVar(grid, '--vi-query-grid-columns')).toBe(columns);
                await expectAligned(grid, 'filtered');

                await openFiltersMenu(grid);
                await filtersControl(grid).getByText('Reset', { exact: true }).click();
                await expect.poll(() => totalItems(grid)).toBe(view.totalItems);
                await expect.poll(() => filterLabel(gender)).toBe('');
                await waitForGridReady(grid);
                await expectAligned(grid, 'reset');
            });
        }

        test(`${view.name} search shrinks the result and keeps widths`, { annotation: [{ type: 'case', description: 'views.all-search' }] }, async ({ page }) => {
            const grid = await openView(page, view.path);
            const rh = await rowHeight(grid);
            const columns = await hostVar(grid, '--vi-query-grid-columns');

            if (view.totalItems > 100) {
                await wheelGrid(page, grid, 0, 3200);
                await settle(grid);
            }

            const initializingAdds = await watchInitializing(grid);
            await search(grid, view.search, 'Aaron');

            await expect.poll(() => grid.evaluate((g: any) => g.query.textSearch)).toBe('Aaron');
            await waitForGridReady(grid);
            const total = await grid.evaluate((g: any) => g.query.totalItems);
            if (view.name === 'PeopleTop10') {
                expect(total).toBeGreaterThan(0);
                expect(total).toBeLessThanOrEqual(10);
            }
            else
                expect(total).toBe(110);

            expect((await getScrollOffset(grid)).top).toBe(0);
            expect((await visibleRows(grid))[0].index).toBe(0);
            expect(await hostVar(grid, '--vi-query-grid-columns')).toBe(columns);
            await expectAligned(grid, 'searched');

            await wheelGrid(page, grid, 0, total * rh + 1000);
            await settle(grid);
            const rows = await visibleRows(grid);
            expect(rows.at(-1)!.index).toBe(total - 1);
            await expectAligned(grid, 'bottom');
            expect(await initializingAdds()).toBe(0);
        });

        test(`${view.name} search without matches keeps the header`, { annotation: [{ type: 'case', description: 'views.all-search-no-results' }] }, async ({ page }) => {
            const grid = await openView(page, view.path);
            const header = await box(grid.locator('header').first());
            const controls = await box(grid.locator('header .controls'));
            const columns = await hostVar(grid, '--vi-query-grid-columns');
            const initializingAdds = await watchInitializing(grid);

            await search(grid, false, 'zzzzqqq');
            await expect.poll(() => grid.evaluate((g: any) => g.query.totalItems)).toBe(0);
            await waitForGridReady(grid);

            expect(await visibleRows(grid)).toEqual([]);
            expect(await box(grid.locator('header').first())).toEqual(header);
            expect(await box(grid.locator('header .controls'))).toEqual(controls);
            expect(await hostVar(grid, '--vi-query-grid-columns')).toBe(columns);
            await expect(grid).not.toHaveAttribute('initializing');
            await expect(grid.locator('vi-spinner').filter({ visible: true })).toHaveCount(0);
            expect(await initializingAdds()).toBe(0);

            await search(grid, false, '');
            await expect.poll(() => grid.evaluate((g: any) => g.query.totalItems)).toBe(view.totalItems);
            await waitForGridReady(grid);
            const rows = await visibleRows(grid);
            expect(rows[0].index).toBe(0);
            expect(rows[0].texts.slice(0, 2)).toEqual(['Aaron', 'Lemmens']);
        });
    }
});
