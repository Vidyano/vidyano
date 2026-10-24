import { expect, Locator, Page, test, TestInfo } from '@playwright/test';
import { openView, VIEWS, waitForQueryIdle } from '../_helpers/query-grid';
import { clickDistinct, columnFilter, columnState, filterLabel, filterLog, filtersControl, filtersMenuItems, openFilter, openFiltersMenu, setSelectedDistincts, totalItems } from '../_helpers/filters';

/**
 * Saved filters are stored on the dev backend for the signed in user, so these tests run serially on one view
 * (QueryGrid_SelectAndFilter) and remove every 'pw-' filter they create.
 */
test.describe.configure({ mode: 'serial' });

let grid: Locator | undefined;

function filterName(testInfo: TestInfo, prefix = 'pw-') {
    return `${prefix}${testInfo.testId.slice(0, 8)}-${Date.now() % 100000}`;
}

async function deleteTestFilters(grid: Locator) {
    await grid.evaluate(async (g: any) => {
        const filters = g.query.filters;
        // 'pw-<id>' filters, grouped 'pwgrp-<id>\n…' filters and filters grouped under a test group
        for (const filter of filters.filters.filter((f: any) => /^pw|\npw-/.test(f.name ?? '')))
            await filters.delete(filter);
    });
    await waitForQueryIdle(grid);
}

async function open(page: Page) {
    grid = await openView(page, VIEWS.QueryGrid_SelectAndFilter);
    await deleteTestFilters(grid);

    return grid;
}

/** Saves a filter through the model with the given Gender values and makes it current. */
async function createFilter(grid: Locator, name: string, gender: string[], options: { inversed?: boolean; isDefault?: boolean } = {}) {
    await grid.evaluate(async (g: any, { name, gender, inversed, isDefault }) => {
        const filters = g.query.filters;
        const column = g.query.getColumn('Gender');
        column.selectedDistincts = gender;
        column.selectedDistinctsInversed = !!inversed;
        const filter = await filters.createNew();
        filter.persistentObject.beginEdit();
        filter.persistentObject.attributes.Name.setValue(name);
        if (isDefault)
            filter.persistentObject.attributes.IsDefault.setValue(true);
        if (!await filters.save(filter))
            throw new Error(`Could not save filter ${name}`);
    }, { name, gender, inversed: options.inversed, isDefault: options.isDefault });
    await waitForQueryIdle(grid);
}

/** Resets the filters through the menu, so no filter is current. */
async function resetFilters(grid: Locator) {
    await openFiltersMenu(grid);
    await filtersControl(grid).getByText('Reset', { exact: true }).click();
    await waitForQueryIdle(grid);
    await expect.poll(() => grid.evaluate((g: any) => g.query.filters.currentFilter)).toBeNull();
}

function notificationText(page: Page) {
    return filterDialog(page).locator('vi-notification').evaluate((n: Element) => (n.shadowRoot?.textContent ?? '').trim());
}

/** The folder entry of a filter group in the filters menu. */
function folderEntry(grid: Locator, group: string) {
    return filtersControl(grid).locator('vi-popup-menu-item[icon="Folder"]').filter({ hasText: group }).first();
}

function filterDialog(page: Page) {
    return page.locator('vi-query-grid-filter-dialog');
}

function footerButton(page: Page, label: string) {
    return filterDialog(page).locator('footer vi-button').filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) });
}

function menuEntry(grid: Locator, name: string) {
    return filtersControl(grid).locator('vi-popup-menu-item-with-actions').filter({ hasText: name });
}

/** Clicks the label part of a saved filter entry (the action buttons are on the right). */
async function loadEntry(grid: Locator, name: string) {
    const entry = menuEntry(grid, name);
    const box = (await entry.boundingBox())!;
    await entry.click({ position: { x: 40, y: box.height / 2 } });
}

async function saveAs(page: Page, grid: Locator) {
    await openFiltersMenu(grid);
    await filtersControl(grid).getByText('Save As...', { exact: true }).click();
    await expect(filterDialog(page).locator('dialog[open]')).toBeVisible();
}

async function selectFemale(grid: Locator) {
    const cf = await openFilter(grid, 'Gender');
    await clickDistinct(cf, 'Female');
    await waitForQueryIdle(grid);
    await expect.poll(() => grid.evaluate((g: any) => !!g.query.filters.currentFilter)).toBe(true);
}

test.afterEach(async () => {
    if (grid)
        await deleteTestFilters(grid).catch(() => {});

    grid = undefined;
});

test.describe('Save', () => {
    test('Save As... opens the filter dialog for a new filter', { annotation: [{ type: 'case', description: 'filters.fl-saveas-opens-dialog' }] }, async ({ page }) => {
        const grid = await open(page);
        await selectFemale(grid);

        const log = filterLog(page);
        await saveAs(page, grid);
        await log.quiet();

        expect(log.actions().map(r => r.action)).toEqual(['Query.New']);
        await expect(filterDialog(page).locator('input.name')).toHaveValue('');
        await expect(filterDialog(page).locator('vi-persistent-object-attribute-presenter[name="IsDefault"] vi-toggle')).not.toHaveAttribute('checked');
        expect(await filterDialog(page).evaluate((d: any) => d.persistentObject.attributes.IsDefault.value)).toBe(false);

        await footerButton(page, 'Cancel').click();
        await expect(filterDialog(page)).toHaveCount(0);
    });

    test('saving a new filter lists it and makes it current', { annotation: [{ type: 'case', description: 'filters.fl-saveas-saves' }] }, async ({ page }, testInfo) => {
        const grid = await open(page);
        const name = filterName(testInfo);
        await selectFemale(grid);

        await saveAs(page, grid);
        await filterDialog(page).locator('input.name').fill(name);
        await footerButton(page, 'Save').click();
        await expect(filterDialog(page)).toHaveCount(0);
        await waitForQueryIdle(grid);

        await openFiltersMenu(grid);
        await expect(menuEntry(grid, name)).toBeVisible();
        const items = await filtersMenuItems(grid);
        expect(items.map(i => i.tag === 'vi-popup-menu-item-separator' ? 'separator' : i.label)).toEqual(['Reset', `Save '${name}'`, 'Save As...', 'separator', name]);
        expect(items[items.length - 1].buttons).toEqual(['Action_Edit', 'Action_Delete']);

        const current = await grid.evaluate((g: any) => ({ name: g.query.filters.currentFilter?.name, isNew: g.query.filters.currentFilter?.persistentObject.isNew }));
        expect(current).toEqual({ name, isNew: false });
    });

    test("Save '<name>' stores the current columns into the loaded filter", { annotation: [{ type: 'case', description: 'filters.fl-save-current' }] }, async ({ page }, testInfo) => {
        const grid = await open(page);
        const name = filterName(testInfo);
        await createFilter(grid, name, ['|Female']);

        const gender = await openFilter(grid, 'Gender');
        await clickDistinct(gender, 'Female');
        await clickDistinct(gender, 'Male');
        await expect.poll(() => filterLabel(gender)).toBe('= Male');
        await waitForQueryIdle(grid);

        const log = filterLog(page);
        await openFiltersMenu(grid);
        await filtersControl(grid).getByText(`Save '${name}'`, { exact: true }).click();
        await waitForQueryIdle(grid);
        await log.quiet();
        expect(log.actions('PersistentObject.Save')).toHaveLength(1);

        await openFiltersMenu(grid);
        await filtersControl(grid).getByText('Reset', { exact: true }).click();
        await waitForQueryIdle(grid);
        await expect.poll(() => filterLabel(columnFilter(grid, 'Gender'))).toBe('');

        await openFiltersMenu(grid);
        await loadEntry(grid, name);
        await waitForQueryIdle(grid);
        await expect.poll(() => filterLabel(columnFilter(grid, 'Gender'))).toBe('= Male');
    });

    test("loaded saved filter offers Save '<name>' and an icon-less Save As", { annotation: [{ type: 'case', description: 'gap.fl-loaded-filter-menu-save-and-saveas' }] }, async ({ page }, testInfo) => {
        const grid = await open(page);
        const name = filterName(testInfo);
        await createFilter(grid, name, ['|Female']);
        expect(await grid.evaluate((g: any) => g.query.filters.currentFilter?.name)).toBe(name);

        await openFiltersMenu(grid);
        await expect(menuEntry(grid, name)).toBeVisible();
        const items = await filtersMenuItems(grid);
        expect(items.map(i => i.tag === 'vi-popup-menu-item-separator' ? 'separator' : i.label)).toEqual(['Reset', `Save '${name}'`, 'Save As...', 'separator', name]);
        expect(items[1].icon).toBe('Filter_Save');
        expect(items[2].icon).toBeNull();

        // Save As has an empty icon space, so its label lines up with Save's label
        const labelX = (label: string) => filtersControl(grid).locator('vi-popup-menu-item').filter({ visible: true }).filter({ hasText: label }).first()
            .evaluate((item: Element) => item.shadowRoot!.querySelector('.label')!.getBoundingClientRect().left);
        expect(Math.abs(await labelX('Save As...') - await labelX(`Save '${name}'`))).toBeLessThanOrEqual(1);

        const separator = filtersControl(grid).locator('vi-popup-menu-item-separator').filter({ visible: true });
        await expect(separator).toHaveCount(1);
        expect((await separator.boundingBox())!.height).toBeGreaterThan(0);
    });
});

test.describe('Saved filter list', () => {
    test('saved filters sort case-insensitively', { annotation: [{ type: 'case', description: 'filters.fl-list-sorted' }] }, async ({ page }, testInfo) => {
        const grid = await open(page);
        const id = filterName(testInfo, '');
        const [b, a, c] = [`pw-b${id}`, `pw-A${id}`, `pw-c${id}`];
        await createFilter(grid, b, ['|Female']);
        await createFilter(grid, a, ['|Male']);
        await createFilter(grid, c, ['|Unknown']);
        await resetFilters(grid);

        await openFiltersMenu(grid);
        await expect(menuEntry(grid, c)).toBeVisible();
        const labels = (await filtersMenuItems(grid)).map(i => i.label).filter(l => [a, b, c].includes(l));
        expect(labels).toEqual([a, b, c]);
    });

    test("'Group\\nName' filters form a folder before ungrouped ones", { annotation: [{ type: 'case', description: 'filters.fl-grouped-folder' }] }, async ({ page }, testInfo) => {
        const grid = await open(page);
        const group = filterName(testInfo, 'pwgrp-');
        const plain = filterName(testInfo, 'pw-plain-');
        await createFilter(grid, `${group}\nOne`, ['|Female']);
        await createFilter(grid, `${group}\nTwo`, ['|Male']);
        await createFilter(grid, plain, ['|Unknown']);
        await resetFilters(grid);

        await openFiltersMenu(grid);
        await expect(menuEntry(grid, plain)).toBeVisible();
        const items = await filtersMenuItems(grid);
        const folderIndex = items.findIndex(i => i.label === group);
        const plainIndex = items.findIndex(i => i.label === plain);
        expect(folderIndex).toBeGreaterThanOrEqual(0);
        expect(folderIndex).toBeLessThan(plainIndex);
        expect(items[folderIndex].icon).toBe('Folder');
        // The children are not listed at the top level
        expect(items.some(i => i.label === 'One' || i.label === 'Two')).toBe(false);

        await folderEntry(grid, group).hover();
        for (const child of ['One', 'Two']) {
            const entry = menuEntry(grid, child);
            await expect(entry).toBeVisible();
            await expect(entry.locator('vi-button[icon="Action_Edit"]')).toBeVisible();
            await expect(entry.locator('vi-button[icon="Action_Delete"]')).toBeVisible();
        }
    });

    test('clicking a folder item changes nothing', { annotation: [{ type: 'case', description: 'filters.fl-grouped-folder-click' }] }, async ({ page }, testInfo) => {
        const grid = await open(page);
        const group = filterName(testInfo, 'pwgrp-');
        await createFilter(grid, `${group}\nOne`, ['|Female']);
        await resetFilters(grid);

        const log = filterLog(page);
        await openFiltersMenu(grid);
        await folderEntry(grid, group).click();
        await waitForQueryIdle(grid);
        await log.quiet();

        expect(await grid.evaluate((g: any) => g.query.filters.currentFilter)).toBeNull();
        expect(log.queries()).toHaveLength(0);
        await expect.poll(() => filterLabel(columnFilter(grid, 'Gender'))).toBe('');
    });

    test('no separator before user filters without a current filter', { annotation: [{ type: 'case', description: 'filters.fl-separator-user' }] }, async ({ page }, testInfo) => {
        let grid = await open(page);
        const name = filterName(testInfo);
        await createFilter(grid, name, ['|Female']);

        // After a reload the saved filter is listed, but none is current
        grid = await openView(page, VIEWS.QueryGrid_SelectAndFilter);
        expect(await grid.evaluate((g: any) => g.query.filters.currentFilter)).toBeNull();
        await expect(filtersControl(grid)).not.toHaveAttribute('disabled');

        await openFiltersMenu(grid);
        await expect(menuEntry(grid, name)).toBeVisible();
        const items = await filtersMenuItems(grid);
        expect(items.some(i => i.tag === 'vi-popup-menu-item-separator')).toBe(false);
        expect(items.some(i => ['Reset', 'Save As...'].includes(i.label) || i.label?.startsWith('Save '))).toBe(false);
        expect(items.every(i => i.tag === 'vi-popup-menu-item-with-actions' || i.icon === 'Folder')).toBe(true);
        await expect(filtersControl(grid).locator('vi-popup-menu-item-separator').filter({ visible: true })).toHaveCount(0);
    });
});

test.describe('Load', () => {
    test('clicking a saved filter applies its columns', { annotation: [{ type: 'case', description: 'filters.fl-load-filter' }] }, async ({ page }, testInfo) => {
        const grid = await open(page);
        const name = filterName(testInfo);
        await createFilter(grid, name, ['|Female']);

        await openFiltersMenu(grid);
        await filtersControl(grid).getByText('Reset', { exact: true }).click();
        await waitForQueryIdle(grid);
        expect(await totalItems(grid)).toBe(10000);

        // A column that is not in the filter, selected without a search
        await setSelectedDistincts(grid, 'IsActive', ['4|TrueYes']);
        await expect.poll(() => filterLabel(columnFilter(grid, 'IsActive'))).toBe('= Yes');

        const log = filterLog(page);
        await openFiltersMenu(grid);
        await loadEntry(grid, name);
        await waitForQueryIdle(grid);
        await log.quiet();

        expect(await grid.evaluate((g: any) => g.query.filters.currentFilter?.name)).toBe(name);
        await expect.poll(() => filterLabel(columnFilter(grid, 'Gender'))).toBe('= Female');
        expect(await totalItems(grid)).toBe(4587);
        expect(log.queries()).toHaveLength(1);
        expect((await columnState(grid, 'IsActive')).selectedDistincts).toEqual([]);
        await expect.poll(() => filterLabel(columnFilter(grid, 'IsActive'))).toBe('');
    });

    test('saved exclude filter restores exclude mode', { annotation: [{ type: 'case', description: 'filters.fl-load-exclude' }] }, async ({ page }, testInfo) => {
        const grid = await open(page);
        const name = filterName(testInfo);
        await createFilter(grid, name, ['|Unknown'], { inversed: true });
        await resetFilters(grid);
        expect((await columnState(grid, 'Gender')).inversed).toBe(false);

        await openFiltersMenu(grid);
        await loadEntry(grid, name);
        await waitForQueryIdle(grid);

        await expect.poll(() => filterLabel(columnFilter(grid, 'Gender'))).toBe('≠ Unknown');
        expect(await columnState(grid, 'Gender')).toEqual({ selectedDistincts: ['|Unknown'], inversed: true });
        expect(await totalItems(grid)).toBe(9093);
    });

    test('clicking a grouped child loads it', { annotation: [{ type: 'case', description: 'filters.fl-grouped-child-load' }] }, async ({ page }, testInfo) => {
        const grid = await open(page);
        const group = filterName(testInfo, 'pwgrp-');
        await createFilter(grid, `${group}\nOne`, ['|Male']);
        await resetFilters(grid);

        await openFiltersMenu(grid);
        await folderEntry(grid, group).hover();
        await expect(menuEntry(grid, 'One')).toBeVisible();
        await loadEntry(grid, 'One');
        await waitForQueryIdle(grid);

        expect(await grid.evaluate((g: any) => g.query.filters.currentFilter?.name)).toBe(`${group}\nOne`);
        await expect.poll(() => filterLabel(columnFilter(grid, 'Gender'))).toBe('= Male');
        expect(await totalItems(grid)).toBe(4506);
    });
});

test.describe('Edit and delete', () => {
    test('delete asks for confirmation', { annotation: [{ type: 'case', description: 'filters.fl-delete-dialog' }] }, async ({ page }, testInfo) => {
        const grid = await open(page);
        const name = filterName(testInfo);
        await createFilter(grid, name, ['|Female']);

        await openFiltersMenu(grid);
        await menuEntry(grid, name).locator('vi-button[icon="Action_Delete"]').click();

        const dialog = page.locator('vi-message-dialog');
        await expect(dialog.locator('header h4')).toHaveText(name);
        await expect(dialog.locator('header vi-icon[source="Action_Delete"]')).toHaveCount(1);
        await expect(dialog.locator('main')).toHaveText(`Are you sure you want to delete filter '${name}'?`);

        const buttons = dialog.locator('footer vi-button');
        await expect(buttons).toHaveCount(2);
        await expect(buttons.nth(0)).toHaveText('Delete');
        await expect(buttons.nth(0)).toHaveAttribute('type', 'Danger');
        await expect(buttons.nth(1)).toHaveText('Cancel');

        await buttons.nth(1).click();
        await expect(dialog).toHaveCount(0);
        expect(await grid.evaluate((g: any, name) => g.query.filters.filters.some((f: any) => f.name === name), name)).toBe(true);
    });

    test('confirming delete removes the filter', { annotation: [{ type: 'case', description: 'filters.fl-delete-confirm' }] }, async ({ page }, testInfo) => {
        const grid = await open(page);
        const name = filterName(testInfo);
        await createFilter(grid, name, ['|Female']);
        expect(await grid.evaluate((g: any) => g.query.filters.currentFilter?.name)).toBe(name);

        const log = filterLog(page);
        await openFiltersMenu(grid);
        await menuEntry(grid, name).locator('vi-button[icon="Action_Delete"]').click();
        const dialog = page.locator('vi-message-dialog');
        await dialog.locator('footer vi-button').filter({ hasText: 'Delete' }).click();
        await expect(dialog).toHaveCount(0);

        await expect.poll(() => grid.evaluate((g: any, name) => g.query.filters.filters.some((f: any) => f.name === name), name)).toBe(false);
        await waitForQueryIdle(grid);
        await log.quiet();

        expect(await grid.evaluate((g: any) => g.query.filters.currentFilter)).toBeNull();
        expect(await grid.evaluate((g: any) => g.query.columns.every((c: any) => c.selectedDistincts.length === 0))).toBe(true);
        await expect.poll(() => filterLabel(columnFilter(grid, 'Gender'))).toBe('');
        // The Delete button click does not load the filter first: only the delete's clearing search is sent
        const queries = log.queries();
        expect(queries).toHaveLength(1);
        expect(queries[0].body.query.columns.every((c: any) => c.includes.length === 0 && c.excludes.length === 0)).toBe(true);
        await expect(filtersControl(grid)).toHaveAttribute('disabled');
        await expect(menuEntry(grid, name)).toBeHidden();
    });

    test('deleting a non-current filter sends no search', { annotation: [{ type: 'case', description: 'filters.fl-delete-confirm-noncurrent' }] }, async ({ page }, testInfo) => {
        const grid = await open(page);
        const deleted = filterName(testInfo);
        const kept = filterName(testInfo, 'pw-kept-');
        await createFilter(grid, deleted, ['|Female']);
        await createFilter(grid, kept, ['|Male']);
        expect(await grid.evaluate((g: any) => g.query.filters.currentFilter?.name)).toBe(kept);
        await expect.poll(() => filterLabel(columnFilter(grid, 'Gender'))).toBe('= Male');

        const log = filterLog(page);
        await openFiltersMenu(grid);
        await menuEntry(grid, deleted).locator('vi-button[icon="Action_Delete"]').click();
        const dialog = page.locator('vi-message-dialog');
        await dialog.locator('footer vi-button').filter({ hasText: 'Delete' }).click();
        await expect(dialog).toHaveCount(0);

        await expect.poll(() => grid.evaluate((g: any, name) => g.query.filters.filters.some((f: any) => f.name === name), deleted)).toBe(false);
        await waitForQueryIdle(grid);
        await log.quiet();

        expect(log.queries()).toHaveLength(0);
        expect(log.actions('PersistentObject.Save').length).toBeGreaterThanOrEqual(1);
        expect(await grid.evaluate((g: any) => g.query.filters.currentFilter?.name)).toBe(kept);
        await expect.poll(() => filterLabel(columnFilter(grid, 'Gender'))).toBe('= Male');
    });

    test('Edit and Delete do not apply the filter', { annotation: [{ type: 'case', description: 'filters.fl-edit-delete-no-apply' }] }, async ({ page }, testInfo) => {
        const grid = await open(page);
        const name = filterName(testInfo);
        await createFilter(grid, name, ['|Female']);

        await openFiltersMenu(grid);
        await filtersControl(grid).getByText('Reset', { exact: true }).click();
        await waitForQueryIdle(grid);
        await expect.poll(() => filterLabel(columnFilter(grid, 'Gender'))).toBe('');

        const log = filterLog(page);
        await openFiltersMenu(grid);
        await menuEntry(grid, name).locator('vi-button[icon="Action_Edit"]').click();
        const editDialog = filterDialog(page);
        await expect(editDialog.locator('input.name')).toHaveValue(name);
        await footerButton(page, 'Cancel').click();
        await expect(editDialog).toHaveCount(0);

        await openFiltersMenu(grid);
        await menuEntry(grid, name).locator('vi-button[icon="Action_Delete"]').click();
        const deleteDialog = page.locator('vi-message-dialog');
        await deleteDialog.locator('footer vi-button').filter({ hasText: 'Cancel' }).click();
        await expect(deleteDialog).toHaveCount(0);

        await waitForQueryIdle(grid);
        await log.quiet();

        expect(log.queries()).toHaveLength(0);
        expect(await grid.evaluate((g: any) => g.query.filters.currentFilter)).toBeNull();
        await expect.poll(() => filterLabel(columnFilter(grid, 'Gender'))).toBe('');
        expect(await grid.evaluate((g: any, name) => g.query.filters.filters.some((f: any) => f.name === name), name)).toBe(true);
    });

    test('grouped filter delete uses the name without its group', { annotation: [{ type: 'case', description: 'filters.fl-grouped-delete-title' }] }, async ({ page }, testInfo) => {
        const grid = await open(page);
        const group = filterName(testInfo, 'pwgrp-');
        await createFilter(grid, `${group}\nOne`, ['|Female']);

        await openFiltersMenu(grid);
        await folderEntry(grid, group).hover();
        await expect(menuEntry(grid, 'One')).toBeVisible();
        await menuEntry(grid, 'One').locator('vi-button[icon="Action_Delete"]').click();

        const dialog = page.locator('vi-message-dialog');
        await expect(dialog.locator('header h4')).toHaveText('One');
        await expect(dialog.locator('main')).toHaveText("Are you sure you want to delete filter 'One'?");

        await dialog.locator('footer vi-button').filter({ hasText: 'Cancel' }).click();
        await expect(dialog).toHaveCount(0);
        expect(await grid.evaluate((g: any, name) => g.query.filters.filters.some((f: any) => f.name === name), `${group}\nOne`)).toBe(true);
    });

    test('loaded grouped filter offers Save with the name without its group', { annotation: [{ type: 'case', description: 'filters.fl-save-label-raw' }] }, async ({ page }, testInfo) => {
        const grid = await open(page);
        const group = filterName(testInfo, 'pwgrp-');
        await createFilter(grid, `${group}\nOne`, ['|Female']);
        expect(await grid.evaluate((g: any) => g.query.filters.currentFilter?.name)).toBe(`${group}\nOne`);

        await openFiltersMenu(grid);
        await expect(filtersControl(grid).getByText('Reset', { exact: true })).toBeVisible();
        const labels = (await filtersMenuItems(grid)).map(i => i.label);
        expect(labels).toContain("Save 'One'");
    });
});

test.describe('Default filter', () => {
    test('default filter applies when the query loads', { annotation: [{ type: 'case', description: 'filters.fl-default-filter' }] }, async ({ page }, testInfo) => {
        grid = await openView(page, VIEWS.QueryGrid_Filter);
        await deleteTestFilters(grid);
        const name = filterName(testInfo);
        await createFilter(grid, name, ['|Female'], { isDefault: true });
        expect(await grid.evaluate((g: any) => g.query.filters.currentFilter?.isDefault)).toBe(true);

        grid = await openView(page, VIEWS.QueryGrid_Filter);
        await expect.poll(() => filterLabel(columnFilter(grid!, 'Gender'))).toBe('= Female');
        expect(await grid.evaluate((g: any) => g.query.filters.currentFilter?.name)).toBe(name);
        expect(await totalItems(grid)).toBe(4587);

        await openFiltersMenu(grid);
        await expect(filtersControl(grid).getByText(`Save '${name}'`, { exact: true })).toBeVisible();
        const labels = (await filtersMenuItems(grid)).map(i => i.label);
        expect(labels.slice(0, 2)).toEqual(['Reset', `Save '${name}'`]);
    });
});

test.describe('Filter dialog', () => {
    test('opens as a modal with Name, IsDefault, Save and Cancel', { annotation: [{ type: 'case', description: 'filters.dg-open-structure' }] }, async ({ page }) => {
        const grid = await open(page);
        await selectFemale(grid);
        await saveAs(page, grid);

        const dialog = filterDialog(page);
        await expect(dialog.locator('main').getByText('Filter name:', { exact: true })).toBeVisible();
        await expect(dialog.locator('main').getByText('Is default filter:', { exact: true })).toBeVisible();
        expect(await dialog.locator('vi-notification').evaluate((n: Element) => (n.shadowRoot?.textContent ?? n.textContent ?? '').trim())).toBe('');

        const save = footerButton(page, 'Save');
        const cancel = footerButton(page, 'Cancel');
        await expect(save).toHaveAttribute('action-type', 'Default');
        await expect(save).not.toHaveAttribute('disabled');
        await expect(cancel).toHaveAttribute('inverse');
        await expect(cancel).not.toHaveAttribute('disabled');

        await cancel.click();
        await expect(dialog).toHaveCount(0);
    });

    test('Name uses the group/name editor with a Folder button', { annotation: [{ type: 'case', description: 'filters.dg-name-editor-folder' }] }, async ({ page }, testInfo) => {
        const grid = await open(page);
        const name = filterName(testInfo);
        await selectFemale(grid);
        await saveAs(page, grid);

        const dialog = filterDialog(page);
        const editor = dialog.locator('vi-query-grid-filter-dialog-name');
        await expect(editor).toHaveCount(1);
        await expect(editor.locator('vi-button[icon="Folder"]')).toBeVisible();
        await expect(editor.locator('input.name')).toBeVisible();
        await expect(editor.locator('input.group')).toBeHidden();

        await editor.locator('input.name').fill(name);
        await footerButton(page, 'Save').click();
        await expect(dialog).toHaveCount(0);
        await waitForQueryIdle(grid);
        expect(await grid.evaluate((g: any) => g.query.filters.filters.map((f: any) => f.name))).toContain(name);
    });

    test('Cancel closes without saving and cancels the edit', { annotation: [{ type: 'case', description: 'filters.dg-cancel' }] }, async ({ page }) => {
        const grid = await open(page);
        await selectFemale(grid);
        const before = await grid.evaluate((g: any) => g.query.filters.filters.map((f: any) => f.name));
        await saveAs(page, grid);

        const dialog = filterDialog(page);
        await dialog.evaluate((d: any) => (window as any).__dialogPo = d.persistentObject);
        const original = await page.evaluate(() => (window as any).__dialogPo.attributes.Name.value);
        await dialog.locator('input.name').pressSequentially('zzz');
        await expect.poll(() => page.evaluate(() => (window as any).__dialogPo.attributes.Name.value)).toBe('zzz');

        await footerButton(page, 'Cancel').click();
        await expect(dialog).toHaveCount(0);

        expect(await grid.evaluate((g: any) => g.query.filters.filters.map((f: any) => f.name))).toEqual(before);
        const po = await page.evaluate(() => ({ isEditing: (window as any).__dialogPo.isEditing, name: (window as any).__dialogPo.attributes.Name.value }));
        expect(po).toEqual({ isEditing: false, name: original });
    });

    test('Save closes the dialog only after the save completes', { annotation: [{ type: 'case', description: 'filters.dg-save-success' }] }, async ({ page }, testInfo) => {
        const grid = await open(page);
        const name = filterName(testInfo);
        await selectFemale(grid);
        await saveAs(page, grid);

        let release: () => void;
        const held = new Promise<void>(resolve => release = resolve);
        let holding = false;
        await page.route('**/ExecuteAction', async route => {
            if (route.request().postData()?.includes('PersistentObject.Save')) {
                holding = true;
                await held;
            }

            await route.continue();
        });

        const dialog = filterDialog(page);
        await dialog.locator('input.name').fill(name);
        await footerButton(page, 'Save').click();
        await expect.poll(() => holding).toBe(true);

        await expect(dialog.locator('dialog[open]')).toBeVisible();
        await expect(footerButton(page, 'Save')).toHaveAttribute('disabled');
        await expect(footerButton(page, 'Cancel')).toHaveAttribute('disabled');
        release!();

        await expect(dialog).toHaveCount(0);
        await waitForQueryIdle(grid);
        await page.unroute('**/ExecuteAction');

        const state = await grid.evaluate((g: any) => ({ names: g.query.filters.filters.map((f: any) => f.name), current: g.query.filters.currentFilter?.name }));
        expect(state.names).toContain(name);
        expect(state.current).toBe(name);
    });

    test('a failed Save re-enables Save and Cancel and keeps the dialog open', { annotation: [{ type: 'case', description: 'filters.dg-save-failure-reenables' }] }, async ({ page }) => {
        const grid = await open(page);
        await selectFemale(grid);
        await saveAs(page, grid);

        let release: () => void;
        const held = new Promise<void>(resolve => release = resolve);
        let holding = false;
        await page.route('**/ExecuteAction', async route => {
            if (route.request().postData()?.includes('PersistentObject.Save')) {
                holding = true;
                await held;
            }

            await route.continue();
        });

        // An empty name makes the server reject the save
        const dialog = filterDialog(page);
        await footerButton(page, 'Save').click();
        await expect.poll(() => holding).toBe(true);
        await expect(footerButton(page, 'Save')).toHaveAttribute('disabled');
        await expect(footerButton(page, 'Cancel')).toHaveAttribute('disabled');
        release!();

        await expect.poll(() => dialog.locator('vi-notification').evaluate((n: Element) => (n.shadowRoot?.textContent ?? '').trim())).not.toBe('');
        await waitForQueryIdle(grid);
        await page.unroute('**/ExecuteAction');
        await expect(dialog.locator('dialog[open]')).toBeVisible();
        await expect(footerButton(page, 'Save')).not.toHaveAttribute('disabled');
        await expect(footerButton(page, 'Cancel')).not.toHaveAttribute('disabled');

        await footerButton(page, 'Cancel').click();
        await expect(dialog).toHaveCount(0);
    });

    test('a failed Save As keeps the dialog open, the error and the column filters', { annotation: [{ type: 'case', description: 'filters.dg-save-empty-name' }, { type: 'case', description: 'filters.dg-saveas-fail' }] }, async ({ page }) => {
        const grid = await open(page);
        await selectFemale(grid);
        await saveAs(page, grid);

        // An empty name makes the server reject the save
        const log = filterLog(page);
        const dialog = filterDialog(page);
        await footerButton(page, 'Save').click();
        await expect.poll(() => dialog.locator('vi-notification').evaluate((n: Element) => (n.shadowRoot?.textContent ?? '').trim())).not.toBe('');
        await expect(dialog.locator('dialog[open]')).toBeVisible();
        await waitForQueryIdle(grid);
        await log.quiet();

        expect(log.queries()).toHaveLength(0);
        expect((await columnState(grid, 'Gender')).selectedDistincts).toEqual(['|Female']);
        await expect.poll(() => filterLabel(columnFilter(grid, 'Gender'))).toBe('= Female');
        expect(await totalItems(grid)).toBe(4587);
        expect(await grid.evaluate((g: any) => g.query.filters.currentFilter?.persistentObject.isNew)).toBe(true);

        await footerButton(page, 'Cancel').click();
        await expect(dialog).toHaveCount(0);
        expect((await columnState(grid, 'Gender')).selectedDistincts).toEqual(['|Female']);
    });

    test('saving with a name after a failed Save As succeeds', { annotation: [{ type: 'case', description: 'filters.dg-retry-after-error' }] }, async ({ page }, testInfo) => {
        const grid = await open(page);
        const name = filterName(testInfo);
        await selectFemale(grid);
        await saveAs(page, grid);

        // An empty name makes the server reject the first save
        const dialog = filterDialog(page);
        await footerButton(page, 'Save').click();
        await expect.poll(() => dialog.locator('vi-notification').evaluate((n: Element) => (n.shadowRoot?.textContent ?? '').trim())).not.toBe('');
        await waitForQueryIdle(grid);

        await dialog.locator('input.name').fill(name);
        await footerButton(page, 'Save').click();
        await expect(dialog).toHaveCount(0);
        await waitForQueryIdle(grid);

        const state = await grid.evaluate((g: any) => ({
            current: g.query.filters.currentFilter?.name,
            isNew: g.query.filters.currentFilter?.persistentObject.isNew,
            columns: JSON.parse(g.query.filters.currentFilter?.persistentObject.getAttributeValue('Columns') ?? '[]'),
            names: g.query.filters.filters.map((f: any) => f.name)
        }));
        expect(state.current).toBe(name);
        expect(state.isNew).toBe(false);
        expect(state.columns).toEqual([{ name: 'Gender', includes: ['|Female'], excludes: [] }]);
        expect(state.names.filter((n: string) => n === name)).toHaveLength(1);
        expect((await columnState(grid, 'Gender')).selectedDistincts).toEqual(['|Female']);
        await expect.poll(() => filterLabel(columnFilter(grid, 'Gender'))).toBe('= Female');
        expect(await totalItems(grid)).toBe(4587);
    });

    test('a failed Save As keeps the loaded filter and its unsaved column changes', { annotation: [{ type: 'case', description: 'filters.dg-saveas-fail-saved-current' }] }, async ({ page }, testInfo) => {
        const grid = await open(page);
        const name = filterName(testInfo);
        await createFilter(grid, name, ['|Female']);

        const gender = await openFilter(grid, 'Gender');
        await clickDistinct(gender, 'Male');
        await waitForQueryIdle(grid);
        await expect.poll(async () => (await columnState(grid, 'Gender')).selectedDistincts.sort()).toEqual(['|Female', '|Male']);

        await saveAs(page, grid);
        const log = filterLog(page);
        const dialog = filterDialog(page);
        await footerButton(page, 'Save').click();
        await expect.poll(() => dialog.locator('vi-notification').evaluate((n: Element) => (n.shadowRoot?.textContent ?? '').trim())).not.toBe('');
        await expect(dialog.locator('dialog[open]')).toBeVisible();
        await waitForQueryIdle(grid);
        await log.quiet();

        expect(log.queries()).toHaveLength(0);
        expect((await columnState(grid, 'Gender')).selectedDistincts.sort()).toEqual(['|Female', '|Male']);
        const state = await grid.evaluate((g: any) => ({
            current: g.query.filters.currentFilter?.name,
            listed: g.query.filters.filters.includes(g.query.filters.currentFilter),
            names: g.query.filters.filters.map((f: any) => f.name)
        }));
        expect(state.current).toBe(name);
        expect(state.listed).toBe(true);
        expect(state.names.filter((n: string) => n === name)).toHaveLength(1);

        await footerButton(page, 'Cancel').click();
        await expect(dialog).toHaveCount(0);
        expect((await columnState(grid, 'Gender')).selectedDistincts.sort()).toEqual(['|Female', '|Male']);
    });

    test('dialog is at least 400px wide with Cancel right of Save', { annotation: [{ type: 'case', description: 'filters.dg-footer-order' }] }, async ({ page }) => {
        const grid = await open(page);
        await selectFemale(grid);
        await saveAs(page, grid);

        const box = (await filterDialog(page).locator('dialog[open]').boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(400);

        const save = (await footerButton(page, 'Save').boundingBox())!;
        const cancel = (await footerButton(page, 'Cancel').boundingBox())!;
        expect(save.x).toBeLessThan(cancel.x);

        await footerButton(page, 'Cancel').click();
        await expect(filterDialog(page)).toHaveCount(0);
    });

    test('Name uses the group/name editor and saves the group', { annotation: [{ type: 'case', description: 'filters.dg-name-editor-saves-group' }] }, async ({ page }, testInfo) => {
        const grid = await open(page);
        const group = filterName(testInfo, 'pwgrp-');
        const name = filterName(testInfo);
        await selectFemale(grid);
        await saveAs(page, grid);

        const editor = filterDialog(page).locator('vi-query-grid-filter-dialog-name');
        await expect(editor.locator('vi-button[icon="Folder"]')).toBeVisible();
        await editor.locator('vi-button[icon="Folder"]').click();
        await expect(editor.locator('input.group')).toBeVisible();
        await editor.locator('input.group').fill(group);
        await editor.locator('input.name').fill(name);

        await footerButton(page, 'Save').click();
        await expect(filterDialog(page)).toHaveCount(0);
        await waitForQueryIdle(grid);

        const state = await grid.evaluate((g: any) => ({ names: g.query.filters.filters.map((f: any) => f.name), current: g.query.filters.currentFilter?.name }));
        expect(state.names).toContain(`${group}\n${name}`);
        expect(state.current).toBe(`${group}\n${name}`);

        await openFiltersMenu(grid);
        await expect(folderEntry(grid, group)).toBeVisible();
        await folderEntry(grid, group).hover();
        await expect(menuEntry(grid, name)).toBeVisible();
    });

    test('Escape behaves like Cancel', { annotation: [{ type: 'case', description: 'filters.dg-escape' }] }, async ({ page }) => {
        const grid = await open(page);
        await selectFemale(grid);
        const before = await grid.evaluate((g: any) => g.query.filters.filters.map((f: any) => f.name));
        await saveAs(page, grid);

        const dialog = filterDialog(page);
        await dialog.evaluate((d: any) => (window as any).__dialogPo = d.persistentObject);
        const original = await page.evaluate(() => (window as any).__dialogPo.attributes.Name.value);
        await dialog.locator('input.name').pressSequentially('zzz');
        await expect.poll(() => page.evaluate(() => (window as any).__dialogPo.attributes.Name.value)).toBe('zzz');

        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);

        expect(await grid.evaluate((g: any) => g.query.filters.filters.map((f: any) => f.name))).toEqual(before);
        const po = await page.evaluate(() => ({ isEditing: (window as any).__dialogPo.isEditing, name: (window as any).__dialogPo.attributes.Name.value }));
        expect(po).toEqual({ isEditing: false, name: original });
    });

    test('server error on save shows a notification and keeps the dialog', { annotation: [{ type: 'case', description: 'filters.dg-save-server-error' }] }, async ({ page }, testInfo) => {
        const grid = await open(page);
        const name = filterName(testInfo);
        await selectFemale(grid);
        await saveAs(page, grid);

        let failed = 0;
        await page.route('**/ExecuteAction', async route => {
            if (!route.request().postData()?.includes('PersistentObject.Save'))
                return route.continue();

            failed++;
            await route.fulfill({ status: 500, contentType: 'text/plain', body: 'pw server error' });
        });

        const log = filterLog(page);
        const dialog = filterDialog(page);
        await dialog.locator('input.name').fill(name);
        await footerButton(page, 'Save').click();
        await expect.poll(() => failed).toBe(1);
        await expect.poll(() => notificationText(page)).not.toBe('');
        await waitForQueryIdle(grid);
        await log.quiet();
        await page.unroute('**/ExecuteAction');

        await expect(dialog.locator('dialog[open]')).toBeVisible();
        await expect(footerButton(page, 'Save')).not.toHaveAttribute('disabled');
        expect(log.queries()).toHaveLength(0);
        expect((await columnState(grid, 'Gender')).selectedDistincts).toEqual(['|Female']);
        await expect.poll(() => filterLabel(columnFilter(grid, 'Gender'))).toBe('= Female');
        expect(await grid.evaluate((g: any) => g.query.filters.currentFilter?.persistentObject.isNew)).toBe(true);

        await footerButton(page, 'Cancel').click();
        await expect(dialog).toHaveCount(0);
        expect((await columnState(grid, 'Gender')).selectedDistincts).toEqual(['|Female']);
        expect(await grid.evaluate((g: any, name) => g.query.filters.filters.some((f: any) => f.name === name), name)).toBe(false);
    });

    test('IsDefault toggle is saved', { annotation: [{ type: 'case', description: 'filters.dg-isdefault-save' }] }, async ({ page }, testInfo) => {
        const grid = await open(page);
        const name = filterName(testInfo);
        await selectFemale(grid);
        await saveAs(page, grid);

        const dialog = filterDialog(page);
        await dialog.locator('input.name').fill(name);
        const toggle = dialog.locator('vi-persistent-object-attribute-presenter[name="IsDefault"] vi-toggle');
        await expect(toggle).not.toHaveAttribute('toggled');
        await toggle.click();
        await expect(toggle).toHaveAttribute('toggled');
        expect(await dialog.evaluate((d: any) => d.persistentObject.attributes.IsDefault.value)).toBe(true);

        await footerButton(page, 'Save').click();
        await expect(dialog).toHaveCount(0);
        await waitForQueryIdle(grid);

        const saved = await grid.evaluate((g: any, name) => {
            const filter = g.query.filters.filters.find((f: any) => f.name === name);
            return filter ? { isDefault: filter.isDefault, isNew: filter.persistentObject.isNew } : null;
        }, name);
        expect(saved).toEqual({ isDefault: true, isNew: false });
    });
});

test.describe('Edit', () => {
    test('editing a saved filter renames it', { annotation: [{ type: 'case', description: 'filters.dg-edit-rename' }] }, async ({ page }, testInfo) => {
        const grid = await open(page);
        const name = filterName(testInfo);
        const renamed = filterName(testInfo, 'pw-renamed-');
        await createFilter(grid, name, ['|Female']);

        await openFiltersMenu(grid);
        await menuEntry(grid, name).locator('vi-button[icon="Action_Edit"]').click();
        const dialog = filterDialog(page);
        await expect(dialog.locator('input.name')).toHaveValue(name);
        await dialog.locator('input.name').fill(renamed);
        await footerButton(page, 'Save').click();
        await expect(dialog).toHaveCount(0);
        await waitForQueryIdle(grid);

        await openFiltersMenu(grid);
        await expect(menuEntry(grid, renamed)).toBeVisible();
        const labels = (await filtersMenuItems(grid)).map(i => i.label);
        expect(labels).toContain(renamed);
        expect(labels).not.toContain(name);
        expect(await grid.evaluate((g: any) => g.query.filters.currentFilter?.name)).toBe(renamed);
    });

    test('cancelling an edit keeps the original name', { annotation: [{ type: 'case', description: 'filters.dg-edit-cancel' }] }, async ({ page }, testInfo) => {
        const grid = await open(page);
        const name = filterName(testInfo);
        await createFilter(grid, name, ['|Female']);

        await openFiltersMenu(grid);
        await menuEntry(grid, name).locator('vi-button[icon="Action_Edit"]').click();
        const dialog = filterDialog(page);
        await expect(dialog.locator('input.name')).toHaveValue(name);
        await dialog.locator('input.name').pressSequentially('zzz');
        await footerButton(page, 'Cancel').click();
        await expect(dialog).toHaveCount(0);

        await openFiltersMenu(grid);
        await expect(menuEntry(grid, name)).toBeVisible();
        expect(await grid.evaluate((g: any, name) => g.query.filters.filters.map((f: any) => f.name).includes(name), name)).toBe(true);
    });
});

/**
 * Last in this serial file: a failure here does not keep the other saved-filter tests from running.
 */
test.describe('Load: menu', () => {
    test('menu closes after loading a filter', { annotation: [{ type: 'case', description: 'filters.fl-load-menu-closes' }] }, async ({ page }, testInfo) => {
        const grid = await open(page);
        const name = filterName(testInfo);
        await createFilter(grid, name, ['|Female']);
        await resetFilters(grid);
        await expect(filtersControl(grid).locator('vi-popup[open]')).toHaveCount(0);

        await openFiltersMenu(grid);
        await loadEntry(grid, name);
        await waitForQueryIdle(grid);
        expect(await grid.evaluate((g: any) => g.query.filters.currentFilter?.name)).toBe(name);

        // Like Reset and the grouping menu items, choosing a filter closes the menu
        await expect(menuEntry(grid, name)).toBeHidden();
        await expect(filtersControl(grid).locator('vi-popup[open]')).toHaveCount(0);
    });
});
