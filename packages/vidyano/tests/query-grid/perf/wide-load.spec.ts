import { Page } from '@playwright/test';
import { waitForGridReady } from '../_helpers/query-grid';
import { appendGrid, cdpMetrics, datasetOf, expect, gridLocator, median, mountPrefetched, perfCase, perfPage, prefetch, recordPerf, round, setCpuThrottle, startFrameTrace, stopFrameTrace, test, traceLayouts, waitFilled } from '../_helpers/perf';

const CELL_TAGS = ['vi-query-grid-cell-default', 'vi-query-grid-cell-boolean', 'vi-query-grid-cell-image', 'vi-query-grid-cell-common-mark'];

/** Counts the updates (renders) of every row and cell element from now on, in window.__renders. */
async function countRenders(page: Page) {
    await page.evaluate(tags => {
        const renders = (window as any).__renders = new Map<Element, number>();
        for (const tag of tags) {
            const proto = customElements.get(tag)!.prototype as any;
            const update = proto.update;
            proto.update = function (this: Element, ...args: any[]) {
                if (this.localName === tag)
                    renders.set(this, (renders.get(this) ?? 0) + 1);

                return update.apply(this, args);
            };
        }
    }, ['vi-query-grid-row', ...CELL_TAGS]);
}

test.describe('Wide view load', () => {
    test.setTimeout(180000);

    test('mounting 60 columns renders every row and cell a bounded number of times, without forced layouts per cell', perfCase('perf.wd-load-structure'), async ({ page }, testInfo) => {
        await perfPage(page, { width: 1600, height: 900 });
        await prefetch(page, 'QueryGrid_Wide');
        await countRenders(page);

        // The cells that exist when the rows first show
        await page.evaluate(() => {
            const w = window as any;
            const append = HTMLElement.prototype.appendChild;
            HTMLElement.prototype.appendChild = function <T extends Node>(this: HTMLElement, node: T): T {
                if ((node as any).localName === 'vi-query-grid') {
                    HTMLElement.prototype.appendChild = append;
                    new MutationObserver((_, observer) => {
                        if ((node as any).hasAttribute('initializing'))
                            return;

                        observer.disconnect();
                        const g = node as any;
                        const rows = [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].filter((r: any) => !r.classList.contains('hidden'));
                        w.__firstPaint = { rows: rows.length, cells: rows.reduce((n: number, r: any) => n + r.querySelectorAll('.column').length, 0), rowColumns: g._rowColumns.length, columns: g.columns.length };
                    }).observe(node as any, { attributes: true, attributeFilter: ['initializing'] });
                }

                return append.call(this, node) as T;
            };
        });

        await startFrameTrace(page);
        await page.evaluate(() => performance.mark('perf-trace-start'));
        await appendGrid(page, { column: 'Id' });
        const grid = gridLocator(page);
        await waitForGridReady(grid);
        await page.evaluate(() => performance.mark('perf-trace-end'));
        const layouts = traceLayouts(await stopFrameTrace(page))!;

        const renders = await grid.evaluate((g: any) => {
            const counts: [Element, number][] = [...(window as any).__renders].filter(([el]: [Element]) => el.getRootNode() === g.shadowRoot || el.parentElement?.getRootNode() === g.shadowRoot);
            const rows = counts.filter(([el]) => el.localName === 'vi-query-grid-row').map(([, n]) => n);
            const cells = counts.filter(([el]) => el.localName !== 'vi-query-grid-row').map(([, n]) => n);
            return { rows: rows.length, maxRowRenders: Math.max(...rows), cells: cells.length, maxCellRenders: Math.max(...cells) };
        });

        // The rows show with the cells of the columns that start inside the visible width, the other columns follow
        const firstPaint = await page.evaluate(() => (window as any).__firstPaint);
        expect(firstPaint.rowColumns, 'columns the rows render when they first show').toBeLessThan(firstPaint.columns / 2);
        expect(firstPaint.cells, 'cells when the rows first show').toBe(firstPaint.rows * firstPaint.rowColumns);

        expect(renders.rows).toBeGreaterThan(0);
        expect(renders.cells).toBeGreaterThanOrEqual(renders.rows);
        // A row renders while the widths are measured, once more when they apply and once per group of columns added after; a cell renders its first value only
        expect(renders.maxRowRenders, 'renders per row').toBeLessThanOrEqual(2 + Math.ceil(firstPaint.columns / 8));
        expect(renders.maxCellRenders, 'renders per cell').toBe(1);
        // Layout is forced a fixed number of times per mount, never per row or cell
        expect(layouts.forced, `forced layouts (${JSON.stringify(layouts.forcedBy)})`).toBeLessThan(renders.rows);

        await recordPerf(page, testInfo, 'perf.wd-load-structure', { dataset: await datasetOf(grid), counts: { ...renders, cellsAtFirstPaint: firstPaint.cells, rowsAtFirstPaint: firstPaint.rows, rowColumnsAtFirstPaint: firstPaint.rowColumns, layouts: layouts.layouts, forcedLayouts: layouts.forced, styleRecalcs: layouts.styleRecalcs }, timings: { layoutMs: [layouts.layoutMs], styleMs: [layouts.styleMs] }, cdp: { forcedBy: layouts.forcedBy } });
    });

    test('a change of the row count reads no layout from the grid', perfCase('perf.vs-no-layout-read-on-row-count'), async ({ page }, testInfo) => {
        await perfPage(page);
        const { grid } = await mountPrefetched(page, 'People');

        const reads = await grid.evaluate(async (g: any) => {
            const reads: Record<string, number> = {};
            let counting = true;
            const restore: (() => void)[] = [];
            const spy = (proto: any, name: string, isMethod = false) => {
                const descriptor = Object.getOwnPropertyDescriptor(proto, name)!;
                const original = isMethod ? descriptor.value : descriptor.get;
                const count = (el: any) => {
                    if (counting && (el === g || el.getRootNode?.() === g.shadowRoot))
                        reads[name] = (reads[name] ?? 0) + 1;
                };
                Object.defineProperty(proto, name, isMethod
                    ? { ...descriptor, value: function (this: any, ...args: any[]) { count(this); return original.apply(this, args); } }
                    : { ...descriptor, get: function (this: any) { count(this); return original.call(this); } });
                restore.push(() => Object.defineProperty(proto, name, descriptor));
            };

            for (const name of ['clientHeight', 'clientWidth', 'scrollHeight', 'scrollWidth'])
                spy(Element.prototype, name);
            for (const name of ['offsetHeight', 'offsetWidth', 'offsetTop', 'offsetLeft'])
                spy(HTMLElement.prototype, name);
            spy(Element.prototype, 'getBoundingClientRect', true);

            const frames = (n: number) => new Promise<void>(resolve => {
                const step = () => --n <= 0 ? resolve() : requestAnimationFrame(step);
                requestAnimationFrame(step);
            });

            try {
                for (const textSearch of ['FirstName:A*', '', 'FirstName:B*']) {
                    g.query.textSearch = textSearch;
                    await g.query.search();
                    await frames(4);
                }
            }
            finally {
                counting = false;
                restore.forEach(r => r());
            }

            return reads;
        });

        expect(reads, 'layout reads by the grid while the row count changes').toEqual({});

        await recordPerf(page, testInfo, 'perf.vs-no-layout-read-on-row-count', { counts: { reads: Object.values(reads).reduce((n, r) => n + r, 0) } });
    });

    test('main-thread time from append to settled rows', perfCase('perf.wd-load-main-thread', { timing: true }), async ({ page }, testInfo) => {
        await perfPage(page, { width: 1600, height: 900 });
        await prefetch(page, 'QueryGrid_Wide');

        const timings: Record<string, number[]> = {};
        for (const rate of [1, 4]) {
            await setCpuThrottle(page, rate);
            await appendGrid(page, { column: 'Id' }); // warm-up
            await waitFilled(gridLocator(page));

            const settled: number[] = [];
            const thread: number[] = [];
            for (let i = 0; i < 5; i++) {
                const before = await cdpMetrics(page);
                const result = await appendGrid(page, { column: 'Id' });
                await waitFilled(gridLocator(page));
                const after = await cdpMetrics(page);
                settled.push(round(Math.max(result.firstRows, result.initializingFalse)));
                thread.push(round((after.TaskDuration - before.TaskDuration) * 1000));
            }

            timings[`settled${rate}x`] = settled;
            timings[`mainThread${rate}x`] = thread;
        }

        await setCpuThrottle(page, 1);
        expect.soft(median(timings.settled1x), 'median append to settled rows at 1x').toBeLessThanOrEqual(400);

        await recordPerf(page, testInfo, 'perf.wd-load-main-thread', { dataset: await datasetOf(gridLocator(page)), timings, repetitions: 5 });
    });
});
