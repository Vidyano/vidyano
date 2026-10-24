import { expect, Locator, Page, test } from '@playwright/test';
import { gridPage, mountGrid, waitForQueryIdle } from '../_helpers/query-grid';
import { clearItem, clickDistinct, columnFilter, filterButton, filterLabel, filterLog, filtersControl, filtersMenuItems, injectFilters, inverseButton, openFilter, openFiltersMenu, removeFilters, totalItems } from '../_helpers/filters';

const PEOPLE_COLUMNS = ['FirstName', 'LastName', 'BirthDate', 'Gender', 'ContactPreference', 'Email', 'PhoneNumber', 'EmergencyContact', 'IsActive'];

async function setup(page: Page) {
    await gridPage(page);
    return mountGrid(page);
}

test.describe('State and rendering', () => {
    test('disabled without saved filters or current filter', { annotation: [{ type: 'case', description: 'filters.fl-disabled-initial' }] }, async ({ page }) => {
        const grid = await setup(page);
        const control = filtersControl(grid);
        const button = control.locator('vi-popup-menu > vi-button[slot="header"]');

        await expect(control).toHaveAttribute('disabled');
        await expect(button).toHaveAttribute('disabled');
        await expect(button).toHaveAttribute('inverse');

        await button.click({ force: true });
        await expect(control.getByText('Reset', { exact: true })).toBeHidden();
        expect(await filtersMenuItems(grid)).toEqual([]);
    });

    test('reflects is-filtering and highlights the button', { annotation: [{ type: 'case', description: 'filters.fl-is-filtering' }] }, async ({ page }) => {
        const grid = await setup(page);
        const control = filtersControl(grid);
        const button = control.locator('vi-popup-menu > vi-button[slot="header"]');
        await expect(control).not.toHaveAttribute('is-filtering');
        await expect(button).toHaveAttribute('inverse');

        const cf = await openFilter(grid, 'Gender');
        await clickDistinct(cf, 'Female');
        await expect(control).toHaveAttribute('is-filtering');
        await expect(button).not.toHaveAttribute('inverse');

        await clearItem(cf).click();
        await waitForQueryIdle(grid);
        await expect(control).not.toHaveAttribute('is-filtering');
        await expect(button).toHaveAttribute('inverse');
    });

    test('filters button is a row-height square', { annotation: [{ type: 'case', description: 'filters.fl-render-size' }] }, async ({ page }) => {
        const grid = await setup(page);
        const rowHeight = await grid.evaluate((g: Element) => parseFloat(getComputedStyle(g).getPropertyValue('--vi-query-grid-row-height')));
        expect(rowHeight).toBeGreaterThan(0);

        const control = filtersControl(grid);
        for (const box of [await control.boundingBox(), await control.locator('vi-popup-menu > vi-button[slot="header"]').boundingBox()]) {
            expect(Math.abs(box!.width - rowHeight)).toBeLessThanOrEqual(1);
            expect(Math.abs(box!.height - rowHeight)).toBeLessThanOrEqual(1);
        }
    });

    test('hidden but space-keeping without a filters object', { annotation: [{ type: 'case', description: 'filters.fl-hidden-no-filters' }] }, async ({ page }) => {
        await gridPage(page);
        await removeFilters(page);
        const grid = await mountGrid(page);
        expect(await grid.evaluate((g: any) => g.query.filters)).toBeFalsy();

        const control = filtersControl(grid);
        await expect(control).toHaveAttribute('hidden');

        const rowHeight = await grid.evaluate((g: Element) => parseFloat(getComputedStyle(g).getPropertyValue('--vi-query-grid-row-height')));
        const box = (await control.boundingBox())!;
        expect(Math.abs(box.width - rowHeight)).toBeLessThanOrEqual(1);
        expect(Math.abs(box.height - rowHeight)).toBeLessThanOrEqual(1);
        await expect(control.locator('vi-popup-menu')).toHaveCSS('visibility', 'hidden');
    });
});

test.describe('Unsaved filter menu', () => {
    test('column selection enables a menu with Reset and Save As only', { annotation: [{ type: 'case', description: 'filters.fl-enabled-after-column-filter' }] }, async ({ page }) => {
        const grid = await setup(page);
        const cf = await openFilter(grid, 'Gender');
        await clickDistinct(cf, 'Female');
        await expect(filtersControl(grid)).not.toHaveAttribute('disabled');

        await openFiltersMenu(grid);
        await expect(filtersControl(grid).getByText('Reset', { exact: true })).toBeVisible();

        const items = await filtersMenuItems(grid);
        expect(items.map(i => ({ tag: i.tag, label: i.label, icon: i.icon }))).toEqual([
            { tag: 'vi-popup-menu-item', label: 'Reset', icon: 'Filter_Reset' },
            { tag: 'vi-popup-menu-item', label: 'Save As...', icon: 'Filter_Save' }
        ]);
    });

    test('Reset clears every column, closes the menu and re-queries', { annotation: [{ type: 'case', description: 'filters.fl-reset' }] }, async ({ page }) => {
        await gridPage(page);
        const log = filterLog(page);
        const grid = await mountGrid(page);

        const gender = await openFilter(grid, 'Gender');
        await clickDistinct(gender, 'Female');
        await inverseButton(gender).click();
        await expect(gender).not.toHaveAttribute('loading');
        await expect.poll(() => filterLabel(gender)).toBe('≠ Female');

        const isActive = await openFilter(grid, 'IsActive');
        await clickDistinct(isActive, 'Yes');
        await waitForQueryIdle(grid);
        await log.quiet();
        log.clear();

        await openFiltersMenu(grid);
        const reset = filtersControl(grid).getByText('Reset', { exact: true });
        await reset.click();
        await expect(reset).toBeHidden();

        await waitForQueryIdle(grid);
        const state = await grid.evaluate((g: any) => ({
            columns: g.query.columns.map((c: any) => ({ name: c.name, selected: c.selectedDistincts.length, inversed: !!c.selectedDistinctsInversed })),
            currentFilter: g.query.filters.currentFilter
        }));
        expect(state.columns.every(c => c.selected === 0 && !c.inversed)).toBe(true);
        expect(state.currentFilter).toBeNull();

        for (const name of PEOPLE_COLUMNS)
            await expect.poll(() => filterLabel(columnFilter(grid, name))).toBe('');

        expect(await totalItems(grid)).toBe(10000);
        await expect(filtersControl(grid)).toHaveAttribute('disabled');

        await log.quiet();
        expect(log.queries()).toHaveLength(1);
    });

    test('after Reset distincts reload on the next open', { annotation: [{ type: 'case', description: 'filters.fl-reset-nulls-distincts' }] }, async ({ page }) => {
        await gridPage(page);
        const log = filterLog(page);
        const grid = await mountGrid(page);

        const gender = await openFilter(grid, 'Gender');
        await clickDistinct(gender, 'Female');
        await waitForQueryIdle(grid);
        await filterButton(gender).click();
        await expect(clearItem(gender)).toBeHidden();
        await log.quiet();
        const before = log.refreshes('Gender').length;
        expect(before).toBeGreaterThanOrEqual(1);

        await openFiltersMenu(grid);
        await filtersControl(grid).getByText('Reset', { exact: true }).click();
        await waitForQueryIdle(grid);
        await log.quiet();
        expect(log.refreshes('Gender')).toHaveLength(before);

        await openFilter(grid, 'Gender');
        await log.quiet();
        expect(log.refreshes('Gender')).toHaveLength(before + 1);
    });
});

/** Visible filters menu items as 'separator', or '<label>' plus ' [locked]' for entries without edit/delete. */
async function menuSummary(grid: Locator) {
    return (await filtersMenuItems(grid)).map(i => {
        if (i.tag === 'vi-popup-menu-item-separator')
            return 'separator';

        return i.tag === 'vi-popup-menu-item-split' ? `${i.label} [locked]` : i.label;
    });
}

/** Clicks the label part of a filters menu entry. */
async function clickEntry(grid: Locator, label: string) {
    const entry = filtersControl(grid).locator('vi-popup-menu-item-with-actions, vi-popup-menu-item-split').filter({ visible: true }).filter({ hasText: label }).first();
    const box = (await entry.boundingBox())!;
    await entry.click({ position: { x: 40, y: box.height / 2 } });
}

/** Closes the filters menu if it is still open (loading a filter does not close it, see fl-load-menu-stays-open). */
async function closeFiltersMenu(grid: Locator) {
    // Clicking the menu button of an open menu closes it, with its open sub menus
    if (await filtersControl(grid).locator('vi-popup[open]').count() > 0)
        await filtersControl(grid).locator('vi-popup-menu > vi-button[slot="header"]').click();

    await expect(filtersControl(grid).locator('vi-popup[open]')).toHaveCount(0);
}

const FEMALE = [{ name: 'Gender', includes: ['|Female'], excludes: [] }];

test.describe('Saved filter list', () => {
    test('filter with an empty name is not listed', { annotation: [{ type: 'case', description: 'filters.fl-empty-name-skipped' }] }, async ({ page }) => {
        await gridPage(page);
        await injectFilters(page, [{ name: '' }, { name: 'pw-visible', columns: FEMALE }]);
        const grid = await mountGrid(page);
        expect(await grid.evaluate((g: any) => g.query.filters.filters.map((f: any) => f.name))).toEqual(['', 'pw-visible']);

        await openFiltersMenu(grid);
        await expect(filtersControl(grid).getByText('pw-visible', { exact: true })).toBeVisible();
        const items = await filtersMenuItems(grid);
        expect(items.filter(i => i.tag !== 'vi-popup-menu-item-separator').map(i => i.label)).toEqual(['pw-visible']);
    });
});

test.describe('Locked filters', () => {
    test('locked filters list after user filters without edit or delete', { annotation: [{ type: 'case', description: 'filters.fl-locked-filters' }] }, async ({ page }) => {
        await gridPage(page);
        await injectFilters(page, [
            { name: 'Locked A', isLocked: true, columns: FEMALE },
            { name: 'G\nL', isLocked: true, columns: [{ name: 'Gender', includes: ['|Male'], excludes: [] }] },
            { name: 'pw-user', columns: FEMALE }
        ]);
        const grid = await mountGrid(page);

        await openFiltersMenu(grid);
        await expect(filtersControl(grid).getByText('pw-user', { exact: true })).toBeVisible();
        expect(await menuSummary(grid)).toEqual(['pw-user', 'separator', 'G', 'Locked A [locked]']);

        const items = await filtersMenuItems(grid);
        expect(items.find(i => i.label === 'pw-user')!.buttons).toEqual(['Action_Edit', 'Action_Delete']);
        expect(items.find(i => i.label === 'Locked A')!.buttons).toEqual([]);
        expect(items.find(i => i.label === 'G')!.icon).toBe('Folder');

        // The locked child sits inside its folder
        const folder = filtersControl(grid).locator('vi-popup-menu-item[icon="Folder"]').filter({ hasText: 'G' }).first();
        await folder.hover();
        const child = filtersControl(grid).locator('vi-popup-menu-item-split').filter({ hasText: /^\s*L\s*$/ });
        await expect(child).toBeVisible();
        await expect(child.locator('vi-button[icon="Action_Edit"], vi-button[icon="Action_Delete"]')).toHaveCount(0);

        // Clicking a locked filter loads it
        await page.mouse.move(0, 0);
        await clickEntry(grid, 'Locked A');
        await waitForQueryIdle(grid);
        expect(await grid.evaluate((g: any) => g.query.filters.currentFilter?.name)).toBe('Locked A');
        await expect.poll(() => filterLabel(columnFilter(grid, 'Gender'))).toBe('= Female');
        expect(await totalItems(grid)).toBe(4587);
    });

    test('locked separator shows only when something precedes it', { annotation: [{ type: 'case', description: 'gap.fl-locked-separator' }] }, async ({ page, browser }) => {
        await gridPage(page);
        await injectFilters(page, [{ name: 'Locked A', isLocked: true, columns: FEMALE }]);
        const grid = await mountGrid(page);

        // Only locked filters and no current filter: no separator above them
        await openFiltersMenu(grid);
        await expect(filtersControl(grid).getByText('Locked A', { exact: true })).toBeVisible();
        expect(await menuSummary(grid)).toEqual(['Locked A [locked]']);

        // With a current filter (here the loaded locked filter), the separator separates Reset from the locked filters
        await clickEntry(grid, 'Locked A');
        await waitForQueryIdle(grid);
        expect(await grid.evaluate((g: any) => g.query.filters.currentFilter?.name)).toBe('Locked A');
        await closeFiltersMenu(grid);
        await openFiltersMenu(grid);
        await expect(filtersControl(grid).getByText('Reset', { exact: true })).toBeVisible();
        expect(await menuSummary(grid)).toEqual(['Reset', 'separator', 'Locked A [locked]']);

        // With a user filter and no current filter, the separator separates the user filters from the locked ones
        const other = await browser.newPage();
        try {
            await gridPage(other);
            await injectFilters(other, [{ name: 'Locked A', isLocked: true, columns: FEMALE }, { name: 'pw-user', columns: FEMALE }]);
            const otherGrid = await mountGrid(other);
            await openFiltersMenu(otherGrid);
            await expect(filtersControl(otherGrid).getByText('pw-user', { exact: true })).toBeVisible();
            expect(await menuSummary(otherGrid)).toEqual(['pw-user', 'separator', 'Locked A [locked]']);
        }
        finally {
            await other.close();
        }
    });

    test('locked current filter offers no Save', { annotation: [{ type: 'case', description: 'filters.fl-locked-no-save' }] }, async ({ page }) => {
        await gridPage(page);
        await injectFilters(page, [{ name: 'Locked A', isLocked: true, columns: FEMALE }]);
        const grid = await mountGrid(page);

        await openFiltersMenu(grid);
        await clickEntry(grid, 'Locked A');
        await waitForQueryIdle(grid);
        expect(await grid.evaluate((g: any) => g.query.filters.currentFilter?.name)).toBe('Locked A');

        await closeFiltersMenu(grid);
        await openFiltersMenu(grid);
        await expect(filtersControl(grid).getByText('Reset', { exact: true })).toBeVisible();
        const labels = (await filtersMenuItems(grid)).map(i => i.label);
        expect(labels).toContain('Reset');
        expect(labels.some(l => typeof l === 'string' && l.startsWith('Save'))).toBe(false);
    });

    test('user and locked filters both list folders first', { annotation: [{ type: 'case', description: 'gap.fl-locked-grouped-interleaved' }] }, async ({ page }) => {
        await gridPage(page);
        await injectFilters(page, [
            { name: 'pw-a', columns: FEMALE },
            { name: 'pw-b\nOne', columns: FEMALE },
            { name: 'pw-c', columns: FEMALE },
            { name: 'pw-a locked', isLocked: true, columns: FEMALE },
            { name: 'pw-b locked\nOne', isLocked: true, columns: FEMALE },
            { name: 'pw-c locked', isLocked: true, columns: FEMALE }
        ]);
        const log = filterLog(page);
        const grid = await mountGrid(page);

        await openFiltersMenu(grid);
        await expect(filtersControl(grid).getByText('pw-c locked', { exact: true })).toBeVisible();
        expect(await menuSummary(grid)).toEqual(['pw-b', 'pw-a', 'pw-c', 'separator', 'pw-b locked', 'pw-a locked [locked]', 'pw-c locked [locked]']);

        // Clicking the locked folder itself does nothing, like a user folder
        await waitForQueryIdle(grid);
        await log.quiet();
        log.clear();
        const folder = filtersControl(grid).locator('vi-popup-menu-item[icon="Folder"]').filter({ hasText: 'pw-b locked' }).first();
        await folder.click();
        await waitForQueryIdle(grid);
        await log.quiet();
        expect(await grid.evaluate((g: any) => g.query.filters.currentFilter ?? null)).toBeNull();
        expect(log.queries()).toHaveLength(0);
        await expect(filtersControl(grid).locator('vi-popup[open]').first()).toBeVisible();
    });
});
