import { holdExecuteQuery } from '../_helpers/grid';
import { mountGrid, requestLog, pauseClock } from '../_helpers/query-grid';
import { cdpMetrics, checkFrameBudget, datasetOf, droppedFrames, expect, frameStats, mountPrefetched, parkMouse, perfCase, perfPage, recordPerf, round, runScrollScenarios, scrollToRow, setCpuThrottle, startFrameTrace, stopFrameTrace, test, traceFrames, traceLayouts, waitFilled } from '../_helpers/perf';

test.describe('Vertical scrolling', () => {
    test.setTimeout(180000);

    test('scrolling inside the overscan window does no DOM work', perfCase('perf.vw-small-scroll-zero-mutations'), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountGrid(page);
        await parkMouse(page);
        const log = requestLog(page);

        const result = await grid.evaluate(async (g: any) => {
            const perf = (window as any).__perf;
            const scroller = perf.scroller(g).scroller;
            const pool = perf.rows(g).length;
            const k = pool - Math.ceil(scroller.clientHeight / g.rowHeight) - 1;

            perf.observe(g);
            await perf.runFrames(k, (i: number) => scroller.scrollTop = (i + 1) * g.rowHeight);
            return { pool, k };
        });

        // A page load would be sent 20ms after the last scroll; give it time to show up
        await page.waitForTimeout(300);
        const mutations = await grid.evaluate(() => (window as any).__perf.takeMutations());

        expect(result.k).toBeGreaterThan(0);
        expect(mutations.rowRecords, 'row and cell mutations inside the overscan').toBe(0);
        expect(mutations.rowAdds + mutations.rowRemoves).toBe(0);
        expect(log.requests).toHaveLength(0);

        await recordPerf(page, testInfo, 'perf.vw-small-scroll-zero-mutations', { counts: { pool: result.pool, steps: result.k, rowMutations: mutations.rowRecords, otherMutations: mutations.otherRecords, requests: log.requests.length } });
    });

    test('rows cover the viewport in every frame while scrolling', perfCase('perf.vw-coverage-every-frame'), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountGrid(page);
        await parkMouse(page);

        // Page loads wait for the scroll to release them: pages are in flight and arrive while scrolling, whatever the frame rate
        const held: (() => void)[] = [];
        await page.route(/\/ExecuteQuery$/, route => {
            held.push(() => route.continue().catch(() => {}));
        });
        await page.exposeFunction('releasePages', () => held.splice(0).forEach(release => release()));

        const result = await grid.evaluate(async (g: any) => {
            const w = window as any;
            const perf = w.__perf;
            const q = g.query;
            const scroller = perf.scroller(g).scroller;
            const rh = g.rowHeight;
            const segment = 50;
            const frames = 4 * segment;
            // 7.5 rows per frame: window starts of both parities and positions between rows
            const step = 7.5 * rh;

            let lastUpdated = q.lastUpdated;
            const loading = () => {
                const lazy = q.disableLazyLoading;
                q.disableLazyLoading = true;
                try {
                    const first = Math.floor(scroller.scrollTop / rh);
                    const last = Math.ceil((scroller.scrollTop + scroller.clientHeight) / rh) - 1;
                    let count = 0;
                    for (let i = first; i <= last; i++)
                        count += q.items[i] === null ? 1 : 0;

                    return count;
                }
                finally {
                    q.disableLazyLoading = lazy;
                }
            };
            const measure = () => {
                const arrived = q.lastUpdated !== lastUpdated;
                lastUpdated = q.lastUpdated;
                return { ...perf.coverage(g), loading: loading(), arrived };
            };

            // Each segment after the first starts over rows whose page is requested and held; its second frame releases the held pages
            const scroll = async (position: (frame: number) => number) => {
                const samples: any[] = [];
                for (let start = 0; start < frames; start += segment) {
                    if (start > 0)
                        await perf.whenFrame(() => loading() > 0);

                    const run = await perf.runFrames(segment, (i: number) => {
                        if (start > 0 && i === 1)
                            w.releasePages();

                        scroller.scrollTop = position(start + i) * step;
                    }, measure);
                    samples.push(...run.samples);
                }

                // Released pages that did not arrive yet arrive in frames that still scroll
                const end = scroller.scrollTop;
                while (!samples.some(s => s.arrived)) {
                    w.releasePages();
                    const run = await perf.runFrames(10, (i: number) => scroller.scrollTop = end + (i % 2 ? rh : 0), measure);
                    samples.push(...run.samples);
                }

                return { samples };
            };

            const down = await scroll(frame => frame + 1);
            // Up from twice as far, so its pauses fall in pages the way down did not load
            const up = await scroll(frame => 2 * frames - 1 - frame);
            const summary = (run: any) => ({
                frames: run.samples.length,
                uncovered: run.samples.filter((s: any) => s.gap > 1).length,
                maxGap: Math.max(...run.samples.map((s: any) => s.gap)),
                loadingFrames: run.samples.filter((s: any) => s.loading > 0).length,
                arrivals: run.samples.filter((s: any) => s.arrived).length
            });

            // A single upward step, then idle: the viewport stays covered without a further scroll (two targets, so one
            // of them aligns the window end to an odd start), in pages the scrolls above never requested
            const steps = [];
            for (const target of [5995, 5994]) {
                const step = await perf.runFrames(2, (i: number) => scroller.scrollTop = [6001, target][i] * rh, () => perf.coverage(g));
                // Idle until the rows in view are requested (their page stays held)
                await perf.whenFrame(() => loading() > 0);
                steps.push({ target, stepGap: step.samples[1].gap, idleGap: perf.coverage(g).gap });
            }

            return { down: summary(down), up: summary(up), steps };
        });

        expect(result.down.frames).toBeGreaterThanOrEqual(200);
        expect(result.down.loadingFrames, 'frames scrolling down over rows whose page is loading').toBeGreaterThan(0);
        expect(result.down.arrivals, 'pages arriving while scrolling down').toBeGreaterThan(0);
        expect(result.down.uncovered, 'uncovered frames scrolling down').toBe(0);

        await recordPerf(page, testInfo, 'perf.vw-coverage-every-frame', { counts: { uncoveredDown: result.down.uncovered, uncoveredUp: result.up.uncovered, maxGapUp: result.up.maxGap }, frames: result });

        // Scrolling up aligns the window to the viewport end, keeping an even start must not uncover the last visible row
        expect(result.up.frames).toBeGreaterThanOrEqual(200);
        expect(result.up.loadingFrames, 'frames scrolling up over rows whose page is loading').toBeGreaterThan(0);
        expect(result.up.arrivals, 'pages arriving while scrolling up').toBeGreaterThan(0);
        expect(result.up.uncovered, 'uncovered frames scrolling up').toBe(0);
        for (const step of result.steps) {
            expect(step.stepGap, `uncovered strip after one upward step to row ${step.target}`).toBeLessThanOrEqual(1);
            expect(step.idleGap, `uncovered strip after an upward step to row ${step.target} and idle`).toBeLessThanOrEqual(1);
        }
    });

    test('no row elements are created or destroyed while scrolling', perfCase('perf.vw-row-elements-constant'), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountGrid(page);
        await parkMouse(page);

        const before = await grid.evaluate((g: any) => {
            const perf = (window as any).__perf;
            const count = perf.deepCount(document);
            perf.observe(g);
            return count;
        });

        await runScrollScenarios(page, grid);

        const after = await grid.evaluate((g: any) => {
            const perf = (window as any).__perf;
            return { mutations: perf.takeMutations(), deep: perf.deepCount(document) };
        });

        expect(after.mutations.rowAdds).toBe(0);
        expect(after.mutations.rowRemoves).toBe(0);
        expect(after.deep - before, 'deep element delta').toBe(0);

        await recordPerf(page, testInfo, 'perf.vw-row-elements-constant', { counts: { rowAdds: after.mutations.rowAdds, rowRemoves: after.mutations.rowRemoves, deepBefore: before, deepAfter: after.deep } });
    });

    test('revisiting loaded regions shows no placeholder frames', perfCase('perf.vw-scroll-back-no-blank'), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountGrid(page);
        await parkMouse(page);

        // Load pages 0-6, the page at 3,000 and the last page
        for (let row = 0; row <= 650; row += 50) {
            await scrollToRow(grid, row);
            await waitFilled(grid);
        }
        for (const row of [3000, 100000]) {
            await scrollToRow(grid, row);
            await waitFilled(grid);
        }
        await scrollToRow(grid, 600);
        await waitFilled(grid);

        const log = requestLog(page);
        const result = await grid.evaluate(async (g: any) => {
            const perf = (window as any).__perf;
            const scroller = perf.scroller(g).scroller;
            const rh = g.rowHeight;
            const back = await perf.runFrames(30, (i: number) => scroller.scrollTop = (600 - (i + 1) * 20) * rh, () => perf.coverage(g));

            // Revisits: every jump is followed by two more sampled frames
            const targets = [3000, 0, 3000, 100000, 0].flatMap(row => [row, row, row]);
            const revisits = await perf.runFrames(targets.length, (i: number) => scroller.scrollTop = targets[i] * rh, () => perf.coverage(g));

            // Blank = a visible row without its item; uncovered = a strip of the viewport without a row
            const blank = (run: any) => run.samples.filter((s: any) => s.blank > 0).length;
            const uncovered = (run: any) => run.samples.filter((s: any) => s.gap > 1).length;
            return { backFrames: back.samples.length, backBlank: blank(back), backUncovered: uncovered(back), revisitFrames: revisits.samples.length, revisitBlank: blank(revisits), revisitUncovered: uncovered(revisits), top: scroller.scrollTop };
        });

        // A page load would be sent 20ms after the last scroll; give it time to show up
        await page.waitForTimeout(300);

        expect(result.top).toBe(0);
        expect(result.backBlank, 'blank frames scrolling back 600 -> 0').toBe(0);
        expect(result.revisitBlank, 'blank frames on revisits').toBe(0);
        expect(result.backUncovered, 'uncovered frames scrolling back 600 -> 0').toBe(0);
        expect(result.revisitUncovered, 'uncovered frames on revisits').toBe(0);
        expect(log.requests).toHaveLength(0);

        await recordPerf(page, testInfo, 'perf.vw-scroll-back-no-blank', { counts: { requests: log.requests.length, blankFrames: result.backBlank + result.revisitBlank }, frames: result });
    });

    for (const rate of [1, 4]) {
        test(`fast vertical fling frame metrics (${rate}x CPU)`, perfCase('perf.vw-fling-frame-metrics', { timing: true }), async ({ page }, testInfo) => {
            await perfPage(page);

            // Warm-up fling on a first query, then measure on a fresh grid for a fresh query (nothing loaded yet)
            const warmUp = (await mountPrefetched(page, 'People')).grid;
            await warmUp.evaluate((g: any) => {
                const perf = (window as any).__perf;
                const scroller = perf.scroller(g).scroller;
                const max = scroller.scrollHeight - scroller.clientHeight;
                return perf.runFrames(120, (i: number) => scroller.scrollTop = max * (i + 1) / 120);
            });
            await waitFilled(warmUp);

            const { grid } = await mountPrefetched(page, 'People');
            await parkMouse(page);
            await setCpuThrottle(page, rate);

            // At 1x the frames also come from a Chrome trace (DrawFrame intervals of the page's compositor)
            const traced = rate === 1;
            if (traced)
                await startFrameTrace(page);

            const fling = await grid.evaluate(async (g: any) => {
                const perf = (window as any).__perf;
                const scroller = perf.scroller(g).scroller;
                const max = scroller.scrollHeight - scroller.clientHeight;
                const start = performance.now();
                performance.mark('perf-trace-start');
                const run = await perf.runFrames(120, (i: number) => scroller.scrollTop = max * (1 - Math.pow(1 - (i + 1) / 120, 3)), () => perf.coverage(g));
                performance.mark('perf-trace-end');
                const end = performance.now();
                const settled = await perf.whenFrame(() => {
                    const c = perf.coverage(g);
                    return !g.query.isBusy && c.blank === 0 && c.gap <= 1;
                });
                const index = perf.topRowIndex(g);
                return {
                    deltas: run.deltas,
                    blankFrames: run.samples.filter((s: any) => s.blank > 0 || s.gap > 1).length,
                    blocking: perf.tbt(start, end),
                    settleMs: settled.time - end,
                    topIndex: index,
                    expectedTopIndex: Math.floor(scroller.scrollTop / g.rowHeight)
                };
            });

            // 50 wheel steps back up
            const box = (await grid.boundingBox())!;
            await page.mouse.move(box.x + 400, box.y + 300);
            await grid.evaluate(() => (window as any).__perf.startFrames());
            const wheelStart = await page.evaluate(() => (performance.mark('perf-wheel-start'), performance.now()));
            for (let i = 0; i < 50; i++)
                await page.mouse.wheel(0, -2000);

            const wheel = await page.evaluate(start => (performance.mark('perf-wheel-end'), { deltas: (window as any).__perf.stopFrames(), blocking: (window as any).__perf.tbt(start, performance.now()) }), wheelStart);
            const events = traced ? await stopFrameTrace(page) : [];
            await waitFilled(grid);
            await setCpuThrottle(page, 1);

            const frames = { ...frameStats(fling.deltas), ...droppedFrames(fling.deltas) };
            const wheelFrames = { ...frameStats(wheel.deltas), ...droppedFrames(wheel.deltas) };
            const flingTrace = traced ? traceFrames(events) : null;
            // The wheel window holds idle gaps between the wheel events (nothing to draw): only its pipeline states are meaningful
            const wheelTrace = traced ? traceFrames(events, 'perf-wheel-start', 'perf-wheel-end') : null;

            expect(fling.topIndex).toBe(fling.expectedTopIndex);
            expect.soft(frames.p95, 'fling frame p95').toBeLessThanOrEqual(rate === 1 ? 50 : 120);
            if (traced) {
                expect(flingTrace, 'frames in the fling trace').not.toBeNull();
                checkFrameBudget(testInfo, 'vertical fling (rAF)', frames, { hard: true });
                checkFrameBudget(testInfo, 'vertical fling (trace)', flingTrace!, { hard: true });
            }
            expect.soft(fling.settleMs, 'settle after fling').toBeLessThanOrEqual(1000);
            expect.soft(fling.blocking.longest, 'no task over 100ms').toBeLessThanOrEqual(100);

            await recordPerf(page, testInfo, `perf.vw-fling-frame-metrics.${rate}x`, {
                cpuThrottle: rate,
                dataset: await datasetOf(grid),
                frames: { fling: frames, wheel: wheelFrames, ...(traced ? { flingTrace, wheelTrace } : {}) },
                counts: { blankFrames: fling.blankFrames },
                timings: { settleMs: [round(fling.settleMs)], tbt: [round(fling.blocking.tbt)], longestTask: [round(fling.blocking.longest)], wheelTbt: [round(wheel.blocking.tbt)] },
                cdp: await cdpMetrics(page)
            });
        });
    }

    test('an idle settled grid does no work', perfCase('perf.vw-idle-no-work'), async ({ page }, testInfo) => {
        // On the page clock, idle page time passes on demand and runs every timer due in it
        await page.clock.install();
        await perfPage(page);
        const grid = await mountGrid(page);
        await parkMouse(page);
        await waitFilled(grid);
        const log = requestLog(page);
        await log.quiet(500);

        await grid.evaluate((g: any) => {
            const w = window as any;
            const counters = w.__idle = { raf: 0, timeout: 0, interval: 0, idle: 0, sources: [] as string[] };
            const wrap = (name: 'requestAnimationFrame' | 'setTimeout' | 'setInterval' | 'requestIdleCallback', key: 'raf' | 'timeout' | 'interval' | 'idle') => {
                const original = (window as any)[name];
                if (!original)
                    return;

                (window as any)[name] = function(...args: any[]) {
                    counters[key]++;
                    if (counters.sources.length < 10)
                        counters.sources.push(`${name}: ${(new Error().stack ?? '').split('\n').slice(2, 4).join(' | ')}`);

                    return original.apply(this, args);
                };
            };
            wrap('requestAnimationFrame', 'raf');
            wrap('setTimeout', 'timeout');
            wrap('setInterval', 'interval');
            wrap('requestIdleCallback', 'idle');
            w.__perf.observe(g);
        });

        await pauseClock(page);

        // Registrations in the first 200ms are allowed (trailing work of the settle); then reset and watch 2s
        await page.clock.runFor(200);
        await grid.evaluate((g: any) => {
            const w = window as any;
            Object.assign(w.__idle, { raf: 0, timeout: 0, interval: 0, idle: 0, sources: [] });
            w.__perf.takeMutations();
            w.__perf.observe(g);
        });
        log.clear();

        await page.clock.runFor(2000);
        await log.quiet();
        const result = await grid.evaluate(() => {
            const w = window as any;
            return { counters: w.__idle, mutations: w.__perf.takeMutations() };
        });
        await page.clock.resume();

        expect(result.mutations.total, `grid mutations: ${result.mutations.other.join(', ')}`).toBe(0);
        expect(log.requests).toHaveLength(0);
        expect({ raf: result.counters.raf, timeout: result.counters.timeout, interval: result.counters.interval, idle: result.counters.idle }, result.counters.sources.join('\n')).toEqual({ raf: 0, timeout: 0, interval: 0, idle: 0 });

        await recordPerf(page, testInfo, 'perf.vw-idle-no-work', { counts: { mutations: result.mutations.total, requests: log.requests.length, ...result.counters, sources: undefined } });
    });

    test('an idle settled grid runs no long tasks', perfCase('perf.vw-idle-no-long-tasks', { timing: true }), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountGrid(page);
        await parkMouse(page);
        await waitFilled(grid);
        const log = requestLog(page);
        await log.quiet(500);

        // The first 200ms are allowed trailing work of the settle; then watch 2s
        await page.waitForTimeout(200);
        const start = await page.evaluate(() => performance.now());
        // Idle on purpose: proving that nothing happens takes waiting
        await page.waitForTimeout(2000);
        const blocking = await page.evaluate(start => (window as any).__perf.tbt(start, performance.now()), start);

        expect(blocking.count).toBe(0);

        await recordPerf(page, testInfo, 'perf.vw-idle-no-long-tasks', { counts: { longTasks: blocking.count }, timings: { tbt: [round(blocking.tbt)], longestTask: [round(blocking.longest)] } });
    });

    test('no layout thrash while scrolling', perfCase('perf.vw-forced-reflows-during-scroll', { timing: true }), async ({ page }, testInfo) => {
        await perfPage(page);
        const { grid } = await mountPrefetched(page, 'People');
        await parkMouse(page);

        const before = await cdpMetrics(page);
        await startFrameTrace(page);
        const fling = await grid.evaluate(async (g: any) => {
            const perf = (window as any).__perf;
            const scroller = perf.scroller(g).scroller;
            const max = scroller.scrollHeight - scroller.clientHeight;
            let last = perf.rows(g)[0].item;
            performance.mark('perf-trace-start');
            // The measure only reads properties (no layout), so every forced layout comes from the grid
            const run = await perf.runFrames(120, (i: number) => scroller.scrollTop = max * (1 - Math.pow(1 - (i + 1) / 120, 3)), () => {
                const item = perf.rows(g)[0].item;
                const shifted = item !== last;
                last = item;
                return shifted;
            });
            performance.mark('perf-trace-end');
            return { frames: run.samples.length, shifts: run.samples.filter((s: boolean) => s).length };
        });
        const layouts = traceLayouts(await stopFrameTrace(page));
        const after = await cdpMetrics(page);
        await waitFilled(grid);

        const layoutsPerFrame = round((after.LayoutCount - before.LayoutCount) / fling.frames, 2);
        expect(layouts, 'layout events in the fling trace').not.toBeNull();
        expect(fling.shifts).toBeGreaterThan(0);
        expect(layouts!.forced, `forced layouts (${JSON.stringify(layouts!.forcedBy)}) for ${fling.shifts} window shifts`).toBeLessThanOrEqual(fling.shifts);
        expect(layoutsPerFrame, 'CDP layouts per frame').toBeLessThanOrEqual(2);

        await recordPerf(page, testInfo, 'perf.vw-forced-reflows-during-scroll', { counts: { forcedLayouts: layouts!.forced, windowShifts: fling.shifts, traceLayouts: layouts!.layouts, LayoutCount: after.LayoutCount - before.LayoutCount }, cdp: { layoutsPerFrame, forcedBy: layouts!.forcedBy }, timings: { traceLayoutMs: [layouts!.layoutMs] } });
    });

    test('real wheel scrolling moves by the wheel deltas', perfCase('perf.vw-wheel-scroll-position'), async ({ page }, testInfo) => {
        await perfPage(page);
        const { grid } = await mountPrefetched(page, 'People');
        await parkMouse(page);
        const log = requestLog(page);

        const box = (await grid.boundingBox())!;
        await page.mouse.move(box.x + 400, box.y + 300);
        await grid.evaluate((g: any) => {
            const w = window as any;
            w.__wheelDelta = 0;
            w.__wheelTops = [];
            const scroller = w.__perf.scroller(g);
            scroller.addEventListener('wheel', (e: WheelEvent) => {
                w.__wheelDelta += e.deltaY;
                w.__wheelTops.push(scroller.scroller.scrollTop);
            }, { passive: true, capture: true });
        });

        // A page arrives between the wheel events: the first 20 are sent while the pages are held, the held pages arrive,
        // then the other 20
        const release = await holdExecuteQuery(page);
        for (let i = 0; i < 20; i++)
            await page.mouse.wheel(0, 600);

        await expect.poll(() => log.of('ExecuteQuery').length, 'a held page request').toBeGreaterThan(0);
        const held = log.of('ExecuteQuery').length;
        await release();
        await log.quiet();
        for (let i = 0; i < 20; i++)
            await page.mouse.wheel(0, 600);

        // The native scroll comes to rest
        let last = -1;
        await expect.poll(async () => {
            const top = await grid.evaluate((g: any) => (window as any).__perf.scroller(g).scroller.scrollTop);
            const stopped = top === last;
            last = top;
            return stopped;
        }, { message: 'the scroll came to rest', intervals: [100] }).toBe(true);
        await waitFilled(grid);
        await log.quiet();

        const result = await grid.evaluate((g: any) => {
            const perf = (window as any).__perf;
            const scroller = perf.scroller(g).scroller;
            return { top: scroller.scrollTop, viewport: scroller.clientHeight, wheelDelta: (window as any).__wheelDelta, wheelTops: (window as any).__wheelTops as number[], topIndex: perf.topRowIndex(g), expectedTopIndex: Math.floor(scroller.scrollTop / g.rowHeight), cells: perf.checkVisibleCells(g) };
        });

        // 40 x 600px end near 24,000px (the scroll position never jumps beyond the wheel deltas, e.g. when a page arrives)
        const steps = [...result.wheelTops.slice(1), result.top].map((top, i) => top - result.wheelTops[i]);
        expect(result.wheelDelta).toBe(24000);
        expect(Math.abs(result.top - 24000), `scrollTop ${result.top}; scrollTop change per wheel event: ${steps}`).toBeLessThanOrEqual(result.viewport);
        expect(result.topIndex).toBe(result.expectedTopIndex);
        expect(result.cells.wrong).toEqual([]);

        await recordPerf(page, testInfo, 'perf.vw-wheel-scroll-position', { counts: { requests: log.of('ExecuteQuery').length, heldRequests: held }, dataset: { scrollTopPerWheel: steps, end: result.top }, requests: { pages: log.of('ExecuteQuery').map(r => [r.skip, r.top]) } });
    });

    test('real wheel scrolling performance', perfCase('perf.vw-wheel-interaction', { timing: true }), async ({ page }, testInfo) => {
        await perfPage(page);
        const { grid } = await mountPrefetched(page, 'People');
        await parkMouse(page);
        const log = requestLog(page);

        const box = (await grid.boundingBox())!;
        await page.mouse.move(box.x + 400, box.y + 300);
        await grid.evaluate((g: any) => {
            const w = window as any;
            w.__wheelTops = [];
            const scroller = w.__perf.scroller(g);
            scroller.addEventListener('wheel', () => w.__wheelTops.push(scroller.scroller.scrollTop), { passive: true, capture: true });
            w.__perf.startFrames();
        });
        for (let i = 0; i < 40; i++) {
            await page.mouse.wheel(0, 600);
            // The scenario's input pacing (one wheel event per 16ms), not a wait for a result
            await page.waitForTimeout(16);
        }

        const deltas: number[] = await page.evaluate(() => (window as any).__perf.stopFrames());
        await waitFilled(grid);
        await log.quiet();

        const result = await grid.evaluate((g: any) => {
            const scroller = (window as any).__perf.scroller(g).scroller;
            return { top: scroller.scrollTop, wheelTops: (window as any).__wheelTops as number[] };
        });
        const frames = { ...frameStats(deltas), ...droppedFrames(deltas) };

        const steps = [...result.wheelTops.slice(1), result.top].map((top, i) => top - result.wheelTops[i]);
        expect.soft(frames.p95, 'wheel frame p95').toBeLessThanOrEqual(50);

        await recordPerf(page, testInfo, 'perf.vw-wheel-interaction', { counts: { requests: log.of('ExecuteQuery').length }, frames, dataset: { scrollTopPerWheel: steps, end: result.top }, requests: { pages: log.of('ExecuteQuery').map(r => [r.skip, r.top]) } });
    });
});
