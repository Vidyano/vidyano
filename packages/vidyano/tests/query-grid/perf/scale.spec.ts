import { Locator, Page } from '@playwright/test';
import { requestLog, waitForGridReady } from '../_helpers/query-grid';
import { appendGrid, cdpMetrics, checkFrameBudget, collectGarbage, datasetOf, droppedFrames, expect, frameStats, gridLocator, median, mountPrefetched, parkMouse, perfCase, perfPage, prefetch, recordPerf, round, scrollToRow, setCpuThrottle, startFrameTrace, stopFrameTrace, test, traceFrames, waitFilled } from '../_helpers/perf';

/** A 120-frame rAF fling from the top to the end, with the number of frame gaps > 20ms and of scroll events more than 20ms apart. */
function flingToEnd(grid: Locator) {
    return grid.evaluate(async (g: any) => {
        const perf = (window as any).__perf;
        const scroller = perf.scroller(g).scroller;
        const max = scroller.scrollHeight - scroller.clientHeight;
        const scrolls: number[] = [];
        const onScroll = () => scrolls.push(performance.now());
        scroller.addEventListener('scroll', onScroll, { passive: true });
        const run = await perf.runFrames(120, (i: number) => scroller.scrollTop = max * (1 - Math.pow(1 - (i + 1) / 120, 3)));
        scroller.removeEventListener('scroll', onScroll);
        return { deltas: run.deltas as number[], frameGaps: run.deltas.filter((d: number) => d > 20).length, scrollGaps: scrolls.slice(1).filter((t, i) => t - scrolls[i] > 20).length };
    });
}

const WIDE_PINNED = { Id: { isPinned: true }, Text01: { isPinned: true } };

/** Mounts `query` 4 times on a prefetched query (1 warm-up) and returns the time to first rows plus DOM counts. */
async function mountRuns(page: Page, query: string, column: string, runs = 3) {
    await prefetch(page, query);
    await appendGrid(page, { column });
    const times: number[] = [];
    let removals = 0;
    for (let i = 0; i < runs; i++) {
        const result = await appendGrid(page, { column });
        times.push(round(result.firstRows));
        removals = Math.max(removals, result.removals);
        expect(result.removals, `${query}: [initializing] removed once`).toBe(1);
    }

    const grid = gridLocator(page);
    await waitForGridReady(grid);
    const dom = await grid.evaluate((g: any) => {
        const perf = (window as any).__perf;
        return { rowElements: perf.rows(g).length, deep: perf.deepCount(g) };
    });

    return { times, ...dom, grid };
}

function verticalFling(grid: Locator, toRow: number) {
    return grid.evaluate(async (g: any, toRow) => {
        const perf = (window as any).__perf;
        const scroller = perf.scroller(g).scroller;
        const end = Math.min(toRow * g.rowHeight, scroller.scrollHeight - scroller.clientHeight);
        const start = performance.now();
        const run = await perf.runFrames(120, (i: number) => scroller.scrollTop = end * (1 - Math.pow(1 - (i + 1) / 120, 3)), () => perf.coverage(g));
        return { deltas: run.deltas, blankFrames: run.samples.filter((s: any) => s.blank > 0 || s.gap > 1).length, blocking: perf.tbt(start, performance.now()) };
    }, toRow);
}

test.describe('Scale: 150k rows and 60 columns', () => {
    test.setTimeout(240000);

    test('jumping to the end of 150k fetches only the last reachable page', perfCase('perf.bd-jump-bottom', { timing: true }), async ({ page }, testInfo) => {
        await perfPage(page);
        const { grid } = await mountPrefetched(page, 'PeopleBig');
        await parkMouse(page);
        const log = requestLog(page);

        const jump = await grid.evaluate(async (g: any) => {
            const perf = (window as any).__perf;
            const scroller = perf.scroller(g).scroller;
            const start = performance.now();
            scroller.scrollTop = scroller.scrollHeight;
            const { time } = await perf.whenFrame(() => {
                const c = perf.coverage(g);
                return c.blank === 0 && c.rows > 0 && perf.firstColumnMatches(g, 'FirstName');
            });
            return { ms: time - start, topIndex: perf.topRowIndex(g), totalItems: g.query.totalItems };
        });
        await log.quiet();

        expect(jump.totalItems).toBe(150000);
        expect(jump.topIndex).toBeGreaterThan(99900);
        expect(log.of('ExecuteQuery').map(r => [r.skip, r.top])).toEqual([[99900, 100]]);
        expect.soft(jump.ms, 'settle at the bottom of 150k').toBeLessThanOrEqual(1500);

        await recordPerf(page, testInfo, 'perf.bd-jump-bottom', { dataset: await datasetOf(grid), counts: { requests: log.of('ExecuteQuery').length }, timings: { settleMs: [round(jump.ms)] } });
    });

    test('mount cost does not scale with 150k rows', perfCase('perf.bd-rows-bounded-mount', { timing: true }), async ({ page }, testInfo) => {
        await perfPage(page);
        const people = await mountRuns(page, 'People', 'FirstName');
        const big = await mountRuns(page, 'PeopleBig', 'FirstName');

        expect(big.rowElements).toBe(people.rowElements);
        expect(Math.abs(big.deep - people.deep) / people.deep, `deep ${big.deep} vs ${people.deep}`).toBeLessThanOrEqual(0.02);
        expect.soft(median(big.times), 'time to first rows of 150k vs 10k').toBeLessThanOrEqual(median(people.times) * 1.2 + 5);

        await recordPerf(page, testInfo, 'perf.bd-rows-bounded-mount', { counts: { rowElements: big.rowElements, deep10k: people.deep, deep150k: big.deep }, timings: { firstRows10k: people.times, firstRows150k: big.times }, repetitions: 3 });
    });

    test('wide query renders bounded cells per row', perfCase('perf.wd-cells-per-row'), async ({ page }, testInfo) => {
        await perfPage(page);
        const { grid } = await mountPrefetched(page, 'QueryGrid_Wide', { column: 'Id' });

        const result = await grid.evaluate((g: any) => {
            const perf = (window as any).__perf;
            const rows = perf.rows(g).filter((r: any) => !r.classList.contains('hidden'));
            const perRow = rows.map((r: any) => perf.deepCount(r));
            return {
                columns: g.columns.length,
                headers: g.shadowRoot.querySelectorAll('vi-query-grid-column-header').length,
                cellsPerRow: rows.map((r: any) => r.querySelectorAll('.column').length),
                elementsPerDataRow: Math.max(...perRow),
                check: perf.checkVisibleCells(g)
            };
        });

        expect(result.columns).toBe(60);
        expect(result.headers).toBe(60);
        expect(Math.max(...result.cellsPerRow)).toBeLessThanOrEqual(60);

        expect(result.check.checked).toBeGreaterThan(0);
        expect(result.check.wrong).toEqual([]);

        await recordPerf(page, testInfo, 'perf.wd-cells-per-row', { dataset: await datasetOf(grid), counts: { cellsPerRow: Math.max(...result.cellsPerRow), elementsPerDataRow: result.elementsPerDataRow, checkedCells: result.check.checked } });
    });

    test('time to first rows on a wide query', perfCase('perf.wd-mount-time', { timing: true }), async ({ page }, testInfo) => {
        await perfPage(page);
        await prefetch(page, 'QueryGrid_Wide');
        await setCpuThrottle(page, 4);
        await appendGrid(page, { column: 'Id' }); // warm-up

        const times: number[] = [];
        const tbt: number[] = [];
        for (let i = 0; i < 5; i++) {
            const result = await appendGrid(page, { column: 'Id' });
            await waitFilled(gridLocator(page));
            const blocking = await page.evaluate(start => (window as any).__perf.tbt(start, performance.now()), result.start);
            times.push(round(result.firstRows));
            tbt.push(round(blocking.tbt));
            expect(result.removals, '[initializing] removed once').toBe(1);
            expect(result.readds).toBe(0);
        }
        await setCpuThrottle(page, 1);

        expect.soft(median(times), 'median time to first rows (wide, 4x)').toBeLessThanOrEqual(1500);

        await recordPerf(page, testInfo, 'perf.wd-mount-time', { cpuThrottle: 4, dataset: await datasetOf(gridLocator(page)), timings: { firstRows4x: times, tbt4x: tbt }, repetitions: 5 });
    });

    test('horizontal fling across 60 columns with pinned columns', perfCase('perf.wd-hscroll'), async ({ page }, testInfo) => {
        await perfPage(page);
        const { grid } = await mountPrefetched(page, 'QueryGrid_Wide', { column: 'Id', userSettings: WIDE_PINNED });
        await parkMouse(page);
        await grid.evaluate((g: any) => (window as any).__perf.observe(g));

        const before = await cdpMetrics(page);
        await startFrameTrace(page);
        const result = await grid.evaluate(async (g: any) => {
            const perf = (window as any).__perf;
            const scroller = perf.scroller(g).scroller;
            const max = scroller.scrollWidth - scroller.clientWidth;
            const pinned = g.columns.filter((c: any) => c.isPinned).map((c: any) => c.name);
            const initial = perf.columnLefts(g);
            performance.mark('perf-trace-start');
            const run = await perf.runFrames(60, (i: number) => scroller.scrollLeft = Math.round(max * (i + 1) / 60), () => {
                const lefts = perf.columnLefts(g);
                const view = perf.scroller(g).getBoundingClientRect();
                let misaligned = 0;
                for (const [name, headerLeft] of Object.entries<number>(lefts.headers)) {
                    if (headerLeft > view.right || headerLeft < view.left - 2000)
                        continue;

                    if (Math.abs(headerLeft - lefts.cells[name]) > 1)
                        misaligned++;
                }

                const pinnedMoved = pinned.filter((name: string) => Math.abs(lefts.cells[name] - initial.cells[name]) > 1 || Math.abs(lefts.headers[name] - initial.headers[name]) > 1).length;
                return { misaligned, pinnedMoved };
            });
            performance.mark('perf-trace-end');

            return { pinned, max, deltas: run.deltas, misalignedFrames: run.samples.filter((s: any) => s.misaligned > 0).length, pinnedMovedFrames: run.samples.filter((s: any) => s.pinnedMoved > 0).length, frames: run.samples.length };
        });
        const trace = traceFrames(await stopFrameTrace(page));
        const after = await cdpMetrics(page);
        const mutations = await grid.evaluate(() => (window as any).__perf.takeMutations());
        const frames = { ...frameStats(result.deltas), ...droppedFrames(result.deltas) };

        expect(result.pinned).toEqual(['Id', 'Text01']);
        expect(result.max).toBeGreaterThan(1000);
        expect(result.misalignedFrames, 'misaligned frames').toBe(0);
        expect(result.pinnedMovedFrames, 'frames in which a pinned column moved').toBe(0);
        expect(mutations.rowRecords, 'row mutations').toBe(0);
        expect(trace, 'frames in the fling trace').not.toBeNull();
        // Report-only: 60 columns at 1x does not hold the 60fps budget today (p95 ~30ms, 20-38% missed vsyncs)
        checkFrameBudget(testInfo, 'wide horizontal fling (rAF)', frames);
        checkFrameBudget(testInfo, 'wide horizontal fling (trace)', trace!);

        await recordPerf(page, testInfo, 'perf.wd-hscroll', {
            frames: { ...frames, trace },
            counts: { misalignedFrames: result.misalignedFrames, rowMutations: mutations.rowRecords },
            cdp: { RecalcStyleDurationPerFrame: round((after.RecalcStyleDuration - before.RecalcStyleDuration) / result.frames, 5), RecalcStyleCountPerFrame: round((after.RecalcStyleCount - before.RecalcStyleCount) / result.frames, 3) }
        });
    });

    test('vertical fling re-formatting 60 cells per row', perfCase('perf.wd-vscroll', { timing: true }), async ({ page }, testInfo) => {
        await perfPage(page);
        const { grid } = await mountPrefetched(page, 'QueryGrid_Wide', { column: 'Id' });
        await parkMouse(page);
        await setCpuThrottle(page, 4);
        await grid.evaluate((g: any) => (window as any).__perf.observe(g));

        const fling = await verticalFling(grid, 1900);
        await waitFilled(grid);
        await setCpuThrottle(page, 1);
        const mutations = await grid.evaluate(() => (window as any).__perf.takeMutations());
        const frames = frameStats(fling.deltas);

        expect(frames.count).toBe(119);
        expect.soft(frames.p95, 'wide vertical fling p95 at 4x').toBeLessThanOrEqual(120);

        await recordPerf(page, testInfo, 'perf.wd-vscroll', { cpuThrottle: 4, frames, counts: { blankFrames: fling.blankFrames, cellTextWrites: mutations.cellTextWrites }, timings: { tbt: [round(fling.blocking.tbt)], longestTask: [round(fling.blocking.longest)] } });
    });

    test('fling through 150k rows', perfCase('perf.bd-fling', { timing: true }), async ({ page }, testInfo) => {
        await perfPage(page);

        // Warm-up fling, then the 10k reference fling and the 150k fling on fresh grids
        const warmUp = (await mountPrefetched(page, 'People')).grid;
        await flingToEnd(warmUp);
        await waitFilled(warmUp);

        const runs: Record<string, any> = {};
        for (const query of ['People', 'PeopleBig']) {
            const { grid } = await mountPrefetched(page, query);
            await parkMouse(page);
            const log = requestLog(page);
            const fling = await flingToEnd(grid);
            await waitFilled(grid);
            await log.quiet();

            const requests = log.of('ExecuteQuery').map(r => [r.skip, r.top]);
            runs[query] = { frames: frameStats(fling.deltas), frameGaps: fling.frameGaps, scrollGaps: fling.scrollGaps, requests };
            expect(requests.length, `${query}: requests ${JSON.stringify(requests)}, gaps ${fling.scrollGaps}`).toBeLessThanOrEqual(1 + Math.max(fling.frameGaps, fling.scrollGaps));
        }

        expect(await gridLocator(page).evaluate((g: any) => g.query.totalItems)).toBe(150000);
        expect.soft(runs.PeopleBig.frames.p95, 'p95 of the 150k fling vs the 10k fling').toBeLessThanOrEqual(runs.People.frames.p95 * 1.2 + 2);

        await recordPerf(page, testInfo, 'perf.bd-fling', { frames: { fling10k: runs.People.frames, fling150k: runs.PeopleBig.frames }, counts: { requests10k: runs.People.requests.length, requests150k: runs.PeopleBig.requests.length }, requests: { fling10k: runs.People.requests, fling150k: runs.PeopleBig.requests } });
    });

    test('sort turnaround on 150k', perfCase('perf.bd-sort'), async ({ page }, testInfo) => {
        await perfPage(page);
        const { grid } = await mountPrefetched(page, 'PeopleBig');
        await parkMouse(page);
        await scrollToRow(grid, 3000);
        await waitFilled(grid);
        const log = requestLog(page);
        await log.quiet();
        log.clear();

        await grid.evaluate((g: any) => {
            const w = window as any;
            const perf = w.__perf;
            w.__sorted = new Promise(resolve => window.addEventListener('pointerup', () => {
                const start = performance.now();
                const items = g.query.items;
                perf.whenFrame(() => !g.query.isBusy && g.query.items !== items && perf.topRowIndex(g) === 0 && perf.firstColumnMatches(g, 'LastName'), 30000).then((r: any) => resolve(r.time - start));
            }, { capture: true, once: true }));
        });
        await grid.locator('vi-query-grid-column-header[name="LastName"] .label').click();
        const ms = await page.evaluate(() => (window as any).__sorted);
        await waitForGridReady(grid);
        await log.quiet();

        expect(log.of('ExecuteQuery').map(r => [r.sortOptions, r.skip])).toEqual([['LastName', undefined]]);
        expect(await grid.evaluate((g: any) => (window as any).__perf.topRowIndex(g))).toBe(0);

        await recordPerf(page, testInfo, 'perf.bd-sort', { counts: { requests: log.of('ExecuteQuery').length }, timings: { sortTurnaround: [round(ms)] } });
    });

    test('heap growth per loaded page', perfCase('perf.bd-heap-after-paging'), async ({ page }, testInfo) => {
        await perfPage(page);
        const { grid } = await mountPrefetched(page, 'PeopleBig');
        await parkMouse(page);

        // 50 distinct pages from a fixed seeded list (rows below the 100,000 physical limit)
        let seed = 1234;
        const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        const pages = new Set<number>();
        while (pages.size < 50)
            pages.add(1 + Math.floor(random() * 990));

        await collectGarbage(page);
        const before = await cdpMetrics(page);
        const loadedBefore = await grid.evaluate((g: any) => {
            const q = g.query;
            q.disableLazyLoading = true;
            try {
                return q.items.filter((i: any) => !!i).length;
            }
            finally {
                q.disableLazyLoading = false;
            }
        });
        for (const pageIndex of pages) {
            await scrollToRow(grid, pageIndex * 100 + 10);
            await waitFilled(grid);
        }
        await scrollToRow(grid, 0);
        await waitFilled(grid);
        await collectGarbage(page);
        const after = await cdpMetrics(page);
        const loaded = await grid.evaluate((g: any) => {
            const q = g.query;
            q.disableLazyLoading = true;
            try {
                return q.items.filter((i: any) => !!i).length;
            }
            finally {
                q.disableLazyLoading = false;
            }
        }) - loadedBefore;

        const growth = after.JSHeapUsedSize - before.JSHeapUsedSize;
        const perItem = round(growth / loaded);
        expect(loaded).toBeGreaterThanOrEqual(50 * 100);
        // Loose sanity bound
        expect.soft(perItem, 'heap growth per loaded item (bytes)').toBeLessThanOrEqual(50 * 1024);

        await recordPerf(page, testInfo, 'perf.bd-heap-after-paging', { counts: { loadedItems: loaded }, memory: { heapGrowth: growth, heapGrowthPerItem: perItem } });
    });

    test('60 columns are measured in one pass', perfCase('perf.wd-single-measure-pass'), async ({ page }, testInfo) => {
        await perfPage(page);
        await prefetch(page, 'QueryGrid_Wide');
        await appendGrid(page, { column: 'Id' }); // warm-up
        await waitFilled(gridLocator(page));

        const before = await cdpMetrics(page);
        const result = await appendGrid(page, { column: 'Id', recordTemplate: true });
        const grid = gridLocator(page);
        await waitForGridReady(grid);
        const after = await cdpMetrics(page);
        const final = await grid.evaluate((g: any) => getComputedStyle(g).getPropertyValue('--vi-query-grid-columns').trim());

        const tokens = final.split(/\s+(?![^(]*\))/);
        expect(tokens).toHaveLength(61);
        expect(tokens.slice(0, 60).every(t => /^\d+px$/.test(t)), final).toBe(true);
        expect(tokens[60]).toMatch(/^minmax\(0(px)?,\s*1fr\)$/);
        expect(result.templates!.length, `templates: ${result.templates!.length}`).toBeLessThanOrEqual(2);
        expect(result.removals).toBe(1);

        await recordPerf(page, testInfo, 'perf.wd-single-measure-pass', { counts: { templateWrites: result.templates!.length }, timings: { LayoutDuration: [round((after.LayoutDuration - before.LayoutDuration) * 1000, 2)] }, cdp: { LayoutCount: after.LayoutCount - before.LayoutCount } });
    });
});
