import { test, expect, Locator } from '@playwright/test';
import { gridPage, mountGrid, getScrollOffset, scrollGrid, headerNames } from '../_helpers/query-grid';
import { clickHeaderMenuItem, rows, settle, valuesOf } from '../_helpers/grid';

const RH = 32;

/** The item indexes of the rows in the viewport. */
async function visibleIndexes(grid: Locator) {
    return (await rows(grid)).map(r => r.index);
}

/** Scrolls the grid body to its end and waits for the rows there. */
async function scrollToEnd(grid: Locator) {
    const { scrollHeight, height } = await getScrollOffset(grid);
    await scrollGrid(grid, { top: scrollHeight - height });
    await expect.poll(async () => (await getScrollOffset(grid)).top).toBe(scrollHeight - height);
    await settle(grid);
}

test.describe('maxRows and skip', () => {
    test('maxRows and skip defaults and reflection', { annotation: [{ type: 'case', description: 'grid.mr-attr-reflect' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        await expect(grid).not.toHaveAttribute('max-rows');
        await expect(grid).not.toHaveAttribute('has-more-rows');
        await expect(grid).toHaveAttribute('skip', '0');

        await grid.evaluate((g: any) => g.maxRows = 5);
        await expect(grid).toHaveAttribute('max-rows', '5');

        await grid.evaluate((g: any) => g.maxRows = null);
        await expect(grid).not.toHaveAttribute('max-rows');

        await grid.evaluate((g: any) => g.setAttribute('max-rows', '7'));
        await expect.poll(() => grid.evaluate((g: any) => g.maxRows)).toBe(7);
    });

    test('maxRows limits rendered rows and scroll height', { annotation: [{ type: 'case', description: 'grid.mr-renders-n' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { props: { maxRows: 5 } });

        const visible = await rows(grid);
        expect(visible.map(r => r.index)).toEqual([0, 1, 2, 3, 4]);
        expect(Math.max(...visible.map(r => r.offset + r.height))).toBeLessThanOrEqual(5 * 32 + 1);

        // The grid body keeps its flex height, so the scroll height is the viewport height: nothing can scroll
        const offset = await getScrollOffset(grid);
        expect(offset.scrollHeight).toBeLessThanOrEqual(Math.max(5 * 32 + 1, offset.height));

        // The browser clamps scrollTop when it is set, so a body that could scroll reads back more than 0 at once
        const top = await grid.evaluate((g: any) => {
            const scroller = ([...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any).scroller as HTMLElement;
            scroller.scrollTop = 300;
            return scroller.scrollTop;
        });
        expect(top).toBe(0);
        await settle(grid);
        expect((await rows(grid)).map(r => r.index)).toEqual([0, 1, 2, 3, 4]);
    });

    test('has-more-rows reflects totalItems > maxRows', { annotation: [{ type: 'case', description: 'grid.mr-has-more-rows-matrix' }] }, async ({ page }) => {
        await gridPage(page);

        const cases: [string, number, boolean][] = [
            ['People', 5, true],
            ['PeopleTop10', 9, true],
            ['PeopleTop10', 10, false],
            ['PeopleTop10', 20, false],
            ['PeopleTop10', 0, false]
        ];

        for (const [query, maxRows, hasMore] of cases) {
            const grid = await mountGrid(page, { query, props: { maxRows } });
            if (hasMore)
                await expect(grid, `${query} maxRows ${maxRows}`).toHaveAttribute('has-more-rows');
            else
                await expect(grid, `${query} maxRows ${maxRows}`).not.toHaveAttribute('has-more-rows');

            if (query === 'PeopleTop10' && maxRows === 0)
                expect((await rows(grid)).map(r => r.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

            await grid.evaluate((g: any) => g.remove());
        }
    });

    test('has-more-rows follows totalItems across searches', { annotation: [{ type: 'case', description: 'grid.has-more-rows-after-search' }] }, async ({ page }) => {
        // Tall enough to show all 50 rows without scrolling
        await gridPage(page, { height: 66 + 52 * RH });
        const grid = await mountGrid(page, { props: { maxRows: 50 } });
        await expect(grid).toHaveAttribute('has-more-rows');

        // The first person's email address matches only a few people
        const email = (await valuesOf(grid, [0], 'Email'))[0];
        await grid.evaluate(async (g: any, email) => {
            g.query.textSearch = email;
            await g.query.search();
        }, email);
        const total = await grid.evaluate((g: any) => g.query.totalItems);
        expect(total, `search '${email}'`).toBeGreaterThan(0);
        expect(total).toBeLessThanOrEqual(50);
        await settle(grid);
        await expect(grid).not.toHaveAttribute('has-more-rows');

        expect(await visibleIndexes(grid)).toEqual(Array.from({ length: total }, (_, i) => i));

        await grid.evaluate(async (g: any) => {
            g.query.textSearch = '';
            await g.query.search();
        });
        await expect(grid).toHaveAttribute('has-more-rows');
        await expect.poll(() => visibleIndexes(grid)).toEqual(Array.from({ length: 50 }, (_, i) => i));
    });

    test('skip offsets the first rendered item', { annotation: [{ type: 'case', description: 'grid.sk-offset' }] }, async ({ page }) => {
        // A body of 4 rows, so the scroll range of the 7 remaining rows matters
        await gridPage(page, { height: 66 + 4 * RH });
        const grid = await mountGrid(page, { query: 'PeopleTop10', props: { skip: 3 } });

        await expect(grid).toHaveAttribute('skip', '3');
        expect(await visibleIndexes(grid)).toEqual([3, 4, 5, 6]);

        const offset = await getScrollOffset(grid);
        expect(Math.abs(offset.scrollHeight - 7 * RH)).toBeLessThanOrEqual(1);

        await scrollToEnd(grid);
        const visible = await rows(grid);
        expect(visible.map(r => r.index)).toEqual([6, 7, 8, 9]);
        expect(visible.every(r => !r.loading)).toBe(true);
    });

    test('skip and maxRows combine', { annotation: [{ type: 'case', description: 'grid.sk-and-mr' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'PeopleTop10', props: { skip: 3, maxRows: 2 } });

        expect(await visibleIndexes(grid)).toEqual([3, 4]);
        await expect(grid).toHaveAttribute('has-more-rows');
    });

    test('maxRows holds after a column update', { annotation: [{ type: 'case', description: 'grid.mr-after-column-update' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { props: { maxRows: 5 } });
        expect(await visibleIndexes(grid)).toEqual([0, 1, 2, 3, 4]);

        await clickHeaderMenuItem(grid, 'Email', 'Pin');
        await expect.poll(async () => (await headerNames(grid))[0]).toBe('Email');
        await settle(grid);

        expect(await visibleIndexes(grid)).toEqual([0, 1, 2, 3, 4]);
    });

    test('runtime maxRows set and clear re-render the rows', { annotation: [{ type: 'case', description: 'gap.grid-maxrows-runtime-set-and-clear' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        await grid.evaluate((g: any) => g.maxRows = 3);
        await expect(grid).toHaveAttribute('max-rows', '3');
        await expect(grid).toHaveAttribute('has-more-rows');
        await settle(grid);
        await expect.poll(() => visibleIndexes(grid)).toEqual([0, 1, 2]);
        const capped = await getScrollOffset(grid);
        expect(capped.scrollHeight).toBeLessThanOrEqual(Math.max(3 * RH + 1, capped.height));

        await grid.evaluate((g: any) => g.maxRows = null);
        await expect(grid).not.toHaveAttribute('max-rows');
        await expect(grid).not.toHaveAttribute('has-more-rows');
        await expect.poll(async () => (await getScrollOffset(grid)).scrollHeight).toBe(10000 * RH);

        await scrollToEnd(grid);
        expect((await visibleIndexes(grid)).at(-1)).toBe(9999);
    });

    test('runtime skip and maxRows changes re-render rows', { annotation: [{ type: 'case', description: 'gap.grid-skip-runtime-rerender' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        await grid.evaluate((g: any) => g.skip = 5);
        await expect(grid).toHaveAttribute('skip', '5');
        await settle(grid);
        await expect.poll(async () => (await visibleIndexes(grid))[0]).toBe(5);

        await grid.evaluate((g: any) => g.maxRows = 3);
        await settle(grid);
        await expect.poll(() => visibleIndexes(grid)).toEqual([5, 6, 7]);

        await grid.evaluate((g: any) => g.maxRows = null);
        await expect.poll(async () => (await getScrollOffset(grid)).scrollHeight).toBe((10000 - 5) * RH);
        await scrollToEnd(grid);
        expect((await visibleIndexes(grid)).at(-1)).toBe(9999);
    });

    test('maxRows larger than the viewport scrolls to its last row', { annotation: [{ type: 'case', description: 'grid.mr-window-smaller-than-maxrows' }] }, async ({ page }) => {
        await gridPage(page, { height: 120 });
        const grid = await mountGrid(page, { props: { maxRows: 20 } });

        const offset = await getScrollOffset(grid);
        expect(offset.height).toBeLessThan(20 * RH);
        expect(Math.abs(offset.scrollHeight - 20 * RH)).toBeLessThanOrEqual(1);

        await scrollToEnd(grid);
        const visible = await rows(grid);
        const last = visible.at(-1)!;
        expect(last.index).toBe(19);
        const view = await getScrollOffset(grid);
        expect(Math.abs(last.offset + last.height - (view.top + view.height))).toBeLessThanOrEqual(1);
    });
});
