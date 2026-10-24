import { expect, Locator, test } from '@playwright/test';
import { gridPage, itemValues, mountGrid, pageErrors, visibleRows, waitForGridReady } from '../_helpers/query-grid';
import { boxes, mountPrepared, patchItemHints, rowOf, scrollToRowAndWait, selectAllState, selectedIndexes, setSelected, swapQuery } from '../_helpers/rows';

const case_ = (id: string) => ({ annotation: [{ type: 'case', description: id }] });

function selectAll(grid: Locator) {
    return grid.locator('vi-query-grid-select-all');
}

function selectAllIcon(grid: Locator) {
    return selectAll(grid).locator('vi-icon[source=Selected]');
}

/** Every visible item row is selected and shows a selected selector icon. */
async function visibleItemRowsSelected(grid: Locator) {
    return grid.evaluate((g: any) => {
        const scroller = [...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any;
        const view = scroller.getBoundingClientRect();
        const itemRows = [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].filter((r: any) => {
            const b = r.getBoundingClientRect();
            return getComputedStyle(r).display !== 'none' && b.height > 0 && b.bottom > view.top + 1 && b.top < view.bottom - 1 && !r.hasAttribute('is-group') && !r.classList.contains('loading');
        });

        return {
            count: itemRows.length,
            selected: itemRows.filter((r: any) => r.hasAttribute('selected')).length,
            icons: itemRows.filter((r: any) => r.shadowRoot.querySelector('[part=selector] vi-icon')?.hasAttribute('is-selected')).length
        };
    });
}

test.describe('vi-query-grid-select-all: availability and layout', () => {
    test('[can-select-all] reflects availability and drives visibility (People)', case_('rows.sa-can-select-all-reflects'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        await expect(selectAll(grid)).toHaveAttribute('can-select-all', '');
        await expect(selectAll(grid)).not.toHaveAttribute('partial', '');
        await expect(selectAll(grid)).not.toHaveAttribute('selected', '');
        await expect(selectAllIcon(grid)).toBeVisible();
        await expect(selectAllIcon(grid)).not.toHaveAttribute('is-selected', '');
        await expect(selectAll(grid)).toHaveCSS('cursor', 'pointer');
    });

    test('[can-select-all] reflects availability and drives visibility (QueryGrid_Select)', case_('rows.sa-can-select-all-reflects'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'QueryGrid_Select' });

        await expect(selectAll(grid)).toBeAttached();
        await expect(selectAll(grid)).not.toHaveAttribute('can-select-all', '');
        await expect(selectAll(grid)).not.toHaveAttribute('partial', '');
        await expect(selectAll(grid)).not.toHaveAttribute('selected', '');
        await expect(selectAllIcon(grid)).toHaveCSS('visibility', 'hidden');
        await expect(selectAll(grid)).toHaveCSS('cursor', 'default');
    });

    for (const grouped of [false, true]) {
        test(`select-all sits above the selector column (${grouped ? 'grouped by BirthDate' : 'ungrouped'})`, case_('rows.sa-matrix-aligned'), async ({ page }) => {
            await gridPage(page);
            const grid = await mountGrid(page);
            if (grouped) {
                await page.evaluate(async () => { await (window as any).q.group('BirthDate'); });
                await waitForGridReady(grid);
            }

            const [box] = await boxes(selectAll(grid));
            const [selector] = await boxes((await rowOf(grid, 0)).locator('[part=selector]'));
            const rowHeight = await grid.evaluate((g: any) => parseFloat(getComputedStyle(g).getPropertyValue('--vi-query-grid-row-height')));

            expect(rowHeight).toBeGreaterThan(0);
            expect(Math.abs(box.x - selector.x)).toBeLessThanOrEqual(1);
            expect(Math.abs(box.width - selector.width)).toBeLessThanOrEqual(1);
            expect(Math.abs(box.width - rowHeight)).toBeLessThanOrEqual(1);
        });
    }

    test('select-all shows no count', case_('rows.sa-no-counter'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        await selectAll(grid).click();
        await expect.poll(async () => (await selectAllState(grid)).allSelected).toBe(true);
        await expect(selectAll(grid)).toHaveAttribute('selected', '');

        // Icon only: no text in the element or its shadow root, the count lives in the model
        const text = await selectAll(grid).evaluate((e: Element) => {
            const collect = (root: Node): string => {
                let result = '';
                const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
                for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                    if (!node.parentElement?.closest('style'))
                        result += node.textContent;
                }

                return result;
            };

            return (collect(e) + (e.shadowRoot ? collect(e.shadowRoot) : '')).trim();
        });
        expect(text).toBe('');
        expect((await selectAllState(grid)).selectedItemCount).toBe(10000);
    });
});

test.describe('vi-query-grid-select-all: toggle', () => {
    test('a click selects all', case_('rows.sa-toggle-on'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        await selectAll(grid).click();
        await expect.poll(async () => (await selectAllState(grid)).allSelected).toBe(true);
        await expect(selectAll(grid)).toHaveAttribute('selected', '');
        await expect(selectAll(grid)).not.toHaveAttribute('partial', '');
        await expect(selectAllIcon(grid)).toHaveAttribute('is-selected', '');

        const state = await selectAllState(grid);
        expect(state.selectedItemCount).toBe(10000);
        expect(state.inverse).toBe(false);
        expect(state.selectedItems).toBe(await grid.evaluate((g: any) => {
            const q = g.query;
            q.disableLazyLoading = true;
            try {
                let loaded = 0;
                for (let i = 0; i < q.totalItems; i++) {
                    if (q.items[i])
                        loaded++;
                }

                return loaded;
            }
            finally {
                q.disableLazyLoading = false;
            }
        }));

        await expect.poll(async () => (await visibleItemRowsSelected(grid)).icons).toBeGreaterThan(10);
        const rows = await visibleItemRowsSelected(grid);
        expect(rows.count).toBeGreaterThan(10);
        expect(rows.selected).toBe(rows.count);
        expect(rows.icons).toBe(rows.count);
    });

    test('a second click deselects all', case_('rows.sa-toggle-off'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        await selectAll(grid).click();
        await expect.poll(async () => (await selectAllState(grid)).allSelected).toBe(true);

        await selectAll(grid).click();
        await expect.poll(async () => (await selectAllState(grid)).allSelected).toBe(false);
        expect((await selectAllState(grid)).selectedItems).toBe(0);
        await expect(selectAll(grid)).not.toHaveAttribute('selected', '');
        await expect(selectAllIcon(grid)).not.toHaveAttribute('is-selected', '');
        await expect(grid.locator('vi-query-grid-row[selected]')).toHaveCount(0);
    });

    test('rows loaded after select-all come in selected', case_('rows.sa-grid-new-pages-selected'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        await selectAll(grid).click();
        await expect.poll(async () => (await selectAllState(grid)).allSelected).toBe(true);

        // The page at row 5000 is not loaded yet, so its rows arrive after select-all
        expect(await itemValues(grid, 5000, ['FirstName'])).toBeNull();
        await scrollToRowAndWait(grid, 5000);
        const visible = await visibleRows(grid);
        expect(visible.length).toBeGreaterThan(10);
        expect(visible[0].index).toBeGreaterThanOrEqual(4990);
        expect(visible.every(r => r.index >= 4990 && r.selected)).toBe(true);
    });
});

test.describe('vi-query-grid-select-all: partial and inverse states', () => {
    test('individual selection shows the partial state', case_('rows.sa-partial-from-individual'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        await setSelected(grid, 0, true);
        await expect(selectAll(grid)).toHaveAttribute('partial', '');
        await expect(selectAll(grid)).toHaveAttribute('selected', '');
        await expect(selectAllIcon(grid)).toHaveAttribute('is-selected', '');
        await expect(selectAllIcon(grid)).toHaveCSS('opacity', '0.5');
    });

    test('a click in the partial state clears instead of selecting all', case_('rows.sa-partial-click-clears'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        await setSelected(grid, 0, true);
        await setSelected(grid, 2, true);
        await expect.poll(() => selectedIndexes(grid)).toEqual([0, 2]);
        await expect(selectAll(grid)).toHaveAttribute('partial', '');

        await selectAll(grid).click();
        await expect.poll(() => selectedIndexes(grid)).toEqual([]);
        expect((await selectAllState(grid)).allSelected).toBe(false);
        await expect(selectAll(grid)).not.toHaveAttribute('partial', '');
        await expect(selectAll(grid)).not.toHaveAttribute('selected', '');
    });

    test('deselecting a row after select-all gives the inverse state', case_('rows.sa-inverse-partial'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        await selectAll(grid).click();
        await expect.poll(async () => (await selectAllState(grid)).allSelected).toBe(true);

        const row = await rowOf(grid, 1);
        await row.locator('[part=selector]').click();
        await expect.poll(async () => (await selectAllState(grid)).inverse).toBe(true);
        expect((await selectAllState(grid)).selectedItemCount).toBe(9999);
        await expect(selectAll(grid)).toHaveAttribute('partial', '');
        await expect(selectAll(grid)).toHaveAttribute('selected', '');
        await expect(row).not.toHaveAttribute('selected', '');
    });

    test('a click in the inverse state clears everything', case_('rows.sa-inverse-click-clears'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        await selectAll(grid).click();
        await expect.poll(async () => (await selectAllState(grid)).allSelected).toBe(true);
        await (await rowOf(grid, 1)).locator('[part=selector]').click();
        await expect.poll(async () => (await selectAllState(grid)).inverse).toBe(true);

        await selectAll(grid).click();
        await expect.poll(() => selectAllState(grid)).toMatchObject({ allSelected: false, inverse: false, selectedItems: 0 });
        await expect(grid.locator('vi-query-grid-row[selected]')).toHaveCount(0);
        await expect(selectAll(grid)).not.toHaveAttribute('selected', '');
        await expect(selectAll(grid)).not.toHaveAttribute('partial', '');
    });

    test('selecting every item individually turns on select-all', case_('rows.sa-auto-all-selected'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'PeopleTop10' });

        for (let i = 0; i < 10; i++)
            await (await rowOf(grid, i)).locator('[part=selector]').click();

        await expect.poll(async () => (await selectAllState(grid)).allSelected).toBe(true);
        await expect(selectAll(grid)).toHaveAttribute('selected', '');
        await expect(selectAll(grid)).not.toHaveAttribute('partial', '');
    });

    test('reselecting the deselected row leaves the inverse state', case_('rows.sa-inverse-reselect'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        await selectAll(grid).click();
        await expect.poll(async () => (await selectAllState(grid)).allSelected).toBe(true);
        const row = await rowOf(grid, 1);
        await row.locator('[part=selector]').click();
        await expect.poll(async () => (await selectAllState(grid)).inverse).toBe(true);

        await row.locator('[part=selector]').click();
        await expect.poll(() => selectAllState(grid)).toMatchObject({ allSelected: true, inverse: false, selectedItemCount: 10000 });
        await expect(selectAll(grid)).toHaveAttribute('selected', '');
        await expect(selectAll(grid)).not.toHaveAttribute('partial', '');
        await expect(row).toHaveAttribute('selected', '');
    });

    test('a shift range covering everything turns on select-all', case_('rows.sa-auto-all-shift'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'PeopleTop10' });

        await (await rowOf(grid, 0)).locator('[part=selector]').click();
        await expect.poll(() => selectedIndexes(grid)).toEqual([0]);
        await (await rowOf(grid, 9)).locator('[part=selector]').click({ modifiers: ['Shift'] });

        await expect.poll(() => selectedIndexes(grid)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
        await expect.poll(async () => (await selectAllState(grid)).allSelected).toBe(true);
        await expect(selectAll(grid)).toHaveAttribute('selected', '');
        await expect(selectAll(grid)).not.toHaveAttribute('partial', '');
    });

    test('after auto select-all, deselecting one gives the inverse state', case_('rows.sa-auto-all-then-deselect'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'PeopleTop10' });

        for (let i = 0; i < 10; i++)
            await (await rowOf(grid, i)).locator('[part=selector]').click();

        await expect.poll(async () => (await selectAllState(grid)).allSelected).toBe(true);

        await (await rowOf(grid, 4)).locator('[part=selector]').click();
        await expect.poll(async () => (await selectAllState(grid)).inverse).toBe(true);
        expect((await selectAllState(grid)).selectedItemCount).toBe(9);
        await expect(selectAll(grid)).toHaveAttribute('partial', '');
        await expect(selectAll(grid)).toHaveAttribute('selected', '');
        await expect(await rowOf(grid, 4)).not.toHaveAttribute('selected', '');
    });
});

test.describe('vi-query-grid-select-all: unavailable select-all', () => {
    test('without select-all a selection turns the control into \'clear selection\'', case_('rows.sa-unavailable-partial-visible'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'QueryGrid_Select' });
        await expect(selectAllIcon(grid)).toHaveCSS('visibility', 'hidden');

        await setSelected(grid, 1, true);
        await setSelected(grid, 2, true);
        await expect.poll(() => selectedIndexes(grid)).toEqual([1, 2]);
        await expect(selectAll(grid)).toHaveAttribute('partial', '');
        await expect(selectAll(grid)).toHaveAttribute('selected', '');
        await expect(selectAllIcon(grid)).toHaveCSS('visibility', 'visible');
        await expect(selectAllIcon(grid)).toHaveCSS('opacity', '0.5');

        await selectAll(grid).click();
        await expect.poll(() => selectedIndexes(grid)).toEqual([]);
        await expect(selectAll(grid)).not.toHaveAttribute('partial', '');
        await expect(selectAllIcon(grid)).toHaveCSS('visibility', 'hidden');
    });

    test('unavailable and nothing selected: a click does nothing', case_('rows.sa-unavailable-click-noop'), async ({ page }) => {
        const errors = pageErrors(page);
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'QueryGrid_Select' });
        const before = await selectAllState(grid);

        await selectAll(grid).click();

        expect(await selectAllState(grid)).toEqual(before);
        expect(before).toMatchObject({ allSelected: false, inverse: false, selectedItems: 0 });
        await expect(selectAll(grid)).not.toHaveAttribute('can-select-all', '');
        await expect(selectAll(grid)).not.toHaveAttribute('partial', '');
        await expect(selectAll(grid)).not.toHaveAttribute('selected', '');
        await expect(selectAllIcon(grid)).toHaveCSS('visibility', 'hidden');
        await expect(grid.locator('vi-query-grid-row[selected]')).toHaveCount(0);
        expect(errors).toEqual([]);
    });

    test('maxSelectedItems set before binding disables select-all', case_('rows.sa-max-selected-items'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountPrepared(page, {
            queryOptions: { asLookup: true },
            props: { asLookup: true },
            prepare: (q: any) => { q.maxSelectedItems = 1; }
        });

        await expect(selectAll(grid)).toBeAttached();
        await expect(selectAll(grid)).not.toHaveAttribute('can-select-all', '');
        await selectAll(grid).click();
        expect(await selectAllState(grid)).toMatchObject({ allSelected: false, inverse: false, selectedItems: 0 });
        await expect(selectAll(grid)).not.toHaveAttribute('selected', '');
    });

    test('setting maxSelectedItems after binding makes select-all select nothing', case_('rows.sa-max-selected-items-after-binding'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await expect(selectAll(grid)).toHaveAttribute('can-select-all', '');

        await page.evaluate(() => (window as any).q.maxSelectedItems = 1);
        await expect(selectAll(grid)).not.toHaveAttribute('can-select-all', '');

        await selectAll(grid).click();
        expect(await selectAllState(grid)).toMatchObject({ allSelected: false, inverse: false, selectedItems: 0 });
        await expect(selectAll(grid)).not.toHaveAttribute('selected', '');
        await expect(grid.locator('vi-query-grid-row[selected]')).toHaveCount(0);
    });
});

test.describe('vi-query-grid-select-all: edge cases', () => {
    test('select-all skips disabled and readonly items', case_('rows.sa-disabled-items-excluded'), async ({ page }) => {
        await gridPage(page);
        await patchItemHints(page, { '1': { extraclass: 'disabled' }, '10': { extraclass: 'readonly' } });
        const grid = await mountGrid(page, { query: 'PeopleTop10' });

        // PeopleTop10 sorted on FirstName: id 1 (Jonas) is row 2, id 10 (Laure) is row 3
        const ids = await grid.evaluate((g: any) => g.query.items.map((i: any) => i.id));
        expect(ids.slice(2, 4)).toEqual(['1', '10']);

        await selectAll(grid).click();
        await expect.poll(async () => (await selectAllState(grid)).allSelected).toBe(true);
        await expect(selectAll(grid)).toHaveAttribute('selected', '');
        await expect(selectAll(grid)).not.toHaveAttribute('partial', '');
        expect(await selectAllState(grid)).toMatchObject({ allSelected: true, inverse: false });

        await expect(await rowOf(grid, 2)).not.toHaveAttribute('selected', '');
        await expect(await rowOf(grid, 3)).not.toHaveAttribute('selected', '');
        for (const i of [0, 1, 4, 5, 6, 7, 8, 9])
            await expect(await rowOf(grid, i)).toHaveAttribute('selected', '');
    });

    test('select-all stays off on an empty result', case_('rows.sa-empty-result'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        await page.evaluate(async () => {
            const q = (window as any).q;
            q.textSearch = 'zzzzqqq';
            await q.search();
        });
        await waitForGridReady(grid);
        expect(await grid.evaluate((g: any) => g.query.totalItems)).toBe(0);

        await selectAll(grid).click();
        expect((await selectAllState(grid)).allSelected).toBe(false);
        await expect(selectAll(grid)).not.toHaveAttribute('selected', '');
    });

    test('without a query nothing is reflected and clicks are ignored', case_('rows.sa-no-query'), async ({ page }) => {
        const errors = pageErrors(page);
        await gridPage(page);
        await page.evaluate(() => {
            const element = document.createElement('vi-query-grid-select-all');
            element.style.setProperty('--vi-query-grid-row-height', '32px');
            document.getElementById('test-container')!.appendChild(element);
        });

        const element = page.locator('#test-container > vi-query-grid-select-all');
        await expect(element).toBeAttached();
        await expect(element).not.toHaveAttribute('can-select-all', '');
        await expect(element).not.toHaveAttribute('partial', '');
        await expect(element).not.toHaveAttribute('selected', '');
        await expect(element.locator('vi-icon[source=Selected]')).toHaveCSS('visibility', 'hidden');

        await element.click();
        await expect(element).not.toHaveAttribute('selected', '');
        expect(errors).toEqual([]);
    });
});

test.describe('vi-query-grid-select-all: model sync and lifecycle', () => {
    test('model-driven select-all changes are reflected', case_('rows.sa-model-driven'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        await page.evaluate(() => (window as any).q.selectAll.allSelected = true);
        await expect(selectAll(grid)).toHaveAttribute('selected', '');
        await expect(selectAll(grid)).not.toHaveAttribute('partial', '');
        await expect(selectAllIcon(grid)).toHaveAttribute('is-selected', '');

        await page.evaluate(() => (window as any).q.clearSelection());
        await expect(selectAll(grid)).not.toHaveAttribute('selected', '');
        await expect(selectAll(grid)).not.toHaveAttribute('partial', '');
        expect(await selectAllState(grid)).toMatchObject({ allSelected: false, inverse: false, selectedItems: 0 });
        await expect(grid.locator('vi-query-grid-row[selected]')).toHaveCount(0);
    });

    test('turning availability off at runtime updates the control', case_('rows.sa-isavailable-runtime'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        await selectAll(grid).click();
        await expect.poll(async () => (await selectAllState(grid)).allSelected).toBe(true);

        await page.evaluate(() => (window as any).q.selectAll.isAvailable = false);
        await expect(selectAll(grid)).not.toHaveAttribute('can-select-all', '');
        expect(await selectAllState(grid)).toMatchObject({ allSelected: false, inverse: false });
    });

    test('a new search resets the select-all state', case_('rows.sa-reset-on-search'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        await selectAll(grid).click();
        await expect.poll(async () => (await selectAllState(grid)).allSelected).toBe(true);

        await page.evaluate(async () => { await (window as any).q.search(); });
        await waitForGridReady(grid);
        expect((await selectAllState(grid)).allSelected).toBe(false);
        await expect(selectAll(grid)).not.toHaveAttribute('selected', '');
        await expect(selectAll(grid)).not.toHaveAttribute('partial', '');
    });

    test('swapping the grid query recomputes the state', case_('rows.sa-query-swap'), async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        await selectAll(grid).click();
        await expect.poll(async () => (await selectAllState(grid)).allSelected).toBe(true);
        await expect(selectAll(grid)).toHaveAttribute('selected', '');

        await swapQuery(grid, 'QueryGrid_Select');
        await expect(selectAll(grid)).not.toHaveAttribute('can-select-all', '');
        await expect(selectAll(grid)).not.toHaveAttribute('selected', '');
        await expect(selectAll(grid)).not.toHaveAttribute('partial', '');
        await expect(selectAllIcon(grid)).toHaveCSS('visibility', 'hidden');
    });
});
