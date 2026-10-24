import { test, expect, Locator } from '@playwright/test';
import { nextFrames, openView, requestLog, VIEWS, waitForGridReady } from '../_helpers/query-grid';
import { ALL_PARTS, box, expectAligned, Part, prefixParts, rowForItem, rowHeight } from '../_helpers/views';

/** Resolves a CSS value expression (e.g. a custom property) to its computed color inside the grid. */
async function resolvedColor(grid: Locator, value: string) {
    return grid.evaluate((g: Element, value) => {
        const probe = document.createElement('div');
        probe.style.backgroundColor = value;
        g.shadowRoot!.appendChild(probe);
        const color = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return color;
    }, value);
}

function firstDataRow(grid: Locator) {
    return grid.locator('vi-query-grid-row:not([is-group])').filter({ visible: true }).first();
}

test.describe('Theming variables', () => {
    test('a consumer --vi-query-grid-row-height sizes rows and the prefix', { annotation: [{ type: 'case', description: 'views.api-row-height-var' }] }, async ({ page }) => {
        // App code sets the variable on the grid host before it initializes: an inline style on every vi-query-grid
        await page.addInitScript(() => {
            const attachShadow = Element.prototype.attachShadow;
            Element.prototype.attachShadow = function (this: HTMLElement, init: ShadowRootInit) {
                const root = attachShadow.call(this, init);
                if (this.tagName === 'VI-QUERY-GRID')
                    queueMicrotask(() => this.style.setProperty('--vi-query-grid-row-height', '40px'));

                return root;
            };
        });

        const grid = await openView(page, VIEWS.People);
        expect(await grid.evaluate(g => getComputedStyle(g).getPropertyValue('--vi-query-grid-row-height').trim())).toBe('40px');

        const rows = await grid.evaluate((g: any) => [...g.shadowRoot.querySelectorAll('vi-query-grid-row')]
            .filter((r: any) => getComputedStyle(r).display !== 'none' && !r.classList.contains('hidden'))
            .map((r: any) => Math.round(r.getBoundingClientRect().height)));
        expect(rows.length).toBeGreaterThan(0);
        expect(new Set(rows)).toEqual(new Set([40]));

        const parts = await prefixParts(firstDataRow(grid));
        expect(parts.selector).toMatchObject({ width: 40, height: 40 });
        expect(parts.actions).toMatchObject({ width: 40, height: 40 });
        expect((await box(grid.locator('header .controls'))).width).toBe(80);
        await expectAligned(grid, '40px rows');
    });

    test('stripe color variables recolor rows; cell-padding affects labels', { annotation: [{ type: 'case', description: 'views.api-stripe-color-vars' }] }, async ({ page }) => {
        const grid = await openView(page, VIEWS.People);
        await page.mouse.move(0, 0);

        await grid.evaluate((g: HTMLElement) => {
            g.style.setProperty('--vi-query-grid-row-odd-color', 'rgb(255, 240, 240)');
            g.style.setProperty('--vi-query-grid-row-even-color', 'rgb(240, 255, 240)');
        });

        // items[0] sits in an odd (first) row of the pool, items[1] in an even one
        const background = async (index: number) => (await rowForItem(grid, index)).locator('.column').first().evaluate(c => getComputedStyle(c).backgroundColor);
        await expect.poll(() => background(0)).toBe('rgb(255, 240, 240)');
        await expect.poll(() => background(1)).toBe('rgb(240, 255, 240)');

        const padding = () => grid.evaluate((g: any) => {
            const header = g.shadowRoot.querySelector('vi-query-grid-column-header[name=FirstName]');
            const filter = header.shadowRoot.querySelector('vi-query-grid-column-filter');
            const icon = filter.shadowRoot.querySelector('vi-icon[source=Filter]');
            return {
                header: getComputedStyle(header.shadowRoot.querySelector('.label')).paddingLeft,
                filter: getComputedStyle(icon).paddingLeft
            };
        });
        const theme = await padding();
        expect(theme.header).toBe(theme.filter);

        await grid.evaluate((g: HTMLElement) => g.style.setProperty('--vi-query-grid-cell-padding', '13px'));
        await expect.poll(padding).toEqual({ header: '13px', filter: '13px' });
    });
});

test.describe('Reflected state attributes', () => {
    test('selected and actions-open rows are styleable through reflected attributes', { annotation: [{ type: 'case', description: 'views.api-selected-attr-styling' }] }, async ({ page }) => {
        const grid = await openView(page, VIEWS.People);
        const faint = await resolvedColor(grid, 'var(--color-faint)');
        const lighter = await resolvedColor(grid, 'var(--color-lighter)');
        expect(faint).not.toBe('rgba(0, 0, 0, 0)');

        const style = (row: Locator) => row.evaluate(r => ({
            background: getComputedStyle(r).backgroundColor,
            after: { height: getComputedStyle(r, '::after').height, color: getComputedStyle(r, '::after').backgroundColor, content: getComputedStyle(r, '::after').content }
        }));
        const expected = { background: faint, after: { height: '1px', color: lighter, content: '""' } };

        const selected = await rowForItem(grid, 1);
        await selected.locator('[part=selector]').click();
        await expect(selected).toHaveAttribute('selected', '');
        await page.mouse.move(0, 0);
        await expect.poll(() => style(selected)).toEqual(expected);

        const open = await rowForItem(grid, 4);
        await open.locator('[part=actions]').click();
        await expect(open).toHaveAttribute('actions-open', '');
        await page.mouse.move(0, 0);
        await expect.poll(() => style(open)).toEqual(expected);

        await page.keyboard.press('Escape');
        await expect(open).not.toHaveAttribute('actions-open');
    });
});

test.describe('Feature properties', () => {
    test('noInlineActions turns People into the Select + Filter layout', { annotation: [{ type: 'case', description: 'views.api-no-inline-actions' }] }, async ({ page }) => {
        const grid = await openView(page, VIEWS.People);
        const rh = await rowHeight(grid);
        await expect(grid).toHaveAttribute('inline-actions', '');

        await grid.evaluate((g: any) => g.noInlineActions = true);
        await expect(grid).toHaveAttribute('no-inline-actions', '');
        await expect(grid).not.toHaveAttribute('inline-actions');
        await waitForGridReady(grid);

        const controls = await box(grid.locator('header .controls'));
        expect([controls.width, controls.height]).toEqual([2 * rh, 2 * rh + 1]);

        const parts = await prefixParts(firstDataRow(grid));
        for (const part of ALL_PARTS) {
            if (part === 'selector' || part === 'filter')
                expect(parts[part], part).toMatchObject({ width: rh, height: rh });
            else
                expect(parts[part], part).toBeNull();
        }

        const row = firstDataRow(grid);
        expect((await box(row.locator('.column').first())).x - (await box(row)).x).toBe(controls.width);
        await expectAligned(grid, 'no inline actions');
    });

    test('asLookup forces selection and stops navigation', { annotation: [{ type: 'case', description: 'views.api-as-lookup-property' }] }, async ({ page }) => {
        const grid = await openView(page, VIEWS.QueryGrid_Filter);
        const rh = await rowHeight(grid);
        await expect(grid).not.toHaveAttribute('can-select');

        await grid.evaluate((g: any) => g.asLookup = true);
        await expect(grid).toHaveAttribute('as-lookup', '');
        await expect(grid).toHaveAttribute('can-select', '');
        await waitForGridReady(grid);

        const controls = grid.locator('header .controls');
        await expect.poll(async () => (await box(controls)).width).toBe(2 * rh);
        await expect(grid.locator('vi-query-grid-select-all')).toBeVisible();
        await expect(grid.locator('vi-query-grid-filters')).toBeVisible();

        const parts = await prefixParts(firstDataRow(grid));
        for (const part of ALL_PARTS) {
            if (part === 'selector' || part === 'filter')
                expect(parts[part], part).toMatchObject({ width: rh, height: rh });
            else
                expect(parts[part], part).toBeNull();
        }
        await expectAligned(grid, 'as lookup');

        const row = await rowForItem(grid, 1);
        const cell = (await row.locator('.column').nth(1).boundingBox())!;
        await page.mouse.click(cell.x + cell.width / 2, cell.y + cell.height / 2, { button: 'right' });
        await nextFrames(page, 3);
        expect(await grid.evaluate((g: any) => [...g.shadowRoot.children].filter((e: Element) => e.tagName === 'VI-POPUP').length)).toBe(0);
        await page.keyboard.press('Escape');

        const url = page.url();
        const log = requestLog(page);
        await row.locator('.column').nth(1).click();
        await log.quiet();
        expect(log.of('GetPersistentObject')).toEqual([]);
        expect(page.url()).toBe(url);
    });
});

test.describe('Public QueryGrid API on app views', () => {
    // noSelection set by app code on a selectable view: the remaining can-filter/inline-actions flags pick the layout
    const noSelectionViews = [
        { view: 'QueryGrid_Select', canFilter: false, inlineActions: false, areas: 'none', prefix: [] },
        { view: 'QueryGrid_SelectAndFilter', canFilter: true, inlineActions: false, areas: '"spacer" "filter"', prefix: ['filter'] },
        { view: 'QueryGrid_InlineActions', canFilter: false, inlineActions: true, areas: '"spacer"', prefix: ['actions'] },
        { view: 'QueryGrid_SelectAndFilterAndInlineActions', canFilter: true, inlineActions: true, areas: '"spacer" "filter"', prefix: ['actions'] },
        { view: 'People', canFilter: true, inlineActions: true, areas: '"spacer" "filter"', prefix: ['actions'] }
    ] as { view: keyof typeof VIEWS; canFilter: boolean; inlineActions: boolean; areas: string; prefix: Part[] }[];

    for (const layout of noSelectionViews) {
        test(`noSelection on ${layout.view} keeps cells aligned with their headers`, { annotation: [{ type: 'case', description: 'views.api-no-selection-filter-inline' }] }, async ({ page }) => {
            const grid = await openView(page, VIEWS[layout.view]);
            await expect(grid).toHaveAttribute('can-select', '');

            await grid.evaluate((g: any) => g.noSelection = true);
            await expect(grid).not.toHaveAttribute('can-select');
            for (const [attribute, expected] of [['can-filter', layout.canFilter], ['inline-actions', layout.inlineActions]] as const) {
                if (expected)
                    await expect(grid, attribute).toHaveAttribute(attribute, '');
                else
                    await expect(grid, attribute).not.toHaveAttribute(attribute);
            }
            await waitForGridReady(grid);

            const rh = await rowHeight(grid);
            const controls = grid.locator('header .controls');
            await expect.poll(() => controls.evaluate(c => getComputedStyle(c).gridTemplateAreas)).toBe(layout.areas);
            const controlsWidth = (await box(controls)).width;
            expect(controlsWidth).toBe(layout.prefix.length * rh);
            await expect.poll(async () => parseFloat(await grid.evaluate(g => getComputedStyle(g).getPropertyValue('--vi-query-grid-controls-width')) || '0')).toBe(controlsWidth);

            const row = grid.locator('vi-query-grid-row:not([is-group])').filter({ visible: true }).first();
            const parts = await prefixParts(row);
            for (const part of ALL_PARTS) {
                if (layout.prefix.includes(part))
                    expect(parts[part], part).toMatchObject({ width: rh, height: rh });
                else
                    expect(parts[part], part).toBeNull();
            }

            // The row prefix is as wide as the header controls, and every cell sits under its header (±1px)
            const rowBox = await box(row);
            const firstCell = await box(row.locator('.column').first());
            const firstHeader = await box(grid.locator('vi-query-grid-column-header').first());
            expect(firstCell.x - rowBox.x).toBe(controlsWidth);
            expect(firstHeader.x - (await box(grid)).x).toBe(controlsWidth);
            await expectAligned(grid);
        });
    }
});
