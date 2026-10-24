import { Locator, Page } from '@playwright/test';
import { mountGrid, nextFrames, waitForGridReady } from '../_helpers/query-grid';
import { expect, frameStats, median, mountPrefetched, parkMouse, perfCase, perfPage, recordPerf, round, runScrollScenarios, scrollToRow, setCpuThrottle, test, waitFilled } from '../_helpers/perf';

/** Loads the rows [start, end) of the grid's query without returning the lazy items to Playwright. */
async function preload(grid: Locator, start: number, end: number) {
    await grid.evaluate(async (g: any, { start, end }) => { await g.query.items.sliceAsync(start, end); }, { start, end });
}

/**
 * Scrolls a QueryGrid_DataTypes grid through all rows (one step per frame) while every cell of `tag` gets a
 * MutationObserver on its shadow root; per frame and cell the records and whether the cell's item changed.
 */
function scrollTypedCells(grid: Locator, tag: string, frames: number) {
    return grid.evaluate(async (g: any, { tag, frames }) => {
        const perf = (window as any).__perf;
        const scroller = perf.scroller(g).scroller;
        const max = scroller.scrollHeight - scroller.clientHeight;
        const cells = perf.rows(g).map((r: any) => r.querySelector(tag)).filter((c: any) => !!c);
        // The callback runs at the microtask checkpoints inside the frame, before the measure: collect its records
        const pending = cells.map(() => [] as MutationRecord[]);
        const observers = cells.map((cell: any, n: number) => {
            const observer = new MutationObserver(records => pending[n].push(...records));
            observer.observe(cell.shadowRoot, { subtree: true, childList: true, attributes: true, characterData: true });
            return observer;
        });
        const takeRecords = (n: number) => pending[n].splice(0).concat(observers[n].takeRecords());
        const items = cells.map((c: any) => c.value?.item ?? null);
        const imageElements = (cell: any) => cell.shadowRoot.querySelectorAll('.image').length;
        const stats = { itemChanges: 0, frames: 0, contentRecords: 0, contentWithoutItemChange: 0, contentPerChangeMax: 0, styleRecords: 0, styleWithoutItemChange: 0, stylePerChangeMax: 0, imageAdds: 0, imageRemoves: 0, maxImagesPerCell: 0 };

        const run = await perf.runFrames(frames, (i: number) => scroller.scrollTop = Math.round(max * (i + 1) / frames), () => {
            cells.forEach((cell: any, n: number) => {
                const records = takeRecords(n);
                const item = cell.value?.item ?? null;
                const changed = item !== items[n];
                items[n] = item;
                if (changed)
                    stats.itemChanges++;

                const content = records.filter(r => r.type === 'childList' || r.type === 'characterData');
                const style = records.filter(r => r.type === 'attributes' && r.attributeName === 'style');
                stats.contentRecords += content.length;
                stats.styleRecords += style.length;
                // A render replaces the content with one innerHTML write, which is one childList record
                const contentWrites = content.length;
                if (contentWrites > 0 && !changed)
                    stats.contentWithoutItemChange++;
                if (style.length > 0 && !changed)
                    stats.styleWithoutItemChange++;

                stats.contentPerChangeMax = Math.max(stats.contentPerChangeMax, contentWrites);
                stats.stylePerChangeMax = Math.max(stats.stylePerChangeMax, style.length);
                for (const r of records.filter(r => r.type === 'childList')) {
                    stats.imageAdds += [...r.addedNodes].filter((e: any) => e.classList?.contains('image')).length;
                    stats.imageRemoves += [...r.removedNodes].filter((e: any) => e.classList?.contains('image')).length;
                }
                stats.maxImagesPerCell = Math.max(stats.maxImagesPerCell, imageElements(cell));
            });
            stats.frames++;
        });

        observers.forEach((o: MutationObserver) => o.disconnect());
        return { ...stats, cells: cells.length, deltas: run.deltas };
    }, { tag, frames });
}

/** Mounts QueryGrid_DataTypes with Id and `column` pinned, so its cells are always in view (and filled). */
async function mountDataTypes(page: Page, column: string) {
    await perfPage(page);
    const { grid } = await mountPrefetched(page, 'QueryGrid_DataTypes', { column: 'Text', userSettings: { Id: { isPinned: true }, [column]: { isPinned: true } } });
    await parkMouse(page);
    await preload(grid, 0, 212);
    return grid;
}

test.describe('Recycling & cell formatting', () => {
    test.setTimeout(120000);

    test('cells are recycled, never recreated, during scroll', perfCase('perf.rc-no-cell-creation-on-scroll'), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountGrid(page);
        await parkMouse(page);

        const cellsPerRow = () => grid.evaluate((g: any) => [...new Set((window as any).__perf.rows(g).map((r: any) => r.querySelectorAll('.column').length))]);
        const before = await cellsPerRow();
        await grid.evaluate((g: any) => (window as any).__perf.observe(g));

        await runScrollScenarios(page, grid);

        const mutations = await grid.evaluate(() => (window as any).__perf.takeMutations());
        expect(mutations.cellAdds).toBe(0);
        expect(mutations.cellRemoves).toBe(0);
        expect(before).toHaveLength(1);
        expect(await cellsPerRow()).toEqual(before);

        await recordPerf(page, testInfo, 'perf.rc-no-cell-creation-on-scroll', { counts: { cellAdds: mutations.cellAdds, cellRemoves: mutations.cellRemoves, cellsPerRow: before[0], cellTextWrites: mutations.cellTextWrites } });
    });

    test('each cell is written at most once per shift', perfCase('perf.rc-text-writes-per-shift'), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountGrid(page);
        await parkMouse(page);

        // Load rows 0-199
        await scrollToRow(grid, 150);
        await waitFilled(grid);
        await scrollToRow(grid, 0);
        await waitFilled(grid);

        const shift = async (row: number) => {
            await grid.evaluate((g: any) => (window as any).__perf.observe(g));
            await scrollToRow(grid, row);
            await waitFilled(grid);
            await nextFrames(page, 2);
            return grid.evaluate(() => (window as any).__perf.takeMutations());
        };

        const loaded = await shift(120);
        const unloaded = await shift(5000);

        expect(loaded.cellTextWrites).toBeGreaterThan(0);
        expect(loaded.maxTextWritesPerCell, 'text writes per cell into a loaded region').toBeLessThanOrEqual(1);
        expect(unloaded.maxTextWritesPerCell, 'text writes per cell into an unloaded region').toBeLessThanOrEqual(2);

        await recordPerf(page, testInfo, 'perf.rc-text-writes-per-shift', { counts: { cellTextWrites: loaded.cellTextWrites + unloaded.cellTextWrites, cellTextWritesLoaded: loaded.cellTextWrites, cellTextWritesUnloaded: unloaded.cellTextWrites, maxPerCellLoaded: loaded.maxTextWritesPerCell, maxPerCellUnloaded: unloaded.maxTextWritesPerCell } });
    });

    test('all visible-row cells are formatted correctly after a shift', perfCase('perf.fmt-offscreen-columns-formatted'), async ({ page }, testInfo) => {
        await perfPage(page, { width: 800 });
        const grid = await mountGrid(page);
        await parkMouse(page);

        // The first render fills every cell, also the off-screen ones, because the column widths are measured from the cell content
        const initial = await grid.evaluate((g: any) => (window as any).__perf.checkVisibleCells(g));
        expect(initial.wrong).toEqual([]);
        expect(initial.offscreenValued).toBeGreaterThan(0);
        expect(initial.offscreenFilled, 'off-screen cells filled after the first render').toBe(initial.offscreenValued);

        await scrollToRow(grid, 2500);
        await waitFilled(grid);
        const result = await grid.evaluate((g: any) => (window as any).__perf.checkVisibleCells(g));

        expect(result.checked).toBeGreaterThan(0);
        expect(result.wrong).toEqual([]);
        expect(result.offscreen).toBeGreaterThan(0);

        // After the first render off-screen cells may be deferred until they scroll into view, so only record them
        await recordPerf(page, testInfo, 'perf.fmt-offscreen-columns-formatted', { counts: { checkedCells: result.checked, offscreenCells: result.offscreen, offscreenWithText: result.offscreenWithText, initialOffscreenFilled: initial.offscreenFilled } });
    });

    test('off-screen cells are deferred after a vertical shift and filled when they scroll into view', perfCase('perf.fmt-offscreen-deferred-on-shift'), async ({ page }, testInfo) => {
        await perfPage(page, { width: 800 });
        const grid = await mountGrid(page);
        await parkMouse(page);

        // Load rows 0-199 so the vertical shift below lands in loaded data
        await scrollToRow(grid, 150);
        await waitFilled(grid);
        await scrollToRow(grid, 0);
        await waitFilled(grid);

        const result = await grid.evaluate(async (g: any) => {
            const perf = (window as any).__perf;
            const scroller = perf.scroller(g).scroller;
            const shifted = await perf.runFrames(1, () => scroller.scrollTop = 120 * g.rowHeight, () => ({ cells: perf.checkVisibleCells(g), top: perf.topRowIndex(g) }));
            const right = await perf.runFrames(1, () => scroller.scrollLeft = scroller.scrollWidth, () => perf.checkVisibleCells(g));
            return { shifted: shifted.samples[0], right: right.samples[0], left: scroller.scrollLeft };
        });

        expect(result.shifted.top).toBe(120);
        expect(result.shifted.cells.checked).toBeGreaterThan(0);
        expect(result.shifted.cells.wrong).toEqual([]);
        expect(result.shifted.cells.offscreenValued).toBeGreaterThan(0);
        expect(result.shifted.cells.offscreenFilled, 'off-screen cells filled during a vertical shift').toBe(0);

        // The deferred cells have the correct text in the first frame they are in view
        expect(result.left).toBeGreaterThan(0);
        expect(result.right.checked).toBeGreaterThan(0);
        expect(result.right.wrong).toEqual([]);

        await recordPerf(page, testInfo, 'perf.fmt-offscreen-deferred-on-shift', { counts: { checkedAfterShift: result.shifted.cells.checked, deferredAfterShift: result.shifted.cells.offscreenValued - result.shifted.cells.offscreenFilled, checkedAfterJumpRight: result.right.checked } });
    });

    test('default cell text updates in place', perfCase('perf.rc-text-node-in-place'), async ({ page }, testInfo) => {
        await perfPage(page, { width: 1600 });
        const grid = await mountGrid(page);
        await parkMouse(page);
        await preload(grid, 0, 600);

        await grid.evaluate((g: any) => (window as any).__perf.observe(g));
        // 500 rows recycled through the pool, 5 rows per frame
        await grid.evaluate((g: any) => {
            const perf = (window as any).__perf;
            const scroller = perf.scroller(g).scroller;
            return perf.runFrames(100, (i: number) => scroller.scrollTop = (i + 1) * 5 * g.rowHeight);
        });
        await waitFilled(grid);
        await nextFrames(page, 2);

        const result = await grid.evaluate((g: any) => {
            const perf = (window as any).__perf;
            const mutations = perf.takeMutations();
            const textNodes = (cell: Element) => {
                const walker = document.createTreeWalker(cell.shadowRoot!, NodeFilter.SHOW_TEXT);
                let count = 0;
                for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                    if (!node.parentElement?.closest('style') && node.textContent!.trim() !== '')
                        count++;
                }
                return count;
            };
            const cells = perf.visibleRows(g).flatMap(({ r }: any) => [...r.querySelectorAll('vi-query-grid-cell-default:not([tag])')]).filter((c: any) => perf.cellText(c) !== '');
            return { mutations, cells: cells.length, wrongTextNodes: cells.map((c: any) => `${c.column.name}: ${textNodes(c)}`).filter((s: string) => !s.endsWith(': 1')), topIndex: perf.topRowIndex(g) };
        });

        expect(result.topIndex).toBe(500);
        expect(result.mutations.cellTextWrites).toBeGreaterThan(0);
        expect(result.mutations.cellChildList['vi-query-grid-cell-default'] ?? 0, 'childList records in default cells').toBe(0);
        expect(result.cells).toBeGreaterThan(0);
        expect(result.wrongTextNodes, 'default cells with other than one non-empty text node').toEqual([]);

        await recordPerf(page, testInfo, 'perf.rc-text-node-in-place', { counts: { defaultCellChildList: result.mutations.cellChildList['vi-query-grid-cell-default'] ?? 0, cellTextWrites: result.mutations.cellTextWrites, checkedCells: result.cells } });
    });

    test('sort and search reuse row and cell elements', perfCase('perf.rc-rows-reused-on-search'), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountGrid(page);
        await parkMouse(page);

        await grid.evaluate((g: any) => {
            const w = window as any;
            const known = w.__known = new WeakSet();
            w.__perf.rows(g).forEach((r: any) => {
                known.add(r);
                r.querySelectorAll('.column').forEach((c: any) => known.add(c));
            });
            w.__perf.observe(g);
        });

        const reused = () => grid.evaluate((g: any) => {
            const w = window as any;
            const rows = w.__perf.rows(g);
            const cells = rows.flatMap((r: any) => [...r.querySelectorAll('.column')]);
            return { newRows: rows.filter((r: any) => !w.__known.has(r)).length, newCells: cells.filter((c: any) => !w.__known.has(c)).length, matches: w.__perf.firstColumnMatches(g, 'FirstName') };
        });
        const steps: Record<string, any> = {};

        await grid.locator('vi-query-grid-column-header[name="LastName"] .label').click();
        await waitForGridReady(grid);
        steps.sort = await reused();

        await grid.evaluate(async (g: any) => { await g.query.search(); });
        await waitForGridReady(grid);
        steps.search = await reused();

        await grid.evaluate(async (g: any) => {
            g.query.textSearch = 'FirstName:A*';
            await g.query.search();
        });
        await waitForGridReady(grid);
        steps.textSearch = await reused();
        expect(await grid.evaluate((g: any) => g.query.totalItems)).toBeLessThan(10000);

        const mutations = await grid.evaluate(() => (window as any).__perf.takeMutations());
        for (const [label, step] of Object.entries<any>(steps))
            expect(step, label).toEqual({ newRows: 0, newCells: 0, matches: true });

        expect({ rowAdds: mutations.rowAdds, rowRemoves: mutations.rowRemoves, cellAdds: mutations.cellAdds, cellRemoves: mutations.cellRemoves }).toEqual({ rowAdds: 0, rowRemoves: 0, cellAdds: 0, cellRemoves: 0 });

        await recordPerf(page, testInfo, 'perf.rc-rows-reused-on-search', { counts: { rowAdds: mutations.rowAdds, rowRemoves: mutations.rowRemoves, cellAdds: mutations.cellAdds, cellRemoves: mutations.cellRemoves, cellTextWrites: mutations.cellTextWrites } });
    });

    test('group header elements are created lazily and reused', perfCase('perf.rc-group-element-reuse'), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountGrid(page);
        await parkMouse(page);

        await grid.evaluate((g: any) => {
            const w = window as any;
            const state = w.__groupElements = { added: 0, removed: 0 };
            const count = (nodes: NodeList) => [...nodes].filter((n: any) => n.tagName === 'VI-QUERY-GRID-ROW-GROUP').length;
            new MutationObserver(records => records.forEach(r => {
                state.added += count(r.addedNodes);
                state.removed += count(r.removedNodes);
            })).observe(g.shadowRoot, { subtree: true, childList: true });
        });
        await grid.evaluate(async (g: any) => { await g.query.group('BirthDate'); });
        await expect(grid).toHaveAttribute('has-grouping', '');
        await waitForGridReady(grid);

        const fling = await grid.evaluate(async (g: any) => {
            const perf = (window as any).__perf;
            const scroller = perf.scroller(g).scroller;
            const max = scroller.scrollHeight - scroller.clientHeight;
            const label = (r: any) => r.querySelector('vi-query-grid-row-group').shadowRoot.querySelector('label').textContent.trim();
            const run = await perf.runFrames(120, (i: number) => scroller.scrollTop = max * (i + 1) / 120, () => perf.visibleRows(g).filter(({ r }: any) => r.hasAttribute('is-group')).map(({ r }: any) => label(r)));
            return { labels: [...new Set(run.samples.flat())] as string[] };
        });
        await waitFilled(grid);

        const result = await grid.evaluate((g: any) => ({ ...(window as any).__groupElements, rowElements: (window as any).__perf.rows(g).length, groups: g.query.groupingInfo.groups.length }));
        expect(fling.labels.length).toBeGreaterThan(10);
        expect(fling.labels.filter(l => !/^\d{4} \(\d+\)$/.test(l)), 'group labels').toEqual([]);
        expect(result.added, 'group elements added').toBeLessThanOrEqual(result.rowElements);
        expect(result.removed, 'group elements removed').toBe(0);

        await recordPerf(page, testInfo, 'perf.rc-group-element-reuse', { counts: { groupElementsAdded: result.added, groupElementsRemoved: result.removed, rowElements: result.rowElements, labelsSeen: fling.labels.length } });
    });

    test('boolean cells reuse their icon', perfCase('perf.rc-boolean-icon-reuse'), async ({ page }, testInfo) => {
        // Wide enough that IsActive is in view (off-screen cells are deferred)
        await perfPage(page, { width: 1600 });
        const grid = await mountGrid(page);
        await parkMouse(page);
        await preload(grid, 0, 2100);

        const result = await grid.evaluate(async (g: any) => {
            const perf = (window as any).__perf;
            const scroller = perf.scroller(g).scroller;
            const cells = perf.rows(g).map((r: any) => r.querySelector('vi-query-grid-cell-boolean')).filter((c: any) => !!c);
            const view = perf.scroller(g).getBoundingClientRect();
            const inView = cells.every((c: any) => c.getBoundingClientRect().right <= view.right);
            // The callback runs at the microtask checkpoints inside the frame, before the measure: collect its records
            const pending = cells.map(() => [] as MutationRecord[]);
            const observers = cells.map((cell: any, n: number) => {
                const observer = new MutationObserver(records => pending[n].push(...records));
                observer.observe(cell.shadowRoot, { subtree: true, childList: true, attributes: true, characterData: true });
                return observer;
            });
            const takeRecords = (n: number) => pending[n].splice(0).concat(observers[n].takeRecords());
            const valueOf = (cell: any) => cell.value ? cell.value.getValue() : undefined;
            const values = cells.map(valueOf);
            const stats = { iconsAdded: 0, sameValueMutations: 0, changes: 0, frames: 0 };

            // 2,000 rows, 8 rows per frame
            await perf.runFrames(250, (i: number) => scroller.scrollTop = (i + 1) * 8 * g.rowHeight, () => {
                stats.frames++;
                cells.forEach((cell: any, n: number) => {
                    const records = takeRecords(n);
                    const value = valueOf(cell);
                    stats.iconsAdded += records.flatMap(r => [...r.addedNodes]).filter((e: any) => e.tagName === 'VI-ICON').length;
                    if (value !== values[n])
                        stats.changes++;
                    else if (records.length)
                        stats.sameValueMutations++;

                    values[n] = value;
                });
            });

            observers.forEach((o: MutationObserver) => o.disconnect());
            const iconsPerCell = [...new Set(cells.map((c: any) => c.shadowRoot.querySelectorAll('vi-icon').length))];
            return { ...stats, cells: cells.length, inView, iconsPerCell, topIndex: perf.topRowIndex(g) };
        });

        expect(result.inView, 'IsActive cells in view').toBe(true);
        expect(result.topIndex).toBe(2000);
        expect(result.changes).toBeGreaterThan(0);
        expect(result.iconsAdded, 'icons added').toBe(0);
        expect(result.iconsPerCell).toEqual([1]);
        expect(result.sameValueMutations, 'cell mutations while the value stayed the same').toBe(0);

        await recordPerf(page, testInfo, 'perf.rc-boolean-icon-reuse', { counts: { iconsAdded: result.iconsAdded, sameValueMutations: result.sameValueMutations, valueChanges: result.changes, cells: result.cells } });
    });

    test('recycling without type hints causes no host attribute churn', perfCase('cells.def-perf-no-host-churn'), async ({ page }, testInfo) => {
        await perfPage(page, { width: 1600 });
        const grid = await mountGrid(page);
        await parkMouse(page);

        await grid.evaluate((g: any) => {
            const w = window as any;
            const records = w.__hostRecords = [] as string[];
            const observer = new MutationObserver(list => list.forEach(r => records.push(`${(r.target as any).column?.name}@${r.attributeName}: ${r.oldValue} -> ${(r.target as Element).getAttribute(r.attributeName!)}`)));
            w.__perf.rows(g).forEach((r: any) => r.querySelectorAll('.column').forEach((c: any) => observer.observe(c, { attributes: true, attributeOldValue: true, attributeFilter: ['style', 'class', 'tag', 'sensitive'] })));
        });

        for (let step = 1; step <= 10; step++) {
            await scrollToRow(grid, step * 37);
            await waitFilled(grid);
        }

        const records: string[] = await page.evaluate(() => (window as any).__hostRecords);
        expect(records, 'cell host attribute mutations').toEqual([]);

        await recordPerf(page, testInfo, 'cells.def-perf-no-host-churn', { counts: { hostAttributeMutations: records.length } });
    });

    test('cost of re-formatting a full window', perfCase('perf.fmt-window-refill-cost', { timing: true }), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountGrid(page);
        await parkMouse(page);
        await preload(grid, 1500, 1600);
        await setCpuThrottle(page, 4);

        const runs: { ms: number; cells: number }[] = [];
        for (let i = 0; i < 10; i++) {
            const row = i % 2 === 0 ? 1500 : 0;
            runs.push(await grid.evaluate(async (g: any, row) => {
                const perf = (window as any).__perf;
                const scroller = perf.scroller(g).scroller;
                const start = performance.now();
                scroller.scrollTop = row * g.rowHeight;
                const { time } = await perf.whenFrame(() => perf.topRowIndex(g) === row && perf.firstColumnMatches(g, 'FirstName') && perf.coverage(g).blank === 0);
                const cells = perf.visibleRows(g).reduce((n: number, { r }: any) => n + r.querySelectorAll('.column').length, 0);
                return { ms: time - start, cells };
            }, row));
        }
        await setCpuThrottle(page, 1);

        const ms = runs.map(r => round(r.ms));
        const perCell = runs.map(r => round(r.ms / r.cells, 3));
        expect.soft(median(ms), 'median window refill at 4x').toBeLessThanOrEqual(500);

        await recordPerf(page, testInfo, 'perf.fmt-window-refill-cost', { cpuThrottle: 4, timings: { refillMs: ms, msPerCell: perCell }, repetitions: 10 });
    });

    test('CommonMark cells parse markdown once per value', perfCase('perf.fmt-commonmark-scroll'), async ({ page }, testInfo) => {
        const grid = await mountDataTypes(page, 'CommonMark');
        await scrollToRow(grid, 0);
        await waitFilled(grid);

        // Row 1 renders its markdown as markup
        const bold = await grid.evaluate((g: any) => {
            const perf = (window as any).__perf;
            const first = perf.visibleRows(g)[0].r;
            return first.querySelector('vi-query-grid-cell-common-mark').shadowRoot.querySelector('strong')?.textContent ?? null;
        });
        expect(bold).toBe('bold');

        const result = await scrollTypedCells(grid, 'vi-query-grid-cell-common-mark', 60);
        const frames = frameStats(result.deltas);

        expect(result.itemChanges).toBeGreaterThan(result.cells);
        expect(result.contentWithoutItemChange, 'content replaced without an item change').toBe(0);
        expect(result.contentPerChangeMax, 'content replacements per item change').toBeLessThanOrEqual(1);

        await recordPerf(page, testInfo, 'perf.fmt-commonmark-scroll', { counts: { itemChanges: result.itemChanges, contentRecords: result.contentRecords, contentWithoutItemChange: result.contentWithoutItemChange }, frames });
    });

    test('image cells update once per value and keep one image element', perfCase('perf.fmt-image-scroll'), async ({ page }, testInfo) => {
        const grid = await mountDataTypes(page, 'Image');
        const result = await scrollTypedCells(grid, 'vi-query-grid-cell-image', 60);
        await waitFilled(grid);

        // Every visible image cell: a value shows a data-URI background, null hides the image
        const shown = await grid.evaluate((g: any) => {
            const perf = (window as any).__perf;
            return perf.visibleRows(g).map(({ r }: any) => {
                const cell = r.querySelector('vi-query-grid-cell-image');
                const image = cell.shadowRoot.querySelector('.image');
                const hasValue = !!cell.value?.value;
                const visible = !!image && image.checkVisibility() && /^url\("data:image\//.test(image.style.backgroundImage);
                return hasValue === visible ? null : `row ${r.item.getValue('Id')}: value ${hasValue}, shown ${visible}`;
            }).filter((s: string | null) => s);
        });

        expect(result.itemChanges).toBeGreaterThan(result.cells);
        expect(result.maxImagesPerCell, 'image elements per cell').toBeLessThanOrEqual(1);
        expect(result.imageRemoves, 'image elements removed').toBe(0);
        expect(result.imageAdds, 'image elements added (at most once per cell)').toBeLessThanOrEqual(result.cells);
        expect(result.styleWithoutItemChange, 'style writes without an item change').toBe(0);
        expect(result.stylePerChangeMax, 'style writes per item change').toBeLessThanOrEqual(1);
        expect(shown).toEqual([]);

        await recordPerf(page, testInfo, 'perf.fmt-image-scroll', { counts: { itemChanges: result.itemChanges, imageAdds: result.imageAdds, styleRecords: result.styleRecords }, frames: frameStats(result.deltas) });
    });

    test('hovering rows without hover hints writes no cell styles', perfCase('perf.fmt-hover-no-style-writes', { timing: true }), async ({ page }, testInfo) => {
        await perfPage(page, { styles: ':root { --color-semi-faint: rgb(1, 2, 3); }' });
        const grid = await mountGrid(page);
        await parkMouse(page);

        const rows = await grid.evaluate((g: any) => {
            const w = window as any;
            const perf = w.__perf;
            const records = w.__cellStyles = [] as string[];
            const observer = new MutationObserver(list => list.forEach(r => records.push(`${(r.target as any).column?.name}: ${(r.target as Element).getAttribute('style')}`)));
            perf.rows(g).forEach((r: any) => r.querySelectorAll('.column').forEach((c: any) => observer.observe(c, { attributes: true, attributeFilter: ['style'] })));
            w.__hoverStart = performance.now();
            return perf.visibleRows(g).slice(0, 20).map(({ b }: any) => ({ x: b.left + 400, y: b.top + b.height / 2 }));
        });
        expect(rows).toHaveLength(20);

        for (const row of rows)
            await page.mouse.move(row.x, row.y, { steps: 2 });

        await nextFrames(page, 2);
        const result = await grid.evaluate((g: any) => {
            const w = window as any;
            const perf = w.__perf;
            const hovered = perf.rows(g).find((r: any) => r.matches(':hover'));
            const cell = hovered?.querySelector('.column');
            return { records: w.__cellStyles, background: cell ? getComputedStyle(cell).backgroundColor : null, blocking: perf.tbt(w.__hoverStart, performance.now()) };
        });
        await parkMouse(page);

        expect(result.records, 'cell style mutations').toEqual([]);
        expect(result.background, 'hovered row background').toBe('rgb(1, 2, 3)');
        expect.soft(result.blocking.longest, 'no task over 50ms').toBeLessThanOrEqual(50);

        await recordPerf(page, testInfo, 'perf.fmt-hover-no-style-writes', { counts: { cellStyleMutations: result.records.length }, timings: { longestTask: [round(result.blocking.longest)] } });
    });
});
