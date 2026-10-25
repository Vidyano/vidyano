import { test, expect, Locator } from '@playwright/test';
import { getScrollOffset, openView, visibleRows } from '../_helpers/query-grid';
import { box, expectAligned, groupBy, groupingMenuItem, groupRows, itemDisplay, openColumnMenu, openPopups, physicalRowCount, prefixParts, rowBoxes, rowForItem, rowHeight, settle, VIEW_MATRIX, wheelGrid } from '../_helpers/views';
import { openFilter } from '../_helpers/filters';

/** Row prefix width: first cell x minus row x of the first displayed data row. */
async function prefixWidth(grid: Locator) {
    const index = (await visibleRows(grid)).find(r => !r.isGroup)!.index;
    const row = await rowForItem(grid, index);
    return (await box(row.locator('.column').first())).x - (await box(row)).x;
}

/** The scroll extent holds the given number of rows; without overflow the rows are counted instead. */
async function expectExtent(grid: Locator, rows: number) {
    const rh = await rowHeight(grid);
    const offset = await getScrollOffset(grid);
    if (rows * rh > offset.height)
        expect(offset.scrollHeight / rh, 'scroll extent in rows').toBe(rows);
    else {
        expect(offset.scrollHeight, 'no vertical overflow').toBe(offset.height);
        expect((await visibleRows(grid)).length, 'displayed rows').toBe(rows);
    }
}

async function groupByBirthDate(grid: Locator) {
    const rh = await rowHeight(grid);
    const controlsBefore = (await box(grid.locator('header .controls'))).width;
    const prefixBefore = await prefixWidth(grid);

    await groupBy(grid, 'BirthDate', 'Birth date');

    const grouping = grid.locator('vi-query-grid-grouping');
    await expect(grouping).toBeVisible();
    const controls = await box(grid.locator('header .controls'));
    expect((await box(grouping)).x).toBe(controls.x);
    expect(controls.width).toBe(controlsBefore + rh);
    expect(await prefixWidth(grid)).toBe(prefixBefore + rh);

    return { controlsBefore };
}

test.describe('Grouping', () => {
    for (const view of VIEW_MATRIX) {
        test(`${view.name} grouping by BirthDate adds group rows`, { annotation: [{ type: 'case', description: 'views.all-group-birthdate' }] }, async ({ page }) => {
            const grid = await openView(page, view.path);
            await groupByBirthDate(grid);

            const index = (await visibleRows(grid)).find(r => !r.isGroup)!.index;
            expect((await prefixParts(await rowForItem(grid, index))).groupspacer).not.toBeNull();

            const first = (await visibleRows(grid))[0];
            expect(first.isGroup).toBe(true);
            const groups = await grid.evaluate((g: any) => g.query.groupingInfo.groups.map((x: any) => `${x.name} (${x.count})`));
            const labels = await groupRows(grid);
            expect(labels[0].text).toBe(groups[0]);

            if (view.totalItems === 10000) {
                expect(labels[0].text).toBe('1945 (166)');
                expect(groups).toHaveLength(56);
                await expectExtent(grid, 10056);
            }
            else
                await expectExtent(grid, view.totalItems + groups.length);

            await expectAligned(grid, 'grouped');
        });

        test(`${view.name} Collapse all and Expand all from the grouping menu`, { annotation: [{ type: 'case', description: 'views.all-group-collapse-expand' }] }, async ({ page }) => {
            const grid = await openView(page, view.path);
            await groupByBirthDate(grid);
            const groups = await grid.evaluate((g: any) => g.query.groupingInfo.groups.length);
            if (view.totalItems === 10000)
                expect(groups).toBe(56);

            if (view.totalItems > 100) {
                await wheelGrid(page, grid, 0, 3200);
                await settle(grid);
                expect((await getScrollOffset(grid)).top).toBeGreaterThan(0);
            }

            await groupingMenuItem(grid, 'Collapse all');
            await expect.poll(() => grid.evaluate((g: any) => g.query.groupingInfo.groups.every((x: any) => x.isCollapsed))).toBe(true);
            await settle(grid);

            expect((await getScrollOffset(grid)).top).toBe(0);
            await expectExtent(grid, groups);
            const rows = await visibleRows(grid);
            expect(rows.every(r => r.isGroup)).toBe(true);
            await expect(grid.locator('vi-query-grid-row-group:not([collapsed])').filter({ visible: true })).toHaveCount(0);
            expect((await groupRows(grid)).length).toBe(rows.length);

            await groupingMenuItem(grid, 'Expand all');
            await expect.poll(() => grid.evaluate((g: any) => g.query.groupingInfo.groups.some((x: any) => x.isCollapsed))).toBe(false);
            await settle(grid);

            expect((await getScrollOffset(grid)).top).toBe(0);
            await expectExtent(grid, view.totalItems + groups);
            const expanded = await visibleRows(grid);
            expect(expanded[0].isGroup).toBe(true);
            expect(expanded[1].isGroup).toBe(false);
            await expectAligned(grid, 'expanded');
        });

        test(`${view.name} clicking a group row toggles its collapse`, { annotation: [{ type: 'case', description: 'views.all-group-row-toggle' }] }, async ({ page }) => {
            const grid = await openView(page, view.path);
            await groupByBirthDate(grid);
            const [first, second] = await grid.evaluate((g: any) => g.query.groupingInfo.groups.slice(0, 2).map((x: any) => `${x.name} (${x.count})`));
            if (view.totalItems === 10000)
                expect(first).toBe('1945 (166)');

            // [collapsed] of the row group that shows the first group
            const firstCollapsedAttribute = () => grid.evaluate((g: any) => {
                const group = g.query.groupingInfo.groups[0];
                const element = [...g.shadowRoot.querySelectorAll('vi-query-grid-row[is-group]')]
                    .map((r: any) => r.querySelector('vi-query-grid-row-group') ?? r.shadowRoot?.querySelector('vi-query-grid-row-group'))
                    .find((e: any) => e?.group === group);
                return element ? element.hasAttribute('collapsed') : null;
            });

            expect((await groupRows(grid))[0].text).toBe(first);
            expect(await firstCollapsedAttribute()).toBe(false);

            const top = (await rowBoxes(grid))[0];
            expect(top.isGroup).toBe(true);
            // Click the group's label at the left
            const labelX = (await groupRows(grid))[0].labelX!;
            const click = { x: labelX + 10, y: top.top + top.height / 2 };
            await page.mouse.click(click.x, click.y);

            await expect.poll(() => grid.evaluate((g: any) => g.query.groupingInfo.groups[0].isCollapsed)).toBe(true);
            await expect.poll(firstCollapsedAttribute).toBe(true);
            await settle(grid);

            const collapsed = await rowBoxes(grid);
            const labels = await groupRows(grid);
            expect(labels.slice(0, 2).map(l => l.text)).toEqual([first, second]);
            expect(collapsed[1].isGroup).toBe(true);
            expect(Math.abs(collapsed[1].top - collapsed[0].bottom)).toBeLessThanOrEqual(1);

            await page.mouse.click(click.x, click.y);
            await expect.poll(() => grid.evaluate((g: any) => g.query.groupingInfo.groups[0].isCollapsed)).toBe(false);
            await settle(grid);

            const expanded = await visibleRows(grid);
            expect(expanded[0].isGroup).toBe(true);
            expect(expanded[1].isGroup).toBe(false);
            expect(expanded[1].index).toBe(0);
            await expect.poll(firstCollapsedAttribute).toBe(false);
        });

        test(`${view.name} Remove grouping restores the ungrouped layout`, { annotation: [{ type: 'case', description: 'views.all-ungroup' }] }, async ({ page }) => {
            const grid = await openView(page, view.path);
            const { controlsBefore } = await groupByBirthDate(grid);

            await groupingMenuItem(grid, 'Remove grouping');

            await expect(grid).not.toHaveAttribute('has-grouping');
            await expect(grid.locator('vi-query-grid-grouping')).toBeHidden();
            await settle(grid);
            await expect(grid.locator('vi-query-grid-row:not([is-group])').first().locator('[part=groupspacer]')).toBeHidden();
            expect((await prefixParts(await rowForItem(grid, 0))).groupspacer).toBeNull();
            expect((await box(grid.locator('header .controls'))).width).toBe(controlsBefore);
            await expectExtent(grid, view.totalItems);
            expect((await visibleRows(grid)).some(r => r.isGroup)).toBe(false);
        });
    }
});

test.describe('Vertical scrolling', () => {
    for (const view of VIEW_MATRIX) {
        test(`${view.name} wheel to the bottom shows the last item flush with the grid`, { annotation: [{ type: 'case', description: 'views.all-scroll-bottom' }] }, async ({ page }) => {
            const grid = await openView(page, view.path);
            const physical = await physicalRowCount(grid);
            const total = await grid.evaluate((g: any) => g.query.totalItems);
            expect(total).toBe(view.totalItems);

            await wheelGrid(page, grid, 0, 400000);
            await settle(grid);

            await expect.poll(async () => (await visibleRows(grid)).at(-1)!.index).toBe(total - 1);
            const rows = await visibleRows(grid);
            const last = rows.at(-1)!;
            const item = (await itemDisplay(grid, total - 1, ['FirstName', 'LastName']))!;
            expect(last.texts.slice(0, 2)).toEqual(item.values);

            const gridBox = await box(grid);
            const lastBox = (await rowBoxes(grid)).at(-1)!;
            if (total * 32 > gridBox.height)
                expect(Math.abs(lastBox.bottom - (gridBox.y + gridBox.height))).toBeLessThanOrEqual(1);
            else
                expect(lastBox.bottom).toBeLessThanOrEqual(gridBox.y + gridBox.height);

            await expectAligned(grid, 'bottom');
            expect(await physicalRowCount(grid)).toBe(physical);
        });

        test(`${view.name} vertical and horizontal scrolling close open popups`, { annotation: [{ type: 'case', description: 'views.all-scroll-closes-popups' }] }, async ({ page }) => {
            const grid = await openView(page, view.path);
            const rh = await rowHeight(grid);

            // Wheel near the bottom right of the body, away from the popups that open at the left
            const wheel = async (dx: number, dy: number) => {
                const at = await grid.evaluate((g: any) => {
                    const r = ([...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as HTMLElement).getBoundingClientRect();
                    return { x: r.right - 80, y: r.bottom - 40 };
                });
                await page.mouse.move(at.x, at.y);
                await page.mouse.wheel(dx, dy);
            };

            // Gender stays in view at both horizontal offsets the test alternates between
            const openers: [string, () => Promise<void>][] = [['header menu', () => openColumnMenu(grid, 'Gender')]];
            if (view.canFilter)
                openers.push(['column filter', async () => { await openFilter(grid, 'Gender'); }]);
            if (view.inline) {
                openers.push(['inline actions', async () => {
                    const row = await rowForItem(grid, (await visibleRows(grid))[0].index);
                    await row.locator('[part=actions]').click();
                    await expect(row.locator('[part=actions]')).toHaveAttribute('open', '');
                }]);
            }

            // PeopleTop10 has no vertical overflow, so a vertical wheel does not scroll it
            const directions: ('vertical' | 'horizontal')[] = view.totalItems > 100 ? ['vertical', 'horizontal'] : ['horizontal'];
            const sign = { vertical: 1, horizontal: 1 };
            for (const [name, open] of openers) {
                for (const direction of directions) {
                    await open();
                    await expect.poll(() => openPopups(grid), `${name} opened`).not.toEqual([]);

                    const before = await getScrollOffset(grid);
                    if (direction === 'vertical')
                        await wheel(0, sign.vertical * 100 * rh);
                    else
                        await wheel(sign.horizontal * 300, 0);
                    sign[direction] *= -1;

                    await expect.poll(async () => {
                        const now = await getScrollOffset(grid);
                        return direction === 'vertical' ? now.top !== before.top : now.left !== before.left;
                    }, `${name}: ${direction} scroll`).toBe(true);
                    await expect.poll(() => openPopups(grid), `${name} after a ${direction} scroll`).toEqual([]);
                    await settle(grid);
                }
            }
        });

        test(`${view.name} jumping to the middle shows the right items once loaded`, { annotation: [{ type: 'case', description: 'views.all-scroll-middle-resolves' }] }, async ({ page }) => {
            const grid = await openView(page, view.path);
            const expectedStart = view.totalItems > 5000 ? 5000 : 0;

            await wheelGrid(page, grid, 0, 160000);

            await expect.poll(async () => {
                const rows = await visibleRows(grid);
                const problems: string[] = [];
                for (let j = 0; j < rows.length; j++) {
                    const item = await itemDisplay(grid, expectedStart + j, ['FirstName', 'LastName']);
                    if (rows[j].index !== expectedStart + j)
                        problems.push(`row ${j}: index ${rows[j].index}`);
                    else if (!item || !rows[j].texts[0] || rows[j].texts.slice(0, 2).join(' ') !== item.values.join(' '))
                        problems.push(`row ${j}: '${rows[j].texts.slice(0, 2).join(' ')}'`);
                }

                return rows.length ? problems : ['no rows'];
            }, { timeout: 3000 }).toEqual([]);
        });
    }
});
