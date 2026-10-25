import { test, expect, Locator } from '@playwright/test';
import { gridPage, mountGrid, getScrollOffset, scrollGrid, requestLog, nextFrames, pageErrors } from '../_helpers/query-grid';
import { attachGrid, clickGroupingMenuItem, hostVar, rows, settle } from '../_helpers/grid';

const RH = 32;
const GROUPS = 56;
const GROUPED_ROWS = 10000 + GROUPS;

async function groupByBirthDate(grid: Locator) {
    await grid.evaluate(async (g: any) => { await g.query.group('BirthDate'); });
    await expect(grid).toHaveAttribute('has-grouping');
    await settle(grid);
}

async function rowAtPosition(grid: Locator, position: number) {
    return (await rows(grid)).find(r => r.position === position);
}

/** Clicks the visible group header row whose label starts with the group name. */
async function clickGroup(grid: Locator, name: string) {
    const index = await grid.evaluate((g: any, name) => [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].findIndex((r: any) => {
        if (!r.hasAttribute('is-group') || r.classList.contains('hidden') || getComputedStyle(r).display === 'none')
            return false;

        const group = r.querySelector('vi-query-grid-row-group') ?? r.shadowRoot?.querySelector('vi-query-grid-row-group');
        return (group?.shadowRoot?.querySelector('label')?.textContent ?? '').trim().startsWith(`${name} (`);
    }), name);
    expect(index, `group row ${name}`).toBeGreaterThanOrEqual(0);

    await grid.locator('vi-query-grid-row').nth(index).locator('vi-query-grid-row-group').click();
}

test.describe('Grouping', () => {
    test('grouping reflects has-grouping and shows the grouping control', { annotation: [{ type: 'case', description: 'grid.grp-attr-controls' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        await groupByBirthDate(grid);
        await expect(grid.locator('.controls vi-query-grid-grouping')).toBeVisible();

        await grid.evaluate(async (g: any) => { await g.query.group(''); });
        await expect(grid).not.toHaveAttribute('has-grouping');
        await expect(grid.locator('.controls vi-query-grid-grouping')).toBeHidden();
    });

    test('first rows are a group header followed by its items', { annotation: [{ type: 'case', description: 'grid.grp-first-rows' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await groupByBirthDate(grid);

        const first = await rowAtPosition(grid, 0);
        expect(first).toMatchObject({ isGroup: true, groupLabel: '1945 (166)' });
        expect((await rowAtPosition(grid, 1))?.index).toBe(0);

        await scrollGrid(grid, { top: 150 * RH });
        await settle(grid);
        expect((await rowAtPosition(grid, 166))?.index).toBe(165);
    });

    test('rows map to items across group boundaries', { annotation: [{ type: 'case', description: 'grid.grp-boundary-mapping' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await groupByBirthDate(grid);

        await scrollGrid(grid, { top: 167 * RH });
        await settle(grid);
        expect(await rowAtPosition(grid, 167)).toMatchObject({ isGroup: true, groupLabel: '1946 (184)' });
        expect((await rowAtPosition(grid, 168))?.index).toBe(166);
    });

    test('grouped scroll height counts group headers', { annotation: [{ type: 'case', description: 'grid.grp-spacer' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await groupByBirthDate(grid);

        expect(await grid.evaluate((g: any) => [g.query.groupingInfo.groups.length, g.query.groupingInfo.groups.some((x: any) => x.isCollapsed)])).toEqual([GROUPS, false]);
        await expect.poll(async () => (await getScrollOffset(grid)).scrollHeight).toBe(GROUPED_ROWS * RH);
    });

    test('collapsing a group removes its items', { annotation: [{ type: 'case', description: 'grid.grp-collapse-one' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await groupByBirthDate(grid);
        const log = requestLog(page);

        const group = grid.locator('vi-query-grid-row[is-group] vi-query-grid-row-group').first();
        await group.click();
        await expect(group).toHaveAttribute('collapsed');

        await settle(grid);
        expect(await rowAtPosition(grid, 0)).toMatchObject({ isGroup: true, collapsed: true, groupLabel: '1945 (166)' });
        expect(await rowAtPosition(grid, 1)).toMatchObject({ isGroup: true, groupLabel: '1946 (184)' });
        expect((await rowAtPosition(grid, 2))?.index).toBe(166);
        expect((await getScrollOffset(grid)).scrollHeight).toBe((GROUPED_ROWS - 166) * RH);

        // Collapsing does not search again; only the next page of items is loaded lazily
        await log.quiet();
        log.of('ExecuteQuery').forEach(r => expect(r.skip, 'lazy page load only').toBeGreaterThan(0));
    });

    test('the scroll range ends at the last expanded group after collapsing the groups above it', { annotation: [{ type: 'case', description: 'grid.grp-collapse-scroll-range' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await grid.evaluate(async (g: any) => { await g.query.group('Gender'); });
        await expect(grid).toHaveAttribute('has-grouping');
        await settle(grid);

        const counts: Record<string, number> = await grid.evaluate((g: any) => Object.fromEntries(g.query.groupingInfo.groups.map((x: any) => [x.name, x.count])));
        expect(Object.keys(counts)).toEqual(['Female', 'Male', 'Unknown']);

        await clickGroup(grid, 'Female');
        await settle(grid);
        await clickGroup(grid, 'Male');
        await settle(grid);

        const visibleRows = 3 + counts.Unknown;
        await expect.poll(async () => (await getScrollOffset(grid)).scrollHeight).toBe(visibleRows * RH);

        // The thumb maps onto the collapsed scroll range, though nothing scrolled since the collapse
        const thumb = await grid.evaluate((g: any) => {
            const vs = [...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any;
            const b = vs.shadowRoot.querySelector('#vertical').getBoundingClientRect();
            return { x: b.left + b.width / 2, y: b.top + b.height / 2, height: b.height, track: vs.scroller.clientHeight };
        });
        await page.mouse.move(thumb.x, thumb.y);
        await page.mouse.down();
        await page.mouse.move(thumb.x, thumb.y + 100, { steps: 5 });
        const dragged = await getScrollOffset(grid);
        expect(Math.abs(dragged.top - 100 * (visibleRows * RH - dragged.height) / (thumb.track - thumb.height))).toBeLessThanOrEqual(RH);
        await page.mouse.move(thumb.x, thumb.y + thumb.track, { steps: 5 });
        await page.mouse.up();
        await settle(grid);

        const offset = await getScrollOffset(grid);
        expect(offset.top).toBe(visibleRows * RH - offset.height);

        const all = await rows(grid, { all: true });
        const shown = all.filter(r => r.height > 0 && !r.loading);
        const last = shown[shown.length - 1];
        expect(last.position).toBe(visibleRows - 1);
        expect(last.index).toBe(9999);
        const view = await grid.evaluate((g: any) => ([...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any).scroller.getBoundingClientRect().bottom);
        expect(Math.abs(last.bottom - view)).toBeLessThanOrEqual(1);

        await scrollGrid(grid, { top: 0 });
        await settle(grid);
        await clickGroup(grid, 'Male');
        await settle(grid);
        await expect.poll(async () => (await getScrollOffset(grid)).scrollHeight).toBe((visibleRows + counts.Male) * RH);
        await clickGroup(grid, 'Female');
        await settle(grid);
        await expect.poll(async () => (await getScrollOffset(grid)).scrollHeight).toBe((10000 + 3) * RH);
    });

    test('Collapse all scrolls to top and leaves only group headers', { annotation: [{ type: 'case', description: 'grid.grp-collapse-all' }] }, async ({ page }) => {
        await gridPage(page, { height: 1900 });
        const grid = await mountGrid(page);
        await groupByBirthDate(grid);

        await scrollGrid(grid, { top: 2000 });
        await settle(grid);
        const log = requestLog(page);

        await clickGroupingMenuItem(grid, 'QueryGrid_Group_Collapse');
        await expect.poll(async () => (await getScrollOffset(grid)).top).toBe(0);
        expect(await grid.evaluate((g: any) => g.query.groupingInfo.groups.every((x: any) => x.isCollapsed))).toBe(true);

        await settle(grid);
        const visible = await rows(grid);
        expect(visible).toHaveLength(GROUPS);
        visible.forEach((r, i) => {
            expect(r.isGroup).toBe(true);
            expect(r.collapsed).toBe(true);
            expect(r.groupLabel!.startsWith(`${1945 + i} (`), r.groupLabel!).toBe(true);
        });

        const offset = await getScrollOffset(grid);
        expect(offset.scrollHeight).toBe(Math.max(GROUPS * RH, offset.height));

        await log.quiet();
        expect(log.of('ExecuteQuery')).toHaveLength(0);
    });

    test('Expand all restores all rows and scrolls to top', { annotation: [{ type: 'case', description: 'grid.grp-expand-all' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await groupByBirthDate(grid);
        const log = requestLog(page);

        await clickGroupingMenuItem(grid, 'QueryGrid_Group_Collapse');
        await expect.poll(() => grid.evaluate((g: any) => g.query.groupingInfo.groups.every((x: any) => x.isCollapsed))).toBe(true);
        await scrollGrid(grid, { top: 500 });

        await clickGroupingMenuItem(grid, 'QueryGrid_Group_Expand');
        await expect.poll(() => grid.evaluate((g: any) => g.query.groupingInfo.groups.some((x: any) => x.isCollapsed))).toBe(false);
        await expect.poll(async () => (await getScrollOffset(grid)).top).toBe(0);
        await settle(grid);

        expect((await getScrollOffset(grid)).scrollHeight).toBe(GROUPED_ROWS * RH);
        expect((await rowAtPosition(grid, 1))?.index).toBe(0);

        await log.quiet();
        expect(log.of('ExecuteQuery')).toHaveLength(0);
    });

    test('Remove grouping returns to flat rows', { annotation: [{ type: 'case', description: 'grid.grp-remove' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await groupByBirthDate(grid);
        const log = requestLog(page);

        await clickGroupingMenuItem(grid, 'Remove');
        await expect(grid).not.toHaveAttribute('has-grouping');
        await settle(grid);
        await log.quiet();

        expect(log.of('ExecuteQuery')).toHaveLength(1);
        expect(await grid.evaluate((g: any) => g.query.groupingInfo == null)).toBe(true);
        await expect(grid.locator('vi-query-grid-grouping')).toBeHidden();
        expect(await grid.evaluate((g: any) => [...g.shadowRoot.querySelectorAll('vi-query-grid-row-group')].filter((e: any) => e.checkVisibility()).length)).toBe(0);
        expect((await rows(grid)).some(r => r.isGroup)).toBe(false);
        expect((await rowAtPosition(grid, 0))?.index).toBe(0);
        expect((await getScrollOffset(grid)).scrollHeight).toBe(10000 * RH);
    });

    test('items after a collapsed middle group map correctly', { annotation: [{ type: 'case', description: 'grid.grp-mapping-after-collapse' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await groupByBirthDate(grid);

        await scrollGrid(grid, { top: 167 * RH });
        await settle(grid);
        await clickGroup(grid, '1946');

        await expect.poll(() => grid.evaluate((g: any) => g.query.groupingInfo.groups[1].isCollapsed)).toBe(true);
        await settle(grid);
        expect(await rowAtPosition(grid, 167)).toMatchObject({ isGroup: true, collapsed: true, groupLabel: '1946 (184)' });
        expect(await rowAtPosition(grid, 168)).toMatchObject({ isGroup: true, collapsed: false });
        expect((await rowAtPosition(grid, 168))!.groupLabel!.startsWith('1947 (')).toBe(true);
        expect((await rowAtPosition(grid, 169))?.index).toBe(350);
    });

    test('striping counts group rows', { annotation: [{ type: 'case', description: 'grid.grp-zebra' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await grid.evaluate(async (g: any) => { await g.query.group('Gender'); });
        await expect(grid).toHaveAttribute('has-grouping');
        await settle(grid);

        // Collapse the first group so the second group header sits at index 1 and its items start at index 2
        await clickGroup(grid, 'Female');
        await settle(grid);
        await page.mouse.move(0, 0);

        const visible = await rows(grid);
        expect(visible[0]).toMatchObject({ position: 0, isGroup: true, collapsed: true });
        expect(visible[1]).toMatchObject({ position: 1, isGroup: true, collapsed: false });

        const items = visible.filter(r => !r.isGroup);
        expect(items.length).toBeGreaterThan(5);
        items.forEach(r => expect(r.background, `index ${r.position}`).toBe(r.position % 2 === 0 ? 'rgb(250, 250, 250)' : 'rgb(255, 255, 255)'));
    });

    test('a jump inside a group loads the page of the query index', { annotation: [{ type: 'case', description: 'grid.grp-lazy-within-group' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await groupByBirthDate(grid);
        const log = requestLog(page);

        // Every group above the item adds its header row
        const position = await grid.evaluate((g: any) => 5000 + g.query.groupingInfo.groups.findIndex((x: any) => x.start <= 5000 && 5000 < x.end) + 1);
        await scrollGrid(grid, { top: position * RH });
        await settle(grid);
        await log.quiet();

        // The pages come from the query index of the rows in view (the row window may start one row above
        // items[5000], so page 49 can be part of the request), never from the grid position
        const requested = new Map<number, number>();
        for (const r of log.of('ExecuteQuery')) {
            for (let i = r.skip!; i < r.skip! + r.top!; i++)
                requested.set(i, (requested.get(i) ?? 0) + 1);
        }
        expect(requested.get(5000)).toBe(1);
        expect([...requested.values()].every(n => n === 1)).toBe(true);
        expect(Math.min(...requested.keys())).toBeGreaterThanOrEqual(4900);
        expect(Math.max(...requested.keys())).toBeLessThan(5100);
        expect((await rowAtPosition(grid, position))?.index).toBe(5000);
    });

    test('collapsed state survives a refresh', { annotation: [{ type: 'case', description: 'grid.grp-collapsed-kept-on-refresh' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await groupByBirthDate(grid);

        await clickGroup(grid, '1945');
        await expect.poll(() => grid.evaluate((g: any) => g.query.groupingInfo.groups[0].isCollapsed)).toBe(true);

        await grid.evaluate(async (g: any) => { await g.query.search(); });
        await settle(grid);

        expect(await grid.evaluate((g: any) => g.query.groupingInfo.groups[0].isCollapsed)).toBe(true);
        expect(await rowAtPosition(grid, 0)).toMatchObject({ isGroup: true, collapsed: true, groupLabel: '1945 (166)' });
        expect(await rowAtPosition(grid, 1)).toMatchObject({ isGroup: true, groupLabel: '1946 (184)' });
        expect((await rowAtPosition(grid, 2))?.index).toBe(166);
    });

    test('collapsed groups survive a lazy page load', { annotation: [{ type: 'case', description: 'gap.grid-grouped-lazy-load-keeps-collapsed' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await groupByBirthDate(grid);

        await scrollGrid(grid, { top: 167 * RH });
        await settle(grid);
        await clickGroup(grid, '1946');
        await expect.poll(() => grid.evaluate((g: any) => g.query.groupingInfo.groups[1].isCollapsed)).toBe(true);
        await settle(grid);

        const log = requestLog(page);
        await log.quiet();
        log.clear();
        await scrollGrid(grid, { top: 6000 * RH });
        await settle(grid);
        await log.quiet();
        expect(log.of('ExecuteQuery')).toHaveLength(1);

        await scrollGrid(grid, { top: 167 * RH });
        await settle(grid);

        expect(await grid.evaluate((g: any) => g.query.groupingInfo.groups[1].isCollapsed)).toBe(true);
        expect(await rowAtPosition(grid, 167)).toMatchObject({ isGroup: true, collapsed: true, groupLabel: '1946 (184)' });
        expect((await rowAtPosition(grid, 168))!.groupLabel!.startsWith('1947 (')).toBe(true);
        expect((await rowAtPosition(grid, 169))?.index).toBe(350);
    });

    test('collapsing a group above the viewport re-maps rows', { annotation: [{ type: 'case', description: 'gap.grid-collapse-group-while-scrolled' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await groupByBirthDate(grid);

        await scrollGrid(grid, { top: 2000 * RH });
        await settle(grid);
        const before = await getScrollOffset(grid);
        const probe = (await rows(grid)).find(r => !r.isGroup && r.position >= 2002)!;
        const count = await grid.evaluate((g: any) => g.query.groupingInfo.groups[2].count);

        await grid.evaluate((g: any) => g.query.groupingInfo.groups[2].isCollapsed = true);
        await expect.poll(async () => (await getScrollOffset(grid)).scrollHeight).toBe(before.scrollHeight - count * RH);
        await settle(grid);

        expect((await getScrollOffset(grid)).top).toBe(before.top);

        // The rows below the collapsed group move up by its item count: the row at the probe's position now
        // shows the row that was count positions further down (an item, or a group header)
        const shifted = (position: number) => grid.evaluate((g: any, position) => {
            let p = 0;
            for (const group of g.query.groupingInfo.groups) {
                if (p === position)
                    return { isGroup: true, index: -1 };

                p++;
                if (!group.isCollapsed) {
                    if (position < p + group.count)
                        return { isGroup: false, index: group.start + position - p };

                    p += group.count;
                }
            }

            return null;
        }, position);

        const expected = await shifted(probe.position);
        expect(expected).not.toBeNull();
        expect(expected!.index === -1 || expected!.index > probe.index).toBe(true);
        expect(await rowAtPosition(grid, probe.position)).toMatchObject({ ...expected, loading: false });
        for (const row of await rows(grid))
            expect(row, `position ${row.position}`).toMatchObject({ ...(await shifted(row.position)), loading: false });
    });

    test('grouping an empty result', { annotation: [{ type: 'case', description: 'gap.grid-group-empty-result' }] }, async ({ page }) => {
        const errors = pageErrors(page);
        await gridPage(page);
        const { grid } = await attachGrid(page, { textSearch: 'zzzzqqq' });
        await expect(grid).not.toHaveAttribute('initializing');
        const controlsWidth = await hostVar(grid, '--vi-query-grid-controls-width');

        await grid.evaluate(async (g: any) => { await g.query.group('Gender'); });
        await expect(grid).toHaveAttribute('has-grouping');
        await expect(grid.locator('.controls vi-query-grid-grouping')).toBeVisible();
        await nextFrames(page, 2);
        expect(await rows(grid)).toEqual([]);
        let offset = await getScrollOffset(grid);
        expect(offset.scrollHeight).toBe(offset.height);

        await grid.evaluate(async (g: any) => { await g.query.group(''); });
        await expect(grid).not.toHaveAttribute('has-grouping');
        await expect(grid.locator('.controls vi-query-grid-grouping')).toBeHidden();
        await expect.poll(() => hostVar(grid, '--vi-query-grid-controls-width')).toBe(controlsWidth);
        await nextFrames(page, 2);
        expect(await rows(grid)).toEqual([]);
        offset = await getScrollOffset(grid);
        expect(offset.scrollHeight).toBe(offset.height);
        expect(errors).toEqual([]);
    });

    test('group header label stays put on horizontal scroll', { annotation: [{ type: 'case', description: 'grid.grp-header-fixed-horizontally' }] }, async ({ page }) => {
        await gridPage(page, { width: 600 });
        const grid = await mountGrid(page);
        await grid.evaluate(async (g: any) => { await g.query.group('Gender'); });
        await expect(grid).toHaveAttribute('has-grouping');
        await settle(grid);

        const labelX = () => grid.evaluate((g: any) => {
            const row = g.shadowRoot.querySelector('vi-query-grid-row[is-group]');
            const group = row.querySelector('vi-query-grid-row-group') ?? row.shadowRoot?.querySelector('vi-query-grid-row-group');
            return group.shadowRoot.querySelector('label').getBoundingClientRect().left;
        });
        const before = await labelX();

        await scrollGrid(grid, { left: 300 });
        await expect.poll(async () => (await getScrollOffset(grid)).left).toBe(300);
        await settle(grid);
        expect(Math.abs(await labelX() - before)).toBeLessThanOrEqual(1);
    });
});
