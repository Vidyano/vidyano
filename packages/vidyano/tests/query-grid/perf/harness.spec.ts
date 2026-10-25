import { getScrollOffset, mountGrid, requestLog, savedSettings, visibleRows } from '../_helpers/query-grid';
import { datasetOf, expect, openFilter, perfCase, perfPage, PERF_SCHEMA_KEYS, readPerfResult, recordPerf, test } from '../_helpers/perf';

test.describe('Harness', () => {
    test('every perf test writes a metrics JSON', perfCase('perf.perf-harness-results-json'), async ({ page }, testInfo) => {
        const id = 'perf.perf-harness-results-json';
        await perfPage(page);
        const grid = await mountGrid(page);

        const written = await recordPerf(page, testInfo, id, { dataset: await datasetOf(grid), counts: { rowElements: await grid.evaluate((g: any) => g.shadowRoot.querySelectorAll('vi-query-grid-row').length) } });
        const file = readPerfResult(id);

        expect(Object.keys(file).sort()).toEqual(PERF_SCHEMA_KEYS);
        expect(file.testId).toBe(id);
        expect(file.gitSha).toMatch(/^([0-9a-f]{40}|unknown)$/);
        expect(file.chromeVersion).toBeTruthy();
        expect(file.cpuThrottle).toBe(1);
        expect(file.viewport).toEqual({ w: 1280, h: 720 });
        expect(file.dataset).toEqual({ query: 'People', totalItems: 10000, visibleColumns: 9, pageSize: 100, rowHeight: 32 });
        expect(file.counts.rowElements).toBe(written.counts.rowElements);

        const attachment = testInfo.attachments.find(a => a.name === `perf-${id}`);
        expect(attachment?.contentType).toBe('application/json');
        expect(JSON.parse(attachment!.body!.toString())).toEqual(file);
    });

    test('grid test page gives the grid a real flex layout', perfCase('perf.perf-harness-grid-page-layout'), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountGrid(page);

        const layout = await grid.evaluate((g: any) => {
            const style = getComputedStyle(g);
            const header = g.shadowRoot.querySelector('header').getBoundingClientRect();
            return { display: style.display, padding: style.padding, host: g.getBoundingClientRect().height, header: header.height, rowHeight: g.rowHeight };
        });
        const scroll = await getScrollOffset(grid);
        const rows = await visibleRows(grid);

        expect(layout.display).toBe('flex');
        expect(layout.padding).toBe('0px');
        expect(scroll.height).toBeGreaterThan(0);
        expect(Math.abs(scroll.height - (layout.host - layout.header))).toBeLessThanOrEqual(1);
        expect(rows.length).toBeGreaterThanOrEqual(Math.ceil(scroll.height / layout.rowHeight));

        await recordPerf(page, testInfo, 'perf.perf-harness-grid-page-layout', { dataset: await datasetOf(grid), counts: { visibleRows: rows.length, scrollerHeight: scroll.height, headerHeight: layout.header } });
    });

    test('perf scenarios never write shared server state', perfCase('perf.perf-harness-no-shared-writes'), async ({ page }, testInfo) => {
        // The perf `test` fixture fails any perf test whose page sends a Save/Delete/Reorder ExecuteAction; this
        // test runs the riskiest interactions (sort, filter toggle, selection, grouping) and checks the log itself.
        await perfPage(page);
        const grid = await mountGrid(page);
        const log = requestLog(page);

        await grid.locator('vi-query-grid-column-header[name="LastName"] .label').click();
        await log.quiet();

        await openFilter(grid, 'FirstName');
        const item = grid.locator('vi-query-grid-column-header[name="FirstName"] vi-query-grid-column-filter .item').first();
        await item.click();
        await log.quiet();
        await page.keyboard.press('Escape');

        await grid.locator('vi-query-grid-select-all').click();
        await grid.evaluate(async (g: any) => { await g.query.group('Gender'); });
        await log.quiet();
        await grid.evaluate(async (g: any) => { await g.query.group(''); });
        await log.quiet();

        const actions = log.of('ExecuteAction').map(r => r.action);
        expect(actions.filter(a => !['QueryFilter.RefreshColumn', 'Query.New'].includes(a!))).toEqual([]);
        expect(actions.filter(a => a === 'Query.New').length).toBeLessThanOrEqual(1);

        // The settings save is the in-page stub: it recorded the sort instead of reaching the backend
        const stubbed = await page.evaluate(() => Array.isArray((window as any).__saves) && !/fetch|postJSON/.test(String((window as any).service.application.saveUserSettings)));
        expect(stubbed).toBe(true);
        const saves = (await savedSettings(page)).length;
        expect(saves).toBeGreaterThanOrEqual(1);

        await recordPerf(page, testInfo, 'perf.perf-harness-no-shared-writes', { counts: { saveUserSettings: saves, executeActions: actions.length }, requests: { actions } });
    });
});
