import { Locator, Page } from '@playwright/test';
import { mountGrid, nextFrames, requestLog } from '../_helpers/query-grid';
import { expect, median, parkMouse, perfCase, perfPage, recordPerf, round, scrollToRow, setCpuThrottle, test, waitFilled } from '../_helpers/perf';

/** Clicks the selector at (x, y) and resolves with the longest Event Timing entry of that click (< 16ms when none is reported). */
async function timedClick(page: Page, at: { x: number; y: number }, modifiers: ('Shift')[] = []) {
    const start = await page.evaluate(() => performance.now());
    await page.mouse.move(at.x, at.y);
    for (const key of modifiers)
        await page.keyboard.down(key);

    await page.mouse.down();
    await page.mouse.up();
    for (const key of modifiers)
        await page.keyboard.up(key);

    // Event Timing entries are reported after the next paint
    await nextFrames(page, 3);
    return page.evaluate(start => {
        const perf = (window as any).__perf;
        const events = perf.events.filter((e: any) => e.start >= start && ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click'].includes(e.name));
        return { duration: Math.max(0, ...events.map((e: any) => e.duration)), start };
    }, start);
}

/** The centre of the selector of the n-th visible row and that row's pool index. */
function selectorOf(grid: Locator, n: number) {
    return grid.evaluate((g: any, n) => {
        const perf = (window as any).__perf;
        const { r } = perf.visibleRows(g)[n];
        const b = r.shadowRoot.querySelector('.selector').getBoundingClientRect();
        return { x: b.left + b.width / 2, y: b.top + b.height / 2, pool: perf.rows(g).indexOf(r) };
    }, n);
}

async function observed(page: Page, grid: Locator, action: () => Promise<void>) {
    await grid.evaluate((g: any) => (window as any).__perf.observe(g));
    await action();
    await nextFrames(page, 2);
    return grid.evaluate(() => (window as any).__perf.takeMutations());
}

/**
 * Clicks select-all on a fresh grid and follows it until every visible row is [selected]: the frames counted from
 * pointerup, the row mutations and the longest Event Timing entry of the click.
 */
async function measureSelectAll(page: Page) {
    await perfPage(page);
    const grid = await mountGrid(page);
    await parkMouse(page);
    const log = requestLog(page);

    const box = (await grid.locator('vi-query-grid-select-all').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await nextFrames(page, 2);

    await grid.evaluate((g: any) => {
        const w = window as any;
        const perf = w.__perf;
        perf.observe(g);
        w.__selectAll = new Promise(resolve => window.addEventListener('pointerup', () => {
            const start = performance.now();
            perf.whenFrame(() => {
                const rows = perf.visibleRows(g);
                return rows.length > 0 && rows.every(({ r }: any) => r.hasAttribute('selected'));
            }).then((result: any) => resolve({ frames: result.frames, ms: result.time - start, start }));
        }, { capture: true, once: true }));
    });

    await page.mouse.down();
    await page.mouse.up();
    const result: { frames: number; ms: number; start: number } = await page.evaluate(() => (window as any).__selectAll);
    await nextFrames(page, 2);

    const after = await grid.evaluate((g: any, start) => {
        const w = window as any;
        const events = w.__perf.events.filter((e: any) => e.start >= start - 50 && ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click'].includes(e.name));
        return { mutations: w.__perf.takeMutations(), eventDuration: Math.max(0, ...events.map((e: any) => e.duration)) };
    }, result.start);

    return { result, after, log };
}

test.describe('Selection', () => {
    test.setTimeout(120000);

    test('a selection change touches only the affected row', perfCase('perf.sel-single-row-mutation'), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountGrid(page, { query: 'QueryGrid_Select' });
        await parkMouse(page);
        const log = requestLog(page);

        const changes: { label: string; pool: number; mutations: any }[] = [];
        for (const n of [3, 5]) {
            const selector = await selectorOf(grid, n);
            await page.mouse.move(selector.x, selector.y);
            await nextFrames(page, 2);
            const mutations = await observed(page, grid, async () => {
                await page.mouse.down();
                await page.mouse.up();
            });
            changes.push({ label: `click row ${n}`, pool: selector.pool, mutations });
        }

        await parkMouse(page);
        const third = await selectorOf(grid, 3);
        const model = await observed(page, grid, async () => {
            await grid.evaluate((g: any) => g.query.items[3].isSelected = !g.query.items[3].isSelected);
        });
        changes.push({ label: 'model row 3', pool: third.pool, mutations: model });

        expect(await grid.evaluate((g: any) => g.query.selectedItems.map((i: any) => g.query.items.indexOf(i)))).toEqual([5]);

        for (const change of changes) {
            expect(Object.keys(change.mutations.perRow).map(Number), `${change.label}: mutated rows`).toEqual([change.pool]);
            expect(change.mutations.cellRecords, `${change.label}: cell mutations`).toBe(0);
        }
        expect(log.requests).toHaveLength(0);

        await recordPerf(page, testInfo, 'perf.sel-single-row-mutation', { counts: Object.fromEntries(changes.map(c => [c.label, { rows: Object.keys(c.mutations.perRow).length, rowRecords: c.mutations.rowRecords, cellRecords: c.mutations.cellRecords, other: c.mutations.otherRecords }])), requests: { count: log.requests.length } });
    });

    test('select-all updates visible rows in at most 2 frames', perfCase('perf.sel-select-all-visible'), async ({ page }, testInfo) => {
        const { result, after, log } = await measureSelectAll(page);
        const maxPerRow = Math.max(...Object.values<number>(after.mutations.perRow));

        // Counted from pointerup, the input that completes the click
        expect(result.frames, 'frames until every visible row is selected').toBeLessThanOrEqual(2);
        expect(maxPerRow, 'mutations per row').toBeLessThanOrEqual(2);
        expect(after.mutations.cellRecords).toBe(0);
        expect(log.requests).toHaveLength(0);

        await recordPerf(page, testInfo, 'perf.sel-select-all-visible', { counts: { frames: result.frames, rowsMutated: Object.keys(after.mutations.perRow).length, maxMutationsPerRow: maxPerRow, cellMutations: after.mutations.cellRecords, requests: log.requests.length } });
    });

    test('select-all interaction latency', perfCase('perf.sel-select-all-visible-speed', { timing: true }), async ({ page }, testInfo) => {
        const { result, after } = await measureSelectAll(page);

        expect.soft(after.eventDuration, 'select-all event duration').toBeLessThanOrEqual(100);

        await recordPerf(page, testInfo, 'perf.sel-select-all-visible-speed', { timings: { selectAllMs: [round(result.ms)], eventDuration: [after.eventDuration] } });
    });

    for (const rate of [1, 4]) {
        test(`selector click interaction latency (${rate}x CPU)`, perfCase('perf.sel-click-latency', { timing: true }), async ({ page }, testInfo) => {
            await perfPage(page);
            const grid = await mountGrid(page, { query: 'QueryGrid_Select' });
            await parkMouse(page);
            await setCpuThrottle(page, rate);

            const durations: number[] = [];
            for (let n = 0; n < 10; n++)
                durations.push(round((await timedClick(page, await selectorOf(grid, n))).duration));

            await setCpuThrottle(page, 1);
            await parkMouse(page);

            // Every click toggled its row (single-click selection adds to the selection)
            expect(await grid.evaluate((g: any) => g.query.selectedItems.length)).toBe(10);
            expect.soft(Math.max(...durations), 'max selector click event duration').toBeLessThanOrEqual(rate === 1 ? 100 : 300);

            await recordPerf(page, testInfo, `perf.sel-click-latency.${rate}x`, { cpuThrottle: rate, timings: { clickEventDuration: durations }, repetitions: 10 });
        });
    }

    test('large shift-range selection cost', perfCase('perf.sel-shift-range-1000'), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountGrid(page);
        await parkMouse(page);
        // Rows 0-999 plus the rows shown below row 999 once it is scrolled to the top
        await grid.evaluate(async (g: any) => { await g.query.items.sliceAsync(0, 1100); });
        const log = requestLog(page);
        await setCpuThrottle(page, 4);

        // Click row 0, then shift+click row 999
        const first = await timedClick(page, await selectorOf(grid, 0));
        await scrollToRow(grid, 999);
        await waitFilled(grid);
        const last = await grid.evaluate((g: any) => {
            const perf = (window as any).__perf;
            const q = g.query;
            const lazy = q.disableLazyLoading;
            q.disableLazyLoading = true;
            try {
                const { r } = perf.visibleRows(g).find(({ r }: any) => r.item === q.items[999]);
                const b = r.shadowRoot.querySelector('.selector').getBoundingClientRect();
                return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
            }
            finally {
                q.disableLazyLoading = lazy;
            }
        });
        const range = await timedClick(page, last, ['Shift']);
        const blocking = await page.evaluate(start => (window as any).__perf.tbt(start, performance.now()), range.start);
        await setCpuThrottle(page, 1);
        await parkMouse(page);
        await log.quiet();

        const result = await grid.evaluate((g: any) => {
            const perf = (window as any).__perf;
            const q = g.query;
            const lazy = q.disableLazyLoading;
            q.disableLazyLoading = true;
            try {
                // The visible rows of the range (999 and above it) are selected, the ones below it not
                const rows = perf.visibleRows(g).map(({ r }: any) => ({ index: q.items.indexOf(r.item), selected: r.hasAttribute('selected') }));
                return { selected: g.query.selectedItems.length, wrong: rows.filter((r: any) => r.selected !== (r.index <= 999)), visible: rows.length };
            }
            finally {
                q.disableLazyLoading = lazy;
            }
        });

        expect(result.selected).toBe(1000);
        expect(result.visible).toBeGreaterThan(0);
        expect(result.wrong, 'visible rows with the wrong [selected]').toEqual([]);
        expect(log.requests).toHaveLength(0);

        await recordPerf(page, testInfo, 'perf.sel-shift-range-1000', { cpuThrottle: 4, counts: { selected: result.selected, requests: log.requests.length, longTasks: blocking.count }, timings: { firstClickEvent: [round(first.duration)], rangeClickEvent: [round(range.duration)], rangeTbt: [round(blocking.tbt)], rangeLongestTask: [round(blocking.longest)] } });
    });

    test('selection latency with all items loaded', perfCase('perf.sel-latency-all-loaded', { timing: true }), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountGrid(page);
        await parkMouse(page);
        await grid.evaluate(async (g: any) => { await g.query.items.toArrayAsync(); });
        expect(await grid.evaluate((g: any) => {
            const q = g.query;
            q.disableLazyLoading = true;
            try {
                return q.items.filter((i: any) => !!i).length;
            }
            finally {
                q.disableLazyLoading = false;
            }
        })).toBe(10000);

        const durations: number[] = [];
        for (const n of [2, 4, 6, 8, 10])
            durations.push(round((await timedClick(page, await selectorOf(grid, n))).duration));

        await parkMouse(page);
        expect(await grid.evaluate((g: any) => g.query.selectedItems.length)).toBeGreaterThan(0);
        expect.soft(median(durations), 'selector click event duration with 10,000 items loaded').toBeLessThanOrEqual(100);

        await recordPerf(page, testInfo, 'perf.sel-latency-all-loaded', { timings: { clickEventDuration: durations }, repetitions: durations.length });
    });
});
