import { test, expect, Locator, Page } from '@playwright/test';
import { gridPage, mountGrid, pageErrors, scrollGrid, getScrollOffset, nextFrames, requestLog, waitForQueryIdle } from '../_helpers/query-grid';
import { rowAt, rows, settle } from '../_helpers/grid';

/**
 * q.reorder is replaced by a stub that records its arguments (as item indexes) and resolves,
 * so the shared QueryGrid_Reorder data is never changed.
 */
async function stubReorder(grid: Locator) {
    await grid.evaluate((g: any) => {
        const q = g.query;
        const w = window as any;
        w.__reorders = [];
        q.reorder = async (before: any, item: any, after: any) => {
            const index = (i: any) => i == null ? null : q.items.indexOf(i);
            w.__reorders.push([index(before), index(item), index(after)]);
            return [];
        };
    });
}

async function dragRow(page: Page, grid: Locator, from: number, to: number) {
    const handle = await rowAt(grid, from).locator('[part~="reorder"]').boundingBox();
    const target = await rowAt(grid, to).boundingBox();
    await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2);
    await page.mouse.down();
    await page.mouse.move(target!.x + handle!.width / 2, target!.y + target!.height / 2, { steps: 10 });
    await page.mouse.move(target!.x + handle!.width / 2, target!.y + target!.height / 3, { steps: 5 });
    await page.mouse.up();
}

/** Drags a row by its second data cell (not the handle) onto another row. */
async function dragCell(page: Page, grid: Locator, from: number, to: number) {
    const cell = (await rowAt(grid, from).locator('.column').nth(1).boundingBox())!;
    const target = (await rowAt(grid, to).boundingBox())!;
    await page.mouse.move(cell.x + cell.width / 2, cell.y + cell.height / 2);
    await page.mouse.down();
    await page.mouse.move(cell.x + cell.width / 2, target.y + target.height / 2, { steps: 10 });
    await page.mouse.move(cell.x + cell.width / 2, target.y + target.height / 3, { steps: 5 });
    await page.mouse.up();
}

/** The item indexes of the rendered rows in DOM order. */
async function domOrder(grid: Locator) {
    return grid.evaluate((g: any) => [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].filter((r: any) => !r.classList.contains('hidden')).map((r: any) => g.query.items.indexOf(r.item)));
}

test.describe('Reorder', () => {
    test('dragging a row up calls query.reorder(before, item, after)', { annotation: [{ type: 'case', description: 'grid.ro-drag-up-args' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'QueryGrid_Reorder' });
        await expect(grid).toHaveAttribute('can-reorder');
        await stubReorder(grid);

        await dragRow(page, grid, 3, 0);
        await expect.poll(() => page.evaluate(() => (window as any).__reorders)).toEqual([[null, 3, 0]]);
    });

    test('row DOM is restored after a drop and stays consistent', { annotation: [{ type: 'case', description: 'grid.ro-dom-restored' }] }, async ({ page }) => {
        const errors = pageErrors(page);
        await gridPage(page, { height: 300 });
        const grid = await mountGrid(page, { query: 'QueryGrid_Reorder' });
        await stubReorder(grid);

        const rowCount = await grid.evaluate((g: any) => g.shadowRoot.querySelectorAll('vi-query-grid-row').length);
        const domOrder = () => grid.evaluate((g: any) => [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].filter((r: any) => !r.classList.contains('hidden')).map((r: any) => g.query.items.indexOf(r.item)));
        const before = await domOrder();
        expect(before).toEqual(Array.from({ length: 12 }, (_, i) => i));

        await dragRow(page, grid, 3, 0);
        await expect.poll(() => page.evaluate(() => (window as any).__reorders.length)).toBe(1);
        await expect.poll(domOrder).toEqual(before);
        expect((await rows(grid)).map(r => r.index)).toEqual((await rows(grid)).map(r => r.position));

        await scrollGrid(grid, { top: 3 * 32 });
        await expect.poll(async () => (await getScrollOffset(grid)).top).toBe(3 * 32);
        await settle(grid);
        await scrollGrid(grid, { top: 0 });
        await settle(grid);

        const after = await domOrder();
        expect(after).toEqual(before);
        expect(new Set(after).size).toBe(after.length);
        expect(await grid.evaluate((g: any) => g.shadowRoot.querySelectorAll('vi-query-grid-row').length)).toBe(rowCount);
        (await rows(grid)).forEach(r => expect(r.index).toBe(r.position));
        expect(errors).toEqual([]);
    });

    test('a reorderable query shows handles and renders every row', { annotation: [{ type: 'case', description: 'grid.ro-controls-and-all-rows' }] }, async ({ page }) => {
        await gridPage(page, { height: 150 });
        const grid = await mountGrid(page, { query: 'QueryGrid_ReorderLarge' });
        await expect(grid).toHaveAttribute('can-reorder');
        await expect(grid.locator('.controls .reorder')).toBeVisible();

        const pool = await grid.evaluate((g: any) => {
            const q = g.query;
            const lazy = q.disableLazyLoading;
            q.disableLazyLoading = true;
            try {
                return [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].filter((r: any) => !r.classList.contains('hidden')).map((r: any) => {
                    const handle = r.shadowRoot.querySelector('[part~="reorder"]') as HTMLElement;
                    const style = handle ? getComputedStyle(handle) : null;
                    const box = handle?.getBoundingClientRect();
                    return {
                        index: q.items.indexOf(r.item),
                        handle: !!style && style.display !== 'none' && style.visibility === 'visible' && box!.width > 0 && box!.height > 0
                    };
                });
            }
            finally {
                q.disableLazyLoading = lazy;
            }
        });

        expect(pool.map(r => r.index)).toEqual(Array.from({ length: 250 }, (_, i) => i));
        expect(pool.every(r => r.handle)).toBe(true);
        await expect(rowAt(grid, 0).locator('[part~="reorder"]')).toBeVisible();
    });

    test('dragging a row down passes the new neighbours', { annotation: [{ type: 'case', description: 'grid.ro-drag-down-args' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'QueryGrid_Reorder' });
        await stubReorder(grid);

        await dragRow(page, grid, 0, 2);
        await expect.poll(() => page.evaluate(() => (window as any).__reorders)).toEqual([[2, 0, 3]]);
    });

    test('DOM is restored when the reorder fails', { annotation: [{ type: 'case', description: 'grid.ro-dom-restored-on-reject' }] }, async ({ page }) => {
        const errors = pageErrors(page);
        await gridPage(page, { height: 300 });
        const grid = await mountGrid(page, { query: 'QueryGrid_Reorder' });
        const log = requestLog(page);

        // The reorder request fails before it reaches the backend, so the shared order never changes
        await page.route('**/ExecuteAction', route => route.abort());

        const before = await domOrder(grid);
        expect(before).toEqual(Array.from({ length: 12 }, (_, i) => i));
        await dragRow(page, grid, 3, 0);

        await expect.poll(() => log.of('ExecuteAction').length).toBe(1);
        expect(log.of('ExecuteAction')[0].action).toBe('QueryOrder.Reorder');
        await waitForQueryIdle(grid);
        await expect.poll(() => domOrder(grid)).toEqual(before);

        await scrollGrid(grid, { top: 3 * 32 });
        await expect.poll(async () => (await getScrollOffset(grid)).top).toBe(3 * 32);
        await settle(grid);
        await scrollGrid(grid, { top: 0 });
        await settle(grid);

        expect(await domOrder(grid)).toEqual(before);
        (await rows(grid)).forEach(r => expect(r.index).toBe(r.position));
        expect(errors).toEqual([]);
    });

    test('dropping in place does not reorder', { annotation: [{ type: 'case', description: 'grid.ro-same-index-noop' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'QueryGrid_Reorder' });
        await stubReorder(grid);
        const before = await domOrder(grid);

        const handle = (await rowAt(grid, 2).locator('[part~="reorder"]').boundingBox())!;
        await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
        await page.mouse.down();
        await page.mouse.move(handle.x + handle.width / 2 + 3, handle.y + handle.height / 2 + 6, { steps: 5 });
        await page.mouse.up();
        await nextFrames(page, 2);

        await expect.poll(() => domOrder(grid)).toEqual(before);
        expect(await page.evaluate(() => (window as any).__reorders)).toEqual([]);
    });

    test('rows drag only by the handle', { annotation: [{ type: 'case', description: 'grid.ro-handle-only' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'QueryGrid_Reorder' });
        await stubReorder(grid);
        const before = await domOrder(grid);

        await dragCell(page, grid, 3, 0);
        await nextFrames(page, 2);

        expect(await domOrder(grid)).toEqual(before);
        expect(await page.evaluate(() => (window as any).__reorders)).toEqual([]);
    });

    test('a non-reorderable grid ignores drags', { annotation: [{ type: 'case', description: 'grid.ro-disabled-not-reorderable' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await expect(grid).not.toHaveAttribute('can-reorder');
        const log = requestLog(page);
        const before = await domOrder(grid);

        await dragCell(page, grid, 3, 0);
        await nextFrames(page, 2);
        await log.quiet();

        expect(await domOrder(grid)).toEqual(before);
        expect(log.of('ExecuteAction')).toHaveLength(0);
    });

    test('a dropped row stays where it was released while the reordered items replace the old ones', { annotation: [{ type: 'case', description: 'grid.ro-drop-keeps-scroll' }] }, async ({ page }) => {
        const grid = await mountScrolledWithReorderResults(page, [[7, 5]]);
        const dropped = await rowOf(grid, 7);

        await dragRow(page, grid, 7, 5);
        await expect.poll(() => page.evaluate(() => (window as any).__reorders)).toBe(1);
        await waitForQueryIdle(grid);

        (await sampleFrames(grid, dropped.id)).forEach(f => {
            expect(f.index).toBe(5);
            expect(f.scrollTop).toBe(3 * 32);
            expect(Math.abs(f.top - (dropped.top - 2 * 32))).toBeLessThanOrEqual(1);
        });
    });

    test('a drop while the previous reorder is pending also keeps the grid in place', { annotation: [{ type: 'case', description: 'grid.ro-overlapping-drops-keep-scroll' }] }, async ({ page }) => {
        const grid = await mountScrolledWithReorderResults(page, [[7, 5], [8, 6]], true);
        const dropped = await rowOf(grid, 8);

        await dragRow(page, grid, 7, 5);
        await expect.poll(() => page.evaluate(() => (window as any).__reorders)).toBe(1);
        await dragRow(page, grid, 8, 6);

        await page.evaluate(() => (window as any).__release());
        await expect.poll(() => page.evaluate(() => (window as any).__reorders)).toBe(2);
        await nextFrames(page, 2);
        await page.evaluate(() => (window as any).__release());
        await waitForQueryIdle(grid);

        (await sampleFrames(grid, dropped.id)).forEach(f => {
            expect(f.index).toBe(6);
            expect(f.scrollTop).toBe(3 * 32);
            expect(Math.abs(f.top - (dropped.top - 2 * 32))).toBeLessThanOrEqual(1);
        });
    });
});

/**
 * Mounts QueryGrid_Reorder scrolled down three rows. QueryOrder.Reorder answers with the query in its new order, built from
 * the GetQuery response so the shared order never changes; each answer applies the next move. Held answers wait for window.__release().
 */
async function mountScrolledWithReorderResults(page: Page, moves: [from: number, to: number][], held = false) {
    await gridPage(page, { height: 300 });
    let queryDto: any;
    await page.route('**/GetQuery', async route => {
        const response = await route.fetch();
        const json = await response.json();
        queryDto = json.query;
        await route.fulfill({ response, json });
    });
    const grid = await mountGrid(page, { query: 'QueryGrid_Reorder' });

    await grid.evaluate((g: any, { dto, moves, held }) => {
        const w = window as any;
        const service = w.service;
        const executeAction = service.executeAction.bind(service);
        const waiting: (() => void)[] = [];
        w.__release = () => waiting.shift()?.();
        w.__reorders = 0;
        service.executeAction = async (action: string, parent: any, ...args: any[]) => {
            if (action !== 'QueryOrder.Reorder')
                return executeAction(action, parent, ...args);

            const [from, to] = moves[w.__reorders++];
            if (held)
                await new Promise<void>(resolve => waiting.push(resolve));

            const items = dto.result.items;
            items.splice(to, 0, ...items.splice(from, 1));
            return { queries: [service.hooks.onConstructQuery(service, dto, parent)] };
        };
    }, { dto: queryDto, moves, held });

    await scrollGrid(grid, { top: 3 * 32 });
    await expect.poll(async () => (await getScrollOffset(grid)).top).toBe(3 * 32);
    await settle(grid);

    return grid;
}

/** The item id and on-screen top of the row of the item at the index. */
async function rowOf(grid: Locator, index: number) {
    return grid.evaluate((g: any, index) => {
        const row = [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].find((r: any) => g.query.items.indexOf(r.item) === index) as any;
        return { id: row.item.id as string, top: row.getBoundingClientRect().top as number };
    }, index);
}

/** The scroll offset, and the on-screen top and item index of the row with the item id, over ten animation frames. */
async function sampleFrames(grid: Locator, id: string) {
    return grid.evaluate((g: any, id) => new Promise<{ scrollTop: number, top: number, index: number }[]>((resolve, reject) => {
        const scroller = ([...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any).scroller as HTMLElement;
        const samples: { scrollTop: number, top: number, index: number }[] = [];
        const deadline = setTimeout(() => reject(new Error('no animation frames')), 5000);
        const sample = () => {
            const row = [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].find((r: any) => r.item?.id === id) as any;
            samples.push({ scrollTop: scroller.scrollTop, top: row?.getBoundingClientRect().top ?? NaN, index: g.query.items.findIndex((i: any) => i?.id === id) });
            if (samples.length < 10)
                requestAnimationFrame(sample);
            else {
                clearTimeout(deadline);
                resolve(samples);
            }
        };
        requestAnimationFrame(sample);
    }), id);
}
