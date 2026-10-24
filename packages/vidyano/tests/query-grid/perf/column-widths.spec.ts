import { columnTracks, mountGrid, nextFrames, requestLog, savedSettings, waitForGridReady } from '../_helpers/query-grid';
import { appendGrid, cdpMetrics, expect, gridLocator, parkMouse, perfCase, perfPage, prefetch, recordPerf, round, scrollToRow, test, waitFilled } from '../_helpers/perf';

const PX_ONLY = /^(\d+(\.\d+)?px\s+)+minmax\(0(px)?,\s*1fr\)$/;

test.describe('Column widths', () => {
    test.setTimeout(120000);

    test('column template does not change after ready', perfCase('perf.cw-stable-during-vscroll'), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountGrid(page);
        await parkMouse(page);

        const before = await grid.evaluate((g: any) => {
            const w = window as any;
            const template = () => getComputedStyle(g).getPropertyValue('--vi-query-grid-columns').trim();
            const state = w.__template = { initial: template(), values: [] as string[] };
            new MutationObserver(() => state.values.push(template())).observe(g, { attributes: true, attributeFilter: ['style'] });

            return w.__perf.columnLefts(g).cells;
        });

        // Scroll top -> 5,000 -> bottom -> top, sampling the template in every frame of a stepped scroll
        const sampled = await grid.evaluate(async (g: any) => {
            const perf = (window as any).__perf;
            const scroller = perf.scroller(g).scroller;
            const result = await perf.runFrames(50, (i: number) => scroller.scrollTop = (i + 1) * 100 * g.rowHeight, () => getComputedStyle(g).getPropertyValue('--vi-query-grid-columns').trim());
            return [...new Set(result.samples)];
        });
        await waitFilled(grid);
        for (const row of [100000, 0]) {
            await scrollToRow(grid, row);
            await waitFilled(grid);
        }

        // Wheel, row hover and selection toggles
        const box = (await grid.boundingBox())!;
        await page.mouse.move(box.x + 400, box.y + 200);
        for (let i = 0; i < 10; i++)
            await page.mouse.wheel(0, 300);

        await waitFilled(grid);
        for (let i = 0; i < 6; i++)
            await page.mouse.move(box.x + 400, box.y + 100 + i * 32);

        await scrollToRow(grid, 0);
        await waitFilled(grid);
        const selectors = grid.locator('vi-query-grid-row:not(.hidden)').locator('.selector');
        for (const index of [1, 2, 1, 2])
            await selectors.nth(index).click();

        await nextFrames(page, 2);
        await parkMouse(page);

        const after = await grid.evaluate((g: any) => {
            const w = window as any;
            return { template: w.__template, lefts: w.__perf.columnLefts(g).cells };
        });

        const changes = [...sampled, ...after.template.values].filter(v => v !== after.template.initial);
        expect(changes, 'template changes after ready').toEqual([]);
        for (const [name, left] of Object.entries(before))
            expect(Math.abs((after.lefts as any)[name] - (left as number)), `${name} cell left`).toBeLessThanOrEqual(0.5);

        await recordPerf(page, testInfo, 'perf.cw-stable-during-vscroll', { counts: { templateChangesAfterReady: changes.length, hostStyleWrites: after.template.values.length } });
    });

    test('column resize drag is coalesced per animation frame', perfCase('perf.cw-resize-drag-coalesced', { timing: true }), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountGrid(page);
        const tracks = await columnTracks(grid);
        const lastNameIndex = 1;
        const savesBefore = (await savedSettings(page)).length;

        const resizer = grid.locator('vi-query-grid-column-header[name="LastName"] .resizer');
        const box = (await resizer.boundingBox())!;
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;

        await page.mouse.move(x, y);
        await grid.evaluate((g: any) => {
            const w = window as any;
            const template = () => getComputedStyle(g).getPropertyValue('--vi-query-grid-columns').trim();
            const state = w.__drag = { frames: 0, writes: 0, last: template(), stop: false };
            new MutationObserver(() => {
                const value = template();
                if (value !== state.last) {
                    state.writes++;
                    state.last = value;
                }
            }).observe(g, { attributes: true, attributeFilter: ['style'] });

            const tick = () => {
                state.frames++;
                if (!state.stop)
                    requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        });

        await page.mouse.down();
        for (let i = 1; i <= 40; i++)
            await page.mouse.move(x + i * 5, y);

        await page.mouse.up();
        await nextFrames(page, 3);

        const drag = await grid.evaluate(() => {
            const state = (window as any).__drag;
            state.stop = true;
            return { frames: state.frames, writes: state.writes };
        });
        const after = await columnTracks(grid);

        expect(drag.writes).toBeLessThanOrEqual(drag.frames + 1);
        expect(Math.abs(after[lastNameIndex] - (tracks[lastNameIndex] + 200))).toBeLessThanOrEqual(2);
        after.forEach((width, index) => {
            if (index !== lastNameIndex)
                expect(width, `track ${index}`).toBe(tracks[index]);
        });
        expect((await savedSettings(page)).length - savesBefore).toBe(1);

        await recordPerf(page, testInfo, 'perf.cw-resize-drag-coalesced', { counts: { templateWrites: drag.writes, framesElapsed: drag.frames, saves: (await savedSettings(page)).length - savesBefore, moves: 40 } });
    });

    test('column template is published once per initialization', perfCase('perf.cw-write-count-on-mount'), async ({ page }, testInfo) => {
        await perfPage(page);
        await prefetch(page, 'People');

        const result = await appendGrid(page, { recordTemplate: true });
        const grid = gridLocator(page);
        await waitForGridReady(grid);
        const final = await grid.evaluate((g: any) => getComputedStyle(g).getPropertyValue('--vi-query-grid-columns').trim());

        const templates = result.templates!;
        const pxTransitions = templates.filter((t, i) => PX_ONLY.test(t) && (i === 0 || !PX_ONLY.test(templates[i - 1]))).length;
        expect(templates.length, `templates: ${JSON.stringify(templates)}`).toBeLessThanOrEqual(2);
        expect(pxTransitions, 'transitions to a px-only template').toBe(1);
        expect(templates[templates.length - 1]).toBe(final);

        await recordPerf(page, testInfo, 'perf.cw-write-count-on-mount', { counts: { templateValues: templates.length, pxTransitions }, dataset: { templates } });
    });

    test('resize drag causes bounded layout work', perfCase('perf.cw-resize-drag-layout-per-frame', { timing: true }), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountGrid(page);

        const resizer = grid.locator('vi-query-grid-column-header[name="LastName"] .resizer');
        const box = (await resizer.boundingBox())!;
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;

        await page.mouse.move(x, y);
        await nextFrames(page, 2);
        const start = await grid.evaluate((g: any) => {
            const w = window as any;
            const state = w.__drag = { frames: 0, stop: false };
            const tick = () => {
                state.frames++;
                if (!state.stop)
                    requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
            w.__perf.observe(g);
            return performance.now();
        });
        const before = await cdpMetrics(page);

        await page.mouse.down();
        for (let i = 1; i <= 40; i++)
            await page.mouse.move(x + i * 5, y);

        await page.mouse.up();
        await nextFrames(page, 3);

        const after = await cdpMetrics(page);
        const drag = await grid.evaluate((g: any, start) => {
            const w = window as any;
            w.__drag.stop = true;
            return { frames: w.__drag.frames, mutations: w.__perf.takeMutations(), blocking: w.__perf.tbt(start, performance.now()) };
        }, start);

        const layouts = after.LayoutCount - before.LayoutCount;
        const layoutsPerFrame = round(layouts / drag.frames, 2);
        expect(drag.frames).toBeGreaterThan(0);
        expect(layoutsPerFrame, `${layouts} layouts in ${drag.frames} frames`).toBeLessThanOrEqual(2);
        expect(drag.mutations.rowChildListRecords, 'childList records in rows and cells').toBe(0);
        expect.soft(drag.blocking.tbt, 'TBT during the drag').toBeLessThanOrEqual(50);

        await recordPerf(page, testInfo, 'perf.cw-resize-drag-layout-per-frame', { counts: { layouts, frames: drag.frames, rowChildListRecords: drag.mutations.rowChildListRecords }, timings: { tbt: [round(drag.blocking.tbt)], layoutDuration: [round((after.LayoutDuration - before.LayoutDuration) * 1000, 2)] }, cdp: { layoutsPerFrame } });
    });

    test('hiding a middle column re-measures once without recreating cells', perfCase('perf.cw-hide-column-remeasure'), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountGrid(page);
        await parkMouse(page);
        const tracksBefore = await columnTracks(grid);
        const savesBefore = (await savedSettings(page)).length;
        const log = requestLog(page);

        // Open the Gender header menu
        const header = grid.locator('vi-query-grid-column-header[name="Gender"]');
        await header.locator('vi-button[icon="CaretDown"]:visible').click();
        const hide = header.locator('vi-popup-menu-item[icon="Eye"]');
        await expect(hide).toBeVisible();

        await grid.evaluate((g: any) => {
            const w = window as any;
            const cells = w.__cells = new WeakSet();
            w.__perf.rows(g).forEach((r: any) => r.querySelectorAll('.column').forEach((c: any) => cells.add(c)));
            const state = w.__hide = { adds: 0, removals: 0, start: NaN, settled: NaN };
            window.addEventListener('pointerup', () => state.start = performance.now(), { capture: true, once: true });
            new MutationObserver(records => records.forEach(r => {
                if (r.oldValue === null)
                    state.adds++;
                else {
                    state.removals++;
                    state.settled = performance.now();
                }
            })).observe(g, { attributes: true, attributeFilter: ['initializing'], attributeOldValue: true });
            w.__perf.observe(g);
        });

        await hide.click();
        await expect(header).toHaveCount(0);
        await waitForGridReady(grid);
        await log.quiet();

        const result = await grid.evaluate((g: any) => {
            const w = window as any;
            const cells = w.__perf.rows(g).flatMap((r: any) => [...r.querySelectorAll('.column')]);
            return {
                state: w.__hide,
                mutations: w.__perf.takeMutations(),
                recreated: cells.filter((c: any) => !w.__cells.has(c)).length,
                cellsWithGender: cells.filter((c: any) => c.column.name === 'Gender').length
            };
        });
        const tracksAfter = await columnTracks(grid);

        expect(tracksAfter).toHaveLength(tracksBefore.length - 1);
        expect(result.recreated, 'recreated cells').toBe(0);
        expect(result.cellsWithGender).toBe(0);
        // At most one re-measure (the remaining columns may also keep their measured widths), never left in [initializing]
        expect(result.state.adds, '[initializing] re-entries').toBeLessThanOrEqual(1);
        expect(result.state.removals, '[initializing] removals').toBe(result.state.adds);
        await expect(grid).not.toHaveAttribute('initializing');
        expect((await savedSettings(page)).length - savesBefore, 'saves').toBe(1);
        expect(log.of('ExecuteQuery')).toHaveLength(0);

        await recordPerf(page, testInfo, 'perf.cw-hide-column-remeasure', { counts: { recreatedCells: result.recreated, saves: (await savedSettings(page)).length - savesBefore, childListRecords: result.mutations.rowChildListRecords, initializingAdds: result.state.adds }, timings: { resettleMs: result.state.adds ? [round(result.state.settled - result.state.start)] : [] } });
    });
});
