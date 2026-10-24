import { test, expect, Page } from '@playwright/test';
import { gridPage, mountGrid, waitForGridReady, headerNames, columnTracks, nextFrames, pageErrors, requestLog, getScrollOffset, recordTransitions, stopRecording } from '../_helpers/query-grid';
import { attachGrid, columnTokens, consoleErrors, headerBoxes, holdExecuteQuery, hostVar, initializingAdds, initializingEvents, rows, settle, watchInitializing, wheelGrid } from '../_helpers/grid';

const PEOPLE_COLUMNS = ['FirstName', 'LastName', 'BirthDate', 'Gender', 'ContactPreference', 'Email', 'PhoneNumber', 'EmergencyContact', 'IsActive'];
const FILLER = 'minmax(0, 1fr)';

/** Attaches a People grid to a display:none container (#box) that the test shows later. */
async function mountInHiddenBox(page: Page) {
    await gridPage(page, { styles: '#box { flex: 1 1 auto; min-height: 0; flex-direction: column; } #box > vi-query-grid { flex: 1 1 auto; min-height: 0; }' });
    await page.evaluate(() => {
        const box = document.createElement('div');
        box.id = 'box';
        box.style.display = 'none';
        document.getElementById('test-container')!.appendChild(box);
    });

    const { grid } = await attachGrid(page, { container: '#box' });
    return grid;
}

test.describe('Initialization and column measuring', () => {
    test('grid without a query stays initializing and attaches cleanly', { annotation: [{ type: 'case', description: 'grid.lc-initializing-default' }] }, async ({ page }) => {
        const errors = pageErrors(page);
        const consoleErrorsLog = consoleErrors(page);
        await gridPage(page);

        for (const how of ['createElement', 'constructor']) {
            const state = await page.evaluate(async how => {
                const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
                const grid = (how === 'createElement' ? document.createElement('vi-query-grid') : new (customElements.get('vi-query-grid') as any)()) as any;
                document.getElementById('test-container')!.appendChild(grid);
                await frame();

                const header = grid.shadowRoot.querySelector('header');
                const scroller = [...grid.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as HTMLElement;
                const result = {
                    attribute: grid.hasAttribute('initializing'),
                    property: grid.initializing,
                    header: getComputedStyle(header).visibility,
                    scroller: getComputedStyle(scroller).visibility
                };

                // Without a query nothing can be measured: still initializing after two more frames
                await frame();
                await frame();
                const later = {
                    attribute: grid.hasAttribute('initializing'),
                    header: getComputedStyle(header).visibility,
                    scroller: getComputedStyle(scroller).visibility
                };

                grid.remove();
                await frame();

                return { ...result, later };
            }, how);

            expect(state, how).toEqual({ attribute: true, property: true, header: 'hidden', scroller: 'hidden', later: { attribute: true, header: 'hidden', scroller: 'hidden' } });
        }

        expect(errors).toEqual([]);
        expect(consoleErrorsLog).toEqual([]);
    });

    test('initializing clears once columns are measured', { annotation: [{ type: 'case', description: 'grid.lc-initializing-cleared' }] }, async ({ page }) => {
        await gridPage(page, { width: 1000, height: 600 });
        const grid = await mountGrid(page, { wait: false });

        await expect(grid).not.toHaveAttribute('initializing', { timeout: 5000 });

        const visibility = await grid.evaluate((g: any) => {
            const scroller = [...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as HTMLElement;
            return [getComputedStyle(g.shadowRoot.querySelector('header')).visibility, getComputedStyle(scroller).visibility];
        });
        expect(visibility).toEqual(['visible', 'visible']);

        const tokens = await columnTokens(grid);
        expect(tokens.at(-1)).toBe(FILLER);
        expect(tokens.slice(0, -1).every(t => /^\d+px$/.test(t))).toBe(true);
    });

    test('initializing-changed(false) fires once, after the measured widths are applied', { annotation: [{ type: 'case', description: 'grid.lc-initializing-changed-event' }] }, async ({ page }) => {
        await gridPage(page);
        const { grid } = await attachGrid(page, { record: true });
        await waitForGridReady(grid);

        const falseEvents = (await initializingEvents(page)).filter(e => e.value === false);
        expect(falseEvents).toHaveLength(1);
        expect(falseEvents[0].columns).toMatch(/^(\d+px\s+)+minmax\(0(px)?,\s*1fr\)$/);

        await expect(grid).not.toHaveAttribute('initializing');
        await expect.poll(() => grid.evaluate((g: any) => getComputedStyle(g.shadowRoot.querySelector('header')).visibility)).toBe('visible');
    });

    test('--vi-query-grid-columns holds one px track per visible column plus a filler', { annotation: [{ type: 'case', description: 'grid.cw-format' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        const tokens = await columnTokens(grid);
        expect(tokens).toHaveLength(10);
        tokens.slice(0, 9).forEach(t => expect(t).toMatch(/^\d+px$/));
        expect(tokens[9]).toBe(FILLER);
        expect(await headerNames(grid)).toEqual(PEOPLE_COLUMNS);
    });

    test('headers render at their track widths and cells align with headers', { annotation: [{ type: 'case', description: 'grid.cw-cells-align-header' }] }, async ({ page }) => {
        await gridPage(page, { width: 2500, height: 600 });
        const grid = await mountGrid(page);

        const tracks = await columnTracks(grid);
        const headers = await headerBoxes(grid);
        expect(headers).toHaveLength(tracks.length);
        headers.forEach((h, i) => {
            expect(Math.abs(h.width - tracks[i]), `${h.name} width`).toBeLessThanOrEqual(1);
            if (i > 0)
                expect(Math.abs(h.x - headers[i - 1].right), `${h.name} contiguous`).toBeLessThanOrEqual(1);
        });

        const visible = await rows(grid);
        expect(visible.length).toBeGreaterThan(0);
        for (const row of visible) {
            expect(row.cells).toHaveLength(headers.length);
            row.cells.forEach((cell, k) => {
                expect(Math.abs(cell.x - headers[k].x), `row ${row.index} cell ${k} left`).toBeLessThanOrEqual(1);
                expect(Math.abs(cell.width - headers[k].width), `row ${row.index} cell ${k} width`).toBeLessThanOrEqual(1);
            });
        }
    });

    test('measured widths fit header labels and initially rendered cells', { annotation: [{ type: 'case', description: 'grid.cw-no-truncation-initial-rows' }] }, async ({ page }) => {
        await gridPage(page, { width: 2500, height: 600 });
        const grid = await mountGrid(page);

        const tracks = await columnTracks(grid);
        const headers = await headerBoxes(grid);
        headers.forEach((h, i) => {
            expect(tracks[i], `${h.name} track fits label`).toBeGreaterThanOrEqual(Math.ceil(h.labelScrollWidth));
            expect(h.labelScrollWidth, `${h.name} label overflow`).toBeLessThanOrEqual(h.labelClientWidth);
        });

        const rendered = (await rows(grid, { all: true })).filter(r => r.height > 0 && r.index >= 0);
        expect(rendered.length).toBeGreaterThan(10);
        for (const row of rendered) {
            row.cells.forEach((cell, k) => {
                expect(tracks[k], `row ${row.index} ${cell.name} fits`).toBeGreaterThanOrEqual(Math.ceil(cell.scrollWidth) - 1);
                expect(cell.scrollWidth, `row ${row.index} ${cell.name} overflow`).toBeLessThanOrEqual(cell.clientWidth);
                expect(cell.textScrollWidth, `row ${row.index} ${cell.name} text overflow`).toBeLessThanOrEqual(cell.textClientWidth);
                expect(Math.abs(cell.width - tracks[k]), `row ${row.index} ${cell.name} width`).toBeLessThanOrEqual(1);
            });
        }
    });

    test('--vi-query-grid-columns-no-data is cleared once data cells are measured', { annotation: [{ type: 'case', description: 'grid.cw-no-data-removed' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        expect(await hostVar(grid, '--vi-query-grid-columns-no-data')).toBe('');
        const templates = await grid.evaluate((g: any) => [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].map((r: any) => getComputedStyle(r).gridTemplateColumns));
        expect(templates.length).toBeGreaterThan(0);
        templates.forEach(t => expect(t).not.toContain('max-content'));
    });

    test('a stored or model column width drives the track', { annotation: [{ type: 'case', description: 'grid.cw-user-width-initial' }] }, async ({ page }) => {
        await gridPage(page, { width: 2500, height: 600 });

        // Baseline: content sized widths of the other columns
        const baseline = await mountGrid(page);
        const baseTracks = await columnTracks(baseline);
        await baseline.evaluate((g: any) => g.remove());

        for (const variant of [{ width: 200, options: { userSettings: { FirstName: { width: '200px' } } } }, { width: 250, options: { userSettings: {}, columnWidths: { FirstName: '250px' } } }]) {
            const { grid, initialColumns } = await attachGrid(page, variant.options);
            expect(initialColumns.startsWith(`${variant.width}px max-content`), initialColumns).toBe(true);

            await waitForGridReady(grid);
            const tracks = await columnTracks(grid);
            expect(tracks[0]).toBe(variant.width);
            tracks.slice(1).forEach((t, i) => expect(Math.abs(t - baseTracks[i + 1]), PEOPLE_COLUMNS[i + 1]).toBeLessThanOrEqual(1));

            const headers = await headerBoxes(grid);
            expect(Math.abs(headers[0].width - variant.width)).toBeLessThanOrEqual(1);
            for (const row of await rows(grid))
                expect(Math.abs(row.cells[0].width - variant.width)).toBeLessThanOrEqual(1);

            await grid.evaluate((g: any) => g.remove());
        }
    });

    test('widths are not re-measured by sort, search or scroll', { annotation: [{ type: 'case', description: 'grid.cw-stable-after-sort' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await watchInitializing(grid);
        const before = await hostVar(grid, '--vi-query-grid-columns');

        const check = async (step: string) => {
            await settle(grid);
            expect(await hostVar(grid, '--vi-query-grid-columns'), step).toBe(before);

            const tracks = await columnTracks(grid);
            const headers = await headerBoxes(grid);
            for (const row of await rows(grid)) {
                row.cells.forEach((cell, k) => {
                    expect(Math.abs(cell.width - tracks[k]), `${step}: row ${row.index} ${cell.name} width`).toBeLessThanOrEqual(1);
                    expect(Math.abs(cell.x - headers[k].x), `${step}: row ${row.index} ${cell.name} left`).toBeLessThanOrEqual(1);
                    // Wider text is cut off with an ellipsis instead of growing the column
                    if (cell.textScrollWidth > cell.textClientWidth)
                        expect(cell.textOverflow, `${step}: row ${row.index} ${cell.name}`).toBe('ellipsis');
                });
            }
        };

        await grid.locator('vi-query-grid-column-header[name="LastName"] .label').click();
        await expect.poll(() => grid.evaluate((g: any) => g.query.sortOptions.map((o: any) => `${o.name} ${o.direction}`).join(';'))).toBe('LastName ASC');
        await check('sort');

        await grid.evaluate(async (g: any) => {
            g.query.textSearch = 'an';
            await g.query.search();
        });
        await check('search');

        await wheelGrid(grid, 0, 300 * 32);
        await expect.poll(async () => (await getScrollOffset(grid)).top).toBeGreaterThan(0);
        await check('scroll');

        expect(await initializingAdds(page)).toBe(0);
    });

    test('a zero-row query initializes from header widths', { annotation: [{ type: 'case', description: 'grid.lc-empty-query' }] }, async ({ page }) => {
        await gridPage(page);
        await page.evaluate(async () => {
            const w = window as any;
            w.q = await w.service.getQuery('People');
            w.q.textSearch = 'zzzzqqq';
            await w.q.search();
        });

        const log = requestLog(page);
        const { grid } = await attachGrid(page, { reuseQuery: true });
        await expect(grid).not.toHaveAttribute('initializing');
        await nextFrames(page, 2);

        const tokens = await columnTokens(grid);
        expect(tokens).toHaveLength(10);
        tokens.slice(0, 9).forEach(t => expect(t).toMatch(/^\d+px$/));
        expect(tokens[9]).toBe(FILLER);

        const tracks = await columnTracks(grid);
        (await headerBoxes(grid)).forEach((h, i) => {
            expect(h.labelScrollWidth, `${h.name} label`).toBeLessThanOrEqual(h.labelClientWidth);
            expect(tracks[i]).toBeGreaterThanOrEqual(Math.ceil(h.labelScrollWidth));
        });

        expect(await columnTokens(grid, '--vi-query-grid-columns-no-data')).toEqual(Array(9).fill('max-content'));
        // The row pool is still rendered, but every row and cell is hidden
        expect(await rows(grid)).toEqual([]);
        expect(await grid.evaluate((g: any) => [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].filter((r: any) => r.checkVisibility()).length)).toBe(0);
        expect(await grid.evaluate((g: any) => [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].flatMap((r: any) => [...r.querySelectorAll('.column'), ...(r.shadowRoot?.querySelectorAll('.column') ?? [])]).filter((c: any) => c.checkVisibility()).length)).toBe(0);

        const offset = await getScrollOffset(grid);
        expect(offset.scrollHeight).toBeLessThanOrEqual(offset.height);

        await log.quiet();
        expect(log.of('ExecuteQuery')).toHaveLength(0);
    });

    test('a grid mounted in a display:none container initializes when shown', { annotation: [{ type: 'case', description: 'grid.lc-hidden-container-then-shown' }] }, async ({ page }) => {
        const errors = pageErrors(page);
        const grid = await mountInHiddenBox(page);

        // Nothing should happen while the container is hidden: give the grid a second to (not) finish
        await page.waitForTimeout(1000);
        await expect(grid).toHaveAttribute('initializing');
        expect(errors).toEqual([]);

        await page.evaluate(() => document.getElementById('box')!.style.display = 'flex');
        await expect(grid).not.toHaveAttribute('initializing', { timeout: 3000 });
        await settle(grid);

        const tracks = await columnTracks(grid);
        const headers = await headerBoxes(grid);
        headers.forEach((h, i) => {
            expect(tracks[i], `${h.name} track fits label`).toBeGreaterThanOrEqual(Math.ceil(h.labelScrollWidth));
            expect(h.labelScrollWidth, `${h.name} label overflow`).toBeLessThanOrEqual(h.labelClientWidth);
        });

        const visible = await rows(grid);
        visible[0].cells.forEach((cell, k) => expect(Math.abs(cell.x - headers[k].x), `${cell.name} aligned`).toBeLessThanOrEqual(1));

        const { height } = await getScrollOffset(grid);
        const expected = Array.from({ length: Math.ceil(height / 32) }, (_, i) => i);
        expect(visible.map(r => r.position)).toEqual(expected);
        expect(visible.map(r => r.index)).toEqual(expected);
        expect(errors).toEqual([]);
    });

    test('header, body and rows stay hidden during the measuring pass', { annotation: [{ type: 'case', description: 'grid.lc-hidden-until-measured' }] }, async ({ page }) => {
        await gridPage(page);
        await recordTransitions(page);
        const { grid } = await attachGrid(page);
        await waitForGridReady(grid);
        await nextFrames(page, 2);

        const frames = await stopRecording(page);
        const measuring = frames.filter(f => f.initializing);
        expect(measuring.length).toBeGreaterThan(0);
        measuring.forEach((f, i) => {
            expect(f.header, `frame ${i} header`).toBe('hidden');
            expect(f.body, `frame ${i} body`).toBe('hidden');
            expect(f.rowsInitializing, `frame ${i} rows`).toBe(f.rows);
        });

        const done = frames.filter(f => !f.initializing);
        expect(done.length).toBeGreaterThan(0);
        expect(done.at(-1).header).toBe('visible');
        expect(done.at(-1).body).toBe('visible');
        expect(await grid.evaluate((g: any) => [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].filter((r: any) => r.hasAttribute('initializing')).length)).toBe(0);
    });

    test('measuring starts from a max-content template', { annotation: [{ type: 'case', description: 'grid.cw-initial-template' }] }, async ({ page }) => {
        await gridPage(page);
        await recordTransitions(page);
        const { grid, initialColumns } = await attachGrid(page);
        await waitForGridReady(grid);

        const values = [initialColumns, ...(await stopRecording(page)).map(f => f.columns)];
        const firstPx = values.findIndex(v => /^(\d+px\s+)+minmax\(0(px)?,\s*1fr\)$/.test(v));
        expect(firstPx).toBeGreaterThan(0);

        const before = values.slice(0, firstPx).filter(v => v);
        expect(before.length).toBeGreaterThan(0);
        before.forEach(v => expect(v.split(/\s+/)).toEqual(Array(9).fill('max-content')));
    });

    test('external initializing=false before measurement is ignored', { annotation: [{ type: 'case', description: 'grid.initializing-external-write-ignored' }] }, async ({ page }) => {
        await gridPage(page);
        const state = await page.evaluate(async () => {
            const w = window as any;
            const q = await w.service.getQuery('People');
            q.sortOptions = [{ name: 'FirstName', direction: 'ASC' }];
            await q.search();

            const grid = document.createElement('vi-query-grid') as any;
            grid.query = q;
            document.getElementById('test-container')!.appendChild(grid);
            w.grid = grid;
            w.q = q;

            w.__initLog = [];
            new MutationObserver(() => w.__initLog.push({
                initializing: grid.hasAttribute('initializing'),
                columns: getComputedStyle(grid).getPropertyValue('--vi-query-grid-columns').trim()
            })).observe(grid, { attributes: true, attributeFilter: ['initializing'] });

            // Right after attaching, before any width was measured
            try {
                grid.initializing = false;
            }
            catch {
                // A read-only property may throw on assignment
            }

            const header = grid.shadowRoot.querySelector('header');
            return { attribute: grid.hasAttribute('initializing'), header: getComputedStyle(header).visibility };
        });
        expect(state).toEqual({ attribute: true, header: 'hidden' });

        const grid = page.locator('#test-container > vi-query-grid');

        await waitForGridReady(grid);
        const log = await page.evaluate(() => (window as any).__initLog);
        const removals = log.filter((e: any) => !e.initializing);
        expect(removals).toHaveLength(1);
        expect(removals[0].columns).toMatch(/^(\d+px\s+)+minmax\(0(px)?,\s*1fr\)$/);
        expect(log.filter((e: any) => e.initializing)).toHaveLength(0);
    });

    test('grid shown during a pending empty search initializes from header widths after it', { annotation: [{ type: 'case', description: 'grid.lc-empty-busy-first-display' }] }, async ({ page }) => {
        await gridPage(page);
        await page.evaluate(async () => {
            const w = window as any;
            w.q = await w.service.getQuery('People');
        });

        const release = await holdExecuteQuery(page);

        await page.evaluate(() => {
            const w = window as any;
            w.q.textSearch = 'zzzzqqq';
            w.__search = w.q.search();
        });

        const { grid } = await attachGrid(page, { reuseQuery: true });
        // The headers report their widths while the search is still held
        await expect.poll(() => grid.evaluate((g: any) => g.columns?.length > 0 && g.columns.every((c: any) => g._columnWidths.get(c.name)?.column >= 0))).toBe(true);
        expect(await grid.evaluate((g: any) => g.query.isBusy)).toBe(true);
        await expect(grid).toHaveAttribute('initializing');

        await release();
        await page.evaluate(async () => { await (window as any).__search; });
        await expect(grid).not.toHaveAttribute('initializing');
        await nextFrames(page, 2);

        // Same result as a grid attached to an already empty query: the tracks come from the header widths
        const tokens = await columnTokens(grid);
        expect(tokens).toHaveLength(10);
        tokens.slice(0, 9).forEach(t => expect(t).toMatch(/^\d+px$/));
        expect(tokens[9]).toBe(FILLER);

        const tracks = await columnTracks(grid);
        (await headerBoxes(grid)).forEach((h, i) => {
            expect(h.labelScrollWidth, `${h.name} label`).toBeLessThanOrEqual(h.labelClientWidth);
            expect(tracks[i]).toBeGreaterThanOrEqual(Math.ceil(h.labelScrollWidth));
        });
        expect(await rows(grid)).toEqual([]);
    });

    test('an empty result followed by rows switches to measured widths', { annotation: [{ type: 'case', description: 'grid.lc-empty-then-data' }] }, async ({ page }) => {
        await gridPage(page);
        const { grid } = await attachGrid(page, { textSearch: 'zzzzqqq' });
        await expect(grid).not.toHaveAttribute('initializing');
        await nextFrames(page, 2);
        expect(await rows(grid)).toEqual([]);

        await grid.evaluate(async (g: any) => {
            g.query.textSearch = '';
            await g.query.search();
        });
        await waitForGridReady(grid);
        await settle(grid);

        await expect.poll(() => hostVar(grid, '--vi-query-grid-columns-no-data')).toBe('');
        const tokens = await columnTokens(grid);
        expect(tokens).toHaveLength(10);
        tokens.slice(0, 9).forEach(t => expect(t).toMatch(/^\d+px$/));
        expect(tokens[9]).toBe(FILLER);

        const visible = await rows(grid);
        expect(visible.length).toBeGreaterThan(0);
        expect(visible[0].index).toBe(0);
        const headers = await headerBoxes(grid);
        visible[0].cells.forEach((cell, k) => {
            expect(Math.abs(cell.x - headers[k].x), `${cell.name} left`).toBeLessThanOrEqual(1);
            expect(Math.abs(cell.width - headers[k].width), `${cell.name} width`).toBeLessThanOrEqual(1);
        });
    });

    test('a failing first search still ends initializing', { annotation: [{ type: 'case', description: 'gap.grid-initial-search-error' }] }, async ({ page }) => {
        const errors = pageErrors(page);
        await gridPage(page);
        await page.evaluate(async () => {
            const w = window as any;
            w.q = await w.service.getQuery('People');
        });

        await page.route('**/ExecuteQuery', async route => {
            await new Promise(resolve => setTimeout(resolve, 500));
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ exception: 'Search failed (test)' }) });
        });

        await page.evaluate(() => {
            const w = window as any;
            w.q.textSearch = 'zzzzqqq';
            w.__search = w.q.search().then(() => 'resolved', () => 'rejected');
        });

        const { grid } = await attachGrid(page, { reuseQuery: true });
        expect(await grid.evaluate((g: any) => g.query.isBusy)).toBe(true);

        // search() does not throw by default: the error ends up as the query notification
        await page.evaluate(() => (window as any).__search);
        expect(await grid.evaluate((g: any) => g.query.notification)).toContain('Search failed (test)');

        await expect(grid).not.toHaveAttribute('initializing');
        await expect.poll(() => grid.evaluate((g: any) => g.query.isBusy)).toBe(false);
        await expect.poll(() => grid.evaluate((g: any) => [...g.shadowRoot.children].filter((e: Element) => e.tagName === 'VI-SPINNER').some((s: any) => s.checkVisibility()))).toBe(false);
        await nextFrames(page, 2);

        expect(await rows(grid)).toEqual([]);
        const tokens = await columnTokens(grid);
        expect(tokens).toHaveLength(10);
        tokens.slice(0, 9).forEach(t => expect(t).toMatch(/^\d+px$/));
        expect(errors).toEqual([]);
    });

    test('a zero-height grid waits and initializes once it gets height', { annotation: [{ type: 'case', description: 'gap.grid-zero-height-viewport' }] }, async ({ page }) => {
        await gridPage(page, { styles: '#box { flex: 0 0 auto; height: 0; display: flex; flex-direction: column; } #box > vi-query-grid { flex: 1 1 auto; min-height: 0; }' });
        await page.evaluate(() => {
            const box = document.createElement('div');
            box.id = 'box';
            document.getElementById('test-container')!.appendChild(box);
        });

        const log = requestLog(page);
        const { grid } = await attachGrid(page, { container: '#box' });

        await page.waitForTimeout(1000);
        await expect(grid).toHaveAttribute('initializing');
        expect(await grid.evaluate((g: any) => g.shadowRoot.querySelectorAll('vi-query-grid-row').length)).toBe(0);
        expect(log.of('ExecuteQuery')).toHaveLength(0);

        await page.evaluate(() => document.getElementById('box')!.style.height = '400px');
        await waitForGridReady(grid);
        await settle(grid);

        const visible = await rows(grid);
        expect(visible.length).toBeGreaterThan(0);
        expect(visible[0].index).toBe(0);

        const tracks = await columnTracks(grid);
        expect(tracks).toHaveLength(9);
        (await headerBoxes(grid)).forEach((h, i) => expect(tracks[i], `${h.name} fits label`).toBeGreaterThanOrEqual(Math.ceil(h.labelScrollWidth)));
        for (const row of visible) {
            row.cells.forEach((cell, k) => expect(cell.scrollWidth, `row ${row.index} ${cell.name} overflow`).toBeLessThanOrEqual(cell.clientWidth));
        }

        await log.quiet();
        expect(log.of('ExecuteQuery')).toHaveLength(0);
    });
});
