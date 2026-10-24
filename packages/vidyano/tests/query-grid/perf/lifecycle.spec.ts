import { nextFrames, pageErrors, requestLog, waitForGridReady } from '../_helpers/query-grid';
import { appendGrid, cdpMetrics, collectGarbage, expect, gridLocator, liveInstances, liveObjects, mountPrefetched, parkMouse, perfCase, perfPage, prefetch, recordPerf, round, scrollToRow, test, waitFilled } from '../_helpers/perf';

test.describe('Lifecycle & leaks', () => {
    test.setTimeout(240000);

    test('mount/unmount cycles leak no grids, rows or cells', perfCase('perf.lc-mount-unmount-leak'), async ({ page }, testInfo) => {
        await perfPage(page);
        await prefetch(page, 'People');

        const cycle = async () => {
            await appendGrid(page);
            const grid = gridLocator(page);
            await waitFilled(grid);
            await scrollToRow(grid, 2000);
            await waitFilled(grid);
            await page.evaluate(() => {
                const w = window as any;
                w.grid.remove();
                w.grid = null;
            });
        };

        // Warm-up cycle: caches, styles and the query's pages exist before the baseline
        await cycle();
        await collectGarbage(page);
        const before = await cdpMetrics(page);
        const liveBefore = { grids: await liveInstances(page, 'vi-query-grid'), rows: await liveInstances(page, 'vi-query-grid-row'), cells: await liveInstances(page, 'vi-query-grid-cell-default') };

        for (let i = 0; i < 20; i++)
            await cycle();

        await collectGarbage(page);
        const after = await cdpMetrics(page);
        const live = {
            grids: await liveInstances(page, 'vi-query-grid'),
            rows: await liveInstances(page, 'vi-query-grid-row'),
            cells: await liveInstances(page, 'vi-query-grid-cell-default')
        };

        // The query (window.q) stays alive on purpose: it must not keep the removed grids alive
        expect(await page.evaluate(() => !!(window as any).q)).toBe(true);

        // Blink's Nodes and JSEventListeners counters sometimes still hold the last removed grid after one GC round
        // (1 in 4 runs, exactly one grid's worth, while the live instance counts above are already right): collect
        // again before judging. A real leak never drops.
        await expect.poll(async () => {
            await collectGarbage(page);
            Object.assign(after, await cdpMetrics(page));
            return { nodes: after.Nodes <= before.Nodes * 1.05, listeners: after.JSEventListeners <= before.JSEventListeners * 1.05 };
        }, { timeout: 10000 }).toEqual({ nodes: true, listeners: true });
        expect(after.Nodes, 'DOM nodes').toBeLessThanOrEqual(before.Nodes * 1.05);
        expect(after.JSEventListeners, 'event listeners').toBeLessThanOrEqual(before.JSEventListeners * 1.05);
        expect(after.JSHeapUsedSize - before.JSHeapUsedSize, 'heap growth').toBeLessThanOrEqual(2 * 1024 * 1024);

        await recordPerf(page, testInfo, 'perf.lc-mount-unmount-leak', { counts: { ...live, liveBefore }, memory: { heapBefore: before.JSHeapUsedSize, heapAfter: after.JSHeapUsedSize, heapGrowth: after.JSHeapUsedSize - before.JSHeapUsedSize, nodesBefore: before.Nodes, nodesAfter: after.Nodes, listenersBefore: before.JSEventListeners, listenersAfter: after.JSEventListeners }, repetitions: 20 });

        // Includes the first grid: a cached template instance must not keep its dom-repeat, and with it that grid, its rows
        // and cells, alive
        expect(live).toEqual({ grids: 0, rows: 0, cells: 0 });
    });

    test('a removed grid does no work when its query changes', perfCase('perf.lc-detached-no-work'), async ({ page }, testInfo) => {
        await perfPage(page);
        const errors = pageErrors(page);
        const consoleErrors: string[] = [];
        page.on('console', msg => {
            if (msg.type() === 'error')
                consoleErrors.push(msg.text());
        });

        const { grid } = await mountPrefetched(page, 'People');
        await waitForGridReady(grid);
        await scrollToRow(grid, 3000);
        await waitFilled(grid);
        await page.evaluate(() => (window as any).grid.remove());

        const log = requestLog(page);
        await page.evaluate(async () => {
            const q = (window as any).q;
            await q.search();

            // Read the item without lazy loading so only the grid (if anything) could request a page
            const lazy = q.disableLazyLoading;
            q.disableLazyLoading = true;
            const item = q.items[0];
            q.disableLazyLoading = lazy;
            item.isSelected = !item.isSelected;
            await q.group('Gender');
        });

        // A detached grid would request a page 20ms after reacting; wait well past that to prove it does not
        await page.waitForTimeout(1000);
        await log.quiet();

        // Only core's own requests: the search and the grouping, no page loads
        expect(log.of('ExecuteQuery').map(r => [r.skip, r.top])).toEqual([[undefined, undefined], [undefined, undefined]]);
        expect(log.of('ExecuteAction')).toHaveLength(0);
        expect(errors).toEqual([]);
        expect(consoleErrors).toEqual([]);

        await recordPerf(page, testInfo, 'perf.lc-detached-no-work', { counts: { requests: log.requests.length, errors: errors.length + consoleErrors.length } });
    });

    test('re-attaching a grid re-renders without refetching', perfCase('perf.lc-reattach'), async ({ page }, testInfo) => {
        await perfPage(page, { styles: '#other { position: fixed; inset: 0; display: flex; flex-direction: column; } #other > vi-query-grid { flex: 1 1 auto; min-height: 0; }' });
        const { grid } = await mountPrefetched(page, 'People');
        await parkMouse(page);
        const before = await grid.evaluate((g: any) => {
            const perf = (window as any).__perf;
            return perf.visibleRows(g).map(({ r }: any) => perf.cellText(r.querySelector('.column')));
        });
        const log = requestLog(page);

        const result = await page.evaluate(async () => {
            const w = window as any;
            const perf = w.__perf;
            const grid = w.grid;
            const state = w.__reattach = { initializingAdds: 0 };
            new MutationObserver(records => records.forEach(r => r.oldValue === null && state.initializingAdds++)).observe(grid, { attributes: true, attributeFilter: ['initializing'], attributeOldValue: true });

            const other = document.createElement('div');
            other.id = 'other';
            document.body.appendChild(other);
            document.getElementById('test-container')!.style.display = 'none';

            const start = performance.now();
            other.appendChild(grid);
            const { time } = await perf.whenFrame(() => perf.firstColumnMatches(grid, 'FirstName') && perf.coverage(grid).gap <= 1);
            return { ms: time - start, state };
        });
        const moved = page.locator('#other > vi-query-grid');
        await waitForGridReady(moved);
        // A page load would be sent 20ms after an update; give it time to show up
        await page.waitForTimeout(300);
        await log.quiet();

        const after = await moved.evaluate((g: any) => {
            const perf = (window as any).__perf;
            return perf.visibleRows(g).map(({ r }: any) => perf.cellText(r.querySelector('.column')));
        });
        const initializingAdds: number = await page.evaluate(() => (window as any).__reattach.initializingAdds);

        expect(after).toEqual(before);
        expect(log.requests).toHaveLength(0);
        expect(initializingAdds, 'column re-measures').toBeLessThanOrEqual(1);
        await expect(moved).not.toHaveAttribute('initializing');

        await recordPerf(page, testInfo, 'perf.lc-reattach', { counts: { requests: log.requests.length, remeasures: initializingAdds }, timings: { rerenderMs: [round(result.ms)] } });
    });

    test('query swaps do not retain old queries', perfCase('perf.lc-query-swap'), async ({ page }, testInfo) => {
        await perfPage(page);
        const { grid } = await mountPrefetched(page, 'People');

        // Every swap binds a new query that only the grid references, so a grid that retains old queries keeps them alive
        const swap = async (name: string) => {
            await grid.evaluate(async (g: any, name) => { g.query = await (window as any).service.getQuery(name); }, name);
            await waitForGridReady(grid);
            return grid.evaluate((g: any) => {
                const perf = (window as any).__perf;
                const scroller = perf.scroller(g).scroller;
                return { pool: perf.rows(g).length, bound: Math.ceil(Math.ceil(scroller.clientHeight / g.rowHeight) * 1.5) + 1 };
            });
        };

        // Warm-up swap, then the baseline with the grid on People
        await swap('PeopleTop10');
        await swap('People');
        await page.evaluate(() => (window as any).q = null);
        await collectGarbage(page);
        const before = await liveObjects(page, 'Vidyano.Query.prototype');

        const pools: { pool: number; bound: number }[] = [];
        for (let i = 0; i < 10; i++)
            pools.push(await swap(i % 2 === 0 ? 'PeopleTop10' : 'People'));

        await collectGarbage(page);
        const after = await liveObjects(page, 'Vidyano.Query.prototype');

        expect(await grid.evaluate((g: any) => g.query.name)).toBe('People');
        for (const { pool, bound } of pools)
            expect(pool, 'row pool').toBeLessThanOrEqual(bound);
        expect(after, `live queries after 10 swaps (before ${before})`).toBeLessThanOrEqual(before);

        await recordPerf(page, testInfo, 'perf.lc-query-swap', { counts: { liveQueriesBefore: before, liveQueries: after, maxPool: Math.max(...pools.map(p => p.pool)) } });
    });

    test('ResizeObserver targets are released', perfCase('perf.lc-resize-observer-accounting'), async ({ page }, testInfo) => {
        await perfPage(page);
        await page.evaluate(() => {
            const w = window as any;
            const observed = w.__observed = new Map<ResizeObserver, Set<Element>>();
            const proto = ResizeObserver.prototype;
            const { observe, unobserve, disconnect } = proto;
            proto.observe = function(target: Element, options?: ResizeObserverOptions) {
                (observed.get(this) ?? observed.set(this, new Set()).get(this)!).add(target);
                return observe.call(this, target, options);
            };
            proto.unobserve = function(target: Element) {
                observed.get(this)?.delete(target);
                return unobserve.call(this, target);
            };
            proto.disconnect = function() {
                observed.get(this)?.clear();
                return disconnect.call(this);
            };
            w.__removedGrids = [];
        });
        await prefetch(page, 'People');

        for (let i = 0; i < 10; i++) {
            await appendGrid(page);
            const grid = gridLocator(page);
            await waitFilled(grid);
            await scrollToRow(grid, 500 * (i + 1));
            await waitFilled(grid);
            await page.evaluate(() => {
                const w = window as any;
                w.__removedGrids.push(w.grid);
                w.grid.remove();
                w.grid = null;
            });
        }
        await nextFrames(page, 3);

        const leaked: string[] = await page.evaluate(() => {
            const w = window as any;
            const removed = new Set(w.__removedGrids);
            const gridOf = (node: any) => {
                for (let n = node; n; n = n.parentNode ?? (n instanceof ShadowRoot ? n.host : null)) {
                    if (removed.has(n))
                        return n;
                }
                return null;
            };

            const result: string[] = [];
            w.__observed.forEach((targets: Set<Element>) => targets.forEach(target => {
                if (gridOf(target))
                    result.push(`${target.tagName.toLowerCase()}${(target as any).column ? `[${(target as any).column.name}]` : ''}`);
            }));
            return result;
        });

        expect(leaked, 'still-observed targets inside removed grids').toEqual([]);

        await recordPerf(page, testInfo, 'perf.lc-resize-observer-accounting', { counts: { stillObservedInRemovedGrids: leaked.length }, repetitions: 10 });
    });
});
