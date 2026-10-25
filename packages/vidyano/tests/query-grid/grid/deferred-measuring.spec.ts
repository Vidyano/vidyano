import { test, expect, Page } from '@playwright/test';
import { gridPage, waitForGridReady, nextFrames } from '../_helpers/query-grid';
import { attachGrid } from '../_helpers/grid';

const HEIGHT = 900;

/** Opens the grid page at `width` and attaches a QueryGrid_Wide grid once the fonts are loaded. */
async function attachWide(page: Page, width: number, options: { userSettings?: Record<string, any> } = {}) {
    await gridPage(page, { width, height: HEIGHT });
    await page.evaluate(() => document.fonts.ready);
    return (await attachGrid(page, { query: 'QueryGrid_Wide', sortByFirstName: false, userSettings: options.userSettings })).grid;
}

/** The applied width of every column. */
async function widths(page: Page) {
    return page.evaluate(() => ({ ...(window as any).grid.columnWidths }));
}

/** Records, in window.__shown, the number of columns the rows render when [initializing] is removed. */
async function recordShown(page: Page) {
    await page.evaluate(() => {
        const g = (window as any).grid;
        new MutationObserver((_, observer) => {
            if (g.hasAttribute('initializing'))
                return;

            observer.disconnect();
            (window as any).__shown = { rowColumns: g._rowColumns.length, columns: g.columns.length };
        }).observe(g, { attributes: true, attributeFilter: ['initializing'] });
    });
}

test.describe('Deferred column measuring', () => {
    test('the columns outside the visible width end at the widths of measuring all columns at once', { annotation: [{ type: 'case', description: 'grid.cw-deferred-equals-full' }] }, async ({ page }) => {
        // Every column starts inside a 12000px wide grid, they are all measured before the rows show
        await attachWide(page, 12000);
        await recordShown(page);
        const fullGrid = page.locator('#test-container > vi-query-grid');
        await waitForGridReady(fullGrid);
        const full = await widths(page);
        const fullShown = await page.evaluate(() => (window as any).__shown);
        expect(fullShown.rowColumns).toBe(fullShown.columns);

        const grid = await attachWide(page, 1600);
        await recordShown(page);
        await waitForGridReady(grid);
        const shown = await page.evaluate(() => (window as any).__shown);
        expect(shown.rowColumns, 'columns rendered before the rows show').toBeLessThan(shown.columns);

        expect(await widths(page)).toEqual(full);
        await expect.poll(() => grid.evaluate((g: any) => getComputedStyle(g).getPropertyValue('--vi-query-grid-columns-no-data'))).toBe('');
    });

    test('while the other columns are measured, the visible cells line up with their headers and keep their widths', { annotation: [{ type: 'case', description: 'grid.cw-deferred-visible-stable' }] }, async ({ page }) => {
        const grid = await attachWide(page, 1600);

        const frames = await page.evaluate(() => new Promise<any[]>(resolve => {
            const g = (window as any).grid;
            const frames: any[] = [];
            const step = () => {
                const scroller = [...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any;
                const view = scroller.getBoundingClientRect();
                const rows = [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].filter((r: any) => r.item && !r.classList.contains('hidden'));
                const columns = [...g.shadowRoot.querySelectorAll('vi-query-grid-column-header')].filter((h: any) => {
                    const box = h.getBoundingClientRect();
                    return box.right > view.left && box.left < view.right;
                }).map((h: any) => {
                    const box = h.getBoundingClientRect();
                    const misaligned = rows.filter((r: any) => {
                        const cell = r.cells.find((c: any) => c.column.name === h.column.name);
                        const cellBox = cell?.getBoundingClientRect();
                        return !cellBox || Math.round(cellBox.left) !== Math.round(box.left) || Math.round(cellBox.width) !== Math.round(box.width);
                    }).length;
                    return { name: h.column.name, x: Math.round(box.left), width: Math.round(box.width), misaligned };
                });

                frames.push({ pending: g._hasUnmeasuredColumns, columns });
                if (g._hasUnmeasuredColumns || frames.length < 3)
                    requestAnimationFrame(step);
                else
                    resolve(frames);
            };

            new MutationObserver((_, observer) => {
                if (g.hasAttribute('initializing'))
                    return;

                observer.disconnect();
                requestAnimationFrame(step);
            }).observe(g, { attributes: true, attributeFilter: ['initializing'] });
        }));

        await waitForGridReady(grid);
        expect(frames.filter(f => f.pending).length, 'frames while columns are measured').toBeGreaterThan(1);
        for (const frame of frames)
            expect(frame.columns).toEqual(frames[0].columns.map((c: any) => ({ ...c, misaligned: 0 })));
    });

    test('a column with a saved width keeps that width and is not measured', { annotation: [{ type: 'case', description: 'grid.cw-deferred-saved-width' }] }, async ({ page }) => {
        const grid = await attachWide(page, 1600, { userSettings: { Int08: { width: '123px' }, Id: { isPinned: true } } });
        await waitForGridReady(grid);

        const result = await grid.evaluate((g: any) => ({ int08: g.columnWidths.Int08, pinned: g.columns.filter((c: any) => c.isPinned).map((c: any) => c.name), measuring: g.shadowRoot.querySelectorAll('[measuring], [unmeasured]').length }));
        expect(result).toEqual({ int08: 123, pinned: ['Id'], measuring: 0 });
    });

    test('scrolling to the far right right after the rows show only shows measured columns that do not move', { annotation: [{ type: 'case', description: 'grid.cw-deferred-scroll-to-end' }] }, async ({ page }) => {
        const grid = await attachWide(page, 1600);
        await recordShown(page);

        // The first frame of rows scrolls to the end of the grid's scroll width at that moment
        const frames = await page.evaluate(() => new Promise<any[]>(resolve => {
            const g = (window as any).grid;
            const visible = () => {
                const scroller = [...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any;
                const view = scroller.getBoundingClientRect();
                const row = [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].find((r: any) => r.item && !r.classList.contains('hidden')) as any;
                return [...g.shadowRoot.querySelectorAll('vi-query-grid-column-header')].map((h: any) => {
                    const box = h.getBoundingClientRect();
                    const cell = row.cells.find((c: any) => c.column.name === h.column.name);
                    const cellBox = cell && getComputedStyle(cell).display !== 'none' ? cell.getBoundingClientRect() : null;
                    return { name: h.column.name, index: g.columns.indexOf(h.column), pinned: h.column.isPinned, x: Math.round(box.left), width: Math.round(box.width), cellX: cellBox && Math.round(cellBox.left), cellWidth: cellBox && Math.round(cellBox.width), visible: box.right > view.left && box.left < view.right };
                }).filter(c => c.visible);
            };

            new MutationObserver((_, observer) => {
                if (g.hasAttribute('initializing'))
                    return;

                observer.disconnect();
                const scroller = ([...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any).scroller;
                scroller.scrollLeft = scroller.scrollWidth;

                const frames: any[] = [];
                const step = () => {
                    frames.push(visible());
                    if (frames.length < 20)
                        requestAnimationFrame(step);
                    else
                        resolve(frames);
                };
                requestAnimationFrame(() => requestAnimationFrame(step));
            }).observe(g, { attributes: true, attributeFilter: ['initializing'] });
        }));

        await waitForGridReady(grid);
        const final = await grid.evaluate((g: any) => g.columnWidths);

        expect(frames[0].length).toBeGreaterThan(0);
        // The columns in view were not rendered when the rows first showed
        const shown = await page.evaluate(() => (window as any).__shown);
        expect(frames[0].every((c: any) => final[c.name] !== undefined)).toBe(true);
        expect(Math.min(...frames[0].filter((c: any) => !c.pinned).map((c: any) => c.index)), 'first visible column').toBeGreaterThanOrEqual(shown.rowColumns);
        for (const frame of frames) {
            expect(frame, 'visible columns per frame').toEqual(frames[0]);
            for (const column of frame) {
                expect(column.width, `${column.name} width`).toBe(final[column.name]);
                expect(column.cellX, `${column.name} cell left`).toBe(column.x);
                expect(column.cellWidth, `${column.name} cell width`).toBe(column.width);
            }
        }
    });

    test('a grid removed before its columns are measured does no measuring until it is attached again', { annotation: [{ type: 'case', description: 'grid.cw-deferred-disconnect' }] }, async ({ page }) => {
        const grid = await attachWide(page, 1600);

        const removed = await page.evaluate(() => new Promise<any>(resolve => {
            const w = window as any;
            const g = w.grid;
            const proto = Object.getPrototypeOf(g);
            const measure = proto._measureNextColumns;
            w.__measures = 0;
            proto._measureNextColumns = function (...args: any[]) {
                w.__measures++;
                return measure.apply(this, args);
            };

            new MutationObserver((_, observer) => {
                if (g.hasAttribute('initializing'))
                    return;

                observer.disconnect();
                g.remove();
                resolve({ rowColumns: g._rowColumns.length, columns: g.columns.length, cells: g.shadowRoot.querySelectorAll('vi-query-grid-row > .column').length });
            }).observe(g, { attributes: true, attributeFilter: ['initializing'] });
        }));

        expect(removed.rowColumns).toBeLessThan(removed.columns);
        await page.waitForTimeout(1000);
        await nextFrames(page, 2);

        const detached = await page.evaluate(() => {
            const g = (window as any).grid;
            return { measures: (window as any).__measures, rowColumns: g._rowColumns.length, cells: g.shadowRoot.querySelectorAll('vi-query-grid-row > .column').length };
        });
        expect(detached).toEqual({ measures: 0, rowColumns: removed.rowColumns, cells: removed.cells });

        await page.evaluate(() => document.getElementById('test-container')!.appendChild((window as any).grid));
        await waitForGridReady(grid);
        expect(await grid.evaluate((g: any) => g._rowColumns.length)).toBe(removed.columns);
    });
});
