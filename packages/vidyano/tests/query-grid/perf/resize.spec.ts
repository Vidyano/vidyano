import { Locator, Page } from '@playwright/test';
import { nextFrames, requestLog, waitForGridReady } from '../_helpers/query-grid';
import { cdpMetrics, expect, mountPrefetched, parkMouse, perfCase, perfPage, recordPerf, round, test, waitFilled } from '../_helpers/perf';

const template = (grid: Locator) => grid.evaluate((g: any) => getComputedStyle(g).getPropertyValue('--vi-query-grid-columns').trim());

/** Header/cell misalignment (px) per column and the viewport coverage of the grid. */
const layoutState = (grid: Locator) => grid.evaluate((g: any) => {
    const perf = (window as any).__perf;
    const lefts = perf.columnLefts(g);
    const misaligned = Object.entries<number>(lefts.headers).filter(([name, left]) => Math.abs(left - lefts.cells[name]) > 1).map(([name]) => name);
    return { misaligned, coverage: perf.coverage(g) };
});

/** Resolves with the ms from the resize until the rows cover the (grown) viewport, plus the pool size and viewport height. */
function whenCovered(grid: Locator) {
    return grid.evaluate(async (g: any) => {
        const perf = (window as any).__perf;
        const start = performance.now();
        const { time } = await perf.whenFrame(() => {
            const scroller = perf.scroller(g).scroller;
            const c = perf.coverage(g);
            return c.gap <= 1 && c.blank === 0 && c.rows >= Math.ceil(scroller.clientHeight / g.rowHeight) && scroller.clientHeight > 0;
        });
        const scroller = perf.scroller(g).scroller;
        const resizedAt = (window as any).__resizedAt ?? start;
        return { ms: time - resizedAt, pool: perf.rows(g).length, viewportHeight: scroller.clientHeight, rowHeight: g.rowHeight };
    });
}

async function grow(page: Page, grid: Locator, resize: () => Promise<void>) {
    const log = requestLog(page);
    await grid.evaluate((g: any) => {
        const w = window as any;
        w.__resizedAt = undefined;
        // Start timing at the resize itself (the first observation is the initial size, not a resize)
        let initial = true;
        new ResizeObserver((entries, observer) => {
            if (initial) {
                initial = false;
                return;
            }

            observer.disconnect();
            w.__resizedAt = performance.now();
        }).observe(w.__perf.scroller(g));
    });
    const sizeBefore = await grid.evaluate((g: any) => (window as any).__perf.scroller(g).scroller.clientHeight);
    await resize();
    await expect.poll(() => grid.evaluate((g: any, before) => (window as any).__perf.scroller(g).scroller.clientHeight > before, sizeBefore)).toBe(true);
    const covered = await whenCovered(grid);
    // A page load would be sent 20ms after the update; give it time to show up
    await page.waitForTimeout(300);

    return { ...covered, requests: log.requests.length };
}

test.describe('Viewport resize & maxRows', () => {
    test.setTimeout(120000);

    test('growing the viewport adds rows with no requests', perfCase('perf.rs-grow-adds-rows'), async ({ page }, testInfo) => {
        // Viewport 1280x600 -> 1280x1000
        await perfPage(page, { width: 1280, height: 600 });
        let { grid } = await mountPrefetched(page, 'People');
        await parkMouse(page);
        const viewport = await grow(page, grid, () => page.setViewportSize({ width: 1280, height: 1000 }));

        // Host 400px -> 1000px
        await perfPage(page, { width: 1280, height: 1100, styles: '#test-container > vi-query-grid { flex: none; height: 400px; }' });
        ({ grid } = await mountPrefetched(page, 'People'));
        await parkMouse(page);
        const host = await grow(page, grid, () => grid.evaluate((g: any) => g.style.height = '1000px'));

        for (const [label, run] of [['viewport', viewport], ['host', host]] as const) {
            const bound = Math.ceil(Math.ceil(run.viewportHeight / run.rowHeight) * 1.5) + 1;
            expect(run.pool, `${label}: pool size`).toBeLessThanOrEqual(bound);
            expect(run.pool, `${label}: rows cover the new area`).toBeGreaterThanOrEqual(Math.ceil(run.viewportHeight / run.rowHeight));
            expect(run.requests, `${label}: requests`).toBe(0);
        }

        await recordPerf(page, testInfo, 'perf.rs-grow-adds-rows', { counts: { viewportPool: viewport.pool, hostPool: host.pool, requests: viewport.requests + host.requests }, timings: { viewportCoverMs: [round(viewport.ms)], hostCoverMs: [round(host.ms)] } });
    });

    test('row pool after a viewport shrink stays within budget', perfCase('grid.vs-row-count-monotonic'), async ({ page }, testInfo) => {
        await perfPage(page, { width: 1280, height: 1000, styles: '#test-container > vi-query-grid { flex: none; height: 300px; }' });
        const { grid } = await mountPrefetched(page, 'People');
        await parkMouse(page);
        const log = requestLog(page);

        const sizes: Record<string, any> = {};
        for (const [label, height] of [['300', 300], ['800', 800], ['300 again', 300]] as const) {
            if (label !== '300')
                await grid.evaluate((g: any, height) => g.style.height = `${height}px`, height);

            await expect.poll(() => grid.evaluate((g: any, height) => Math.abs(g.getBoundingClientRect().height - height) < 1, height)).toBe(true);
            await waitFilled(grid);
            sizes[label] = await grid.evaluate((g: any) => {
                const perf = (window as any).__perf;
                const c = perf.coverage(g);
                return { pool: perf.rows(g).length, gap: c.gap, blank: c.blank, viewportHeight: perf.scroller(g).scroller.clientHeight, rowHeight: g.rowHeight };
            });
        }
        // A page load would be sent 20ms after an update; give it time to show up
        await page.waitForTimeout(300);

        const largest = sizes['800'];
        const bound = Math.ceil(Math.ceil(largest.viewportHeight / largest.rowHeight) * 1.5) + 1;
        for (const [label, size] of Object.entries<any>(sizes)) {
            expect(size.gap, `${label}: uncovered strip`).toBeLessThanOrEqual(1);
            expect(size.blank, `${label}: blank rows`).toBe(0);
            expect(size.pool, `${label}: pool`).toBeLessThanOrEqual(bound);
        }
        expect(log.requests).toHaveLength(0);

        await recordPerf(page, testInfo, 'grid.vs-row-count-monotonic', { counts: { pool300: sizes['300'].pool, pool800: sizes['800'].pool, poolAfterShrink: sizes['300 again'].pool, requests: log.requests.length } });
    });

    test('continuous window resizing has bounded layout work', perfCase('perf.rs-continuous-resize', { timing: true }), async ({ page }, testInfo) => {
        await perfPage(page, { width: 1280, height: 900 });
        const { grid } = await mountPrefetched(page, 'People');
        await parkMouse(page);
        const before = { template: await template(grid) };
        const start = await page.evaluate(() => performance.now());

        const layouts: number[] = [];
        const sizes = Array.from({ length: 20 }, (_, i) => i < 10 ? { width: 1280, height: i % 2 ? 900 : 600 } : { width: i % 2 ? 1280 : 900, height: 900 });
        for (const size of sizes) {
            const metrics = await cdpMetrics(page);
            await page.setViewportSize(size);
            await nextFrames(page, 1);
            layouts.push((await cdpMetrics(page)).LayoutCount - metrics.LayoutCount);
        }
        await page.setViewportSize({ width: 1280, height: 900 });
        await waitForGridReady(grid);
        await waitFilled(grid);
        await nextFrames(page, 3);

        const blocking = await page.evaluate(start => (window as any).__perf.tbt(start, performance.now()), start);
        const after = await layoutState(grid);

        expect(Math.max(...layouts), `layouts per step: ${layouts}`).toBeLessThanOrEqual(3);
        expect(after.misaligned, 'columns with the header not above the cells').toEqual([]);
        expect(after.coverage.gap).toBeLessThanOrEqual(1);
        expect(after.coverage.blank).toBe(0);
        expect(await template(grid), 'column template').toBe(before.template);

        await recordPerf(page, testInfo, 'perf.rs-continuous-resize', { counts: { maxLayoutsPerStep: Math.max(...layouts), layouts: layouts.reduce((a, b) => a + b, 0) }, timings: { tbt: [round(blocking.tbt)] } });
    });

    test('width-only resize does not touch rows', perfCase('perf.rs-width-only'), async ({ page }, testInfo) => {
        await perfPage(page, { width: 1600, height: 720 });
        const { grid } = await mountPrefetched(page, 'People');
        await parkMouse(page);
        const before = await template(grid);
        await expect(grid.locator('vi-popup.more.right')).toBeHidden();

        await grid.evaluate((g: any) => (window as any).__perf.observe(g));
        await page.setViewportSize({ width: 900, height: 720 });
        await expect(grid.locator('vi-popup.more.right')).toBeVisible();
        await nextFrames(page, 2);

        const mutations = await grid.evaluate(() => (window as any).__perf.takeMutations());
        expect(mutations.rowRecords, 'row and cell mutations').toBe(0);
        expect(await template(grid), 'column template').toBe(before);

        await recordPerf(page, testInfo, 'perf.rs-width-only', { counts: { rowMutations: mutations.rowRecords, hostRecords: mutations.hostRecords } });
    });

    test('a maxRows grid does no row work for scrolls inside its window', { annotation: [{ type: 'case', description: 'gap.grid-perf-maxrows-scroll-no-rerender' }] }, async ({ page }, testInfo) => {
        await perfPage(page, { styles: '#test-container > vi-query-grid { flex: none; height: 300px; }' });
        const { grid } = await mountPrefetched(page, 'People', { props: { maxRows: 12 } });
        await parkMouse(page);
        const log = requestLog(page);

        const scroll = await grid.evaluate((g: any) => {
            const scroller = (window as any).__perf.scroller(g).scroller;
            return { max: scroller.scrollHeight - scroller.clientHeight, rows: (window as any).__perf.visibleRows(g).length };
        });
        expect(scroll.max, 'the 12 rows scroll inside the viewport').toBeGreaterThan(40);

        await grid.evaluate((g: any) => (window as any).__perf.observe(g));
        const box = (await grid.boundingBox())!;
        await page.mouse.move(box.x + 400, box.y + 150);
        for (let i = 0; i < 10; i++) {
            await page.mouse.wheel(0, 4);
            await nextFrames(page, 1);
        }
        await parkMouse(page);
        // A page load would be sent 20ms after an update; give it time to show up
        await page.waitForTimeout(300);

        const result = await grid.evaluate((g: any) => ({ mutations: (window as any).__perf.takeMutations(), top: (window as any).__perf.scroller(g).scroller.scrollTop }));
        expect(result.top, 'scrolled').toBeGreaterThan(0);
        expect(result.mutations.rowRecords, 'row mutations for scrolls inside the window').toBe(0);
        expect(log.requests).toHaveLength(0);

        await recordPerf(page, testInfo, 'gap.grid-perf-maxrows-scroll-no-rerender', { counts: { rowRecords: result.mutations.rowRecords, cellTextWrites: result.mutations.cellTextWrites } });
    });
});
