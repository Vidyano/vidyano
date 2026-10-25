import { expect, Locator, Page } from '@playwright/test';
import { gridPage, mountGrid, MountOptions, GridPageOptions, waitForGridReady } from './query-grid';

/**
 * Helpers for the column header, configure dialog and grid user settings specs.
 */

/**
 * Opens the bare grid page and mounts a grid.
 */
export async function headerGrid(page: Page, options: MountOptions = {}, pageOptions: GridPageOptions = {}): Promise<Locator> {
    await gridPage(page, pageOptions);

    return mountGrid(page, options);
}

/** The column header for a column name. */
export function header(grid: Locator, name: string): Locator {
    return grid.locator(`vi-query-grid-column-header[name="${name}"]`);
}

/** The sort icon inside a column header's label. */
export function sortIcon(grid: Locator, name: string): Locator {
    return header(grid, name).locator('div.label > vi-icon');
}

/** A column menu item found by its label text. */
export function menuItem(headerLocator: Locator, label: string | RegExp): Locator {
    return headerLocator.locator('vi-popup-menu-item').filter({ has: headerLocator.page().locator('span.label', { hasText: typeof label === 'string' ? new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) : label }) });
}

/** Opens a column's menu by clicking its caret. */
export async function openMenuByCaret(grid: Locator, name: string) {
    const h = header(grid, name);
    await h.locator('vi-button[icon="CaretDown"]:visible').click();
    await expect(h.locator('vi-popup-menu-item[icon="Configure"]')).toBeVisible();

    return h;
}

/** Opens a column's menu by right-clicking its label. */
export async function openMenu(grid: Locator, name: string) {
    const h = header(grid, name);
    await h.locator('div.label').click({ button: 'right' });
    await expect(h.locator('vi-popup-menu-item[icon="Configure"]')).toBeVisible();

    return h;
}

/** Closes an open column menu with Escape. */
export async function closeMenu(headerLocator: Locator) {
    await headerLocator.page().keyboard.press('Escape');
    await expect(headerLocator.locator('vi-popup-menu-item[icon="Configure"]')).toBeHidden();
}

/** The grid query's sort options as 'Name DIR' strings. */
export async function sortOptions(page: Page): Promise<string[]> {
    return page.evaluate(() => (window as any).grid.query.sortOptions.map((o: any) => `${o.name} ${o.direction}`));
}

/** The configure dialog. */
export function configureDialog(page: Page): Locator {
    return page.locator('vi-query-grid-configure-dialog');
}

/** Opens the configure dialog through a column's Manage menu item. */
export async function openConfigure(grid: Locator, name = 'FirstName'): Promise<Locator> {
    const h = await openMenu(grid, name);
    await h.locator('vi-popup-menu-item[icon="Configure"]').click();

    const dialog = configureDialog(grid.page());
    await expect(dialog.locator('dialog')).toBeVisible();
    await expect(dialog.locator('vi-query-grid-configure-dialog-column').first()).toBeVisible();

    return dialog;
}

/** A configure dialog row by its label. */
export function dialogRow(dialog: Locator, label: string): Locator {
    return dialog.locator('vi-query-grid-configure-dialog-column').filter({ has: dialog.page().locator('label', { hasText: new RegExp(`^${label}$`) }) });
}

/** A configure dialog footer button by its label. */
export function dialogButton(dialog: Locator, label: 'Reset' | 'Save' | 'Cancel'): Locator {
    return dialog.locator('footer vi-button').filter({ hasText: label });
}

export interface DialogList {
    visible: boolean;
    rows: { label: string; pinned: boolean; hidden: boolean }[];
}

/** The rows in the dialog's pinned and unpinned lists, in DOM order. */
export async function dialogLists(dialog: Locator): Promise<{ pinned: DialogList; unpinned: DialogList }> {
    return dialog.evaluate((d: any) => {
        const list = (group: string) => {
            const sortable = d.shadowRoot.querySelector(`vi-sortable[group="${group}"]`) as HTMLElement;
            return {
                visible: getComputedStyle(sortable).display !== 'none',
                rows: [...sortable.children].map((c: any) => ({
                    label: c.shadowRoot.querySelector('label').textContent.trim(),
                    pinned: c.hasAttribute('is-pinned'),
                    hidden: c.hasAttribute('is-hidden')
                }))
            };
        };

        return { pinned: list('pinned'), unpinned: list('unpinned') };
    });
}

/** Labels of a dialog list. */
export async function dialogLabels(dialog: Locator, group: 'pinned' | 'unpinned'): Promise<string[]> {
    return (await dialogLists(dialog))[group].rows.map(r => r.label);
}

/** The label and icon of the dialog row button that has keyboard focus, or null when focus is elsewhere. */
export async function focusedRowButton(dialog: Locator): Promise<{ label: string; icon: string } | null> {
    return dialog.evaluate((d: any) => {
        let element: any = document.activeElement;
        const path = [element];
        while (element?.shadowRoot?.activeElement)
            path.push(element = element.shadowRoot.activeElement);

        const index = path.indexOf(d);
        const [row, button] = index < 0 ? [] : path.slice(index + 1);
        if (row?.tagName !== 'VI-QUERY-GRID-CONFIGURE-DIALOG-COLUMN' || button?.tagName !== 'VI-BUTTON')
            return null;

        return { label: row.shadowRoot.querySelector('label').textContent.trim(), icon: button.getAttribute('icon') };
    });
}

/** Presses Enter on a row's focused Pin or Eye button, once the lists show every row's pin state. */
export async function pressRowButton(dialog: Locator, label: string, icon: 'Pin' | 'Eye') {
    await expect.poll(async () => {
        const { pinned, unpinned } = await dialogLists(dialog);
        return pinned.rows.every(r => r.pinned) && unpinned.rows.every(r => !r.pinned);
    }).toBe(true);
    await dialogRow(dialog, label).locator(`vi-button[icon="${icon}"]`).focus();
    await dialog.page().keyboard.press('Enter');
}

/** Drags a dialog row with the mouse to just above another row. */
export async function dragRowAbove(dialog: Locator, label: string, targetLabel: string) {
    const page = dialog.page();
    const source = (await dialogRow(dialog, label).boundingBox())!;
    const target = (await dialogRow(dialog, targetLabel).boundingBox())!;
    const x = source.x + 60;

    await page.mouse.move(x, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(x, target.y + 2, { steps: 15 });
    await page.mouse.move(x, target.y - 2, { steps: 5 });
    await page.mouse.up();
}

/** Waits until the dialog is gone and the grid is ready again. */
export async function waitForDialogClosed(grid: Locator) {
    await expect(configureDialog(grid.page())).toHaveCount(0);
    await waitForGridReady(grid);
}

/** The stored QueryGridSettings entry for the grid's query (in memory). */
export async function storedGridSettings(page: Page): Promise<any> {
    return page.evaluate(() => {
        const w = window as any;
        return w.service.application.userSettings.QueryGridSettings[w.grid.query.id];
    });
}

/** The grid query's id. */
export async function queryId(page: Page): Promise<string> {
    return page.evaluate(() => (window as any).grid.query.id);
}

/** Drags a column's resizer horizontally by dx pixels (mouse, in steps). */
export async function resizeColumn(grid: Locator, name: string, dx: number) {
    const page = grid.page();
    const resizer = (await header(grid, name).locator('.resizer').boundingBox())!;
    const x = resizer.x + resizer.width / 2;
    const y = resizer.y + resizer.height / 2;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y, { steps: 10 });
    await page.mouse.up();
}

/** The open (visible) column menus in the grid, by header name. */
export async function openMenus(grid: Locator): Promise<string[]> {
    return grid.evaluate((g: any) => [...g.shadowRoot.querySelectorAll('vi-query-grid-column-header')]
        .filter((h: any) => [...h.shadowRoot.querySelectorAll('vi-popup-menu-item')].some((i: any) => i.getClientRects().length > 0 && getComputedStyle(i).visibility !== 'hidden'))
        .map((h: any) => h.getAttribute('name')));
}

/** The chain of focused elements from document.activeElement down through the shadow roots. */
export async function deepFocusPath(page: Page): Promise<{ tag: string; name: string | null; icon: string | null }[]> {
    return page.evaluate(() => {
        const path: { tag: string; name: string | null; icon: string | null }[] = [];
        let element: Element | null | undefined = document.activeElement;
        while (element) {
            path.push({ tag: element.tagName.toLowerCase(), name: element.getAttribute('name'), icon: element.getAttribute('icon') });
            element = element.shadowRoot?.activeElement;
        }

        return path;
    });
}

/** Header widths by column name (rounded). */
export async function headerWidths(grid: Locator): Promise<Record<string, number>> {
    return grid.evaluate((g: any) => Object.fromEntries([...g.shadowRoot.querySelectorAll('vi-query-grid-column-header')].map((h: any) => [h.getAttribute('name'), Math.round(h.getBoundingClientRect().width)])));
}
