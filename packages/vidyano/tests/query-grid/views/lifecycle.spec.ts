import { test, expect } from '@playwright/test';
import { BASE, nextFrames, openView, pageErrors, waitForGridReady } from '../_helpers/query-grid';
import { activeGrid, clickQueryHeader, consoleErrors, groupBy, groupingMenuItem, openColumnMenu, openPopups, settle, VIEW_MATRIX, wheelGrid } from '../_helpers/views';

test.describe('Lifecycle and isolation', () => {
    for (const view of VIEW_MATRIX) {
        test(`${view.name} header and body stay hidden while initializing`, { annotation: [{ type: 'case', description: 'views.all-initializing-hidden' }] }, async ({ page }) => {
            // Samples the grid in every animation frame from the first script on
            await page.addInitScript(() => {
                const w = window as any;
                w.__pwFrames = [];
                let grid: any = null;
                const find = (root: ParentNode): any => {
                    for (const e of root.querySelectorAll('*')) {
                        if (e.tagName === 'VI-QUERY-GRID')
                            return e;

                        const found = e.shadowRoot && find(e.shadowRoot);
                        if (found)
                            return found;
                    }

                    return null;
                };
                const sample = () => {
                    grid ??= find(document);
                    if (grid?.shadowRoot) {
                        const header = grid.shadowRoot.querySelector('header');
                        const scroller = [...grid.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup'));
                        if (header && scroller)
                            w.__pwFrames.push({ initializing: grid.hasAttribute('initializing'), header: getComputedStyle(header).visibility, body: getComputedStyle(scroller).visibility });
                    }

                    if (!w.__pwStop)
                        requestAnimationFrame(sample);
                };
                requestAnimationFrame(sample);
            });

            const grid = await openView(page, view.path);
            // Keep sampling while the grid is idle
            await nextFrames(page, 10);
            const frames: { initializing: boolean; header: string; body: string }[] = await page.evaluate(() => {
                const w = window as any;
                w.__pwStop = true;
                return w.__pwFrames;
            });

            expect(frames.length).toBeGreaterThan(0);
            expect(frames[0].initializing).toBe(true);
            expect(frames.filter(f => f.initializing && (f.header !== 'hidden' || f.body !== 'hidden'))).toEqual([]);

            const cleared = frames.findIndex(f => !f.initializing);
            expect(cleared).toBeGreaterThan(0);
            expect(frames.slice(cleared).filter(f => f.initializing || f.header !== 'visible' || f.body !== 'visible')).toEqual([]);
            await expect(grid).not.toHaveAttribute('initializing');
        });

        test(`${view.name} standard interaction script produces no page or console errors`, { annotation: [{ type: 'case', description: 'gap.views-all-no-page-errors' }] }, async ({ page }) => {
            const errors = pageErrors(page);
            const consoleLog = consoleErrors(page);
            const grid = await openView(page, view.path);

            await grid.locator('vi-query-grid-column-header[name=LastName] .label').click();
            await expect.poll(() => grid.evaluate((g: any) => g.query.sortOptions.map((o: any) => `${o.name} ${o.direction}`).join(';'))).toBe('LastName ASC');
            await waitForGridReady(grid);

            await groupBy(grid, 'Gender', 'Gender');
            await groupingMenuItem(grid, 'Collapse all');
            await expect.poll(() => grid.evaluate((g: any) => g.query.groupingInfo.groups.every((x: any) => x.isCollapsed))).toBe(true);
            await groupingMenuItem(grid, 'Expand all');
            await expect.poll(() => grid.evaluate((g: any) => g.query.groupingInfo.groups.some((x: any) => x.isCollapsed))).toBe(false);
            await groupingMenuItem(grid, 'Remove grouping');
            await expect(grid).not.toHaveAttribute('has-grouping');
            await waitForGridReady(grid);

            await wheelGrid(page, grid, 0, 400000);
            await settle(grid);
            await wheelGrid(page, grid, 300, 0);
            await settle(grid);

            await openColumnMenu(grid, 'Gender');
            await expect.poll(() => openPopups(grid)).not.toEqual([]);
            await page.keyboard.press('Escape');
            await expect.poll(() => openPopups(grid)).toEqual([]);

            if (view.canFilter) {
                await grid.locator('vi-query-grid-column-header[name=Gender] vi-query-grid-column-filter').click();
                await expect.poll(() => openPopups(grid)).not.toEqual([]);
                await clickQueryHeader(page);
                await expect.poll(() => openPopups(grid)).toEqual([]);
            }

            const away = view.name === 'QueryGrid_None' ? 'home/people' : 'components/query-grid_none';
            await page.evaluate(path => (document.querySelector('vi-app') as any).changePath(path), away);
            await expect(page).toHaveURL(`${BASE}/${away}`);
            await expect.poll(() => activeGrid(page).evaluate((g: any) => g.query?.name)).toBe(view.name === 'QueryGrid_None' ? 'People' : 'QueryGrid_None');
            await waitForGridReady(activeGrid(page));

            expect(errors).toEqual([]);
            expect(consoleLog).toEqual([]);
        });
    }
});
