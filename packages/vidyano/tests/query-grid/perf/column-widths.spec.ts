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

    test('column resize drag is coalesced per animation frame', perfCase('perf.cw-resize-drag-coalesced'), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountGrid(page);
        const tracks = await columnTracks(grid);
        const lastNameIndex = 1;
        const savesBefore = (await savedSettings(page)).length;

        const resizer = grid.locator('vi-query-grid-column-header[name="LastName"] .resizer');
        const box = (await resizer.boundingBox())!;
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        const frames = 10;
        const movesPerFrame = 4;
        const stepPx = 5;

        await page.mouse.move(x, y);
        await page.mouse.down();

        // Chrome delivers at most one real pointermove per frame, so the moves within a frame are dispatched in the page;
        // they reach the drag through the document listeners that the real pointer down added
        const samples: { publications: number; width: number }[] = await grid.evaluate(async (g: any, { x, y, frames, movesPerFrame, stepPx, lastNameIndex }) => {
            const template = (style: string | null) => /--vi-query-grid-columns:\s*([^;]+)/.exec(style ?? '')?.[1].trim() ?? '';
            const records: MutationRecord[] = [];
            const observer = new MutationObserver(list => records.push(...list));
            observer.observe(g, { attributes: true, attributeFilter: ['style'], attributeOldValue: true });
            let last = template(g.getAttribute('style'));

            // The old values hold every template in between, also the ones replaced again within the same task
            const publications = () => {
                records.push(...observer.takeRecords());
                let count = 0;
                for (const value of [...records.splice(0).map(r => template(r.oldValue)), template(g.getAttribute('style'))]) {
                    if (value !== last) {
                        count++;
                        last = value;
                    }
                }

                return count;
            };

            const result = await (window as any).__perf.runFrames(frames, (i: number) => {
                for (let move = 1; move <= movesPerFrame; move++)
                    document.dispatchEvent(new PointerEvent('pointermove', { clientX: x + (i * movesPerFrame + move) * stepPx, clientY: y, buttons: 1, pointerId: 1, pointerType: 'mouse', bubbles: true, composed: true }));
            }, () => ({ publications: publications(), width: parseFloat(template(g.getAttribute('style')).split(/\s+/)[lastNameIndex]) }));
            observer.disconnect();

            return result.samples;
        }, { x, y, frames, movesPerFrame, stepPx, lastNameIndex });

        const totalPx = frames * movesPerFrame * stepPx;
        await page.mouse.move(x + totalPx, y);
        await page.mouse.up();
        await nextFrames(page, 3);
        const after = await columnTracks(grid);

        samples.forEach((sample, i) => {
            expect(sample.publications, `width publications in frame ${i}`).toBeLessThanOrEqual(1);
            // The frame shows the latest move of its task, not an earlier one
            expect(Math.abs(sample.width - (tracks[lastNameIndex] + (i + 1) * movesPerFrame * stepPx)), `width in frame ${i}: ${sample.width}`).toBeLessThanOrEqual(1);
        });
        expect(Math.abs(after[lastNameIndex] - (tracks[lastNameIndex] + totalPx))).toBeLessThanOrEqual(2);
        after.forEach((width, index) => {
            if (index !== lastNameIndex)
                expect(width, `track ${index}`).toBe(tracks[index]);
        });
        expect((await savedSettings(page)).length - savesBefore).toBe(1);

        await recordPerf(page, testInfo, 'perf.cw-resize-drag-coalesced', { counts: { publications: samples.reduce((sum, s) => sum + s.publications, 0), frames, moves: frames * movesPerFrame, saves: (await savedSettings(page)).length - savesBefore } });
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

    test('resize drag causes bounded layout work', perfCase('perf.cw-resize-drag-layout-per-frame'), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountGrid(page);
        const tracks = await columnTracks(grid);
        const lastNameIndex = 1;

        const resizer = grid.locator('vi-query-grid-column-header[name="LastName"] .resizer');
        const box = (await resizer.boundingBox())!;
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        const frames = 20;
        const stepPx = 5;

        // One move per frame: real pointermoves can share a frame or skip one, so they are dispatched in the page and reach
        // the drag through the document listeners that the real pointer down added
        const runFrames = (from: number | null) => grid.evaluate((g: any, { x, y, frames, stepPx, from }) => (window as any).__perf.runFrames(frames, (i: number) => {
            if (from !== null)
                document.dispatchEvent(new PointerEvent('pointermove', { clientX: x + (from + i) * stepPx, clientY: y, buttons: 1, pointerId: 1, pointerType: 'mouse', bubbles: true, composed: true }));
        }), { x, y, frames, stepPx, from });
        const layoutsDuring = async (run: () => Promise<unknown>) => {
            const before = await cdpMetrics(page);
            await run();
            const after = await cdpMetrics(page);
            return { layouts: after.LayoutCount - before.LayoutCount, styles: after.RecalcStyleCount - before.RecalcStyleCount };
        };

        await page.mouse.move(x, y);
        await nextFrames(page, 2);

        // The frame helper's own work: it resizes a probe in every frame
        const idle = await layoutsDuring(() => runFrames(null));

        await page.mouse.down();
        // The first move past the drag threshold starts the drag without a resize
        await grid.evaluate((g: any, { x, y, stepPx }) => {
            document.dispatchEvent(new PointerEvent('pointermove', { clientX: x + stepPx, clientY: y, buttons: 1, pointerId: 1, pointerType: 'mouse', bubbles: true, composed: true }));
            (window as any).__perf.observe(g);
        }, { x, y, stepPx });
        await nextFrames(page, 2);
        const drag = await layoutsDuring(() => runFrames(2));

        const totalPx = (frames + 1) * stepPx;
        await page.mouse.move(x + totalPx, y);
        await page.mouse.up();
        await nextFrames(page, 3);
        const mutations = await grid.evaluate(() => (window as any).__perf.takeMutations());
        const after = await columnTracks(grid);

        // Each move's width is laid out in the frame the helper lays out anyway. A layout forced per move, or a second
        // layout pass per frame, adds one per move; work that does not repeat per move only adds a few
        expect(drag.layouts - idle.layouts, `layouts: ${drag.layouts} in ${frames} drag frames, ${idle.layouts} in ${frames} idle frames`).toBeLessThanOrEqual(frames / 4);
        expect(Math.abs(after[lastNameIndex] - (tracks[lastNameIndex] + totalPx)), 'resized width').toBeLessThanOrEqual(2);
        expect(mutations.rowChildListRecords, 'childList records in rows and cells').toBe(0);

        await recordPerf(page, testInfo, 'perf.cw-resize-drag-layout-per-frame', { counts: { layouts: drag.layouts, helperLayouts: idle.layouts, styleRecalcs: drag.styles, helperStyleRecalcs: idle.styles, frames, rowChildListRecords: mutations.rowChildListRecords } });
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
