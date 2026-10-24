import { test, expect, Locator, Page } from '@playwright/test';
import { gridPage, mountGrid, columnTracks, getScrollOffset, headerNames, nextFrames, pageErrors, requestLog, scrollGrid, waitForGridReady, waitForQueryIdle } from '../_helpers/query-grid';
import { clickGroupingMenuItem, columnTokens, consoleErrors, controlsBox, headerBoxes, holdExecuteQuery, hostVar, initializingAdds, initializingEvents, rowAt, rows, settle, valuesOf, watchInitializing } from '../_helpers/grid';

const RH = 32;
const PEOPLE_COLUMNS = ['FirstName', 'LastName', 'BirthDate', 'Gender', 'ContactPreference', 'Email', 'PhoneNumber', 'EmergencyContact', 'IsActive'];

async function spinnerVisible(grid: Locator) {
    return grid.evaluate((g: any) => {
        const spinner = [...g.shadowRoot.querySelectorAll('vi-spinner')].find((s: Element) => !s.closest('vi-popup, vi-query-grid-row, header')) as HTMLElement;
        return !!spinner && spinner.checkVisibility();
    });
}

/** Assigns a new query (by name, FirstName ASC when it has that column) to the grid in window.grid. */
async function swapQuery(page: Page, name: string, options?: Record<string, any>) {
    await page.evaluate(async ({ name, options }) => {
        const w = window as any;
        const q = await w.service.getQuery(name, options);
        if (q.columns.some((c: any) => c.name === 'FirstName') && q.sortOptions.map((o: any) => `${o.name} ${o.direction}`).join(';') !== 'FirstName ASC') {
            q.sortOptions = [{ name: 'FirstName', direction: 'ASC' }];
            await q.search();
        }

        w.grid.query = q;
        w.q = q;
    }, { name, options });
}

/** Every visible item row shows its own item at its own position, with the item's FirstName. */
async function expectRowsAtTheirIndex(grid: Locator, step: string) {
    const visible = (await rows(grid)).filter(r => !r.loading);
    const names = await valuesOf(grid, visible.map(r => r.index), 'FirstName');
    visible.forEach((r, i) => {
        expect(r.index, `${step}: row at ${r.position}`).toBeGreaterThanOrEqual(0);
        expect(Math.abs(r.offset - r.index * RH), `${step}: row ${r.index} offset`).toBeLessThanOrEqual(1);
        expect(r.cells[0].text, `${step}: row ${r.index} FirstName`).toBe(names[i]);
    });
}

/** Scrolls the grid body to a top offset and waits for the rows there. */
async function scrolledTo(grid: Locator, top: number) {
    await scrollGrid(grid, { top });
    await expect.poll(async () => (await getScrollOffset(grid)).top).toBe(top);
    await settle(grid);
}

test.describe('Query swap, detach, busy and errors', () => {
    test('swapping the query re-initializes and re-renders', { annotation: [{ type: 'case', description: 'grid.lc-query-swap' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        for (const i of [0, 1, 2])
            await rowAt(grid, i).locator('[part~="selector"]').click();
        await expect.poll(async () => (await rows(grid)).filter(r => r.selected).map(r => r.index)).toEqual([0, 1, 2]);

        await watchInitializing(grid);
        const columns = await page.evaluate(async () => {
            const w = window as any;
            const top10 = await w.service.getQuery('PeopleTop10');
            w.grid.query = top10;
            w.q = top10;
            return top10.columns.filter((c: any) => !c.isHidden && c.width !== '0').map((c: any) => c.name);
        });

        await expect.poll(() => initializingAdds(page)).toBeGreaterThan(0);
        await waitForGridReady(grid);
        await settle(grid);

        const visible = await rows(grid);
        expect(visible.map(r => r.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
        expect(visible.some(r => r.selected)).toBe(false);
        expect(await headerNames(grid)).toEqual(columns);

        const tracks = await columnTracks(grid);
        const headers = await headerBoxes(grid);
        headers.forEach((h, i) => expect(h.labelScrollWidth, `${h.name} label`).toBeLessThanOrEqual(h.labelClientWidth));
        for (const row of visible) {
            row.cells.forEach((cell, k) => {
                expect(cell.textScrollWidth, `row ${row.index} ${cell.name} truncated`).toBeLessThanOrEqual(cell.textClientWidth);
                expect(Math.abs(cell.width - tracks[k]), `row ${row.index} ${cell.name} width`).toBeLessThanOrEqual(1);
                expect(Math.abs(cell.x - headers[k].x), `row ${row.index} ${cell.name} aligned`).toBeLessThanOrEqual(1);
            });
        }
    });

    test('a query assigned after connection initializes normally', { annotation: [{ type: 'case', description: 'grid.lc-query-after-attach' }] }, async ({ page }) => {
        await gridPage(page);
        await page.evaluate(async () => {
            const w = window as any;
            w.grid = document.createElement('vi-query-grid');
            document.getElementById('test-container')!.appendChild(w.grid);
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        });
        const grid = page.locator('#test-container > vi-query-grid');
        await expect(grid).toHaveAttribute('initializing');

        await swapQuery(page, 'People');
        await waitForGridReady(grid);
        await settle(grid);

        await expect(grid).not.toHaveAttribute('initializing');
        expect(await headerNames(grid)).toEqual(PEOPLE_COLUMNS);
        (await columnTokens(grid)).slice(0, 9).forEach(t => expect(t).toMatch(/^\d+px$/));

        const first = (await rows(grid))[0];
        expect(first.index).toBe(0);
        expect(first.cells[0].text).toBe((await valuesOf(grid, [0], 'FirstName'))[0]);
        await expectRowsAtTheirIndex(grid, 'after attach');

        // Same end state as a grid that got its query before it was attached
        const late = await columnTracks(grid);
        await grid.evaluate((g: any) => g.remove());
        const early = await mountGrid(page);
        const tracks = await columnTracks(early);
        expect(tracks).toHaveLength(late.length);
        tracks.forEach((t, i) => expect(Math.abs(t - late[i]), PEOPLE_COLUMNS[i]).toBeLessThanOrEqual(1));
    });

    test('query swap emits initializing-changed true then false', { annotation: [{ type: 'case', description: 'grid.lc-query-swap-events' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await watchInitializing(grid);

        await swapQuery(page, 'PeopleTop10');
        await waitForGridReady(grid);

        expect((await initializingEvents(page)).map(e => e.value)).toEqual([true, false]);
    });

    test('query swap resets the vertical and horizontal scroll', { annotation: [{ type: 'case', description: 'grid.lc-query-swap-scrolltop' }] }, async ({ page }) => {
        await gridPage(page, { width: 600, height: 600 });
        const grid = await mountGrid(page);

        await scrollGrid(grid, { top: 3000, left: 200 });
        await expect.poll(() => getScrollOffset(grid)).toMatchObject({ top: 3000, left: 200 });
        await settle(grid);

        await swapQuery(page, 'People');
        await waitForGridReady(grid);
        await settle(grid);

        expect(await getScrollOffset(grid)).toMatchObject({ top: 0, left: 0 });
        expect((await rows(grid))[0].index).toBe(0);
        await expectRowsAtTheirIndex(grid, 'after swap');
    });

    test('query null then a new query initializes cleanly', { annotation: [{ type: 'case', description: 'gap.grid-query-null-then-new-query' }] }, async ({ page }) => {
        const errors = pageErrors(page);
        const consoleErrorList = consoleErrors(page);
        await gridPage(page);
        const grid = await mountGrid(page);

        const thrown = await grid.evaluate((g: any) => {
            try {
                g.query = null;
                return null;
            }
            catch (e) {
                return String(e);
            }
        });
        expect(thrown).toBeNull();
        await expect(grid).toHaveAttribute('initializing');
        await expect(grid.locator('header')).toBeHidden();
        expect(await spinnerVisible(grid)).toBe(false);
        expect(await grid.evaluate((g: any) => [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].filter((r: any) => r.checkVisibility() && r.getBoundingClientRect().height > 0).length)).toBe(0);

        await swapQuery(page, 'PeopleTop10');
        await waitForGridReady(grid);
        await settle(grid);

        await expect(grid).not.toHaveAttribute('initializing');
        (await columnTokens(grid)).slice(0, -1).forEach(t => expect(t).toMatch(/^\d+px$/));
        expect(await headerNames(grid)).toHaveLength(9);
        expect((await rows(grid)).map(r => r.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
        expect((await getScrollOffset(grid)).top).toBe(0);
        expect(errors).toEqual([]);
        expect(consoleErrorList).toEqual([]);
    });

    test('a swapped grid measures like a fresh one', { annotation: [{ type: 'case', description: 'gap.grid-swap-same-columns-cell-widths' }] }, async ({ page }) => {
        await gridPage(page, { width: 2500, height: 600 });
        const empty = { textSearch: 'zzzzqqq' };

        // Grid A: People, then swapped to an empty PeopleTop10 with the same columns
        const gridA = await mountGrid(page);
        await swapQuery(page, 'PeopleTop10', empty);
        expect(await page.evaluate(() => (window as any).q.totalItems)).toBe(0);
        await waitForGridReady(gridA);
        const swapped = { tokens: await columnTokens(gridA), noData: await hostVar(gridA, '--vi-query-grid-columns-no-data') };
        await gridA.evaluate((g: any) => g.remove());

        // Grid B: a fresh grid on the same empty query
        const gridB = await mountGrid(page, { query: 'PeopleTop10', queryOptions: empty });
        const fresh = { tokens: await columnTokens(gridB), noData: await hostVar(gridB, '--vi-query-grid-columns-no-data') };

        expect(swapped.noData).toBe(fresh.noData);
        expect(swapped.tokens).toHaveLength(fresh.tokens.length);
        fresh.tokens.forEach((t, i) => {
            if (/px$/.test(t))
                expect(Math.abs(parseFloat(swapped.tokens[i]) - parseFloat(t)), `track ${i}`).toBeLessThanOrEqual(1);
            else
                expect(swapped.tokens[i]).toBe(t);
        });
    });

    test('detach and re-attach keeps the grid working', { annotation: [{ type: 'case', description: 'grid.lc-reattach' }] }, async ({ page }) => {
        const errors = pageErrors(page);
        await gridPage(page, { styles: '#other { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; } #other > vi-query-grid { flex: 1 1 auto; min-height: 0; }' });
        await mountGrid(page);
        let grid = page.locator('#test-container > vi-query-grid');

        for (const target of ['same', 'other'] as const) {
            await page.evaluate(target => {
                const w = window as any;
                const container = document.getElementById('test-container')!;
                w.grid.remove();
                if (target === 'same')
                    container.appendChild(w.grid);
                else {
                    const other = document.createElement('div');
                    other.id = 'other';
                    container.appendChild(other);
                    other.appendChild(w.grid);
                }
            }, target);
            grid = page.locator(target === 'same' ? '#test-container > vi-query-grid' : '#other > vi-query-grid');
            await waitForGridReady(grid);

            await scrolledTo(grid, 2000);
            await expectRowsAtTheirIndex(grid, `${target} container`);
            await scrolledTo(grid, 0);
        }

        const controlsWidth = async () => parseFloat(await hostVar(grid, '--vi-query-grid-controls-width'));
        const before = await controlsWidth();
        await grid.evaluate(async (g: any) => { await g.query.group('Gender'); });
        await settle(grid);
        await expect.poll(controlsWidth).toBeGreaterThan(before);
        expect(Math.abs(await controlsWidth() - (await controlsBox(grid)).width)).toBeLessThanOrEqual(1);

        await clickGroupingMenuItem(grid, 'Remove');
        await waitForQueryIdle(grid);
        await expect.poll(controlsWidth).toBe(before);
        expect(errors).toEqual([]);
    });

    test('a page that arrives while the grid is detached is used after re-attach', { annotation: [{ type: 'case', description: 'grid.lc-detach-page-arrives' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        // The page request is sent before the grid is removed, its response arrives while it is detached
        const release = await holdExecuteQuery(page);
        const requested = page.waitForRequest('**/ExecuteQuery');
        await scrollGrid(grid, { top: 6000 * RH });
        await requested;
        await grid.evaluate((g: any) => g.remove());

        await release();
        await expect.poll(() => page.evaluate(() => {
            const q = (window as any).q;
            const lazy = q.disableLazyLoading;
            q.disableLazyLoading = true;
            try {
                return !!q.items[6000];
            }
            finally {
                q.disableLazyLoading = lazy;
            }
        })).toBe(true);

        // Re-inserting the grid resets its scroll position, so it shows the loaded first rows
        await page.evaluate(() => document.getElementById('test-container')!.appendChild((window as any).grid));
        await settle(grid);
        expect((await getScrollOffset(grid)).top).toBe(0);
        expect((await rows(grid))[0].index).toBe(0);
        await expectRowsAtTheirIndex(grid, 're-attached');

        // Back at the page that arrived while detached, its rows show without loading it again
        const log = requestLog(page);
        await scrolledTo(grid, 6000 * RH);
        await expectRowsAtTheirIndex(grid, 'scrolled back');
        await log.quiet();
        expect(log.of('ExecuteQuery')).toHaveLength(0);
    });

    test('a removed grid sends no pending page load', { annotation: [{ type: 'case', description: 'grid.lc-detach-pending-load' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        const log = requestLog(page);

        // Scroll far, let the grid queue the page load (the scroll event and the row update run before the next frame), then remove it
        await grid.evaluate((g: any, top) => new Promise<void>(resolve => {
            const scroller = ([...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any).scroller as HTMLElement;
            scroller.scrollTop = top;
            requestAnimationFrame(() => {
                g.remove();
                resolve();
            });
        }), 6000 * RH);

        await page.waitForTimeout(500);
        expect(log.of('ExecuteQuery').map(r => r.skip)).toEqual([]);
    });

    test('a grid re-attached before its new query renders still initializes', { annotation: [{ type: 'case', description: 'grid.lc-reattach-before-render' }] }, async ({ page }) => {
        const errors = pageErrors(page);
        await gridPage(page);
        const grid = await mountGrid(page);

        // Swap the query, then detach and re-attach before the frame that renders the new rows
        await page.evaluate(async () => {
            const w = window as any;
            const q = await w.service.getQuery('PeopleTop10');
            w.grid.query = q;
            w.q = q;

            const parent = w.grid.parentElement;
            w.grid.remove();
            parent.appendChild(w.grid);
        });

        await waitForGridReady(grid);
        await expectRowsAtTheirIndex(grid, 're-attached');
        expect(errors).toEqual([]);
    });

    test('a grid removed while its query searches loads nothing and shows the new result when re-attached', { annotation: [{ type: 'case', description: 'grid.lc-detach-search' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await scrollGrid(grid, { top: 6000 * RH });
        await settle(grid);
        await grid.evaluate((g: any) => g.remove());

        const log = requestLog(page);
        await page.evaluate(async () => {
            const q = (window as any).q;
            q.textSearch = 'a';
            await q.search();
        });

        await page.waitForTimeout(500);
        expect(log.of('ExecuteQuery').map(r => r.skip ?? 0)).toEqual([0]);

        // Re-attached, the grid shows the new result from the top
        await page.evaluate(() => document.getElementById('test-container')!.appendChild((window as any).grid));
        await expect.poll(async () => (await getScrollOffset(grid)).top).toBe(0);
        await settle(grid);
        const totalItems = await page.evaluate(() => (window as any).q.totalItems);
        expect(totalItems).toBeLessThan(10000);
        expect((await getScrollOffset(grid)).scrollHeight).toBe(totalItems * RH);
        expect((await rows(grid))[0].index).toBe(0);
        await expectRowsAtTheirIndex(grid, 're-attached');
    });

    test('a full scenario produces no errors', { annotation: [{ type: 'case', description: 'grid.lc-no-console-errors' }] }, async ({ page }) => {
        const errors = pageErrors(page);
        const consoleErrorList = consoleErrors(page);
        await gridPage(page);
        const grid = await mountGrid(page);

        await scrolledTo(grid, 5000 * RH);
        await grid.evaluate(async (g: any) => { await g.query.group('Gender'); });
        await settle(grid);
        await clickGroupingMenuItem(grid, 'Remove');
        await waitForQueryIdle(grid);
        await settle(grid);
        await grid.evaluate((g: any) => g.remove());
        await nextFrames(page, 2);

        expect(errors).toEqual([]);
        expect(consoleErrorList).toEqual([]);
    });

    test('the grid is empty while a search runs, scrolled or not', { annotation: [{ type: 'case', description: 'gap.grid-search-in-flight-empty' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        for (const start of [0, 500 * RH]) {
            const step = `from scrollTop ${start}`;
            await page.unroute('**/ExecuteQuery');
            await grid.evaluate(async (g: any) => {
                g.query.textSearch = '';
                await g.query.search();
            });
            await scrolledTo(grid, start);
            await page.route('**/ExecuteQuery', async route => {
                await new Promise(resolve => setTimeout(resolve, 2000));
                await route.continue();
            });

            await page.evaluate(() => {
                const w = window as any;
                w.q.textSearch = 'Aaron';
                w.__search = w.q.search();
            });
            await expect.poll(() => spinnerVisible(grid), step).toBe(true);
            await expect.poll(async () => (await getScrollOffset(grid)).top, { message: step, timeout: 1000 }).toBe(0);
            await nextFrames(page, 2);

            // Also when the grid was at the top already, where the visible rows don't move
            expect(await grid.evaluate((g: any) => g.query.isBusy), step).toBe(true);
            for (const r of await rows(grid))
                expect(r.cells.map(c => c.text).join(''), `${step}: row at ${r.offset}`).toBe('');

            await page.evaluate(() => (window as any).__search);
            await expect.poll(() => spinnerVisible(grid), step).toBe(false);
            await settle(grid);
            expect((await rows(grid))[0].index, step).toBe(0);
            await expectRowsAtTheirIndex(grid, step);
            expect((await valuesOf(grid, [0], 'FirstName'))[0], step).toMatch(/aaron/i);
        }
    });

    test('a failed search keeps the grid usable', { annotation: [{ type: 'case', description: 'gap.grid-search-error-keeps-grid-usable' }] }, async ({ page }) => {
        const errors = pageErrors(page);
        await gridPage(page);
        const grid = await mountGrid(page);

        await page.route('**/ExecuteQuery', route => route.fulfill({ contentType: 'application/json', json: { exception: 'pw: search failed' } }), { times: 1 });
        await page.evaluate(async () => {
            const w = window as any;
            w.q.textSearch = 'Aaron';
            try {
                await w.q.search();
            }
            catch {
                // The failure is reported through the query notification
            }
        });

        await expect.poll(() => grid.evaluate((g: any) => g.query.notification)).toBe('pw: search failed');
        expect(await grid.evaluate((g: any) => String(g.query.notificationType))).toMatch(/error/i);
        await expect.poll(() => spinnerVisible(grid)).toBe(false);
        expect(errors).toEqual([]);

        // A later search shows its result
        await grid.evaluate(async (g: any) => { await g.query.search(); });
        await settle(grid);
        expect((await rows(grid))[0].index).toBe(0);
        await expectRowsAtTheirIndex(grid, 'after retry');
        expect(errors).toEqual([]);
    });

    test('a failed lazy page leaves placeholders and retries on revisit', { annotation: [{ type: 'case', description: 'gap.grid-lazy-page-error' }] }, async ({ page }) => {
        const errors = pageErrors(page);
        await gridPage(page);
        const grid = await mountGrid(page);
        const log = requestLog(page);

        await page.route('**/ExecuteQuery', route => route.abort(), { times: 1 });
        await scrollGrid(grid, { top: 5000 * RH });
        await expect.poll(() => log.of('ExecuteQuery').length).toBe(1);
        await waitForQueryIdle(grid);
        await nextFrames(page, 2);

        const failedSkip = log.of('ExecuteQuery')[0].skip!;
        expect(failedSkip).toBeGreaterThanOrEqual(4900);
        expect(failedSkip).toBeLessThanOrEqual(5000);
        const visible = await rows(grid);
        expect(visible.length).toBeGreaterThan(0);
        expect(visible.every(r => r.loading)).toBe(true);
        expect(await grid.evaluate((g: any) => !!g.query.notification)).toBe(true);
        expect(errors).toEqual([]);

        await scrolledTo(grid, 0);
        log.clear();
        await scrolledTo(grid, 5000 * RH);
        expect(log.of('ExecuteQuery').some(r => r.skip === failedSkip)).toBe(true);
        await expectRowsAtTheirIndex(grid, 'after revisit');
        expect(errors).toEqual([]);
    });

    test('a lazy page with a different totalItems resets the grid', { annotation: [{ type: 'case', description: 'gap.grid-lazy-page-totalitems-changed' }] }, async ({ page }) => {
        const errors = pageErrors(page);
        await gridPage(page);
        const grid = await mountGrid(page);

        // Every lazy page reports the new total, as a server whose data changed would
        await page.route('**/ExecuteQuery', async route => {
            const response = await route.fetch();
            const json = await response.json();
            const result = json.result ?? json.query?.result;
            if (result?.totalItems === 10000)
                result.totalItems = 9990;

            await route.fulfill({ response, json });
        });

        await scrollGrid(grid, { top: 5000 * RH });
        await expect.poll(() => grid.evaluate((g: any) => g.query.totalItems)).toBe(9990);
        await expect.poll(async () => (await getScrollOffset(grid)).scrollHeight).toBe(9990 * RH);
        await settle(grid);

        await expectRowsAtTheirIndex(grid, 'after the total changed');
        expect((await rows(grid)).every(r => !r.loading)).toBe(true);
        expect(errors).toEqual([]);
    });
});
