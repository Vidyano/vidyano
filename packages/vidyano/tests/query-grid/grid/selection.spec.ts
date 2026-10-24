import { test, expect, Locator } from '@playwright/test';
import { gridPage, mountGrid, getScrollOffset, scrollGrid } from '../_helpers/query-grid';
import { rowAt, rows, selectedIndexes, settle } from '../_helpers/grid';

const RH = 32;
const FAINT = 'rgba(26, 115, 232, 0.1)';
const SEMI_FAINT = 'rgba(26, 115, 232, 0.2)';
/** The test page defines --color-faint; the hover colour is added here */
const STYLES = ':root { --color-semi-faint: rgba(26, 115, 232, 0.2); }';

function selector(grid: Locator, index: number) {
    return rowAt(grid, index).locator('[part~="selector"]');
}

async function selectedRows(grid: Locator) {
    return (await rows(grid)).filter(r => r.selected).map(r => r.index);
}

async function sortedSelection(grid: Locator) {
    return (await selectedIndexes(grid)).sort((a, b) => a - b);
}

/** The row element that shows the item at an index (rows are recycled, so the DOM position differs from the index). */
async function rowOfItem(grid: Locator, index: number): Promise<Locator> {
    const domIndex = await grid.evaluate((g: any, index) => {
        const q = g.query;
        const lazy = q.disableLazyLoading;
        q.disableLazyLoading = true;
        try {
            return [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].findIndex((r: any) => r.item === q.items[index]);
        }
        finally {
            q.disableLazyLoading = lazy;
        }
    }, index);
    expect(domIndex, `row of item ${index}`).toBeGreaterThanOrEqual(0);

    return rowAt(grid, domIndex);
}

/** Background of a row and its cells, and whether its selection borders (::before, ::after) are displayed. */
async function rowStyle(grid: Locator, index: number) {
    return grid.evaluate((g: any, index) => {
        const q = g.query;
        const lazy = q.disableLazyLoading;
        q.disableLazyLoading = true;
        try {
            const row = [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].find((r: any) => !r.classList.contains('hidden') && r.item === q.items[index]) as HTMLElement;
            const shown = (pseudo: string) => {
                const style = getComputedStyle(row, pseudo);
                return style.display !== 'none' && style.content !== 'none' && style.content !== 'normal';
            };

            return {
                background: getComputedStyle(row).backgroundColor,
                cells: [...row.querySelectorAll('.column')].map(c => getComputedStyle(c).backgroundColor),
                before: shown('::before'),
                after: shown('::after')
            };
        }
        finally {
            q.disableLazyLoading = lazy;
        }
    }, index);
}

test.describe('Selection', () => {
    test('selector click toggles selection', { annotation: [{ type: 'case', description: 'grid.sel-toggle' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'PeopleTop10' });

        await selector(grid, 2).click();
        await expect(rowAt(grid, 2)).toHaveAttribute('selected');
        expect(await grid.evaluate((g: any) => g.query.items[2].isSelected)).toBe(true);
        expect(await selectedIndexes(grid)).toEqual([2]);

        await selector(grid, 2).click();
        await expect(rowAt(grid, 2)).not.toHaveAttribute('selected');
        expect(await selectedIndexes(grid)).toEqual([]);
        expect(await selectedRows(grid)).toEqual([]);
    });

    test('plain clicks accumulate by default', { annotation: [{ type: 'case', description: 'grid.sel-accumulate' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'PeopleTop10' });

        await selector(grid, 1).click();
        await selector(grid, 3).click();
        await expect.poll(() => selectedIndexes(grid)).toEqual([1, 3]);
        await expect.poll(() => selectedRows(grid)).toEqual([1, 3]);
    });

    test('shift-click selects a contiguous range in both directions', { annotation: [{ type: 'case', description: 'grid.sel-shift-range' }] }, async ({ page }) => {
        await gridPage(page);
        let grid = await mountGrid(page, { query: 'PeopleTop10' });

        await selector(grid, 2).click();
        await selector(grid, 5).click({ modifiers: ['Shift'] });
        await expect.poll(async () => (await selectedIndexes(grid)).sort((a, b) => a - b)).toEqual([2, 3, 4, 5]);
        expect(await selectedRows(grid)).toEqual([2, 3, 4, 5]);

        // Fresh grid and query for the other direction
        await grid.evaluate((g: any) => g.remove());
        grid = await mountGrid(page, { query: 'PeopleTop10' });

        await selector(grid, 6).click();
        await selector(grid, 2).click({ modifiers: ['Shift'] });
        await expect.poll(async () => (await selectedIndexes(grid)).sort((a, b) => a - b)).toEqual([2, 3, 4, 5, 6]);
        expect(await selectedRows(grid)).toEqual([2, 3, 4, 5, 6]);
    });

    test('single-click off: plain clicks select exclusively, ctrl adds', { annotation: [{ type: 'case', description: 'grid.sel-exclusive-single-click-false' }] }, async ({ page }) => {
        await gridPage(page, { settings: { 'vi-query-grid.single-click': 'false' } });
        const grid = await mountGrid(page, { query: 'PeopleTop10' });

        await selector(grid, 1).click();
        await expect.poll(() => selectedIndexes(grid)).toEqual([1]);
        await selector(grid, 3).click();
        await expect.poll(() => selectedIndexes(grid)).toEqual([3]);
        await selector(grid, 3).click();
        await expect.poll(() => selectedIndexes(grid)).toEqual([]);

        await selector(grid, 1).click({ modifiers: ['Control'] });
        await selector(grid, 3).click({ modifiers: ['Control'] });
        await expect.poll(() => selectedIndexes(grid)).toEqual([1, 3]);
        await selector(grid, 1).click({ modifiers: ['Control'] });
        await expect.poll(() => selectedIndexes(grid)).toEqual([3]);

        await selector(grid, 1).click({ modifiers: ['Control'] });
        await expect.poll(async () => (await selectedIndexes(grid)).sort()).toEqual([1, 3]);
        await selector(grid, 1).click();
        await expect.poll(() => selectedIndexes(grid)).toEqual([1]);
        await expect.poll(() => selectedRows(grid)).toEqual([1]);
    });

    test('in select-all mode a click deselects one item', { annotation: [{ type: 'case', description: 'grid.sel-allselected-toggle' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'PeopleTop10' });

        expect(await grid.evaluate((g: any) => g.query.selectAll.isAvailable)).toBe(true);
        await grid.evaluate((g: any) => g.query.selectAll.allSelected = true);
        await expect.poll(() => selectedRows(grid)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

        await selector(grid, 3).click();
        await expect.poll(() => selectedRows(grid)).toEqual([0, 1, 2, 4, 5, 6, 7, 8, 9]);
        expect(await grid.evaluate((g: any) => ({ allSelected: g.query.selectAll.allSelected, inverse: g.query.selectAll.inverse }))).toEqual({ allSelected: true, inverse: true });
    });

    test('the range anchor moves to the shift-click target', { annotation: [{ type: 'case', description: 'grid.sel-shift-anchor-moves' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'PeopleTop10' });

        await selector(grid, 2).click();
        await selector(grid, 4).click({ modifiers: ['Shift'] });
        await expect.poll(() => sortedSelection(grid)).toEqual([2, 3, 4]);

        // Deselecting 3 leaves a gap: a range from the old anchor (2) would select it again
        await selector(grid, 3).click();
        await expect.poll(() => sortedSelection(grid)).toEqual([2, 4]);

        await selector(grid, 6).click({ modifiers: ['Shift'] });
        await expect.poll(() => sortedSelection(grid)).toEqual([2, 4, 5, 6]);
        expect(await selectedRows(grid)).toEqual([2, 4, 5, 6]);
    });

    test('shift-click on a selected row toggles only it', { annotation: [{ type: 'case', description: 'grid.sel-shift-on-selected' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'PeopleTop10' });

        await selector(grid, 2).click();
        await selector(grid, 5).click({ modifiers: ['Shift'] });
        await expect.poll(() => sortedSelection(grid)).toEqual([2, 3, 4, 5]);

        await selector(grid, 3).click({ modifiers: ['Shift'] });
        await expect.poll(() => sortedSelection(grid)).toEqual([2, 4, 5]);
        expect(await selectedRows(grid)).toEqual([2, 4, 5]);
    });

    test('shift-click without an anchor toggles one row', { annotation: [{ type: 'case', description: 'grid.sel-shift-no-anchor' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'PeopleTop10' });

        await selector(grid, 4).click({ modifiers: ['Shift'] });
        await expect.poll(() => selectedIndexes(grid)).toEqual([4]);
        expect(await selectedRows(grid)).toEqual([4]);
    });

    test('a range over unloaded items falls back to a toggle', { annotation: [{ type: 'case', description: 'grid.sel-shift-gap' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        await selector(grid, 0).click();
        await expect.poll(() => selectedIndexes(grid)).toEqual([0]);

        await scrollGrid(grid, { top: 5000 * RH });
        await expect.poll(async () => (await getScrollOffset(grid)).top).toBe(5000 * RH);
        await settle(grid);

        await (await rowOfItem(grid, 5000)).locator('[part~="selector"]').click({ modifiers: ['Shift'] });
        await expect.poll(() => sortedSelection(grid)).toEqual([0, 5000]);
        expect(await grid.evaluate((g: any) => g.query.selectedItems.length)).toBe(2);
    });

    test('deselecting keeps the anchor on the clicked row', { annotation: [{ type: 'case', description: 'grid.sel-anchor-after-ctrl-deselect' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'PeopleTop10' });

        await selector(grid, 2).click();
        await selector(grid, 4).click();
        await selector(grid, 4).click();
        await expect.poll(() => selectedIndexes(grid)).toEqual([2]);

        await selector(grid, 7).click({ modifiers: ['Shift'] });
        await expect.poll(() => sortedSelection(grid)).toEqual([2, 4, 5, 6, 7]);
    });

    test('a range beyond maxSelectedItems leaves the selection unchanged', { annotation: [{ type: 'case', description: 'grid.sel-maxselected' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'PeopleTop10' });
        await grid.evaluate((g: any) => g.query.maxSelectedItems = 3);

        await selector(grid, 1).click();
        await expect.poll(() => selectedIndexes(grid)).toEqual([1]);

        await selector(grid, 5).click({ modifiers: ['Shift'] });
        await settle(grid);
        expect(await selectedIndexes(grid)).toEqual([1]);
        expect(await selectedRows(grid)).toEqual([1]);

        // The anchor stays on row 1: a range that fits the limit still works
        await selector(grid, 3).click({ modifiers: ['Shift'] });
        await expect.poll(() => sortedSelection(grid)).toEqual([1, 2, 3]);
    });

    test('a shift-range across a collapsed group selects its items', { annotation: [{ type: 'case', description: 'grid.sel-grouped-range-hidden-items' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'PeopleTop10' });
        await grid.evaluate(async (g: any) => { await g.query.group('Gender'); });
        await expect(grid).toHaveAttribute('has-grouping');
        await settle(grid);

        const groups: { label: string; items: number[] }[] = await grid.evaluate((g: any) => g.query.groupingInfo.groups.map((gr: any) => ({ label: gr.name, items: Array.from({ length: gr.count }, (_, i) => gr.start + i) })));
        expect(groups.length).toBe(3);
        const [first, middle, last] = groups;
        expect(middle.items.length).toBeGreaterThan(0);

        // Collapse the middle group through its header
        const middleHeader = (await rows(grid)).find(r => r.isGroup && r.groupLabel?.startsWith(middle.label))!;
        await page.mouse.click(middleHeader.x + middleHeader.width / 2, middleHeader.top + middleHeader.height / 2);
        await expect.poll(() => grid.evaluate((g: any) => g.query.groupingInfo.groups.map((gr: any) => gr.isCollapsed))).toEqual([false, true, false]);
        await settle(grid);
        expect((await rows(grid)).filter(r => middle.items.includes(r.index))).toEqual([]);

        await (await rowOfItem(grid, first.items[0])).locator('[part~="selector"]').click();
        await (await rowOfItem(grid, last.items[0])).locator('[part~="selector"]').click({ modifiers: ['Shift'] });

        const range = [...first.items, ...middle.items, last.items[0]].sort((a, b) => a - b);
        await expect.poll(() => sortedSelection(grid)).toEqual(range);

        // Expanding the group shows its items selected
        await page.mouse.click(middleHeader.x + middleHeader.width / 2, middleHeader.top + middleHeader.height / 2);
        await expect.poll(() => grid.evaluate((g: any) => g.query.groupingInfo.groups.some((gr: any) => gr.isCollapsed))).toBe(false);
        await settle(grid);
        await expect.poll(async () => (await rows(grid)).filter(r => r.selected).map(r => r.index).sort((a, b) => a - b)).toEqual(range);
    });

    test('select-all mode toggles even with single-click off', { annotation: [{ type: 'case', description: 'grid.sel-allselected-single-click-false' }] }, async ({ page }) => {
        await gridPage(page, { settings: { 'vi-query-grid.single-click': 'false' } });
        const grid = await mountGrid(page, { query: 'PeopleTop10' });

        await grid.evaluate((g: any) => g.query.selectAll.allSelected = true);
        await expect.poll(() => selectedRows(grid)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

        await selector(grid, 3).click();
        await expect.poll(() => selectedRows(grid)).toEqual([0, 1, 2, 4, 5, 6, 7, 8, 9]);
        expect(await grid.evaluate((g: any) => ({ allSelected: g.query.selectAll.allSelected, inverse: g.query.selectAll.inverse }))).toEqual({ allSelected: true, inverse: true });
    });

    test('an exclusive click clears select-all flags', { annotation: [{ type: 'case', description: 'grid.sel-selectall-flags-cleared' }] }, async ({ page }) => {
        await gridPage(page, { settings: { 'vi-query-grid.single-click': 'false' } });
        const grid = await mountGrid(page, { query: 'PeopleTop10' });
        expect(await grid.evaluate((g: any) => g.query.selectAll.isAvailable)).toBe(true);

        // With allSelected set the click toggles instead, so a left-over inverse flag is what the exclusive click must clear
        await grid.evaluate((g: any) => g.query.selectAll.inverse = true);
        expect(await grid.evaluate((g: any) => g.query.selectAll.inverse)).toBe(true);

        await selector(grid, 2).click();
        await expect.poll(() => selectedIndexes(grid)).toEqual([2]);
        expect(await grid.evaluate((g: any) => ({ allSelected: g.query.selectAll.allSelected, inverse: g.query.selectAll.inverse }))).toEqual({ allSelected: false, inverse: false });
    });

    test('a search drops the range anchor', { annotation: [{ type: 'case', description: 'grid.sel-stale-anchor-after-search' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        await selector(grid, 2).click();
        await expect.poll(() => selectedIndexes(grid)).toEqual([2]);

        await grid.evaluate(async (g: any) => {
            g.query.textSearch = 'a';
            await g.query.search();
        });
        await settle(grid);
        expect(await selectedIndexes(grid)).toEqual([]);

        // The anchor item is not part of the new result: shift-click acts as without an anchor
        await selector(grid, 5).click({ modifiers: ['Shift'] });
        await expect.poll(() => selectedIndexes(grid)).toEqual([5]);
    });

    test('selected rows get the faint background and merged borders', { annotation: [{ type: 'case', description: 'grid.sel-row-styles' }] }, async ({ page }) => {
        await gridPage(page, { styles: STYLES });
        const grid = await mountGrid(page, { query: 'PeopleTop10' });

        await selector(grid, 2).click();
        await selector(grid, 3).click();
        await expect.poll(() => selectedRows(grid)).toEqual([2, 3]);
        await page.mouse.move(5, 5);

        for (const index of [2, 3]) {
            const style = await rowStyle(grid, index);
            expect(style.background, `row ${index}`).toBe(FAINT);
            expect(style.cells.every(c => c === FAINT), `row ${index} cells`).toBe(true);
            expect(style.after, `row ${index} ::after`).toBe(true);
        }
        expect((await rowStyle(grid, 2)).before).toBe(true);
        expect((await rowStyle(grid, 3)).before).toBe(false);
        expect((await rowStyle(grid, 4)).after).toBe(false);

        await grid.evaluate((g: any) => g.query.selectedItems = [g.query.items[0]]);
        await expect.poll(() => selectedRows(grid)).toEqual([0]);
        const first = await rowStyle(grid, 0);
        expect(first.before).toBe(false);
        expect(first.after).toBe(true);
    });

    test('merged selection borders survive window shifts', { annotation: [{ type: 'case', description: 'grid.rows-adjacent-selected-borders-after-scroll' }] }, async ({ page }) => {
        await gridPage(page, { styles: STYLES });
        const grid = await mountGrid(page);

        await grid.evaluate((g: any) => g.query.selectedItems = [20, 21, 22].map(i => g.query.items[i]));
        await page.mouse.move(5, 5);

        for (const top of [15 * RH, 18 * RH]) {
            await scrollGrid(grid, { top });
            await expect.poll(async () => (await getScrollOffset(grid)).top).toBe(top);
            await settle(grid);

            await expect.poll(() => selectedRows(grid), `scrollTop ${top}`).toEqual([20, 21, 22]);
            const styles = await Promise.all([20, 21, 22].map(i => rowStyle(grid, i)));
            expect(styles.map(s => s.before), `scrollTop ${top} ::before`).toEqual([true, false, false]);
            expect(styles.map(s => s.after), `scrollTop ${top} ::after`).toEqual([true, true, true]);
        }
    });

    test('a hovered selected row shows the hover colour', { annotation: [{ type: 'case', description: 'gap.grid-hover-selected-row' }] }, async ({ page }) => {
        await gridPage(page, { styles: STYLES });
        const grid = await mountGrid(page, { query: 'PeopleTop10' });

        await selector(grid, 2).click();
        await expect.poll(() => selectedRows(grid)).toEqual([2]);

        const cell = (await rows(grid)).find(r => r.index === 2)!.cells[1];
        await page.mouse.move(cell.x + cell.width / 2, cell.top + cell.height / 2);
        await expect.poll(async () => (await rowStyle(grid, 2)).cells.every(c => c === SEMI_FAINT)).toBe(true);
        const hovered = await rowStyle(grid, 2);
        expect(hovered.before).toBe(true);
        expect(hovered.after).toBe(true);

        await page.mouse.move(5, 5);
        await expect.poll(async () => (await rowStyle(grid, 2)).cells.every(c => c === FAINT)).toBe(true);
    });
});
