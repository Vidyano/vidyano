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
