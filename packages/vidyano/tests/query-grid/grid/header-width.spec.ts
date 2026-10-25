import { test, expect, Locator } from '@playwright/test';
import { openApp, openView, VIEWS, waitForGridReady } from '../_helpers/query-grid';

const WIDE = 'components/query-grid_wide';

// The headers report their width before Open Sans replaces the narrower fallback font
const FONTS_DELAY = 3000;

/** The headers whose label does not fit, with the label's full and shown width. */
async function truncatedLabels(grid: Locator, visibleOnly: boolean) {
    return grid.evaluate((g: any, visibleOnly: boolean) => {
        const scroller = [...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as HTMLElement;
        const view = scroller.getBoundingClientRect();
        return [...g.shadowRoot.querySelectorAll('header vi-query-grid-column-header')].filter((h: any) => {
            const box = h.getBoundingClientRect();
            return !visibleOnly || (box.right > view.left && box.left < view.right);
        }).map((h: any) => {
            const label = h.shadowRoot.querySelector('.label label') as HTMLElement;
            return { name: h.column.name, scrollWidth: label.scrollWidth, clientWidth: label.clientWidth };
        }).filter(l => l.scrollWidth > l.clientWidth);
    }, visibleOnly);
}

test.describe('Initial column widths', () => {
    for (const [key, name, path] of [['wide', 'the wide view', WIDE], ['people', 'People', VIEWS.People]]) {
        test(`every visible column fits its header label on ${name}`, { annotation: [{ type: 'case', description: `grid.cw-header-label-fits-${key}` }] }, async ({ page }) => {
            const grid = await openView(page, path, { width: 1600, height: 900, fontsDelay: FONTS_DELAY });

            await expect.poll(() => truncatedLabels(grid, true)).toEqual([]);
        });
    }

    test('the columns measured after the rows show fit their header labels once scrolled to', { annotation: [{ type: 'case', description: 'grid.cw-header-label-fits-deferred' }] }, async ({ page }) => {
        const grid = await openView(page, WIDE, { width: 1600, height: 900, fontsDelay: FONTS_DELAY });
        await expect.poll(() => grid.evaluate((g: any) => g._hasUnmeasuredColumns)).toBe(false);

        const total = await grid.evaluate((g: any) => Object.values<number>(g.columnWidths).reduce((sum, w) => sum + w, 0));
        for (let offset = 0; offset <= total; offset += 1200) {
            await grid.evaluate((g: any, offset: number) => g.horizontalScrollOffset = offset, offset);
            await expect.poll(() => truncatedLabels(grid, true)).toEqual([]);
        }

        expect(await truncatedLabels(grid, false)).toEqual([]);
    });

    test('a grid removed while the fonts load measures its columns when it is attached again', { annotation: [{ type: 'case', description: 'grid.cw-header-label-fits-reattached' }] }, async ({ page }) => {
        await page.addInitScript(() => customElements.whenDefined('vi-query-grid').then((QueryGrid: any) => {
            const apply = QueryGrid.prototype._applyColumnWidthsAfterFonts;
            QueryGrid.prototype._applyColumnWidthsAfterFonts = function(this: any) {
                // Every header and cell reported its width, the grid is removed before the fonts load and attached again after
                if (!(window as any).__removed && this.initializing && document.fonts.status === 'loading') {
                    (window as any).__removed = true;
                    const parent = this.parentNode, next = this.nextSibling;
                    this.remove();
                    document.fonts.ready.then(() => setTimeout(() => parent.insertBefore(this, next)));
                }

                return apply.call(this);
            };
        }));

        await openApp(page, WIDE, { width: 1600, height: 900, fontsDelay: FONTS_DELAY });
        await expect.poll(() => page.evaluate(() => (window as any).__removed), { timeout: 30000 }).toBe(true);

        const grid = page.locator('vi-query-grid').first();
        await waitForGridReady(grid, 30000);
        await expect.poll(() => truncatedLabels(grid, true)).toEqual([]);
    });
});
