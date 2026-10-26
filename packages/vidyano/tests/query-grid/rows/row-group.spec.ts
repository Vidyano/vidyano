import { expect, Locator, Page } from '@playwright/test';
import { getScrollOffset, gridPage, mountGrid, pageErrors, requestLog, test, visibleRows, waitForGridReady } from '../_helpers/query-grid';
import { groupRowOf, opens, rowHeight, scrollToRow, selectedIndexes, setSelected, spyTapAndOpen, taps } from '../_helpers/rows';

const case_ = (id: string) => ({ annotation: [{ type: 'case', description: id }] });

async function groupedGrid(page: Page, column = 'BirthDate', query = 'People') {
    await gridPage(page);
    const grid = await mountGrid(page, { query });
    await page.evaluate(async column => { await (window as any).q.group(column); }, column);
    await waitForGridReady(grid);
    await expect.poll(() => grid.evaluate((g: any) => !!g.query.groupingInfo?.groups?.length)).toBe(true);

    return grid;
}

/** `${group.name} (${group.items.length})` from the model. */
async function expectedLabel(grid: Locator, groupIndex: number) {
    return grid.evaluate((g: any, groupIndex) => {
        const group = g.query.groupingInfo.groups[groupIndex];
        return `${group.name} (${group.items.length})`;
    }, groupIndex);
}

async function header(grid: Locator, groupIndex: number) {
    return (await groupRowOf(grid, groupIndex)).locator('vi-query-grid-row-group');
}

async function isCollapsed(grid: Locator, groupIndex: number) {
    return grid.evaluate((g: any, groupIndex) => g.query.groupingInfo.groups[groupIndex].isCollapsed, groupIndex);
}

test.describe('vi-query-grid-row-group: rendering', () => {
    test('label shows the group name and item count (BirthDate)', case_('rows.grp-label'), async ({ page }) => {
        const grid = await groupedGrid(page);

        const expected = await expectedLabel(grid, 0);
        expect(expected).toBe('1945 (166)');
        await expect((await header(grid, 0)).locator('label')).toHaveText(expected);
        await expect((await header(grid, 0)).locator('label')).toBeVisible();
    });

    test('label shows the group name and item count (Gender)', case_('rows.grp-label'), async ({ page }) => {
        const grid = await groupedGrid(page, 'Gender');

        const names = await grid.evaluate((g: any) => g.query.groupingInfo.groups.map((group: any) => group.name));
        expect(names).toEqual(['Female', 'Male', 'Unknown']);

        // Collapse each group in turn so the next header scrolls into view
        for (let i = 0; i < names.length; i++) {
            const expected = await expectedLabel(grid, i);
            expect(expected).toMatch(new RegExp(`^${names[i]} \\(\\d+\\)$`));

            const groupHeader = await header(grid, i);
            await expect(groupHeader.locator('label')).toHaveText(expected);
            await expect(groupHeader.locator('label')).toBeVisible();
            if (i < names.length - 1) {
                await groupHeader.click();
                await expect.poll(() => isCollapsed(grid, i)).toBe(true);
                await waitForGridReady(grid);
            }
        }
    });
});

test.describe('vi-query-grid-row-group: collapse', () => {
    test('clicking the header toggles collapse both ways', case_('rows.grp-click-toggles'), async ({ page }) => {
        const grid = await groupedGrid(page);
        const groupHeader = await header(grid, 0);
        await expect(groupHeader).not.toHaveAttribute('collapsed', '');

        await groupHeader.click();
        await expect.poll(() => isCollapsed(grid, 0)).toBe(true);
        await expect(groupHeader).toHaveAttribute('collapsed', '');
        await waitForGridReady(grid);

        const collapsed = await visibleRows(grid);
        expect(collapsed[0].isGroup).toBe(true);
        expect(collapsed[1].isGroup).toBe(true);

        await (await header(grid, 0)).click();
        await expect.poll(() => isCollapsed(grid, 0)).toBe(false);
        await expect(await header(grid, 0)).not.toHaveAttribute('collapsed', '');
        await waitForGridReady(grid);

        const expanded = await visibleRows(grid);
        expect(expanded[0].isGroup).toBe(true);
        expect(expanded[1]).toMatchObject({ isGroup: false, index: 0 });
    });

    test('[collapsed] follows model changes', case_('rows.grp-collapsed-attr'), async ({ page }) => {
        const grid = await groupedGrid(page);
        const groupHeader = await header(grid, 0);
        await expect(groupHeader).not.toHaveAttribute('collapsed', '');

        await grid.evaluate((g: any) => g.query.groupingInfo.groups[0].isCollapsed = true);
        await expect(await header(grid, 0)).toHaveAttribute('collapsed', '');

        await grid.evaluate((g: any) => g.query.groupingInfo.groups[0].isCollapsed = false);
        await expect(await header(grid, 0)).not.toHaveAttribute('collapsed', '');
    });

    test('[collapsed] follows only the current group, also after a reconnect', case_('rows.grp-collapsed-follows-current-group'), async ({ page }) => {
        const grid = await groupedGrid(page, 'Gender');

        const states = await grid.evaluate(async (g: any) => {
            const [first, second] = g.query.groupingInfo.groups;
            const element = document.createElement('vi-query-grid-row-group') as any;
            document.body.appendChild(element);
            const collapsed = async () => {
                await element.updateComplete;
                return element.hasAttribute('collapsed');
            };

            const result: boolean[] = [];
            element.group = first;
            first.isCollapsed = true;
            result.push(await collapsed());

            element.group = second;
            result.push(await collapsed());
            second.isCollapsed = true;
            result.push(await collapsed());

            first.isCollapsed = false;
            result.push(await collapsed());

            element.remove();
            second.isCollapsed = false;
            document.body.appendChild(element);
            result.push(await collapsed());

            element.remove();
            second.isCollapsed = true;
            document.body.appendChild(element);
            result.push(await collapsed());

            element.remove();
            return result;
        });

        expect(states).toEqual([true, false, true, true, false, true]);
    });
});

test.describe('vi-query-grid-row-group: grid integration', () => {
    test('clicking a group header neither opens nor selects', case_('rows.grp-grid-click-no-open'), async ({ page }) => {
        const grid = await groupedGrid(page);
        await spyTapAndOpen(page);
        const log = requestLog(page);

        await setSelected(grid, 0, true);
        await expect.poll(() => selectedIndexes(grid)).toEqual([0]);

        await (await header(grid, 0)).click();
        await expect.poll(() => isCollapsed(grid, 0)).toBe(true);

        // Opening is async (GetPersistentObject first), so let the network settle to prove nothing was requested
        await log.quiet(300);
        expect(await taps(page)).toEqual([]);
        expect(await opens(page)).toEqual([]);
        expect(log.of('GetPersistentObject')).toEqual([]);
        expect(await selectedIndexes(grid)).toEqual([0]);
    });

    test('collapsed state survives row recycling', case_('rows.grp-grid-collapsed-survives-recycle'), async ({ page }) => {
        const grid = await groupedGrid(page);

        await (await header(grid, 0)).click();
        await expect.poll(() => isCollapsed(grid, 0)).toBe(true);
        await waitForGridReady(grid);

        await scrollGroupedTo(grid, 1000);
        await scrollGroupedTo(grid, 0);

        await expect(await header(grid, 0)).toHaveAttribute('collapsed', '');
        const visible = await visibleRows(grid);
        expect(visible[0].isGroup).toBe(true);
        expect(visible[1].isGroup).toBe(true);
        expect(await expectedLabel(grid, 1)).toMatch(/^1946 \(\d+\)$/);

        // The second visible row is the 1946 header
        const secondLabel = await grid.evaluate((g: any) => {
            const scroller = [...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any;
            const view = scroller.getBoundingClientRect();
            const shown = [...g.shadowRoot.querySelectorAll('vi-query-grid-row')]
                .map((r: any) => ({ r, b: r.getBoundingClientRect() }))
                .filter(({ r, b }) => getComputedStyle(r).display !== 'none' && b.height > 0 && b.bottom > view.top + 1 && b.top < view.bottom - 1)
                .sort((a, b) => a.b.top - b.b.top);

            const second = shown[1].r;
            return second.item === g.query.groupingInfo.groups[1] ? second.querySelector('vi-query-grid-row-group').shadowRoot.querySelector('label').textContent.trim() : null;
        });
        expect(secondLabel).toBe(await expectedLabel(grid, 1));
    });
});

test.describe('vi-query-grid-row-group: rendering details', () => {
    test('renders the group triangle icon', case_('rows.grp-icon'), async ({ page }) => {
        const grid = await groupedGrid(page);
        const icon = (await header(grid, 0)).locator('vi-icon[source=QueryGrid_Group_Row]');

        await expect(icon).toBeVisible();
        const rendered = await icon.evaluate((e: any) => {
            const box = e.getBoundingClientRect();
            const path = e.shadowRoot?.querySelector('svg path') ?? e.querySelector('svg path');
            const bbox = path?.getBBox();
            return { width: box.width, height: box.height, path: !!path, pathWidth: bbox?.width ?? 0, pathHeight: bbox?.height ?? 0 };
        });
        expect(rendered.width).toBeGreaterThan(0);
        expect(rendered.height).toBeGreaterThan(0);
        expect(rendered.path).toBe(true);
        expect(rendered.pathWidth).toBeGreaterThan(0);
        expect(rendered.pathHeight).toBeGreaterThan(0);
    });

    test('group header base style', case_('rows.grp-base-style'), async ({ page }) => {
        const grid = await groupedGrid(page);
        const groupHeader = await header(grid, 0);

        await expect(groupHeader).toHaveCSS('border-bottom-width', '1px');
        await expect(groupHeader).toHaveCSS('background-color', 'rgb(245, 245, 245)');
        await expect(groupHeader).toHaveCSS('cursor', 'pointer');
    });

    test('the first group header has no top border', case_('rows.grp-first-border'), async ({ page }) => {
        // Small groups, so the second header is rendered too
        const grid = await groupedGrid(page, 'Gender', 'PeopleTop10');

        expect(await grid.evaluate((g: any) => g.query.groupingInfo.groups[0].start)).toBe(0);
        await expect(await header(grid, 0)).toHaveCSS('border-top-width', '0px');
        await expect(await header(grid, 1)).toHaveCSS('border-top-width', '1px');
    });

    test('group icon and label follow --vi-query-grid-row-height', case_('rows.grp-height-follows-row-height'), async ({ page }) => {
        await gridPage(page, { styles: 'vi-query-grid { --vi-query-grid-row-height: 40px; }' });
        const grid = await mountGrid(page);
        await page.evaluate(async () => { await (window as any).q.group('BirthDate'); });
        await waitForGridReady(grid);
        await expect.poll(() => grid.evaluate((g: any) => getComputedStyle(g).getPropertyValue('--vi-query-grid-row-height').trim())).toBe('40px');

        const groupHeader = await header(grid, 0);
        await expect(groupHeader.locator('vi-icon[source=QueryGrid_Group_Row]')).toHaveCSS('height', '40px');
        await expect(groupHeader.locator('label')).toHaveCSS('line-height', '40px');
    });
});

test.describe('vi-query-grid-row-group: collapse details', () => {
    test('toggling bumps query.lastUpdated without requests', case_('rows.grp-click-notifies-query'), async ({ page }) => {
        // PeopleTop10 has every item loaded, so no lazy page load can follow the new layout
        const grid = await groupedGrid(page, 'Gender', 'PeopleTop10');
        const before = await grid.evaluate((g: any) => g.query.lastUpdated?.getTime() ?? null);
        expect(before).not.toBeNull();
        const log = requestLog(page);

        // lastUpdated has ms resolution: make sure the clock moved on
        await page.waitForFunction(before => Date.now() > before, before);
        await (await header(grid, 0)).click();
        await expect.poll(() => isCollapsed(grid, 0)).toBe(true);
        await expect.poll(() => grid.evaluate((g: any) => g.query.lastUpdated?.getTime())).toBeGreaterThan(before!);

        await log.quiet(300);
        expect(log.requests).toEqual([]);
    });

    test('the collapsed icon rotates -45deg', case_('rows.grp-collapsed-icon-rotation'), async ({ page }) => {
        const grid = await groupedGrid(page);
        const groupHeader = await header(grid, 0);
        const icon = groupHeader.locator('vi-icon[source=QueryGrid_Group_Row]');
        const transform = () => icon.evaluate((e: Element) => getComputedStyle(e).transform);
        expect(await transform()).toBe('none');

        await groupHeader.click();
        await expect(groupHeader).toHaveAttribute('collapsed', '');
        await expect.poll(async () => {
            const match = /^matrix\(([^)]+)\)$/.exec(await transform());
            return match ? match[1].split(',').map(v => Math.round(parseFloat(v) * 1000) / 1000) : null;
        }, { timeout: 1000 }).toEqual([0.707, -0.707, 0.707, 0.707, 0, 0]);

        await groupHeader.click();
        await expect(groupHeader).not.toHaveAttribute('collapsed', '');
        await expect.poll(transform, { timeout: 1000 }).toBe('none');
    });
});

test.describe('vi-query-grid-row-group: edge cases', () => {
    test('a null group name renders an empty name and the count', case_('gap.grp-null-name-label'), async ({ page }) => {
        const errors = pageErrors(page);
        await gridPage(page);
        const grid = await mountGrid(page);
        await page.route(/\/ExecuteQuery$/, async route => {
            const response = await route.fetch();
            const json = await response.json();
            const groups = json.result?.groupingInfo?.groups;
            if (groups?.length)
                groups[0].name = null;

            await route.fulfill({ response, json });
        });
        await page.evaluate(async () => { await (window as any).q.group('Gender'); });
        await waitForGridReady(grid);

        const group = await grid.evaluate((g: any) => {
            const group = g.query.groupingInfo.groups[0];
            return { name: group.name, count: group.items.length };
        });
        expect(group.name).toBeNull();
        expect(group.count).toBeGreaterThan(0);

        const label = (await header(grid, 0)).locator('label');
        await expect(label).toBeVisible();
        expect(await label.evaluate((e: Element) => e.textContent)).toBe(` (${group.count})`);
        expect(errors).toEqual([]);
    });

    test('double-clicking a header toggles twice without requests', case_('gap.grp-rapid-double-click'), async ({ page }) => {
        const errors = pageErrors(page);
        // PeopleTop10 has every item loaded, so a lazy page load cannot hide a request made by the toggle
        const grid = await groupedGrid(page, 'Gender', 'PeopleTop10');
        const snapshot = async () => (await visibleRows(grid)).map(r => ({ index: r.index, isGroup: r.isGroup, texts: r.texts }));
        const before = await snapshot();
        const log = requestLog(page);

        await (await header(grid, 0)).dblclick();
        await log.quiet(300);
        await waitForGridReady(grid);

        expect(await isCollapsed(grid, 0)).toBe(false);
        await expect(await header(grid, 0)).not.toHaveAttribute('collapsed', '');
        expect(await snapshot()).toEqual(before);
        expect(log.requests).toEqual([]);
        expect(errors).toEqual([]);
    });
});

/** Scrolls the grouped grid so row slot `index` is at the top (or as far as it goes) and waits for it to settle. */
async function scrollGroupedTo(grid: Locator, index: number) {
    await scrollToRow(grid, index);
    const target = Math.min(index * await rowHeight(grid), await grid.evaluate((g: any) => {
        const scroller = ([...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any).scroller as HTMLElement;
        return scroller.scrollHeight - scroller.clientHeight;
    }));
    await expect.poll(async () => (await getScrollOffset(grid)).top).toBeCloseTo(target, 0);
    await waitForGridReady(grid);
}
