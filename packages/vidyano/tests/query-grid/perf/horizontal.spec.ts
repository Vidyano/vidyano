import { Locator, Page } from '@playwright/test';
import { headerNames, mountGrid, requestLog, savedSettings, waitForGridReady, pauseClock } from '../_helpers/query-grid';
import { cdpMetrics, checkFrameBudget, droppedFrames, expect, frameStats, mountPrefetched, parkMouse, peopleWidths, perfCase, perfPage, recordPerf, round, scrollToRow, setCpuThrottle, startFrameTrace, stopFrameTrace, test, traceFrames, waitFilled } from '../_helpers/perf';

async function mountWide(page: Page, pinned: string[] = []) {
    await perfPage(page, { width: 800 });
    const { grid } = await mountPrefetched(page, 'People', { userSettings: peopleWidths(300, pinned) });
    await waitForGridReady(grid);
    await parkMouse(page);
    return grid;
}

/** Runs a 60-frame rAF scroll from scrollLeft 0 to max (and optionally back), measuring alignment every frame. */
function horizontalFling(grid: Locator, options: { back?: boolean; frames?: number } = {}) {
    return grid.evaluate(async (g: any, { back, frames }) => {
        const perf = (window as any).__perf;
        const scroller = perf.scroller(g).scroller;
        const max = scroller.scrollWidth - scroller.clientWidth;
        const pinnedNames = g.columns.filter((c: any) => c.isPinned).map((c: any) => c.name);
        const initial = perf.columnLefts(g);
        const positions = Array.from({ length: frames }, (_, i) => Math.round(max * (i + 1) / frames));
        if (back)
            positions.push(...[...positions].reverse().slice(1), 0);

        performance.mark('perf-trace-start');
        const run = await perf.runFrames(positions.length, (i: number) => scroller.scrollLeft = positions[i], () => {
            const lefts = perf.columnLefts(g);
            const delta = scroller.scrollLeft;
            let misaligned = 0;
            let pinnedMoved = 0;
            let othersWrong = 0;
            let pinnedHidden = 0;
            for (const [name, headerLeft] of Object.entries<number>(lefts.headers)) {
                const cellLeft = lefts.cells[name];
                if (Math.abs(headerLeft - cellLeft) > 1)
                    misaligned++;

                if (pinnedNames.includes(name)) {
                    if (Math.abs(headerLeft - initial.headers[name]) > 1 || Math.abs(cellLeft - initial.cells[name]) > 1)
                        pinnedMoved++;
                }
                else if (Math.abs(cellLeft - (initial.cells[name] - delta)) > 1)
                    othersWrong++;
            }

            for (const name of pinnedNames) {
                const row = perf.visibleRows(g).find(({ r }: any) => !r.hasAttribute('is-group'));
                const cell = [...row.r.querySelectorAll('.column')].find((c: any) => c.column.name === name) as any;
                const b = cell.getBoundingClientRect();
                const hit = perf.deepElementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
                if (!(hit === cell || cell.contains(hit) || cell.shadowRoot?.contains(hit)))
                    pinnedHidden++;
            }

            return { misaligned, pinnedMoved, othersWrong, pinnedHidden };
        });
        performance.mark('perf-trace-end');

        const sum = (key: string) => run.samples.filter((s: any) => s[key] > 0).length;
        return { frames: run.samples.length, max, deltas: run.deltas, misalignedFrames: sum('misaligned'), pinnedMovedFrames: sum('pinnedMoved'), othersWrongFrames: sum('othersWrong'), pinnedHiddenFrames: sum('pinnedHidden'), final: scroller.scrollLeft };
    }, { back: !!options.back, frames: options.frames ?? 60 });
}

test.describe('Horizontal scroll & pinning', () => {
    test.setTimeout(120000);

    test('header and body move together in every frame', perfCase('perf.hs-header-body-sync'), async ({ page }, testInfo) => {
        const grid = await mountWide(page);
        const result = await horizontalFling(grid);

        expect(result.max).toBeGreaterThan(1000);
        expect(result.frames).toBe(60);
        expect(result.misalignedFrames, 'frames with a header not above its cells').toBe(0);
        expect(result.othersWrongFrames).toBe(0);

        await recordPerf(page, testInfo, 'perf.hs-header-body-sync', { counts: { misalignedFrames: result.misalignedFrames }, frames: frameStats(result.deltas) });
    });

    test('pinned columns stay fixed in every frame', perfCase('perf.hs-pinned-fixed'), async ({ page }, testInfo) => {
        const grid = await mountWide(page, ['FirstName']);
        const result = await horizontalFling(grid);

        expect(result.frames).toBe(60);
        expect(result.pinnedMovedFrames, 'frames in which the pinned column moved').toBe(0);
        expect(result.pinnedHiddenFrames, 'frames in which the pinned cell was covered').toBe(0);
        expect(result.othersWrongFrames, 'frames in which other columns did not move by the scroll delta').toBe(0);
        expect(result.misalignedFrames).toBe(0);

        await recordPerf(page, testInfo, 'perf.hs-pinned-fixed', { counts: { pinnedMovedFrames: result.pinnedMovedFrames, pinnedHiddenFrames: result.pinnedHiddenFrames, othersWrongFrames: result.othersWrongFrames }, frames: frameStats(result.deltas) });
    });

    test('horizontal scroll does not re-render rows', perfCase('perf.hs-no-row-mutations'), async ({ page }, testInfo) => {
        const grid = await mountWide(page);
        const log = requestLog(page);

        const styleBefore = await grid.evaluate((g: any) => {
            (window as any).__perf.observe(g);
            return [...g.style].filter((p: string) => p !== '--vi-query-grid-horizontal').map((p: string) => `${p}:${g.style.getPropertyValue(p)}`).sort();
        });

        await horizontalFling(grid, { back: true, frames: 30 });

        const box = (await grid.boundingBox())!;
        await page.mouse.move(box.x + 400, box.y + 300);
        for (let i = 0; i < 10; i++)
            await page.mouse.wheel(300, 0);
        for (let i = 0; i < 10; i++)
            await page.mouse.wheel(-300, 0);

        await parkMouse(page);
        // A page load would be sent 20ms after the last scroll; give it time to show up
        await page.waitForTimeout(300);

        const after = await grid.evaluate((g: any) => ({
            mutations: (window as any).__perf.takeMutations(),
            style: [...g.style].filter((p: string) => p !== '--vi-query-grid-horizontal').map((p: string) => `${p}:${g.style.getPropertyValue(p)}`).sort(),
            horizontal: g.style.getPropertyValue('--vi-query-grid-horizontal')
        }));

        expect(after.mutations.rowRecords, 'row and cell mutations').toBe(0);
        expect(after.mutations.cellRecords).toBe(0);
        expect(log.requests).toHaveLength(0);
        expect(after.mutations.hostStyleRecords).toBeGreaterThan(0);
        expect(after.mutations.hostRecords).toBe(after.mutations.hostStyleRecords);
        expect(after.style, 'host style besides --vi-query-grid-horizontal').toEqual(styleBefore);
        expect(after.horizontal).toBe('0px');

        await recordPerf(page, testInfo, 'perf.hs-no-row-mutations', { counts: { rowMutations: after.mutations.rowRecords, hostStyleWrites: after.mutations.hostStyleRecords, otherMutations: after.mutations.otherRecords, requests: log.requests.length } });
    });

    for (const rate of [1, 4]) {
        test(`horizontal fling frame and style-recalc metrics (${rate}x CPU)`, perfCase('perf.hs-frame-and-style-metrics', { timing: true }), async ({ page }, testInfo) => {
            const grid = await mountWide(page);
            await setCpuThrottle(page, rate);

            // At 1x the frames also come from a Chrome trace (DrawFrame intervals of the page's compositor)
            const traced = rate === 1;
            const before = await cdpMetrics(page);
            if (traced)
                await startFrameTrace(page);

            const result = await horizontalFling(grid, { back: true, frames: 60 });
            const events = traced ? await stopFrameTrace(page) : [];
            const after = await cdpMetrics(page);
            await setCpuThrottle(page, 1);

            const frames = { ...frameStats(result.deltas), ...droppedFrames(result.deltas) };
            const trace = traced ? traceFrames(events) : null;
            const perFrame = (key: string) => round((after[key] - before[key]) / result.frames, 4);
            const cdp = { RecalcStyleCountPerFrame: perFrame('RecalcStyleCount'), RecalcStyleDurationPerFrame: perFrame('RecalcStyleDuration'), LayoutCountPerFrame: perFrame('LayoutCount'), LayoutDurationPerFrame: perFrame('LayoutDuration') };

            expect.soft(frames.p95, 'horizontal fling frame p95').toBeLessThanOrEqual(rate === 1 ? 50 : 120);
            if (traced) {
                expect(trace, 'frames in the fling trace').not.toBeNull();
                checkFrameBudget(testInfo, 'horizontal fling (rAF)', frames, { hard: true });
                checkFrameBudget(testInfo, 'horizontal fling (trace)', trace!, { hard: true });
            }

            await recordPerf(page, testInfo, `perf.hs-frame-and-style-metrics.${rate}x`, { cpuThrottle: rate, frames: traced ? { ...frames, trace } : frames, cdp });
        });
    }

    test('cells scrolled into view have text in the first frame', perfCase('perf.hs-offscreen-text-on-arrival'), async ({ page }, testInfo) => {
        const grid = await mountWide(page);

        // Load rows 0-199 so the vertical shift below lands in loaded data
        await scrollToRow(grid, 150);
        await waitFilled(grid);
        await scrollToRow(grid, 0);
        await waitFilled(grid);

        const result = await grid.evaluate(async (g: any) => {
            const perf = (window as any).__perf;
            const scroller = perf.scroller(g).scroller;
            const right = await perf.runFrames(1, () => scroller.scrollLeft = scroller.scrollWidth, () => perf.checkVisibleCells(g));
            const shifted = await perf.runFrames(1, () => scroller.scrollTop = 120 * g.rowHeight, () => ({ cells: perf.checkVisibleCells(g), coverage: perf.coverage(g), top: perf.topRowIndex(g) }));
            return { right: right.samples[0], shifted: shifted.samples[0], left: scroller.scrollLeft };
        });

        expect(result.left).toBeGreaterThan(0);
        expect(result.right.checked).toBeGreaterThan(0);
        expect(result.right.wrong).toEqual([]);
        expect(result.shifted.top).toBe(120);
        expect(result.shifted.coverage.blank).toBe(0);
        expect(result.shifted.cells.checked).toBeGreaterThan(0);
        expect(result.shifted.cells.wrong).toEqual([]);

        await recordPerf(page, testInfo, 'perf.hs-offscreen-text-on-arrival', { counts: { checkedAfterJumpRight: result.right.checked, checkedAfterShift: result.shifted.cells.checked } });
    });

    test('\'more columns\' buttons update only after scrolling settles', perfCase('perf.hs-more-columns-debounced'), async ({ page }, testInfo) => {
        // The page clock holds the 50ms debounce of the more buttons, so the scroll steps do not depend on the frame rate
        await page.clock.install();
        const grid = await mountWide(page);

        // Visibility of the more buttons, and which side has headers cut off by the visible header area
        const state = () => grid.evaluate((g: any) => {
            const more = (side: string) => !!g.shadowRoot.querySelector(`vi-popup.more.${side}`)?.checkVisibility();
            // The header grid moves with the scroll; its container is the visible header area
            const area = g.shadowRoot.querySelector('header [grid]').parentElement.getBoundingClientRect();
            const headers = [...g.shadowRoot.querySelectorAll('vi-query-grid-column-header')].map((h: any) => h.getBoundingClientRect());
            return {
                left: more('left'),
                right: more('right'),
                cutLeft: headers.some(b => b.left < area.left - 1),
                cutRight: headers.some(b => b.left + b.width / 2 > area.right + 1)
            };
        });
        const buttons = async () => {
            const { left, right } = await state();
            return { left, right };
        };

        const initial = await state();
        expect(initial).toEqual({ left: false, right: true, cutLeft: false, cutRight: true });

        await pauseClock(page);

        // 60 steps to the end, a frame (16ms) apart: each step restarts the debounce before it runs out
        const max = await grid.evaluate((g: any) => {
            const scroller = (window as any).__perf.scroller(g).scroller;
            return scroller.scrollWidth - scroller.clientWidth;
        });
        let flips = 0;
        for (let i = 1; i <= 60; i++) {
            if (i > 1)
                await page.clock.runFor(16);

            const left = await grid.evaluate((g: any, left) => (window as any).__perf.scroller(g).scroller.scrollLeft = left, Math.round(max * i / 60));
            await expect.poll(() => grid.evaluate((g: any) => g.horizontalScrollOffset), 'the scroll event').toBe(left);
            if (JSON.stringify(await buttons()) !== JSON.stringify({ left: false, right: true }))
                flips++;
        }

        await page.clock.runFor(49);
        expect(flips, 'visibility flips during the scroll').toBe(0);
        expect(await buttons(), '49ms after the last scroll').toEqual({ left: false, right: true });

        // After the scroll settles both buttons match the cut-off headers of their side
        await page.clock.runFor(1);
        const settled = await state();
        expect(settled.left, `more.left after the scroll settled: ${JSON.stringify(settled)}`).toBe(settled.cutLeft);
        expect(settled.right, `more.right after the scroll settled: ${JSON.stringify(settled)}`).toBe(settled.cutRight);
        expect(settled.cutLeft).toBe(true);
        expect(settled.left).toBe(true);

        await page.clock.resume();
        await recordPerf(page, testInfo, 'perf.hs-more-columns-debounced', { counts: { flipsDuringScroll: flips }, dataset: { initial, settled } });
    });

    test('pinning a column moves cells without recreating them', perfCase('perf.hs-pin-toggle-moves-cells'), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountGrid(page);
        await parkMouse(page);
        const savesBefore = (await savedSettings(page)).length;
        const log = requestLog(page);

        const header = grid.locator('vi-query-grid-column-header[name="Email"]');
        await header.locator('vi-button[icon="CaretDown"]:visible').click();
        const pin = header.locator('vi-popup-menu-item[icon="Pin"]');
        await expect(pin).toBeVisible();

        await grid.evaluate((g: any) => {
            const w = window as any;
            const cells = w.__cells = new WeakSet();
            w.__perf.rows(g).forEach((r: any) => r.querySelectorAll('.column').forEach((c: any) => cells.add(c)));
            const state = w.__pin = { initializingAdds: 0 };
            new MutationObserver(records => records.forEach(r => r.oldValue === null && state.initializingAdds++)).observe(g, { attributes: true, attributeFilter: ['initializing'], attributeOldValue: true });
            w.__perf.observe(g);
        });

        await pin.click();
        await expect.poll(() => headerNames(grid)).toEqual(expect.arrayContaining(['Email']));
        await expect.poll(async () => (await headerNames(grid))[0]).toBe('Email');
        await waitForGridReady(grid);
        await log.quiet();

        const result = await grid.evaluate((g: any) => {
            const w = window as any;
            const rows = w.__perf.rows(g).filter((r: any) => !r.classList.contains('hidden'));
            const cells = rows.flatMap((r: any) => [...r.querySelectorAll('.column')]);
            return {
                mutations: w.__perf.takeMutations(),
                recreated: cells.filter((c: any) => !w.__cells.has(c)).length,
                firstCells: [...new Set(rows.map((r: any) => r.querySelector('.column').column.name))],
                initializingAdds: w.__pin.initializingAdds
            };
        });

        expect(result.firstCells, 'first cell of every row').toEqual(['Email']);
        expect(result.recreated, 'recreated cells').toBe(0);
        expect((await savedSettings(page)).length - savesBefore, 'saves').toBe(1);
        expect(log.of('ExecuteQuery')).toHaveLength(0);
        await expect(grid).not.toHaveAttribute('initializing');

        await recordPerf(page, testInfo, 'perf.hs-pin-toggle-moves-cells', { counts: { recreatedCells: result.recreated, saves: (await savedSettings(page)).length - savesBefore, childListRecords: result.mutations.rowChildListRecords, initializingAdds: result.initializingAdds } });
    });
});
