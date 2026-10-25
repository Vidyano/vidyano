import { Page } from '@playwright/test';
import { mountGrid, nextFrames, requestLog, scrollGrid, waitForGridReady, pauseClock } from '../_helpers/query-grid';
import { appendGrid, cdpMetrics, datasetOf, expect, gridLocator, median, mountPrefetched, perfCase, perfPage, prefetch, recordPerf, round, scrollToRow, setCpuThrottle, startFrameTrace, stopFrameTrace, test, traceLayouts, waitFilled } from '../_helpers/perf';
import { consoleErrors } from '../_helpers/grid';

/** Creates window.q: a People query that was never searched (a clone of the service's query). */
async function unsearchedQuery(page: Page) {
    const unsearched = await page.evaluate(async () => {
        const w = window as any;
        const source = await w.service.getQuery('People');
        w.q = source.clone();
        return { hasSearched: !!w.q.hasSearched, items: w.q.items?.length ?? 0 };
    });
    expect(unsearched).toEqual({ hasSearched: false, items: 0 });
}

/** Attaches a grid to window.q. */
async function attachToQuery(page: Page) {
    await page.evaluate(() => {
        const w = window as any;
        const grid = w.grid = document.createElement('vi-query-grid') as any;
        grid.query = w.q;
        document.getElementById('test-container')!.appendChild(grid);
    });

    return gridLocator(page);
}

test.describe('Initial render', () => {
    test.setTimeout(180000);

    test('mounting on an already-searched query sends no ExecuteQuery', perfCase('perf.init-zero-requests-prefetched'), async ({ page }, testInfo) => {
        await perfPage(page);
        await prefetch(page, 'People');

        const log = requestLog(page);
        const result = await appendGrid(page);
        const grid = gridLocator(page);
        await waitForGridReady(grid);

        // Page loads are debounced (20ms); wait well past that to prove none is sent
        await page.waitForTimeout(1000);

        expect(log.of('ExecuteQuery')).toHaveLength(0);
        expect(log.of('ExecuteAction')).toHaveLength(0);

        // The first page covers the window
        const coverage = await grid.evaluate((g: any) => (window as any).__perf.coverage(g));
        expect(coverage.gap).toBeLessThanOrEqual(1);
        expect(coverage.blank).toBe(0);

        await recordPerf(page, testInfo, 'perf.init-zero-requests-prefetched', { dataset: await datasetOf(grid), counts: { initRequests: log.requests.length }, timings: { firstRows: [round(result.firstRows)] } });
    });

    test('row and element counts do not scale with totalItems', perfCase('perf.init-row-count-independent-of-total'), async ({ page }, testInfo) => {
        await perfPage(page);

        const runs: Record<string, any> = {};
        for (const [label, query, queryOptions] of [['People', 'People', undefined], ['People A*', 'People', { textSearch: 'FirstName:A*' }], ['PeopleTop10', 'PeopleTop10', undefined]] as const) {
            await mountPrefetched(page, query, { queryOptions });
            const grid = gridLocator(page);
            runs[label] = await grid.evaluate((g: any) => {
                const perf = (window as any).__perf;
                const rows = perf.rows(g);
                return {
                    totalItems: g.query.totalItems,
                    rowElements: rows.length,
                    shownRows: rows.filter((r: any) => !r.classList.contains('hidden') && r.getBoundingClientRect().height > 0).length,
                    deepRows: rows.reduce((n: number, r: any) => n + perf.deepCount(r), 0),
                    deepElementCount: perf.deepCount(g)
                };
            });
        }

        expect(runs['People'].totalItems).toBe(10000);
        expect(runs['People A*'].totalItems).toBeLessThan(10000);
        expect(runs['PeopleTop10'].totalItems).toBe(10);

        // The row pool and its element count depend on the viewport only
        expect(runs['People A*'].rowElements).toBe(runs['People'].rowElements);
        expect(runs['PeopleTop10'].rowElements).toBe(runs['People'].rowElements);
        expect(runs['People A*'].deepRows).toBe(runs['People'].deepRows);
        // Hidden pool rows (no item) never fill their cells (e.g. no boolean icon), so the 10-row result can only be lighter
        expect(runs['PeopleTop10'].deepRows).toBeLessThanOrEqual(runs['People'].deepRows);
        expect(runs['People A*'].deepElementCount).toBe(runs['People'].deepElementCount);
        expect(runs['PeopleTop10'].shownRows).toBe(10);

        await recordPerf(page, testInfo, 'perf.init-row-count-independent-of-total', { counts: { poolSize: runs['People'].rowElements, deepElementCount: runs['People'].deepElementCount, deepElementCountTop10: runs['PeopleTop10'].deepElementCount }, dataset: runs });
    });

    for (const width of [1280, 800]) {
        test(`cells per row are bounded by the visible column count (${width}px)`, perfCase('perf.init-cells-per-row'), async ({ page }, testInfo) => {
            await perfPage(page, { width });
            const grid = await mountGrid(page);

            const result = await grid.evaluate((g: any) => {
                const perf = (window as any).__perf;
                const rows = perf.rows(g).filter((r: any) => !r.classList.contains('hidden') && !r.hasAttribute('is-group'));
                return { columns: g.columns.length, cellsPerRow: rows.map((r: any) => r.querySelectorAll('.column').length), check: perf.checkVisibleCells(g) };
            });

            expect(Math.max(...result.cellsPerRow)).toBeLessThanOrEqual(result.columns);

            // Every cell that intersects the viewport shows its value
            expect(result.check.wrong).toEqual([]);
            expect(result.check.checked).toBeGreaterThan(0);

            await recordPerf(page, testInfo, `perf.init-cells-per-row.${width}`, { dataset: await datasetOf(grid), counts: { cellsPerRow: Math.max(...result.cellsPerRow), checkedCells: result.check.checked, offscreenCells: result.check.offscreen } });
        });
    }

    test('time to first rows on a prefetched query', perfCase('perf.init-time-to-first-rows', { timing: true }), async ({ page }, testInfo) => {
        await perfPage(page);
        await prefetch(page, 'People');

        const timings: Record<string, number[]> = {};
        for (const rate of [1, 4]) {
            await setCpuThrottle(page, rate);
            await appendGrid(page); // warm-up

            const firstRows: number[] = [];
            const initializingFalse: number[] = [];
            for (let i = 0; i < 5; i++) {
                const result = await appendGrid(page);
                firstRows.push(round(result.firstRows));
                initializingFalse.push(round(result.initializingFalse));
            }

            timings[`firstRows${rate}x`] = firstRows;
            timings[`initializingFalse${rate}x`] = initializingFalse;
            expect.soft(median(firstRows), `median time to first rows at ${rate}x`).toBeLessThanOrEqual(rate === 1 ? 400 : 1500);
        }

        await setCpuThrottle(page, 1);
        await recordPerf(page, testInfo, 'perf.init-time-to-first-rows', { dataset: await datasetOf(gridLocator(page)), timings, repetitions: 5 });
    });

    test('initialization completes exactly once and is never re-entered', perfCase('perf.init-initializing-once'), async ({ page }, testInfo) => {
        await perfPage(page);
        await prefetch(page, 'People');
        await appendGrid(page);
        const grid = gridLocator(page);
        await waitForGridReady(grid);

        for (const row of [5000, 100000, 0]) {
            await scrollToRow(grid, row);
            await waitFilled(grid);
        }

        await grid.locator('vi-query-grid-column-header[name="LastName"] .label').click();
        await waitForGridReady(grid);
        await grid.evaluate(async (g: any) => { await g.query.search(); });
        await waitForGridReady(grid);
        await scrollGrid(grid, { top: 0 });
        await waitFilled(grid);

        const stats = await page.evaluate(() => (window as any).__init);
        expect(stats.removals).toBe(1);
        expect(stats.readds).toBe(0);
        expect(stats.falseEvents).toBe(1);
        await expect(grid).not.toHaveAttribute('initializing');

        await recordPerf(page, testInfo, 'perf.init-initializing-once', { counts: stats });
    });

    test('every data row has the same deep DOM element count', perfCase('perf.init-element-counts'), async ({ page }, testInfo) => {
        await perfPage(page);

        const counts: Record<string, any> = {};
        for (const query of ['People', 'QueryGrid_None', 'QueryGrid_SelectAndFilterAndInlineActions']) {
            const { grid } = await mountPrefetched(page, query);
            counts[query] = await grid.evaluate((g: any) => {
                const perf = (window as any).__perf;
                const rows = perf.rows(g).filter((r: any) => !r.classList.contains('hidden') && !r.hasAttribute('is-group'));
                const perRow = rows.map((r: any) => perf.deepCount(r));
                return {
                    deepTotal: perf.deepCount(g),
                    deepDocument: perf.deepCount(document),
                    rowElements: perf.rows(g).length,
                    elementsPerDataRow: Math.max(...perRow),
                    elementsPerDataRowMin: Math.min(...perRow),
                    headerElements: perf.deepCount(g.shadowRoot.querySelector('header'))
                };
            });

            // Every data row of a view has the same element count
            expect(counts[query].elementsPerDataRowMin).toBe(counts[query].elementsPerDataRow);
            expect(counts[query].deepTotal).toBeGreaterThan(0);
        }

        await recordPerf(page, testInfo, 'perf.init-element-counts', { counts });
    });

    test('total blocking time during mount', perfCase('perf.init-longtasks', { timing: true }), async ({ page }, testInfo) => {
        await perfPage(page);
        await prefetch(page, 'People');

        const timings: Record<string, number[]> = {};
        for (const rate of [1, 4]) {
            await setCpuThrottle(page, rate);
            await appendGrid(page); // warm-up

            const tbt: number[] = [];
            const longest: number[] = [];
            for (let i = 0; i < 5; i++) {
                const result = await appendGrid(page);
                await waitFilled(gridLocator(page));
                const blocking = await page.evaluate(start => (window as any).__perf.tbt(start, performance.now()), result.start);
                tbt.push(round(blocking.tbt));
                longest.push(round(blocking.longest));
            }

            timings[`tbt${rate}x`] = tbt;
            timings[`longestTask${rate}x`] = longest;
            expect.soft(median(tbt), `median TBT at ${rate}x`).toBeLessThanOrEqual(rate === 1 ? 150 : 600);
        }

        await setCpuThrottle(page, 1);
        await recordPerf(page, testInfo, 'perf.init-longtasks', { timings, repetitions: 5 });
    });

    test('per-row chrome parts are bounded', perfCase('perf.init-row-chrome-upper-bound'), async ({ page }, testInfo) => {
        await perfPage(page);

        const counts: Record<string, any> = {};
        const variants: [string, string, boolean][] = [['People', 'People', false], ['People grouped', 'People', true], ['QueryGrid_None', 'QueryGrid_None', false], ['QueryGrid_Select', 'QueryGrid_Select', false], ['QueryGrid_SelectAndFilterAndInlineActions', 'QueryGrid_SelectAndFilterAndInlineActions', false]];
        for (const [label, query, grouped] of variants) {
            const { grid } = await mountPrefetched(page, query);
            if (grouped) {
                await grid.evaluate(async (g: any) => { await g.query.group('BirthDate'); });
                await expect(grid).toHaveAttribute('has-grouping', '');
                await waitForGridReady(grid);
            }

            counts[label] = await grid.evaluate((g: any) => {
                const perf = (window as any).__perf;
                const rows = perf.rows(g).filter((r: any) => !r.classList.contains('hidden') && !r.hasAttribute('is-group'));
                const parts = ['selector', 'actions', 'groupspacer', 'filter'];
                const max = Object.fromEntries(parts.map(part => [part, Math.max(0, ...rows.map((r: any) => r.shadowRoot.querySelectorAll(`[part=${part}]`).length))]));
                const shown = Object.fromEntries(parts.map(part => [part, Math.max(0, ...rows.map((r: any) => [...r.shadowRoot.querySelectorAll(`[part=${part}]`)].filter((e: any) => e.checkVisibility()).length))]));
                return { dataRows: rows.length, max, shown, flags: ['can-select', 'can-filter', 'inline-actions', 'has-grouping'].filter(f => g.hasAttribute(f)) };
            });

            expect(counts[label].dataRows, `${label}: data rows`).toBeGreaterThan(0);
            for (const [part, n] of Object.entries<number>(counts[label].max))
                expect(n, `${label}: [part=${part}] per row`).toBeLessThanOrEqual(1);
        }

        await recordPerf(page, testInfo, 'perf.init-row-chrome-upper-bound', { counts });
    });

    test('layout/style work and forced reflows during mount', perfCase('perf.init-layout-and-forced-reflows'), async ({ page }, testInfo) => {
        await perfPage(page);
        await prefetch(page, 'People');
        await appendGrid(page); // warm-up
        await waitFilled(gridLocator(page));

        const before = await cdpMetrics(page);
        await startFrameTrace(page);
        await page.evaluate(() => performance.mark('perf-trace-start'));
        await appendGrid(page);
        const grid = gridLocator(page);
        await waitForGridReady(grid);
        await page.evaluate(() => performance.mark('perf-trace-end'));
        const layouts = traceLayouts(await stopFrameTrace(page));
        const after = await cdpMetrics(page);

        const cdp = {
            LayoutCount: after.LayoutCount - before.LayoutCount,
            RecalcStyleCount: after.RecalcStyleCount - before.RecalcStyleCount,
            LayoutDuration: round((after.LayoutDuration - before.LayoutDuration) * 1000, 2),
            RecalcStyleDuration: round((after.RecalcStyleDuration - before.RecalcStyleDuration) * 1000, 2)
        };

        expect(layouts, 'layout events in the mount trace').not.toBeNull();
        expect(layouts!.layouts).toBeGreaterThan(0);
        expect(cdp.LayoutCount).toBeGreaterThan(0);

        await recordPerf(page, testInfo, 'perf.init-layout-and-forced-reflows', { counts: { LayoutCount: cdp.LayoutCount, RecalcStyleCount: cdp.RecalcStyleCount, traceLayouts: layouts!.layouts, forcedLayouts: layouts!.forced }, timings: { LayoutDuration: [cdp.LayoutDuration], RecalcStyleDuration: [cdp.RecalcStyleDuration], traceLayoutMs: [layouts!.layoutMs], traceStyleMs: [layouts!.styleMs] }, cdp: { ...cdp, forcedBy: layouts!.forcedBy } });
    });

    test('no visible layout shift when widths apply', perfCase('perf.init-layout-shift'), async ({ page }, testInfo) => {
        await perfPage(page);
        await prefetch(page, 'People');
        await page.evaluate(() => {
            const w = window as any;
            w.__shifts = [];
            new PerformanceObserver(list => list.getEntries().forEach((e: any) => {
                if (!e.hadRecentInput)
                    w.__shifts.push({ value: e.value, start: e.startTime, sources: (e.sources ?? []).map((s: any) => s.node?.nodeName ?? '?') });
            })).observe({ type: 'layout-shift', buffered: true });
        });

        const result = await appendGrid(page);
        await waitFilled(gridLocator(page));
        // Shifts are reported per rendered frame: the frames after ready also catch widths that change late
        await nextFrames(page, 30);

        const shifts: any[] = await page.evaluate(start => (window as any).__shifts.filter((s: any) => s.start >= start), result.start);
        const cls = round(shifts.reduce((sum, s) => sum + s.value, 0), 4);
        expect(shifts, 'layout shifts').toEqual([]);

        await recordPerf(page, testInfo, 'perf.init-layout-shift', { counts: { shifts: shifts.length }, timings: { cls: [cls] } });
    });

    test('grid does not trigger a search for an unsearched query', perfCase('perf.init-unsearched-no-search'), async ({ page }, testInfo) => {
        await page.clock.install();
        await perfPage(page);
        const errors = consoleErrors(page);
        await unsearchedQuery(page);
        const log = requestLog(page);
        const grid = await attachToQuery(page);
        await expect(grid).not.toHaveAttribute('initializing');

        // Ten seconds of page time run every grid timer (page loads, more columns) that could start a search
        await pauseClock(page);
        await page.clock.runFor(10000);
        await log.quiet();
        expect(log.of('ExecuteQuery'), 'ExecuteQuery before the search').toHaveLength(0);
        const shownRows = await grid.evaluate((g: any) => (window as any).__perf.visibleRows(g).filter(({ r }: any) => r.item).length);
        expect(shownRows, 'data rows before the search').toBe(0);
        await page.clock.resume();

        await grid.evaluate((g: any) => { g.query.search(); });
        await expect.poll(() => grid.evaluate((g: any) => !g.query.isBusy && (window as any).__perf.firstColumnMatches(g, 'FirstName'))).toBe(true);
        await waitForGridReady(grid);
        await log.quiet();

        expect(log.of('ExecuteQuery'), 'ExecuteQuery after the search').toHaveLength(1);
        expect(errors).toEqual([]);

        await recordPerf(page, testInfo, 'perf.init-unsearched-no-search', { counts: { requestsBeforeSearch: 0, requestsAfterSearch: log.of('ExecuteQuery').length } });
    });

    test('time from search to first rows on an unsearched query', perfCase('perf.init-unsearched-query', { timing: true }), async ({ page }, testInfo) => {
        await perfPage(page);
        await unsearchedQuery(page);
        const grid = await attachToQuery(page);
        await expect(grid).not.toHaveAttribute('initializing');

        const ms = await grid.evaluate(async (g: any) => {
            const perf = (window as any).__perf;
            const start = performance.now();
            g.query.search();
            const { time } = await perf.whenFrame(() => !g.query.isBusy && perf.firstColumnMatches(g, 'FirstName'));
            return time - start;
        });
        await waitForGridReady(grid);

        expect.soft(ms, 'time from search to first rows').toBeLessThanOrEqual(1500);

        await recordPerf(page, testInfo, 'perf.init-unsearched-query', { timings: { searchToFirstRows: [round(ms)] } });
    });

    test('empty result finishes initializing quickly', perfCase('perf.init-empty-result', { timing: true }), async ({ page }, testInfo) => {
        await perfPage(page);
        await prefetch(page, 'People', { queryOptions: { textSearch: 'zzzzqqq' } });
        expect(await page.evaluate(() => (window as any).q.totalItems)).toBe(0);

        const log = requestLog(page);
        const ms = await page.evaluate(async () => {
            const w = window as any;
            const grid = w.grid = document.createElement('vi-query-grid') as any;
            grid.query = w.q;
            const start = performance.now();
            const done = new Promise<number>(resolve => new MutationObserver((records, observer) => {
                if (!grid.hasAttribute('initializing')) {
                    observer.disconnect();
                    resolve(performance.now() - start);
                }
            }).observe(grid, { attributes: true, attributeFilter: ['initializing'] }));
            document.getElementById('test-container')!.appendChild(grid);
            return done;
        });
        const grid = gridLocator(page);
        await waitForGridReady(grid);
        await nextFrames(page, 2);
        await log.quiet();

        expect(log.of('ExecuteQuery')).toHaveLength(0);
        expect(await grid.evaluate((g: any) => (window as any).__perf.visibleRows(g).filter(({ r }: any) => r.item).length)).toBe(0);
        expect.soft(ms, 'append to [initializing] removal').toBeLessThanOrEqual(1000);

        await recordPerf(page, testInfo, 'perf.init-empty-result', { counts: { requests: log.requests.length }, timings: { initializingFalse: [round(ms)] } });
    });
});
