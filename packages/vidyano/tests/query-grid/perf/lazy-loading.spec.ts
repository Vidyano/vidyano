import { Locator, Page } from '@playwright/test';
import { holdExecuteQuery } from '../_helpers/grid';
import { requestLog, waitForGridReady, pauseClock } from '../_helpers/query-grid';
import { datasetOf, expect, gridLocator, mountPrefetched, parkMouse, perfCase, perfPage, recordPerf, round, scrollToRow, setCpuThrottle, test, waitFilled } from '../_helpers/perf';

/**
 * Scrolls to a row (row x rowHeight, clamped to the end) and resolves with the ms until the first frame in which the
 * scroller is there, the grid handled that scroll and every visible row is filled. Without `wheel` the scrollTop is set
 * in the same task as the start; with it one mouse wheel over the grid scrolls, which lands in a later frame.
 */
async function scrollAndSettle(grid: Locator, row: number, wheel?: Page) {
    const rowHeight = await grid.evaluate((g: any, { row, jump }) => {
        const w = window as any;
        const perf = w.__perf;
        const scroller = perf.scroller(g).scroller;
        const target = Math.min(row * g.rowHeight, scroller.scrollHeight - scroller.clientHeight);
        const start = performance.now();
        w.__settled = perf.whenFrame(() => {
            const c = perf.coverage(g);
            return Math.abs(scroller.scrollTop - target) < 1 && g.verticalScrollOffset === scroller.scrollTop && c.blank === 0 && c.rows > 0 && perf.firstColumnMatches(g, 'FirstName');
        }).then(({ time }: any) => ({ ms: time - start, topIndex: perf.topRowIndex(g) }));
        if (jump)
            scroller.scrollTop = row * g.rowHeight;

        return g.rowHeight as number;
    }, { row, jump: !wheel });

    await wheel?.mouse.wheel(0, row * rowHeight);
    return grid.evaluate(() => (window as any).__settled as Promise<{ ms: number; topIndex: number }>);
}

/**
 * Scrolls to a row and waits until the grid decided which pages to fetch for it: the scroll event runs in the next frame,
 * then the grid's 20ms fetch debounce and the query's 10ms batching run. A timer started later fires later, so this holds
 * at any CPU speed.
 */
async function scrollAndLetFetch(grid: Locator, row: number) {
    await grid.evaluate(async (g: any, row) => {
        (window as any).__perf.scroller(g).scroller.scrollTop = row * g.rowHeight;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await new Promise(resolve => setTimeout(resolve, 20));
        await new Promise(resolve => setTimeout(resolve, 10));
    }, row);
}

const pageAligned = (r: { skip?: number; top?: number }) => (r.skip ?? 0) % 100 === 0 && (r.top ?? 100) % 100 === 0 && (r.top ?? 100) <= 200;

async function mountFresh(page: Page) {
    const { grid } = await mountPrefetched(page, 'People');
    await parkMouse(page);
    return grid;
}

/** Sets scrollTop and waits until the grid handled the scroll event (scroll events do not depend on the page clock). */
async function scrollAndWaitForEvent(grid: Locator, top: number) {
    const scrollTop = await grid.evaluate((g: any, top) => {
        const scroller = (window as any).__perf.scroller(g).scroller;
        scroller.scrollTop = top;
        return scroller.scrollTop;
    }, top);
    await expect.poll(() => grid.evaluate((g: any) => g.verticalScrollOffset), 'the scroll event').toBe(scrollTop);
}

/** Waits (in real time) until a native scroll, e.g. from wheel events, came to rest and the grid handled its last scroll event. */
async function waitScrollStopped(grid: Locator) {
    let last = -1;
    await expect.poll(async () => {
        const { top, offset } = await grid.evaluate((g: any) => ({ top: (window as any).__perf.scroller(g).scroller.scrollTop, offset: g.verticalScrollOffset }));
        const stopped = top > 0 && top === last && offset === top;
        last = top;
        return stopped;
    }, { message: 'the scroll came to rest', intervals: [100] }).toBe(true);
}

/** The item index of every visible row, the item count and the visible cells that do not show the value of their item. */
const shownRows = (grid: Locator) => grid.evaluate((g: any) => {
    const perf = (window as any).__perf;
    const q = g.query;
    const lazy = q.disableLazyLoading;
    q.disableLazyLoading = true;
    try {
        return { indexes: perf.visibleRows(g).map(({ r }: any) => q.items.indexOf(r.item)) as number[], total: q.totalItems as number, wrong: perf.checkVisibleCells(g).wrong as string[] };
    }
    finally {
        q.disableLazyLoading = lazy;
    }
});

const consecutive = (from: number, count: number) => Array.from({ length: count }, (_, i) => from + i);

test.describe('Lazy loading', () => {
    test.setTimeout(180000);

    test('a jump into an unloaded region loads only the page at the target', perfCase('perf.vw-jump-middle-loads-target'), async ({ page }, testInfo) => {
        // The page clock holds the grid's 20ms page fetch debounce while the wheel scroll below runs, whatever the frame rate
        await page.clock.install();
        await perfPage(page);
        let grid = await mountFresh(page);
        let log = requestLog(page);

        // The page is held until the rows at the target show as waiting
        const release = await holdExecuteQuery(page);
        await scrollToRow(grid, 5000);
        await expect.poll(() => log.of('ExecuteQuery').length, 'the held request').toBe(1);
        await expect.poll(() => grid.evaluate((g: any) => (window as any).__perf.coverage(g).blank), 'rows waiting for the held page').toBeGreaterThan(0);
        await release();
        await waitFilled(grid);
        await log.quiet();

        const jumpRequests = log.of('ExecuteQuery').map(r => [r.skip, r.top]);
        expect(jumpRequests).toEqual([[5000, 100]]);
        const jumped = await shownRows(grid);
        expect(jumped.indexes, 'item index of every visible row').toEqual(consecutive(5000, jumped.indexes.length));
        expect(jumped.wrong).toEqual([]);

        // One large wheel lands on the same row and also loads only that page
        grid = await mountFresh(page);
        log = requestLog(page);
        const box = (await grid.boundingBox())!;
        const rowHeight = await grid.evaluate((g: any) => g.rowHeight);
        await page.mouse.move(box.x + 400, box.y + 300);
        await pauseClock(page);
        await page.mouse.wheel(0, 5000 * rowHeight);
        await waitScrollStopped(grid);
        await page.clock.runFor(20);
        await page.clock.resume();
        await waitFilled(grid);
        await log.quiet();

        const wheelRequests = log.of('ExecuteQuery').map(r => [r.skip, r.top]);
        expect(wheelRequests).toEqual([[5000, 100]]);
        const wheeled = await shownRows(grid);
        expect(wheeled.indexes, 'item index of every visible row').toEqual(consecutive(5000, wheeled.indexes.length));
        expect(wheeled.wrong).toEqual([]);

        await recordPerf(page, testInfo, 'perf.vw-jump-middle-loads-target', { counts: { jumpRequests: jumpRequests.length, wheelRequests: wheelRequests.length }, requests: { jump: jumpRequests, wheel: wheelRequests } });
    });

    test('a jump to the bottom loads only the last page', perfCase('perf.vw-jump-bottom-loads-last-page'), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountFresh(page);
        const log = requestLog(page);

        // The page is held until the rows at the bottom show as waiting
        const release = await holdExecuteQuery(page);
        await scrollToRow(grid, 10000);
        await expect.poll(() => log.of('ExecuteQuery').length, 'the held request').toBe(1);
        await expect.poll(() => grid.evaluate((g: any) => (window as any).__perf.coverage(g).blank), 'rows waiting for the held page').toBeGreaterThan(0);
        await release();
        await waitFilled(grid);
        await log.quiet();

        const requests = log.of('ExecuteQuery').map(r => [r.skip, r.top]);
        expect(requests).toEqual([[9900, 100]]);
        const rows = await shownRows(grid);
        expect(rows.total).toBe(10000);
        expect(rows.indexes, 'item index of every visible row').toEqual(consecutive(rows.total - rows.indexes.length, rows.indexes.length));
        expect(rows.wrong).toEqual([]);

        await recordPerf(page, testInfo, 'perf.vw-jump-bottom-loads-last-page', { counts: { requests: requests.length }, requests: { pages: requests } });
    });

    for (const rate of [1, 4]) {
        test(`time to data after a jump into an unloaded region (${rate}x CPU)`, perfCase('perf.vw-settle-after-jump-middle', { timing: true }), async ({ page }, testInfo) => {
            await perfPage(page);
            const grid = await mountFresh(page);
            const log = requestLog(page);
            await setCpuThrottle(page, rate);

            const jump = await scrollAndSettle(grid, 5000);
            await log.quiet();
            await setCpuThrottle(page, 1);

            expect(jump.topIndex).toBe(5000);
            expect.soft(jump.ms, 'settle after jump').toBeLessThanOrEqual(rate === 1 ? 1000 : 2500);

            // The same row through one large wheel
            let wheelMs: number | null = null;
            if (rate === 1) {
                const fresh = await mountFresh(page);
                const box = (await fresh.boundingBox())!;
                await page.mouse.move(box.x + 400, box.y + 300);
                const wheel = await scrollAndSettle(fresh, 5000, page);
                expect(wheel.topIndex).toBe(5000);
                wheelMs = round(wheel.ms);
            }

            await recordPerf(page, testInfo, `perf.vw-settle-after-jump-middle.${rate}x`, { cpuThrottle: rate, dataset: await datasetOf(grid), counts: { requests: log.of('ExecuteQuery').length }, timings: { settleMs: [round(jump.ms)], ...(wheelMs !== null ? { wheelSettleMs: [wheelMs] } : {}) } });
        });

        test(`time to settle at the bottom of 10,000 rows (${rate}x CPU)`, perfCase('perf.vw-settle-after-jump-bottom', { timing: true }), async ({ page }, testInfo) => {
            await perfPage(page);
            const grid = await mountFresh(page);
            const log = requestLog(page);
            await setCpuThrottle(page, rate);

            const jump = await scrollAndSettle(grid, 10000);
            await log.quiet();
            await setCpuThrottle(page, 1);

            expect.soft(jump.ms, 'settleBottomMs').toBeLessThanOrEqual(rate === 1 ? 1000 : 2500);

            await recordPerf(page, testInfo, `perf.vw-settle-after-jump-bottom.${rate}x`, { cpuThrottle: rate, dataset: await datasetOf(grid), counts: { requests: log.of('ExecuteQuery').length }, timings: { settleBottomMs: [round(jump.ms)] } });
        });
    }

    test('linear scrolling requests each page once', perfCase('grid.pf-sequential-scroll-requests'), async ({ page }, testInfo) => {
        await perfPage(page);

        // Scroll 160px a step down to row 500, each step waited until the grid decided its fetch: once with the pages
        // answered as they come, once with every page held until the end so the requests of the crossed pages overlap
        const scrolls: Record<string, { requests: { skip?: number; top?: number }[]; pagesCrossed: number }> = {};
        for (const held of [false, true]) {
            const grid = await mountFresh(page);
            const log = requestLog(page);
            const release = held ? await holdExecuteQuery(page) : null;
            const rowHeight = await grid.evaluate((g: any) => g.rowHeight);
            for (let top = 160; top <= 500 * rowHeight; top += 160)
                await scrollAndLetFetch(grid, top / rowHeight);

            if (release) {
                await expect.poll(() => log.of('ExecuteQuery').length, 'a page request is held').toBeGreaterThan(0);
                release();
            }

            await waitFilled(grid);
            await log.quiet();

            const requests = log.of('ExecuteQuery');
            const lastRow = await grid.evaluate((g: any) => (window as any).__perf.visibleRows(g).length) + 500;
            const pagesCrossed = Math.floor(lastRow / 100); // pages 1..n were crossed (page 0 came with the query)
            const skips = requests.map(r => r.skip);
            const label = `${held ? 'held' : 'answered'}: ${JSON.stringify(requests.map(r => [r.skip, r.top]))}`;
            expect(requests.every(pageAligned), label).toBe(true);
            expect(new Set(skips).size, `${label}, duplicate pages`).toBe(skips.length);
            expect(requests.length, label).toBeLessThanOrEqual(pagesCrossed);
            scrolls[held ? 'held' : 'answered'] = { requests, pagesCrossed };
        }

        // 33 jumps of +300 rows, each waited until filled
        const grid = await mountFresh(page);
        const log = requestLog(page);
        const stepRequests: number[] = [];
        for (let step = 1; step <= 33; step++) {
            const before = log.of('ExecuteQuery').length;
            await scrollToRow(grid, step * 300);
            await waitFilled(grid);
            stepRequests.push(log.of('ExecuteQuery').length - before);
        }
        await log.quiet();

        const jumpRequests = log.of('ExecuteQuery');
        const jumpSkips = jumpRequests.map(r => r.skip);
        expect(jumpRequests.every(pageAligned), JSON.stringify(jumpRequests.map(r => [r.skip, r.top]))).toBe(true);
        expect(new Set(jumpSkips).size, 'duplicate pages').toBe(jumpSkips.length);
        expect(jumpRequests.length).toBeLessThanOrEqual(33);
        expect(Math.max(...stepRequests)).toBeLessThanOrEqual(2);

        await recordPerf(page, testInfo, 'grid.pf-sequential-scroll-requests', {
            counts: { scrollRequests: scrolls.answered.requests.length, heldScrollRequests: scrolls.held.requests.length, scrollPagesCrossed: scrolls.answered.pagesCrossed, jumpRequests: jumpRequests.length },
            requests: { scroll: scrolls.answered.requests.map(r => [r.skip, r.top]), heldScroll: scrolls.held.requests.map(r => [r.skip, r.top]), jumps: jumpRequests.map(r => [r.skip, r.top]), perStep: stepRequests }
        });
    });

    test('a fast fling only loads where it stops', perfCase('grid.pf-fling-requests-final-only'), async ({ page }, testInfo) => {
        // The page clock holds the grid's 20ms page fetch debounce: each scroll event of the fling restarts it before it runs
        // out, whatever the frame rate
        await page.clock.install();
        await perfPage(page);

        const covers = (requests: { skip?: number; top?: number }[], indexes: number[]) => indexes.every(index => requests.some(r => index >= (r.skip ?? 0) && index < (r.skip ?? 0) + (r.top ?? 100)));
        const finalIndexes = (grid: Locator) => grid.evaluate((g: any) => {
            const perf = (window as any).__perf;
            const q = g.query;
            const lazy = q.disableLazyLoading;
            q.disableLazyLoading = true;
            try {
                return perf.visibleRows(g).map(({ r }: any) => q.items.indexOf(r.item)).filter((i: number) => i >= 100);
            }
            finally {
                q.disableLazyLoading = lazy;
            }
        });

        // 30 wheel events of 3000px, all while the page clock stands still
        let grid = await mountFresh(page);
        let log = requestLog(page);
        const box = (await grid.boundingBox())!;
        await page.mouse.move(box.x + 400, box.y + 300);
        await pauseClock(page);
        for (let i = 0; i < 30; i++)
            await page.mouse.wheel(0, 3000);

        await waitScrollStopped(grid);
        await page.clock.runFor(19);
        await log.quiet();
        const wheelBeforeDebounce = log.of('ExecuteQuery').length;
        expect(wheelBeforeDebounce, 'requests within 20ms of the last scroll').toBe(0);
        await page.clock.runFor(1);
        await page.clock.resume();
        await waitFilled(grid);
        await log.quiet();

        const wheelRequests = log.of('ExecuteQuery');
        const wheelLabel = `requests ${JSON.stringify(wheelRequests.map(r => [r.skip, r.top]))}`;
        expect(wheelRequests, wheelLabel).toHaveLength(1);
        expect(wheelRequests.every(pageAligned), wheelLabel).toBe(true);
        expect(covers(wheelRequests, await finalIndexes(grid)), wheelLabel).toBe(true);

        // 30-frame fling to the bottom: a scroll step, then a frame (16ms) of page time
        grid = await mountFresh(page);
        log = requestLog(page);
        await pauseClock(page);
        const max = await grid.evaluate((g: any) => {
            const scroller = (window as any).__perf.scroller(g).scroller;
            return scroller.scrollHeight - scroller.clientHeight;
        });
        for (let i = 0; i < 30; i++) {
            if (i > 0)
                await page.clock.runFor(16);

            await scrollAndWaitForEvent(grid, Math.round(max * (1 - Math.pow(1 - (i + 1) / 30, 3))));
        }

        await page.clock.runFor(19);
        await log.quiet();
        const midFling = log.of('ExecuteQuery').length;
        expect(midFling, 'requests during the fling and within 20ms of its last scroll').toBe(0);
        await page.clock.runFor(1);
        await page.clock.resume();
        await waitFilled(grid);
        await log.quiet();

        const flingRequests = log.of('ExecuteQuery');
        const flingLabel = `requests ${JSON.stringify(flingRequests.map(r => [r.skip, r.top]))}`;
        expect(flingRequests, flingLabel).toHaveLength(1);
        expect(flingRequests.every(pageAligned), flingLabel).toBe(true);
        expect(covers(flingRequests, await finalIndexes(grid)), flingLabel).toBe(true);

        await recordPerf(page, testInfo, 'grid.pf-fling-requests-final-only', {
            counts: { wheelRequests: wheelRequests.length, flingRequests: flingRequests.length, midFlingRequests: midFling },
            requests: { wheel: wheelRequests.map(r => [r.skip, r.top]), fling: flingRequests.map(r => [r.skip, r.top]) }
        });
    });

    test('page arrival re-renders only rows that were waiting', perfCase('perf.ll-page-arrival-touches-only-placeholders'), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountFresh(page);
        const log = requestLog(page);

        // Hold the second page until its rows show as waiting, then record what its arrival changes
        const release = await holdExecuteQuery(page, body => body?.query?.skip === 100);
        await scrollToRow(grid, 80);
        await expect.poll(() => log.of('ExecuteQuery').some(r => r.skip === 100)).toBe(true);
        await expect.poll(() => grid.evaluate((g: any) => (window as any).__perf.coverage(g).blank), 'rows waiting for the held page').toBeGreaterThan(0);
        await grid.evaluate((g: any) => (window as any).__perf.observe(g));
        release();
        await waitFilled(grid);
        await log.quiet();

        const result = await grid.evaluate((g: any) => {
            const perf = (window as any).__perf;
            const mutations = perf.takeMutations();
            const q = g.query;
            const lazy = q.disableLazyLoading;
            q.disableLazyLoading = true;
            try {
                const rows = perf.rows(g).map((r: any, pool: number) => ({ pool, index: q.items.indexOf(r.item) }));
                return { mutations, rows };
            }
            finally {
                q.disableLazyLoading = lazy;
            }
        });

        const loaded = result.rows.filter(r => r.index >= 0 && r.index < 100);
        const waiting = result.rows.filter(r => r.index >= 100);
        expect(loaded.length).toBeGreaterThan(0);
        expect(waiting.length).toBeGreaterThan(0);

        for (const row of loaded)
            expect(result.mutations.perRow[row.pool] ?? 0, `mutations on loaded row ${row.index}`).toBe(0);

        expect(result.mutations.maxTextWritesPerCell, 'text writes per waiting cell').toBeLessThanOrEqual(1);

        await recordPerf(page, testInfo, 'perf.ll-page-arrival-touches-only-placeholders', { counts: { loadedRows: loaded.length, waitingRows: waiting.length, cellTextWrites: result.mutations.cellTextWrites, maxTextWritesPerCell: result.mutations.maxTextWritesPerCell, rowRecords: result.mutations.rowRecords } });
    });

    test('oscillating between two unloaded regions does not duplicate requests', perfCase('grid.pf-no-duplicate-page-requests'), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountFresh(page);
        const log = requestLog(page);

        // Every page is held: the page at row 4,000 is requested and both regions are revisited while it is pending, then
        // both again once they arrived
        const release = await holdExecuteQuery(page);
        for (let i = 0; i < 5; i++) {
            for (const row of [4000, 6000]) {
                await scrollAndLetFetch(grid, row);
                if (i === 0 && row === 4000)
                    await expect.poll(() => log.of('ExecuteQuery').map(r => r.skip), 'the held request').toEqual([4000]);
            }
        }

        release();
        await waitFilled(grid);
        for (const row of [4000, 6000]) {
            await scrollAndLetFetch(grid, row);
            await waitFilled(grid);
        }
        await log.quiet();

        const pages = log.of('ExecuteQuery').map(r => r.skip ?? 0);
        const perPage = pages.reduce((map, skip) => map.set(skip, (map.get(skip) ?? 0) + 1), new Map<number, number>());
        expect(perPage.get(4000) ?? 0, `requests ${JSON.stringify(pages)}`).toBeLessThanOrEqual(1);
        expect(perPage.get(6000) ?? 0, `requests ${JSON.stringify(pages)}`).toBeLessThanOrEqual(1);
        expect(Math.max(...perPage.values()), 'requests per page').toBe(1);
        expect(log.of('ExecuteQuery').every(pageAligned)).toBe(true);

        await recordPerf(page, testInfo, 'grid.pf-no-duplicate-page-requests', { counts: { requests: pages.length, maxPerPage: Math.max(...perPage.values()) }, requests: { pages } });
    });

    test('abandoned windows are not fetched', perfCase('perf.ll-stale-window-not-fetched'), async ({ page }, testInfo) => {
        // The page clock holds the grid's 20ms page fetch debounce, so the second jump comes before it runs out at any frame rate
        await page.clock.install();
        await perfPage(page);
        const grid = await mountFresh(page);
        const log = requestLog(page);
        const rowHeight = await grid.evaluate((g: any) => g.rowHeight);

        // Jump to row 3,000 and, a frame later, on to row 7,000
        await pauseClock(page);
        await scrollAndWaitForEvent(grid, 3000 * rowHeight);
        await page.clock.runFor(16);
        await scrollAndWaitForEvent(grid, 7000 * rowHeight);
        await page.clock.runFor(20);
        await page.clock.resume();
        await waitFilled(grid);
        await log.quiet();

        const requests = log.of('ExecuteQuery').map(r => [r.skip, r.top]);
        expect(requests.filter(([skip]) => skip! >= 2900 && skip! <= 3100), `requests ${JSON.stringify(requests)}`).toEqual([]);
        expect(requests).toEqual([[7000, 100]]);
        expect(await grid.evaluate((g: any) => (window as any).__perf.topRowIndex(g))).toBe(7000);

        await recordPerf(page, testInfo, 'perf.ll-stale-window-not-fetched', { counts: { requests: requests.length }, requests: { pages: requests } });
    });

    test('arrived data fills all waiting rows in one frame', perfCase('perf.ll-fill-in-one-frame'), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountFresh(page);
        const log = requestLog(page);

        // Sample every frame from the jump until all rows are filled; the page is held until frames with only waiting rows were seen
        const release = await holdExecuteQuery(page);
        await grid.evaluate((g: any) => {
            const w = window as any;
            const perf = w.__perf;
            const samples = w.__fillSamples = [] as { rows: number; blank: number }[];
            perf.scroller(g).scroller.scrollTop = 5000 * g.rowHeight;
            w.__filled = perf.whenFrame(() => {
                const c = perf.coverage(g);
                samples.push({ rows: c.rows, blank: c.blank });
                return c.rows > 0 && c.blank === 0;
            });
        });
        const waiting = () => page.evaluate(() => ((window as any).__fillSamples as { rows: number; blank: number }[]).filter(s => s.rows > 0 && s.blank === s.rows).length);
        await expect.poll(() => log.of('ExecuteQuery').length, 'the held request').toBe(1);
        await expect.poll(waiting, 'frames with only waiting rows').toBeGreaterThan(5);
        release();

        const result = await page.evaluate(async () => {
            const w = window as any;
            await w.__filled;
            const samples = w.__fillSamples as { rows: number; blank: number }[];
            const firstFilled = samples.findIndex(s => s.rows > 0 && s.blank < s.rows);
            const allFilled = samples.findIndex(s => s.rows > 0 && s.blank === 0);
            return { frames: samples.length, firstFilled, allFilled, waitingFrames: samples.filter(s => s.rows > 0 && s.blank === s.rows).length };
        });
        await log.quiet();

        expect(log.of('ExecuteQuery').map(r => [r.skip, r.top])).toEqual([[5000, 100]]);
        expect(result.waitingFrames, 'frames with only waiting rows (the held page)').toBeGreaterThan(5);
        expect(result.allFilled - result.firstFilled, 'frames between the first and the last filled row').toBe(0);

        await recordPerf(page, testInfo, 'perf.ll-fill-in-one-frame', { counts: { framesBetweenFirstAndLastFilled: result.allFilled - result.firstFilled, waitingFrames: result.waitingFrames } });
    });

    test('no redundant item construction', perfCase('perf.ll-item-construction-count'), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountFresh(page);

        let received = 0;
        const responses: Promise<void>[] = [];
        page.on('response', response => {
            if (/\/ExecuteQuery$/.test(response.url()))
                responses.push(response.json().then(json => { received += json?.result?.items?.length ?? 0; }, () => {}));
        });
        await grid.evaluate(() => {
            const w = window as any;
            const hooks = w.service.hooks;
            const original = hooks.onConstructQueryResultItem;
            w.__constructed = 0;
            hooks.onConstructQueryResultItem = function(...args: any[]) {
                w.__constructed++;
                return original.apply(this, args);
            };
        });

        // Stepped scroll through the first 1,500 rows, one window per step
        for (let row = 30; row <= 1500; row += 30) {
            await scrollToRow(grid, row);
            await waitFilled(grid);
        }
        const log = requestLog(page);
        await log.quiet();
        await Promise.all(responses);

        const constructed = await page.evaluate(() => (window as any).__constructed);
        expect(received).toBeGreaterThan(0);
        expect(constructed, `constructed ${constructed} items for ${received} received`).toBe(received);

        await recordPerf(page, testInfo, 'perf.ll-item-construction-count', { counts: { constructed, received, responses: responses.length } });
    });

    test('two grids loading at once both resolve', perfCase('perf.ll-two-grids-concurrent'), async ({ page }, testInfo) => {
        await perfPage(page);
        await page.evaluate(async () => {
            const w = window as any;
            w.grids = [];
            for (const name of ['People', 'QueryGrid_Select']) {
                const q = await w.service.getQuery(name);
                if (q.sortOptions.map((o: any) => `${o.name} ${o.direction}`).join(';') !== 'FirstName ASC') {
                    q.sortOptions = [{ name: 'FirstName', direction: 'ASC' }];
                    await q.search();
                }

                const grid = document.createElement('vi-query-grid') as any;
                grid.query = q;
                document.getElementById('test-container')!.appendChild(grid);
                w.grids.push(grid);
            }
        });
        const grids = [gridLocator(page).nth(0), gridLocator(page).nth(1)];
        for (const grid of grids)
            await waitForGridReady(grid);

        await parkMouse(page);
        const log = requestLog(page);

        // Both jump to row 4,000 in the same task
        await page.evaluate(() => (window as any).grids.forEach((g: any) => (window as any).__perf.scroller(g).scroller.scrollTop = 4000 * g.rowHeight));
        for (const grid of grids)
            await waitFilled(grid);

        await log.quiet();

        const requests = log.of('ExecuteQuery').map(r => ({ query: r.body?.query?.id, skip: r.skip, top: r.top }));
        const states = await page.evaluate(() => (window as any).grids.map((g: any) => {
            const perf = (window as any).__perf;
            const q = g.query;
            const lazy = q.disableLazyLoading;
            q.disableLazyLoading = true;
            try {
                return { id: q.id, topIndex: perf.topRowIndex(g), same: perf.visibleRows(g)[0].r.item === q.items[4000] };
            }
            finally {
                q.disableLazyLoading = lazy;
            }
        }));

        expect(requests).toHaveLength(2);
        expect(new Set(requests.map(r => r.query)), 'one request per grid').toEqual(new Set(states.map((s: any) => s.id)));
        expect(requests.every(r => r.skip === 4000)).toBe(true);
        for (const state of states)
            expect(state).toMatchObject({ topIndex: 4000, same: true });

        await recordPerf(page, testInfo, 'perf.ll-two-grids-concurrent', { counts: { requests: requests.length }, requests: { pages: requests } });
    });
});
