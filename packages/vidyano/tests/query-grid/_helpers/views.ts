import { test as base, devices, expect, Locator, Page } from '@playwright/test';
import { getScrollOffset, openApp, openView, VIEWS, waitForGridReady } from './query-grid';

/**
 * Helpers for the app view specs (tests/query-grid/views). VIEW_MATRIX holds the expected values per view; pixel
 * values are derived from the row height.
 */

export const PEOPLE_COLUMNS = ['FirstName', 'LastName', 'BirthDate', 'Gender', 'ContactPreference', 'Email', 'PhoneNumber', 'EmergencyContact', 'IsActive'];
export const PEOPLE_ID = 'c81496d8-154b-4f66-905e-1d32354eea0c';
export const TOP10_ID = 'd9c7a23e-b445-4831-bbce-383121655046';
export const ATTRIBUTES_REFERENCE = 'attributes/persistent-object.1cc61676-3aa6-450f-884b-bdc425c7b232/Reference;ReferenceWithCanAddNew';

export type ViewName = keyof typeof VIEWS;
export type Part = 'groupspacer' | 'selector' | 'actions' | 'filter';

export interface ViewSpec {
    name: ViewName;
    path: string;
    /** Text of the vi-query header */
    title: string;
    totalItems: number;
    canSelect: boolean;
    canFilter: boolean;
    inlineActions: boolean;
    /** Visible (not [hidden]) action buttons in the action bar, or null when the view has no action bar */
    actionBar: string[] | null;
    search: boolean;
    selectAll: 'available' | 'unavailable' | 'absent';
    /** Number of row-height slots in the controls box, and its grid areas */
    controls: { slots: number; areas: string };
    grouped: { slots: number; areas: string; prefix: Part[] };
    prefix: Part[];
    /** Actions in the inline actions popup, null when the view has none */
    inline: string[] | null;
    /** Program unit used when a row opens */
    unit: 'home' | 'components';
}

const PERSON_ACTIONS = ['NewPersonWizard', 'New', 'BulkEdit', 'Delete', 'SendEmail', 'TestActionsGroup', 'TestPinned'];
const PERSON_INLINE = ['BulkEdit', 'Delete', 'TestActionsGroup'];

export const VIEW_MATRIX: ViewSpec[] = [
    {
        name: 'People', path: VIEWS.People, title: '10.000 People', totalItems: 10000,
        canSelect: true, canFilter: true, inlineActions: true, actionBar: PERSON_ACTIONS, search: true, selectAll: 'available',
        controls: { slots: 2, areas: '"spacer spacer" "select filter"' },
        grouped: { slots: 3, areas: '"spacer spacer spacer" "grouping select filter"', prefix: ['groupspacer', 'selector', 'actions'] },
        prefix: ['selector', 'actions'], inline: PERSON_INLINE, unit: 'home'
    },
    {
        name: 'PeopleTop10', path: VIEWS.PeopleTop10, title: '10 People (Top 10)', totalItems: 10,
        canSelect: true, canFilter: true, inlineActions: true, actionBar: PERSON_ACTIONS, search: true, selectAll: 'available',
        controls: { slots: 2, areas: '"spacer spacer" "select filter"' },
        grouped: { slots: 3, areas: '"spacer spacer spacer" "grouping select filter"', prefix: ['groupspacer', 'selector', 'actions'] },
        prefix: ['selector', 'actions'], inline: PERSON_INLINE, unit: 'home'
    },
    {
        name: 'QueryGrid_None', path: VIEWS.QueryGrid_None, title: '10.000 People (None)', totalItems: 10000,
        canSelect: false, canFilter: false, inlineActions: false, actionBar: null, search: false, selectAll: 'absent',
        controls: { slots: 0, areas: 'none' },
        grouped: { slots: 1, areas: '"grouping"', prefix: ['groupspacer'] },
        prefix: [], inline: null, unit: 'components'
    },
    {
        name: 'QueryGrid_Select', path: VIEWS.QueryGrid_Select, title: '10.000 People (Select)', totalItems: 10000,
        canSelect: true, canFilter: false, inlineActions: false, actionBar: ['MoreThanOne'], search: false, selectAll: 'unavailable',
        controls: { slots: 1, areas: '"select"' },
        grouped: { slots: 2, areas: '"grouping select"', prefix: ['groupspacer', 'selector'] },
        prefix: ['selector'], inline: null, unit: 'components'
    },
    {
        name: 'QueryGrid_Filter', path: VIEWS.QueryGrid_Filter, title: '10.000 People (Filter)', totalItems: 10000,
        canSelect: false, canFilter: true, inlineActions: false, actionBar: [], search: true, selectAll: 'absent',
        controls: { slots: 1, areas: '"spacer" "filter"' },
        grouped: { slots: 2, areas: '"spacer spacer" "grouping filter"', prefix: ['groupspacer', 'filter'] },
        prefix: ['filter'], inline: null, unit: 'components'
    },
    {
        // The One (=1) action in the action bar needs exactly one selected row, so this view has can-select too.
        name: 'QueryGrid_InlineActions', path: VIEWS.QueryGrid_InlineActions, title: '10.000 People (Inline actions)', totalItems: 10000,
        canSelect: true, canFilter: false, inlineActions: true, actionBar: ['One'], search: false, selectAll: 'unavailable',
        controls: { slots: 2, areas: '"select spacer"' },
        grouped: { slots: 3, areas: '"grouping select spacer"', prefix: ['groupspacer', 'selector', 'actions'] },
        prefix: ['selector', 'actions'], inline: ['One'], unit: 'components'
    },
    {
        name: 'QueryGrid_SelectAndFilter', path: VIEWS.QueryGrid_SelectAndFilter, title: '10.000 People (Select + Filter)', totalItems: 10000,
        canSelect: true, canFilter: true, inlineActions: false, actionBar: ['MoreThanOne'], search: true, selectAll: 'unavailable',
        controls: { slots: 2, areas: '"spacer spacer" "select filter"' },
        grouped: { slots: 3, areas: '"spacer spacer spacer" "grouping select filter"', prefix: ['groupspacer', 'selector', 'filter'] },
        prefix: ['selector', 'filter'], inline: null, unit: 'components'
    },
    {
        name: 'QueryGrid_SelectAndInlineActions', path: VIEWS.QueryGrid_SelectAndInlineActions, title: '10.000 People (Select + Inline Actions)', totalItems: 10000,
        canSelect: true, canFilter: false, inlineActions: true, actionBar: PERSON_ACTIONS, search: false, selectAll: 'unavailable',
        controls: { slots: 2, areas: '"select spacer"' },
        grouped: { slots: 3, areas: '"grouping select spacer"', prefix: ['groupspacer', 'selector', 'actions'] },
        prefix: ['selector', 'actions'], inline: PERSON_INLINE, unit: 'components'
    },
    {
        name: 'QueryGrid_SelectAndFilterAndInlineActions', path: VIEWS.QueryGrid_SelectAndFilterAndInlineActions, title: '10.000 People (Select + Filter + Inline Actions)', totalItems: 10000,
        canSelect: true, canFilter: true, inlineActions: true, actionBar: PERSON_ACTIONS, search: true, selectAll: 'unavailable',
        controls: { slots: 2, areas: '"spacer spacer" "select filter"' },
        grouped: { slots: 3, areas: '"spacer spacer spacer" "grouping select filter"', prefix: ['groupspacer', 'selector', 'actions'] },
        prefix: ['selector', 'actions'], inline: PERSON_INLINE, unit: 'components'
    }
];

export const ALL_PARTS: Part[] = ['groupspacer', 'selector', 'actions', 'filter'];

/**
 * The `test` of the view specs that share one app per worker: the app boots once and every test shows its view
 * on it with showView instead of opening a fresh page. A failed test ends its worker, so the next one boots again.
 */
export const test = base.extend<{}, { appPage: Page }>({
    appPage: [async ({ browser }, use) => {
        const context = await browser.newContext({ ...devices['Desktop Chrome'] });
        const page = await context.newPage();
        await openView(page, VIEWS.People);
        await use(page);
        await context.close();
    }, { scope: 'worker' }],
    page: async ({ appPage }, use) => {
        await use(appPage);
    }
});

/**
 * Shows a view on the shared app page (see `test`) the way openView opens it on a fresh page: the current route
 * is left first, so the view's route stamps a new grid, and the app's query cache, the grid and query settings and
 * the recorded saves are cleared before the view loads its query again.
 */
export async function showView(page: Page, viewPath: string, options: { width?: number; height?: number } = {}): Promise<Locator> {
    const { width = 1280, height = 720 } = options;
    await page.mouse.move(0, 0);
    await page.setViewportSize({ width, height });

    // Routes keep the grids of earlier views in the DOM, hidden; they are marked so the new grid can be told apart
    await page.locator('vi-query-grid').evaluateAll(grids => grids.forEach(g => g.setAttribute('data-stale', '')));
    await page.evaluate(() => (document.querySelector('vi-app') as any).changePath('query-grid-test-blank'));
    await expect(page.locator('vi-query-grid').filter({ visible: true })).toHaveCount(0);

    await page.evaluate(path => {
        const app = document.querySelector('vi-app') as any;
        const settings = app.service.application.userSettings;
        settings.QueryGridSettings = {};
        settings.QuerySettings = {};
        app.cacheClear();
        (window as any).__saves = [];
        app.changePath(path);
    }, viewPath);

    const grid = page.locator('vi-query-grid:not([data-stale])').filter({ visible: true }).first();
    await grid.waitFor({ state: 'attached', timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    await waitForGridReady(grid, 30000);

    return grid;
}

export interface Box { x: number; y: number; width: number; height: number }

export async function box(locator: Locator): Promise<Box> {
    const b = await locator.boundingBox();
    expect(b, 'element has a box').not.toBeNull();
    return { x: Math.round(b!.x), y: Math.round(b!.y), width: Math.round(b!.width), height: Math.round(b!.height) };
}

/** The grid of the active route (other routes keep their grids in the DOM, hidden). */
export function activeGrid(page: Page): Locator {
    return page.locator('vi-query-grid').filter({ visible: true }).first();
}

export async function hostVar(grid: Locator, name: string) {
    return grid.evaluate((g, name) => getComputedStyle(g).getPropertyValue(name).trim(), name);
}

export async function rowHeight(grid: Locator) {
    return parseInt(await hostVar(grid, '--vi-query-grid-row-height'));
}

/** The px tracks of --vi-query-grid-columns, without the filler. */
export async function tracks(grid: Locator) {
    return [...(await hostVar(grid, '--vi-query-grid-columns')).matchAll(/(\d+(?:\.\d+)?)px/g)].map(m => parseFloat(m[1]));
}

export interface AlignmentResult {
    rows: number;
    headers: string[];
    errors: string[];
}

/**
 * Compares every visible data row's cells with the visible column headers: cell k must have header k's left
 * and width within the tolerance.
 */
export async function alignment(grid: Locator, tolerance = 1): Promise<AlignmentResult> {
    return grid.evaluate((g: any, tolerance) => {
        const s = g.shadowRoot;
        const visible = (e: Element) => getComputedStyle(e).display !== 'none';
        const headers = [...s.querySelectorAll('vi-query-grid-column-header')].filter(visible) as HTMLElement[];
        const hb = headers.map(h => h.getBoundingClientRect());
        const scroller = [...s.querySelectorAll('vi-scroller')].find((e: any) => !e.closest('header, vi-popup')) as HTMLElement;
        const view = scroller.getBoundingClientRect();
        const rows = [...s.querySelectorAll('vi-query-grid-row')].filter((r: any) => {
            const b = r.getBoundingClientRect();
            return visible(r) && !r.hasAttribute('is-group') && !r.classList.contains('hidden') && b.height > 0 && b.bottom > view.top + 1 && b.top < view.bottom - 1;
        }) as HTMLElement[];

        const errors: string[] = [];
        rows.forEach((r, ri) => {
            const cells = [...r.querySelectorAll(':scope > .column'), ...(r.shadowRoot?.querySelectorAll('.column') ?? [])].filter(visible);
            if (cells.length !== headers.length)
                errors.push(`row ${ri}: ${cells.length} cells for ${headers.length} headers`);

            cells.forEach((c, k) => {
                const cb = c.getBoundingClientRect();
                if (hb[k] && (Math.abs(cb.left - hb[k].left) > tolerance || Math.abs(cb.width - hb[k].width) > tolerance))
                    errors.push(`row ${ri} cell ${k}: ${cb.left.toFixed(1)}/${cb.width.toFixed(1)} vs header ${hb[k].left.toFixed(1)}/${hb[k].width.toFixed(1)}`);
            });
        });

        return { rows: rows.length, headers: headers.map(h => h.getAttribute('name')!), errors };
    }, tolerance);
}

export async function expectAligned(grid: Locator, message = 'alignment') {
    const result = await alignment(grid);
    expect(result.rows, `${message}: visible data rows`).toBeGreaterThan(0);
    expect(result.errors, message).toEqual([]);
    return result;
}

/** Physical rows (data and group) that are displayed and intersect the body viewport, with their boxes. */
export async function rowBoxes(grid: Locator) {
    return grid.evaluate((g: any) => {
        const s = g.shadowRoot;
        const scroller = [...s.querySelectorAll('vi-scroller')].find((e: any) => !e.closest('header, vi-popup')) as HTMLElement;
        const view = scroller.getBoundingClientRect();
        return ([...s.querySelectorAll('vi-query-grid-row')] as HTMLElement[])
            .map(r => ({ r, b: r.getBoundingClientRect() }))
            .filter(({ r, b }) => getComputedStyle(r).display !== 'none' && !r.classList.contains('hidden') && b.height > 0 && b.bottom > view.top + 1 && b.top < view.bottom - 1)
            .sort((a, b) => a.b.top - b.b.top)
            .map(({ r, b }) => ({
                isGroup: r.hasAttribute('is-group'),
                top: b.top, bottom: b.bottom, left: b.left, width: b.width, height: b.height,
                cellHeights: [...r.querySelectorAll(':scope > .column'), ...(r.shadowRoot?.querySelectorAll('.column') ?? [])].filter(c => getComputedStyle(c).display !== 'none').map(c => c.getBoundingClientRect().height)
            }));
    });
}

export async function physicalRowCount(grid: Locator) {
    return grid.evaluate((g: any) => g.shadowRoot.querySelectorAll('vi-query-grid-row').length);
}

/** The DOM index of the physical row that shows query.items[index] (lazy loading disabled while reading). */
export async function rowForItem(grid: Locator, index: number): Promise<Locator> {
    const domIndex = await grid.evaluate((g: any, index) => {
        const q = g.query;
        const lazy = q.disableLazyLoading;
        q.disableLazyLoading = true;
        try {
            const item = q.items[index];
            return [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].findIndex((r: any) => r.item === item && getComputedStyle(r).display !== 'none');
        }
        finally {
            q.disableLazyLoading = lazy;
        }
    }, index);
    expect(domIndex, `a row shows items[${index}]`).toBeGreaterThanOrEqual(0);

    return grid.locator('vi-query-grid-row').nth(domIndex);
}

/** The text of a cell, through its shadow root. */
export async function cellTexts(row: Locator): Promise<string[]> {
    return row.evaluate((r: any) => [...r.querySelectorAll(':scope > .column'), ...(r.shadowRoot?.querySelectorAll('.column') ?? [])].map((c: any) => {
        const root = c.shadowRoot;
        if (!root)
            return (c.textContent ?? '').trim();

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let text = '';
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (!node.parentElement?.closest('style'))
                text += node.textContent;
        }

        return text.trim();
    }));
}

/** Values of query.items[index] as the cells render them (display values). */
export async function itemDisplay(grid: Locator, index: number, columns = PEOPLE_COLUMNS) {
    return grid.evaluate((g: any, { index, columns }) => {
        const q = g.query;
        const lazy = q.disableLazyLoading;
        q.disableLazyLoading = true;
        try {
            const item = q.items[index];
            return item ? { id: item.id, values: columns.map(c => item.getValue(c)) } : null;
        }
        finally {
            q.disableLazyLoading = lazy;
        }
    }, { index, columns });
}

/** Moves the mouse over the grid body and wheels. */
export async function wheelGrid(page: Page, grid: Locator, dx: number, dy: number) {
    const b = await grid.evaluate((g: any) => {
        const scroller = [...g.shadowRoot.querySelectorAll('vi-scroller')].find((e: any) => !e.closest('header, vi-popup')) as HTMLElement;
        const r = scroller.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + Math.min(r.height / 2, 150) };
    });
    await page.mouse.move(b.x, b.y);
    await page.mouse.wheel(dx, dy);
}

/** Waits until the scroll offsets stopped changing and the grid shows its items. */
export async function settle(grid: Locator) {
    let last = '';
    await expect.poll(async () => {
        const o = await getScrollOffset(grid);
        const now = `${o.top}/${o.left}/${await hostVar(grid, '--vi-query-grid-horizontal')}`;
        const stable = now === last;
        last = now;
        return stable;
    }, { intervals: [100, 100, 150, 200, 250], timeout: 15000 }).toBe(true);
    await waitForGridReady(grid);
}

export async function openColumnMenu(grid: Locator, column: string) {
    // Before the first open the header renders a plain button; afterwards the popup menu's own header button (the first one stays hidden)
    await grid.locator(`vi-query-grid-column-header[name=${column}] vi-button[icon=CaretDown]`).filter({ visible: true }).first().click();
}

export async function columnMenuItem(grid: Locator, column: string, label: string) {
    await openColumnMenu(grid, column);
    await grid.locator(`vi-query-grid-column-header[name=${column}]`).getByText(label, { exact: true }).click();
}

export async function groupBy(grid: Locator, column: string, label: string) {
    await columnMenuItem(grid, column, `Group by ${label}`);
    await expect(grid).toHaveAttribute('has-grouping', '');
    await waitForGridReady(grid);
}

export async function groupingMenuItem(grid: Locator, label: 'Collapse all' | 'Expand all' | 'Remove grouping') {
    // Every item closes the menu, so open it first
    await grid.locator('vi-query-grid-grouping vi-button[icon=QueryGrid_Group]').click();
    const item = grid.locator('vi-query-grid-grouping').getByText(label, { exact: true });
    await expect(item).toBeVisible();
    await item.click();
}

/** Visible group rows with the text of their label. */
export async function groupRows(grid: Locator) {
    return grid.evaluate((g: any) => {
        const s = g.shadowRoot;
        const scroller = [...s.querySelectorAll('vi-scroller')].find((e: any) => !e.closest('header, vi-popup')) as HTMLElement;
        const view = scroller.getBoundingClientRect();
        return ([...s.querySelectorAll('vi-query-grid-row[is-group]')] as HTMLElement[])
            .map(r => ({ r, b: r.getBoundingClientRect() }))
            .filter(({ r, b }) => getComputedStyle(r).display !== 'none' && b.height > 0 && b.bottom > view.top + 1 && b.top < view.bottom - 1)
            .sort((a, b) => a.b.top - b.b.top)
            .map(({ r, b }) => {
                const group = r.querySelector('vi-query-grid-row-group') ?? r.shadowRoot?.querySelector('vi-query-grid-row-group');
                const label = group?.shadowRoot?.querySelector('label') ?? group?.querySelector('label');
                const lb = label?.getBoundingClientRect();
                return { text: (label?.textContent ?? '').trim(), top: b.top, left: b.left, width: b.width, height: b.height, labelX: lb ? Math.round(lb.x) : null };
            });
    });
}

/** Visibility and box of each row prefix part of a displayed data row. */
export async function prefixParts(row: Locator) {
    return row.evaluate((r: any) => Object.fromEntries(['groupspacer', 'selector', 'actions', 'filter', 'reorder'].map(p => {
        const e = r.shadowRoot?.querySelector(`[part=${p}]`) as HTMLElement | null;
        if (!e)
            return [p, null];

        const b = e.getBoundingClientRect();
        const shown = e.checkVisibility() && b.width > 0 && b.height > 0;
        return [p, shown ? { x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height) } : null];
    })));
}

/** Clicks the vi-query header label to close popups without hitting the grid. */
export async function clickQueryHeader(page: Page) {
    await page.locator('vi-query').filter({ visible: true }).first().locator('header').first().click();
}

export function consoleErrors(page: Page) {
    const errors: string[] = [];
    page.on('console', msg => {
        if (msg.type() === 'error')
            errors.push(msg.text());
    });
    return errors;
}

/** Records the open state of the grid's popups (header menus, inline actions, column filters). */
export async function openPopups(grid: Locator) {
    return grid.evaluate((g: any) => {
        const found: string[] = [];
        const walk = (root: ParentNode) => {
            root.querySelectorAll('vi-popup[open], vi-popup-menu[open]').forEach(p => found.push(p.tagName.toLowerCase() + '.' + (p as HTMLElement).className));
            root.querySelectorAll('*').forEach(e => e.shadowRoot && walk(e.shadowRoot));
        };
        walk(g.shadowRoot);
        return found;
    });
}

/** The select reference dialog (vi-app shows it in its shadow root). */
export function referenceDialog(page: Page): Locator {
    return page.locator('vi-select-reference-dialog');
}

export async function openAttributesReference(page: Page, attribute = 'Reference') {
    await openApp(page, ATTRIBUTES_REFERENCE);

    const reference = page.locator('vi-persistent-object-attribute-reference').filter({ has: page.locator('input') });
    await reference.first().waitFor({ timeout: 30000 });
    const index = await reference.evaluateAll((els, name) => els.findIndex((e: any) => e.attribute?.name === name), attribute);
    expect(index, `attribute ${attribute}`).toBeGreaterThanOrEqual(0);

    return reference.nth(index);
}

export async function browseReference(reference: Locator) {
    await reference.locator('vi-button:has(vi-icon[source=Ellipsis])').click();
    const dialog = referenceDialog(reference.page());
    await dialog.waitFor({ state: 'attached' });
    const grid = dialog.locator('vi-query-grid');
    await grid.waitFor({ state: 'attached' });
    await waitForGridReady(grid);

    return { dialog, grid };
}

/** Opens person 3 in edit mode and returns its EmergencyContact reference attribute. */
export async function openEmergencyContact(page: Page) {
    await openApp(page, 'home/person/3');

    const po = page.locator('vi-persistent-object').first();
    await po.locator('vi-action-button[name=Edit]').click({ timeout: 30000 });
    await expect(po.locator('vi-action-button[name=CancelEdit]')).toBeVisible();

    const reference = page.locator('vi-persistent-object-attribute-reference').filter({ visible: true });
    await expect.poll(() => reference.evaluateAll(els => els.map((e: any) => e.attribute?.name))).toContain('EmergencyContact');
    const index = await reference.evaluateAll(els => els.findIndex((e: any) => e.attribute?.name === 'EmergencyContact'));

    return { po, reference: reference.nth(index) };
}

export function dialogButton(dialog: Locator, label: 'OK' | 'Cancel' | 'New') {
    return dialog.locator('footer vi-button').filter({ hasText: label });
}
