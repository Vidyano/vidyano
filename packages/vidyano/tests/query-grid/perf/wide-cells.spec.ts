import { Locator, Page } from '@playwright/test';
import { checkFrameBudget, droppedFrames, expect, frameStats, mountPrefetched, parkMouse, perfCase, perfPage, recordPerf, setCpuThrottle, test, waitFilled } from '../_helpers/perf';

const TYPED_CELLS = 'vi-query-grid-cell-common-mark, vi-query-grid-cell-image, vi-query-grid-cell-boolean';

/** Mounts QueryGrid_Wide with its first 2,000 rows loaded, scrolled fully right so the Markdown, Image and boolean cells are in view. */
async function mountWideRight(page: Page) {
    await perfPage(page);
    const { grid } = await mountPrefetched(page, 'QueryGrid_Wide', { column: 'Id' });
    await parkMouse(page);
    await grid.evaluate(async (g: any) => {
        await g.query.items.sliceAsync(0, 2000);
        const scroller = (window as any).__perf.scroller(g).scroller;
        scroller.scrollLeft = scroller.scrollWidth;
    });
    await waitFilled(grid);
    return grid;
}

/** Scrolls 1,900 rows down, 8 rows per frame. */
function fling(grid: Locator) {
    return grid.evaluate((g: any) => {
        const perf = (window as any).__perf;
        const scroller = perf.scroller(g).scroller;
        return perf.runFrames(238, (i: number) => scroller.scrollTop = (i + 1) * 8 * g.rowHeight);
    });
}

test.describe('Markdown, image and boolean cells on a wide query', () => {
    test.setTimeout(180000);

    test('markdown is parsed once per distinct value', perfCase('perf.wc-markdown-parse-once'), async ({ page }, testInfo) => {
        const grid = await mountWideRight(page);

        const inView = await grid.evaluate((g: any) => {
            const perf = (window as any).__perf;
            const view = perf.scroller(g).getBoundingClientRect();
            const cell = perf.visibleRows(g)[0].r.querySelector('vi-query-grid-cell-common-mark');
            const b = cell.getBoundingClientRect();
            return b.left >= view.left && b.right <= view.right;
        });
        expect(inView, 'Markdown01 in view').toBe(true);

        await page.evaluate(() => {
            const w = window as any;
            w.__parses = 0;
            const parse = DOMParser.prototype.parseFromString;
            DOMParser.prototype.parseFromString = function(this: DOMParser, ...args: any[]) {
                w.__parses++;
                return parse.apply(this, args as any);
            } as any;
        });
        await fling(grid);
        await waitFilled(grid);

        const result = await grid.evaluate((g: any) => {
            const perf = (window as any).__perf;
            const distinct = new Set(g.query.items.slice(0, 2000).map((i: any) => i.getValue('Markdown01'))).size;
            const wrong = perf.visibleRows(g).map(({ r }: any) => {
                const cell = r.querySelector('vi-query-grid-cell-common-mark');
                const value: string = r.item.getValue('Markdown01');
                const [, bold, italic] = /^\*\*(.+)\*\* _(.+)_$/.exec(value);
                const text = cell.shadowRoot.getElementById('text');
                return text.querySelector('strong')?.textContent === bold && text.querySelector('em')?.textContent === italic && text.textContent.trim() === `${bold} ${italic}` ? null : `${value}: ${text.innerHTML}`;
            }).filter((s: string | null) => s);

            return { distinct, parses: (window as any).__parses, wrong, topIndex: perf.topRowIndex(g) };
        });

        expect(result.topIndex).toBe(1904);
        expect(result.wrong).toEqual([]);
        expect(result.parses, `parses for ${result.distinct} distinct values`).toBeLessThanOrEqual(result.distinct);

        await recordPerf(page, testInfo, 'perf.wc-markdown-parse-once', { counts: { parses: result.parses, distinctValues: result.distinct } });
    });

    test('image and boolean cells only write what they show differently', perfCase('perf.wc-image-boolean-writes'), async ({ page }, testInfo) => {
        const grid = await mountWideRight(page);

        const result = await grid.evaluate(async (g: any) => {
            const perf = (window as any).__perf;
            const scroller = perf.scroller(g).scroller;
            // Off-screen cells are deferred and never written, so only the cells in view count
            const view = perf.scroller(g).getBoundingClientRect();
            const cells = perf.rows(g).flatMap((r: any) => [...r.querySelectorAll('vi-query-grid-cell-image, vi-query-grid-cell-boolean')]).filter((c: any) => {
                const b = c.getBoundingClientRect();
                return b.left >= view.left && b.right <= view.right;
            });
            const shown = (cell: any) => {
                const root = cell.shadowRoot;
                if (cell.tagName === 'VI-QUERY-GRID-CELL-IMAGE') {
                    const image = root.querySelector('.image');
                    return image && !image.hidden ? image.style.backgroundImage : '';
                }

                const icon = root.querySelector('vi-icon');
                return `${icon && !icon.hidden ? (icon.hasAttribute('is-selected') ? 'checked' : 'unchecked') : ''}|${root.textContent.trim()}`;
            };
            // The callback runs at the microtask checkpoints inside the frame, before the measure: collect its records
            const pending = cells.map(() => [] as MutationRecord[]);
            const observers = cells.map((cell: any, n: number) => {
                const observer = new MutationObserver(records => pending[n].push(...records));
                observer.observe(cell.shadowRoot, { subtree: true, childList: true, attributes: true, characterData: true });
                return observer;
            });
            const takeRecords = (n: number) => pending[n].splice(0).concat(observers[n].takeRecords());
            const states = cells.map(shown);
            const stats = { changes: 0, unchanged: 0, writesWithoutChange: 0, elementsRemoved: 0, nullToggles: 0 };
            const changesByType: Record<string, number> = { image: 0, boolean: 0 };
            const typeOf = (cell: any) => cell.tagName === 'VI-QUERY-GRID-CELL-IMAGE' ? 'image' : 'boolean';
            const elementCount = (cell: any) => cell.shadowRoot.querySelectorAll('vi-icon, .image').length;
            const initialElements = cells.map(elementCount);
            const added = cells.map(() => 0);
            const isElement = (node: Node) => node instanceof Element && (node.tagName === 'VI-ICON' || node.classList.contains('image'));

            await perf.runFrames(238, (i: number) => scroller.scrollTop = (i + 1) * 8 * g.rowHeight, () => {
                cells.forEach((cell: any, n: number) => {
                    const records = takeRecords(n);
                    const state = shown(cell);
                    if (state !== states[n]) {
                        stats.changes++;
                        changesByType[typeOf(cell)]++;
                        if (!state || !states[n] || state.startsWith('|') !== states[n].startsWith('|'))
                            stats.nullToggles++;
                    }
                    else {
                        stats.unchanged++;
                        if (records.length)
                            stats.writesWithoutChange++;
                    }

                    for (const r of records) {
                        added[n] += [...r.addedNodes].filter(isElement).length;
                        stats.elementsRemoved += [...r.removedNodes].filter(isElement).length;
                    }
                    states[n] = state;
                });
            });

            observers.forEach((o: MutationObserver) => o.disconnect());

            // Each cell shows its own item: an image for a value, a check state for true or false and a text for null
            const wrong = cells.map((cell: any, n: number) => {
                const value = cell.parentElement.item.getValue(cell.column.name);
                const ok = typeOf(cell) === 'image' ? (value ?/^url\("data:image\//.test(states[n]) : states[n] === '') :
                    value === true ? states[n] === 'checked|' : value === false ? states[n] === 'unchecked|' : /^\|.+/.test(states[n]);
                return ok ? null : `${cell.column.name} ${value}: ${states[n].slice(0, 40)}`;
            }).filter((s: string | null) => s);
            // An element is added only by a cell that had none yet, and a cell never holds more than one
            const extraElements = cells.filter((cell: any, n: number) => added[n] > (initialElements[n] ? 0 : 1) || elementCount(cell) > 1).length;

            return { ...stats, changesByType, wrong, extraElements, elementsAdded: added.reduce((a: number, b: number) => a + b, 0), cells: cells.length, topIndex: perf.topRowIndex(g) };
        });

        expect(result.topIndex).toBe(1904);
        expect(result.changesByType.image, 'image changes').toBeGreaterThan(0);
        expect(result.changesByType.boolean, 'boolean changes').toBeGreaterThan(0);
        expect(result.wrong).toEqual([]);
        expect(result.nullToggles, 'changes between a value and null').toBeGreaterThan(0);
        expect(result.unchanged, 'recycles that show the same image or check state').toBeGreaterThan(0);
        expect(result.writesWithoutChange, 'shadow DOM writes while the cell shows the same').toBe(0);
        expect(result.elementsRemoved, 'icon and image elements removed').toBe(0);
        expect(result.extraElements, 'cells that added a second icon or image element').toBe(0);

        await recordPerf(page, testInfo, 'perf.wc-image-boolean-writes', { counts: { cells: result.cells, changes: result.changes, unchanged: result.unchanged, nullToggles: result.nullToggles, writesWithoutChange: result.writesWithoutChange, elementsAdded: result.elementsAdded } });
    });

    test('vertical fling scrolled fully right', perfCase('perf.wc-vscroll-right', { timing: true }), async ({ page }, testInfo) => {
        const grid = await mountWideRight(page);
        await setCpuThrottle(page, 4);
        const run = await fling(grid);
        await setCpuThrottle(page, 1);
        await waitFilled(grid);

        const frames = { ...frameStats(run.deltas), ...droppedFrames(run.deltas) };
        const cells = await grid.evaluate((g: any, selector) => (window as any).__perf.visibleRows(g)[0].r.querySelectorAll(selector).length, TYPED_CELLS);
        expect(cells).toBeGreaterThan(0);
        checkFrameBudget(testInfo, 'wide vertical fling scrolled right (4x)', frames);

        await recordPerf(page, testInfo, 'perf.wc-vscroll-right', { cpuThrottle: 4, frames });
    });
});
