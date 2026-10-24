import { test, expect, Page, Locator } from '@playwright/test';
import { headerNames, openView, waitForGridReady } from '../_helpers/query-grid';
import { ALL_PARTS, box, groupBy, groupRows, hostVar, PEOPLE_COLUMNS, physicalRowCount, prefixParts, rowHeight, settle, VIEW_MATRIX, wheelGrid } from '../_helpers/views';

const NEVER = ['can-reorder', 'has-grouping', 'as-lookup', 'no-selection', 'no-inline-actions', 'has-more-rows'];

/** The first displayed data row in the body. */
function firstDataRow(grid: Locator) {
    return grid.locator('vi-query-grid-row:not([is-group])').filter({ visible: true }).first();
}

for (const view of VIEW_MATRIX) {
    test.describe(`View matrix: ${view.name}`, () => {
        test.describe.configure({ mode: 'serial' });

        let page: Page;
        let grid: Locator;

        test.beforeAll(async ({ browser }) => {
            page = await browser.newPage();
            grid = await openView(page, view.path);
        });

        test.afterAll(async () => {
            await page?.close();
        });

        test(`${view.name} reflects the expected feature flags`, { annotation: [{ type: 'case', description: 'views.matrix-flags' }] }, async () => {
            // QueryGrid_InlineActions has [can-select]: its One action in the action bar needs exactly one selected row
            for (const [attribute, expected] of [['can-select', view.canSelect], ['can-filter', view.canFilter], ['inline-actions', view.inlineActions]] as const) {
                if (expected)
                    await expect(grid, attribute).toHaveAttribute(attribute, '');
                else
                    await expect(grid, attribute).not.toHaveAttribute(attribute);
            }

            for (const attribute of NEVER)
                await expect(grid, attribute).not.toHaveAttribute(attribute);

            await expect(grid.locator('vi-query-grid-row[is-group]').filter({ visible: true })).toHaveCount(0);
        });

        test(`${view.name} shows its title and action bar`, { annotation: [{ type: 'case', description: 'views.matrix-action-bar' }] }, async () => {
            const query = page.locator('vi-query').filter({ visible: true }).first();
            await expect(query.locator('header').first()).toHaveText(view.title);

            const actionBar = query.locator('vi-action-bar');
            if (view.actionBar === null) {
                await expect(query).toHaveAttribute('no-actions', '');
                await expect(actionBar).toHaveCount(0);
                expect((await box(grid)).y).toBe(43);
            }
            else {
                await expect(query).not.toHaveAttribute('no-actions');
                await expect(actionBar).toBeVisible();
                // The action bar's own buttons; the children of an action group are rendered inside the group button
                const buttons = await actionBar.evaluate(bar => [...bar.shadowRoot!.querySelectorAll('vi-action-button:not([hidden])')].map(b => b.getAttribute('name')));
                expect(buttons).toEqual(view.actionBar);
                expect((await box(grid)).y).toBe(83);
            }

            const search = query.locator('vi-action-bar vi-input-search');
            if (view.search)
                await expect(search).toBeVisible();
            else
                await expect(search).toBeHidden();
        });

        test(`${view.name} header controls hold the expected parts`, { annotation: [{ type: 'case', description: 'views.matrix-controls' }] }, async () => {
            const rh = await rowHeight(grid);
            const controls = grid.locator('header .controls');
            const controlsBox = await box(controls);

            expect(controlsBox.width).toBe(view.controls.slots * rh);
            expect(controlsBox.height).toBe(view.canFilter ? 2 * rh + 1 : rh);
            expect(await controls.evaluate(c => getComputedStyle(c).gridTemplateAreas)).toBe(view.controls.areas);
            expect(parseFloat(await hostVar(grid, '--vi-query-grid-controls-width') || '0')).toBe(controlsBox.width);

            const selectAll = grid.locator('vi-query-grid-select-all');
            if (view.selectAll === 'absent')
                await expect(selectAll).toBeHidden();
            else {
                await expect(selectAll).toBeVisible();
                const b = await box(selectAll);
                expect([b.width, b.height]).toEqual([rh, rh]);
                expect(b.y + b.height).toBe(controlsBox.y + controlsBox.height);

                const state = await selectAll.evaluate((e: any) => ({
                    cursor: getComputedStyle(e).cursor,
                    icon: getComputedStyle(e.shadowRoot.querySelector('vi-icon')).visibility
                }));
                if (view.selectAll === 'available') {
                    await expect(selectAll).toHaveAttribute('can-select-all', '');
                    expect(state).toEqual({ cursor: 'pointer', icon: 'visible' });
                }
                else {
                    await expect(selectAll).not.toHaveAttribute('can-select-all');
                    expect(state).toEqual({ cursor: 'default', icon: 'hidden' });
                }
            }

            const filters = grid.locator('vi-query-grid-filters');
            if (view.canFilter) {
                await expect(filters).toBeVisible();
                await expect(filters).toHaveAttribute('disabled', '');
                const b = await box(filters);
                expect([b.width, b.height]).toEqual([rh, rh]);
            }
            else
                await expect(filters).toBeHidden();

            const spacer = controls.locator('.spacer');
            if (view.controls.areas.includes('spacer')) {
                await expect(spacer).toBeVisible();
                const b = await box(spacer);
                if (view.canFilter)
                    expect([b.x, b.width, b.height]).toEqual([controlsBox.x, controlsBox.width, rh + 1]);
                else
                    expect([b.x + b.width, b.height]).toEqual([controlsBox.x + controlsBox.width, rh]);
            }
            else
                await expect(spacer).toBeHidden();
        });

        test(`${view.name} header is one or two rows tall`, { annotation: [{ type: 'case', description: 'views.matrix-header' }] }, async () => {
            const rh = await rowHeight(grid);
            const header = await box(grid.locator('header').first());
            expect(header.height).toBe(view.canFilter ? 2 * rh + 2 : rh + 1);

            const columnHeaders = grid.locator('vi-query-grid-column-header');
            await expect(columnHeaders).toHaveCount(PEOPLE_COLUMNS.length);
            for (let i = 0; i < PEOPLE_COLUMNS.length; i++) {
                expect((await box(columnHeaders.nth(i))).height, PEOPLE_COLUMNS[i]).toBe(header.height - 1);

                const filter = columnHeaders.nth(i).locator('vi-query-grid-column-filter');
                if (view.canFilter)
                    await expect(filter, PEOPLE_COLUMNS[i]).toBeVisible();
                else
                    await expect(filter, PEOPLE_COLUMNS[i]).toBeHidden();
            }

            expect((await box(firstDataRow(grid))).y).toBe(header.y + header.height);
            expect((await box(grid.locator('header .controls'))).height).toBe(header.height - 1);
        });

        test(`${view.name} rows show the expected prefix parts`, { annotation: [{ type: 'case', description: 'views.matrix-row-prefix' }] }, async () => {
            const rh = await rowHeight(grid);
            const row = firstDataRow(grid);
            const parts = await prefixParts(row);

            for (const part of ALL_PARTS) {
                if (view.prefix.includes(part))
                    expect(parts[part], part).toMatchObject({ width: rh, height: rh });
                else
                    expect(parts[part], part).toBeNull();
            }

            const rowBox = await box(row);
            const gridBox = await box(grid);
            const firstCell = await box(row.locator('.column').first());
            const firstHeader = await box(grid.locator('vi-query-grid-column-header').first());
            const controlsWidth = (await box(grid.locator('header .controls'))).width;

            expect(firstCell.x - rowBox.x).toBe(firstHeader.x - gridBox.x);
            expect(firstHeader.x - gridBox.x).toBe(controlsWidth);

            // The prefix parts sit side by side in their declared order, starting at the row's left edge
            const shown = view.prefix.map(p => parts[p]!);
            shown.forEach((p, i) => expect(p.x, view.prefix[i]).toBe(rowBox.x + i * rh));

            if (view.selectAll !== 'absent' && parts.selector)
                expect((await box(grid.locator('vi-query-grid-select-all'))).x).toBe(parts.selector.x);
        });

        test(`${view.name} renders 9 columns with type-specific cells`, { annotation: [{ type: 'case', description: 'views.matrix-columns' }] }, async () => {
            expect(await headerNames(grid)).toEqual(PEOPLE_COLUMNS);

            const cells = await grid.evaluate((g: any) => [...g.shadowRoot.querySelectorAll('vi-query-grid-row:not([is-group])')]
                .filter((r: any) => getComputedStyle(r).display !== 'none' && !r.classList.contains('hidden'))
                .map((r: any) => [...r.querySelectorAll(':scope > .column'), ...(r.shadowRoot?.querySelectorAll('.column') ?? [])].map((c: Element) => c.tagName.toLowerCase()).join(',')));

            const expected = [...Array(8).fill('vi-query-grid-cell-default'), 'vi-query-grid-cell-boolean'].join(',');
            expect(cells.length).toBeGreaterThan(0);
            expect(new Set(cells)).toEqual(new Set([expected]));
        });

        test(`${view.name} keeps a bounded row pool and renders no footer`, { annotation: [{ type: 'case', description: 'views.matrix-physical-rows' }] }, async () => {
            const rh = await rowHeight(grid);
            const viewport = await grid.evaluate((g: any) => ([...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as HTMLElement).getBoundingClientRect().height);
            const slots = Math.ceil(viewport / rh);

            // Exact pool sizes (27/29/32) are recorded by the perf specs only
            const physical = await physicalRowCount(grid);
            expect(physical).toBeGreaterThanOrEqual(slots + 1);
            expect(physical).toBeLessThanOrEqual(Math.ceil(slots * 1.5) + 1);

            await expect(grid.locator('footer')).toBeHidden();
            await expect(grid.locator('vi-query-grid-footer')).toBeHidden();

            const scroller = await grid.evaluate((g: any) => Math.round(([...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as HTMLElement).getBoundingClientRect().bottom));
            const host = await box(grid);
            expect(scroller).toBe(host.y + host.height);
        });
    });

    test(`${view.name} grouped by Gender adds the grouping control and group spacer`, { annotation: [{ type: 'case', description: 'views.matrix-grouped' }] }, async ({ page }) => {
        const grid = await openView(page, view.path);
        const rh = await rowHeight(grid);

        await groupBy(grid, 'Gender', 'Gender');

        const controls = grid.locator('header .controls');
        await expect.poll(() => controls.evaluate(c => getComputedStyle(c).gridTemplateAreas)).toBe(view.grouped.areas);
        const controlsBox = await box(controls);
        expect(controlsBox.width).toBe(view.grouped.slots * rh);

        const grouping = grid.locator('vi-query-grid-grouping');
        await expect(grouping).toBeVisible();
        const groupingBox = await box(grouping);
        expect(groupingBox.x).toBe(controlsBox.x);
        expect([groupingBox.width, groupingBox.height]).toEqual([rh, rh]);

        const row = grid.locator('vi-query-grid-row:not([is-group])').filter({ visible: true }).first();
        const parts = await prefixParts(row);
        for (const part of ALL_PARTS) {
            if (view.grouped.prefix.includes(part))
                expect(parts[part], part).toMatchObject({ width: rh, height: rh });
            else
                expect(parts[part], part).toBeNull();
        }

        const groups = await grid.evaluate((g: any) => g.query.groupingInfo.groups.map((x: any) => `${x.name} (${x.count})`));
        expect(groups).toHaveLength(3);
        if (view.name === 'PeopleTop10')
            expect(groups).toEqual(['Female (2)', 'Male (5)', 'Unknown (3)']);

        const gridBox = await box(grid);
        const rows = await groupRows(grid);
        expect(rows.length).toBeGreaterThan(0);
        if (view.name === 'PeopleTop10')
            expect(rows.map(r => r.text)).toEqual(groups);
        else
            expect(rows[0].text).toBe(groups[0]);

        for (const r of rows) {
            expect(Math.round(r.width), r.text).toBe(gridBox.width);
            expect(Math.round(r.height), r.text).toBe(rh);
        }

        await wheelGrid(page, grid, 300, 0);
        await settle(grid);
        expect(parseFloat(await hostVar(grid, '--vi-query-grid-horizontal'))).toBeGreaterThan(0);
        const scrolled = await groupRows(grid);
        expect(scrolled.map(r => r.labelX)).toEqual(rows.map(r => r.labelX));
        await waitForGridReady(grid);
    });
}
