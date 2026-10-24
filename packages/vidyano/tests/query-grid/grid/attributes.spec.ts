import { test, expect } from '@playwright/test';
import { gridPage, mountGrid, waitForGridReady, requestLog } from '../_helpers/query-grid';
import { controlsBox, headerBoxes, hostVar, rowAt, rows, valuesOf } from '../_helpers/grid';
import { ALL_PARTS, box, expectAligned, Part, prefixParts, rowHeight } from '../_helpers/views';

test.describe('Host attributes and configuration', () => {
    test('markup attributes configure the grid', { annotation: [{ type: 'case', description: 'grid.attr-config-from-attributes' }] }, async ({ page }) => {
        await gridPage(page);
        await page.evaluate(async () => {
            const w = window as any;
            w.q = await w.service.getQuery('PeopleTop10');
        });

        const mount = async (attributes: string) => {
            await page.evaluate(attributes => {
                const w = window as any;
                const container = document.getElementById('test-container')!;
                container.innerHTML = `<vi-query-grid ${attributes} style="height:400px"></vi-query-grid>`;
                w.grid = container.querySelector('vi-query-grid');
                w.grid.query = w.q;
            }, attributes);

            const grid = page.locator('#test-container > vi-query-grid');
            await waitForGridReady(grid);
            return grid;
        };

        const grid = await mount('as-lookup no-inline-actions max-rows="5" skip="3"');
        expect(await grid.evaluate((g: any) => ({ asLookup: g.asLookup, maxRows: g.maxRows, maxRowsType: typeof g.maxRows, skip: g.skip }))).toEqual({ asLookup: true, maxRows: 5, maxRowsType: 'number', skip: 3 });
        await expect(grid).toHaveAttribute('as-lookup');
        await expect(grid).toHaveAttribute('can-select');
        await expect(grid).toHaveAttribute('has-more-rows');
        await expect(grid).not.toHaveAttribute('inline-actions');

        const visible = await rows(grid);
        expect(visible.map(r => r.index)).toEqual([3, 4, 5, 6, 7]);
        const emails = await valuesOf(grid, [3, 4, 5, 6, 7], 'Email');
        expect(visible.map(r => r.cells.find(c => c.name === 'Email')!.text)).toEqual(emails);

        await expect(rowAt(grid, 0).locator('[part~="selector"]')).toBeVisible();
        await expect(rowAt(grid, 0).locator('[part~="actions"]')).toBeHidden();

        const noSelection = await mount('as-lookup no-inline-actions no-selection max-rows="5" skip="3"');
        await expect(noSelection).not.toHaveAttribute('can-select');
        await expect(rowAt(noSelection, 0).locator('[part~="selector"]')).toBeHidden();
    });

    test('noSelection removes the selection UI', { annotation: [{ type: 'case', description: 'grid.at-no-selection' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { props: { noSelection: true } });

        // Row alignment is asserted separately, see the noSelection layout tests below
        await expect(grid).not.toHaveAttribute('can-select');
        await expect(rowAt(grid, 0).locator('[part~="selector"]')).toBeHidden();
        await expect(grid.locator('vi-query-grid-select-all')).toBeHidden();
        await expect(rowAt(grid, 0).locator('[part~="actions"]')).toBeVisible();
    });

    test('noSelection with filter and inline actions keeps cells aligned with headers', { annotation: [{ type: 'case', description: 'rows.row-matrix-no-selection-filter-inline' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { props: { noSelection: true } });
        await expect(grid).not.toHaveAttribute('can-select');
        await expect(grid).toHaveAttribute('can-filter');
        await expect(grid).toHaveAttribute('inline-actions');

        // The actions part is the only control column, as wide as the header controls
        const rh = await rowHeight(grid);
        const parts = await prefixParts(rowAt(grid, 0));
        expect(parts.actions).toMatchObject({ width: rh, height: rh });
        expect([parts.groupspacer, parts.selector, parts.filter]).toEqual([null, null, null]);
        expect((await box(grid.locator('header .controls'))).width).toBe(rh);

        const headers = await headerBoxes(grid);
        const visible = await rows(grid);
        expect(visible.length).toBeGreaterThan(0);
        for (const row of visible) {
            expect(row.cells.map(c => c.name)).toEqual(headers.map(h => h.name));
            row.cells.forEach((cell, k) => {
                expect(Math.abs(cell.x - headers[k].x), `row ${row.index} ${cell.name} left`).toBeLessThanOrEqual(1);
                expect(Math.abs(cell.width - headers[k].width), `row ${row.index} ${cell.name} width`).toBeLessThanOrEqual(1);
            });
        }
    });

    // noSelection on every can-filter/inline-actions combination: query, flags, then the controls areas and row prefix, flat and grouped
    const noSelectionLayouts = [
        { query: 'QueryGrid_Select', canFilter: false, inlineActions: false, areas: 'none', prefix: [], grouped: { areas: '"grouping"', prefix: ['groupspacer'] } },
        { query: 'QueryGrid_SelectAndFilter', canFilter: true, inlineActions: false, areas: '"spacer" "filter"', prefix: ['filter'], grouped: { areas: '"spacer spacer" "grouping filter"', prefix: ['groupspacer', 'filter'] } },
        { query: 'QueryGrid_SelectAndInlineActions', canFilter: false, inlineActions: true, areas: '"spacer"', prefix: ['actions'], grouped: { areas: '"grouping spacer"', prefix: ['groupspacer', 'actions'] } },
        { query: 'People', canFilter: true, inlineActions: true, areas: '"spacer" "filter"', prefix: ['actions'], grouped: { areas: '"spacer spacer" "grouping filter"', prefix: ['groupspacer', 'actions'] } }
    ] as { query: string; canFilter: boolean; inlineActions: boolean; areas: string; prefix: Part[]; grouped: { areas: string; prefix: Part[] } }[];

    for (const layout of noSelectionLayouts) {
        test(`noSelection on ${layout.query} lays rows out like the headers`, { annotation: [{ type: 'case', description: 'rows.row-matrix-no-selection' }] }, async ({ page }) => {
            await gridPage(page);
            const grid = await mountGrid(page, { query: layout.query, props: { noSelection: true } });
            await expect(grid).not.toHaveAttribute('can-select');
            for (const [attribute, expected] of [['can-filter', layout.canFilter], ['inline-actions', layout.inlineActions]] as const) {
                if (expected)
                    await expect(grid, attribute).toHaveAttribute(attribute, '');
                else
                    await expect(grid, attribute).not.toHaveAttribute(attribute);
            }

            const rh = await rowHeight(grid);
            const expectLayout = async (areas: string, prefix: Part[], message: string) => {
                const controls = grid.locator('header .controls');
                await expect.poll(() => controls.evaluate(c => getComputedStyle(c).gridTemplateAreas), message).toBe(areas);
                const controlsWidth = (await box(controls)).width;
                expect(controlsWidth, `${message}: controls width`).toBe(prefix.length * rh);

                const row = grid.locator('vi-query-grid-row:not([is-group])').filter({ visible: true }).first();
                const parts = await prefixParts(row);
                for (const part of ALL_PARTS) {
                    if (prefix.includes(part))
                        expect(parts[part], `${message}: ${part}`).toMatchObject({ width: rh, height: rh });
                    else
                        expect(parts[part], `${message}: ${part}`).toBeNull();
                }

                // The row prefix is as wide as the header controls, and every cell sits under its header
                const rowBox = await box(row);
                const firstCell = await box(row.locator('.column').first());
                expect(firstCell.x - rowBox.x, `${message}: prefix width`).toBe(controlsWidth);
                await expectAligned(grid, message);
            };

            await expectLayout(layout.areas, layout.prefix, 'flat');

            await grid.evaluate(async (g: any) => { await g.query.group('Gender'); });
            await expect(grid).toHaveAttribute('has-grouping', '');
            await waitForGridReady(grid);
            await expectLayout(layout.grouped.areas, layout.grouped.prefix, 'grouped');
        });
    }

    test('noInlineActions hides row actions', { annotation: [{ type: 'case', description: 'grid.at-no-inline-actions' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { props: { noInlineActions: true } });

        await expect(grid).not.toHaveAttribute('inline-actions');
        await expect(rowAt(grid, 0).locator('[part~="actions"]')).toBeHidden();
    });

    test('item-tap reaches host and document listeners and is cancelable', { annotation: [{ type: 'case', description: 'grid.it-item-tap-bubbles' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'PeopleTop10' });

        await grid.evaluate((g: any) => {
            const w = window as any;
            w.__taps = [];
            w.__preventTap = true;
            const record = (where: string) => (e: CustomEvent) => {
                const q = g.query;
                q.disableLazyLoading = true;
                w.__taps.push({ where, bubbles: e.bubbles, composed: e.composed, cancelable: e.cancelable, isItem1: e.detail.item === q.items[1] });
                q.disableLazyLoading = false;
                if (where === 'host' && w.__preventTap)
                    e.preventDefault();
            };
            g.addEventListener('item-tap', record('host'));
            document.addEventListener('item-tap', record('document'));
        });

        const log = requestLog(page);
        await rowAt(grid, 1).locator('.column').first().click();

        await expect.poll(() => page.evaluate(() => (window as any).__taps.length)).toBe(2);
        expect(await page.evaluate(() => (window as any).__taps)).toEqual([
            { where: 'host', bubbles: true, composed: true, cancelable: true, isItem1: true },
            { where: 'document', bubbles: true, composed: true, cancelable: true, isItem1: true }
        ]);

        // preventDefault stops the open: no GetPersistentObject once the network is quiet
        await log.quiet(500);
        expect(log.of('GetPersistentObject')).toHaveLength(0);

        // Control: without preventDefault the same click does open the item (a read-only GetPersistentObject)
        await page.evaluate(() => (window as any).__preventTap = false);
        await rowAt(grid, 1).locator('.column').first().click();
        await expect.poll(() => log.of('GetPersistentObject').length).toBe(1);
    });

    test('asLookup enables selection without selection actions', { annotation: [{ type: 'case', description: 'grid.at-as-lookup-can-select' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'QueryGrid_None', props: { asLookup: true } });

        await expect(grid).toHaveAttribute('as-lookup');
        await expect(grid).toHaveAttribute('can-select');
        await expect(rowAt(grid, 0).locator('[part~="selector"]')).toBeVisible();
    });

    test('noSelection property and attribute toggle at runtime', { annotation: [{ type: 'case', description: 'grid.at-no-selection-runtime' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'QueryGrid_Select' });
        const selector = rowAt(grid, 0).locator('[part~="selector"]');
        const rh = await rowHeight(grid);

        const expectSelectable = async (selectable: boolean, step: string) => {
            await expect.poll(() => grid.evaluate((g: any) => g.noSelection), step).toBe(!selectable);
            if (selectable) {
                await expect(grid, step).not.toHaveAttribute('no-selection');
                await expect(grid, step).toHaveAttribute('can-select');
                await expect(selector, step).toBeVisible();
            }
            else {
                await expect(grid, step).toHaveAttribute('no-selection');
                await expect(grid, step).not.toHaveAttribute('can-select');
                await expect(selector, step).toBeHidden();
            }

            const width = selectable ? rh : 0;
            await expect.poll(async () => (await controlsBox(grid)).width, `${step}: controls width`).toBe(width);
            await expect.poll(async () => {
                const row = (await rows(grid))[0];
                return Math.round(row.cells[0].x - row.x);
            }, `${step}: row prefix`).toBe(width);
            await expectAligned(grid, step);
        };

        await expectSelectable(true, 'initial');

        await grid.evaluate((g: any) => g.noSelection = true);
        await expectSelectable(false, 'property true');
        await grid.evaluate((g: any) => g.noSelection = false);
        await expectSelectable(true, 'property false');

        await grid.evaluate((g: any) => g.setAttribute('no-selection', ''));
        await expectSelectable(false, 'attribute added');
        await grid.evaluate((g: any) => g.removeAttribute('no-selection'));
        await expectSelectable(true, 'attribute removed');
    });

    test('lookup queries never show inline actions', { annotation: [{ type: 'case', description: 'grid.at-inline-lookup-query' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { queryOptions: { asLookup: true } });

        expect(await grid.evaluate((g: any) => g.query.asLookup)).toBe(true);
        await expect(grid).not.toHaveAttribute('inline-actions');
        await expect(rowAt(grid, 0).locator('[part~="actions"]')).toBeHidden();
        // A lookup is for picking rows: it stays selectable
        await expect(grid).toHaveAttribute('can-select');
        await expect(rowAt(grid, 0).locator('[part~="selector"]')).toBeVisible();
    });

    test('asLookup set after the query removes inline actions', { annotation: [{ type: 'case', description: 'grid.at-inline-aslookup-order' }] }, async ({ page }) => {
        await gridPage(page);

        const before = await mountGrid(page, { props: { asLookup: true } });
        await expect(before).not.toHaveAttribute('inline-actions');
        await before.evaluate((g: any) => g.remove());

        const grid = await mountGrid(page);
        await expect(grid).toHaveAttribute('inline-actions');
        await expect(rowAt(grid, 0).locator('[part~="actions"]')).toBeVisible();

        await grid.evaluate((g: any) => g.asLookup = true);
        await expect(grid).toHaveAttribute('as-lookup');
        await expect(grid).not.toHaveAttribute('inline-actions');
        await expect(rowAt(grid, 0).locator('[part~="actions"]')).toBeHidden();
    });

    test('hiding all selection actions removes can-select and inline-actions', { annotation: [{ type: 'case', description: 'gap.grid-canselect-recomputed-on-action-visibility' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await expect(grid).toHaveAttribute('can-select');
        await expect(grid).toHaveAttribute('inline-actions');

        // Every action with a selection rule (not the always-true rule) is hidden
        const hidden = await grid.evaluate((g: any) => {
            const alwaysTrue = (window as any).Vidyano.ExpressionParser.alwaysTrue;
            const actions = g.query.actions.filter((a: any) => a.isVisible && a.definition.selectionRule !== alwaysTrue);
            actions.forEach((a: any) => a.isVisible = false);
            return actions.map((a: any) => a.name);
        });
        expect(hidden.length).toBeGreaterThan(0);

        await expect(grid).not.toHaveAttribute('can-select');
        await expect(grid).not.toHaveAttribute('inline-actions');
        await expect(rowAt(grid, 0).locator('[part~="selector"]')).toBeHidden();
        await expect(rowAt(grid, 0).locator('[part~="actions"]')).toBeHidden();
    });

    test('can-reorder follows query.canReorder', { annotation: [{ type: 'case', description: 'grid.at-can-reorder' }] }, async ({ page }) => {
        await gridPage(page);

        const reorder = await mountGrid(page, { query: 'QueryGrid_Reorder' });
        expect(await reorder.evaluate((g: any) => g.query.canReorder)).toBe(true);
        await expect(reorder).toHaveAttribute('can-reorder');
        await reorder.evaluate((g: any) => g.remove());

        const people = await mountGrid(page);
        expect(await people.evaluate((g: any) => g.query.canReorder)).toBe(false);
        await expect(people).not.toHaveAttribute('can-reorder');
    });

    test('grouping disables reordering', { annotation: [{ type: 'case', description: 'grid.at-reorder-grouping-exclusive' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'QueryGrid_Reorder' });
        await expect(grid).toHaveAttribute('can-reorder');
        await expect(grid.locator('vi-query-grid-row:not([is-group]) [part~="reorder"]').filter({ visible: true }).first()).toBeVisible();

        await grid.evaluate(async (g: any) => { await g.query.group('Name'); });
        await expect(grid).toHaveAttribute('has-grouping');
        await expect(grid).not.toHaveAttribute('can-reorder');
        await waitForGridReady(grid);

        expect(await grid.evaluate((g: any) => [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].flatMap((r: any) => [...(r.shadowRoot?.querySelectorAll('[part~="reorder"]') ?? [])]).filter((e: any) => e.checkVisibility()).length)).toBe(0);
    });

    test('noSelection on an inline-actions query gives the inline-only layout', { annotation: [{ type: 'case', description: 'grid.vm-inline-only-no-selection' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'QueryGrid_InlineActions', props: { noSelection: true } });
        const rh = await rowHeight(grid);

        await expect(grid).toHaveAttribute('inline-actions');
        await expect(grid).not.toHaveAttribute('can-select');
        await expect(grid).not.toHaveAttribute('can-filter');

        const expectLayout = async (areas: string, prefix: Part[], message: string) => {
            const controls = grid.locator('header .controls');
            await expect.poll(() => controls.evaluate(c => getComputedStyle(c).gridTemplateAreas), message).toBe(areas);
            expect((await box(controls)).width, `${message}: controls width`).toBe(prefix.length * rh);

            const row = grid.locator('vi-query-grid-row:not([is-group])').filter({ visible: true }).first();
            const parts = await prefixParts(row);
            for (const part of ALL_PARTS) {
                if (prefix.includes(part))
                    expect(parts[part], `${message}: ${part}`).toMatchObject({ width: rh, height: rh });
                else
                    expect(parts[part], `${message}: ${part}`).toBeNull();
            }

            await expectAligned(grid, message);
        };

        await expectLayout('"spacer"', ['actions'], 'flat');

        await grid.evaluate(async (g: any) => { await g.query.group('Gender'); });
        await expect(grid).toHaveAttribute('has-grouping', '');
        await waitForGridReady(grid);
        await expectLayout('"grouping spacer"', ['groupspacer', 'actions'], 'grouped');
    });

    test('properties set before connection give a consistent first render', { annotation: [{ type: 'case', description: 'grid.lc-batch-props-before-connect' }] }, async ({ page }) => {
        await gridPage(page);
        await page.evaluate(async () => {
            const w = window as any;
            w.q = await w.service.getQuery('PeopleTop10');
        });

        const log = requestLog(page);
        await page.evaluate(() => {
            const w = window as any;
            const grid = document.createElement('vi-query-grid') as any;
            grid.maxRows = 3;
            grid.skip = 2;
            grid.noInlineActions = true;
            grid.query = w.q;
            document.getElementById('test-container')!.appendChild(grid);
            w.grid = grid;
        });

        const grid = page.locator('#test-container > vi-query-grid');
        await waitForGridReady(grid);

        await expect(grid).toHaveAttribute('max-rows', '3');
        await expect(grid).toHaveAttribute('skip', '2');
        await expect(grid).toHaveAttribute('no-inline-actions');
        await expect(grid).toHaveAttribute('has-more-rows');
        await expect(grid).not.toHaveAttribute('inline-actions');
        expect((await rows(grid)).map(r => r.index)).toEqual([2, 3, 4]);

        await log.quiet();
        expect(log.of('ExecuteQuery')).toHaveLength(0);
    });

    test('swapping None and People on one element updates flags and layout', { annotation: [{ type: 'case', description: 'grid.query-swap-view-flags' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'QueryGrid_None' });

        const swap = async (query: string) => {
            await page.evaluate(async query => {
                const w = window as any;
                const q = await w.service.getQuery(query);
                q.sortOptions = [{ name: 'FirstName', direction: 'ASC' }];
                await q.search();
                w.grid.query = w.q = q;
            }, query);
            await waitForGridReady(grid);
        };

        const expectFlags = async (on: boolean, step: string) => {
            for (const attribute of ['can-select', 'inline-actions', 'can-filter']) {
                if (on)
                    await expect(grid, `${step}: ${attribute}`).toHaveAttribute(attribute);
                else
                    await expect(grid, `${step}: ${attribute}`).not.toHaveAttribute(attribute);
            }

            const parts = [grid.locator('vi-query-grid-select-all'), grid.locator('vi-query-grid-filters'), grid.locator('vi-query-grid-column-header vi-query-grid-column-filter').first()];
            for (const part of parts) {
                if (on)
                    await expect(part, step).toBeVisible();
                else
                    await expect(part, step).toBeHidden();
            }

            const row = rowAt(grid, 0);
            for (const part of ['selector', 'actions']) {
                if (on)
                    await expect(row.locator(`[part~="${part}"]`), `${step}: ${part}`).toBeVisible();
                else
                    await expect(row.locator(`[part~="${part}"]`), `${step}: ${part}`).toBeHidden();
            }

            await expect.poll(() => hostVar(grid, '--vi-query-grid-controls-width'), step).toMatch(on ? /^64px$/ : /^(0px)?$/);
            await expectAligned(grid, step);
        };

        await expectFlags(false, 'None');
        await swap('People');
        await expectFlags(true, 'People');
        await swap('QueryGrid_None');
        await expectFlags(false, 'None again');
    });
});
