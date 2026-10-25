import { expect, Locator, Page } from '@playwright/test';
import { LoggedRequest, requestLog, waitForQueryIdle } from './query-grid';

/**
 * Helpers for the column filter, filters menu, filter dialog and grouping specs.
 */

/** Grey used for "remaining" distinct values (values outside the current result). */
export const REMAINING = 'rgb(170, 170, 170)';

/** The vi-query-grid-column-filter of a column. */
export function columnFilter(grid: Locator, column: string): Locator {
    return grid.locator(`vi-query-grid-column-header[name="${column}"] vi-query-grid-column-filter`);
}

/** The visible filter button in the header cell (before and after the popup was rendered). */
export function filterButton(cf: Locator): Locator {
    return cf.locator('vi-button').filter({ visible: true }).first();
}

/** The "Clear filter from <label>" item of an opened filter popup. */
export function clearItem(cf: Locator): Locator {
    return cf.locator('.menuItem');
}

export function searchInput(cf: Locator): Locator {
    return cf.locator('vi-input-search input');
}

/** The include/exclude toggle next to the search box. */
export function inverseButton(cf: Locator): Locator {
    return cf.locator('button:has(vi-icon[source="Filter_Inverse"])');
}

/** The resize handle of an opened filter popup: the element that shows the nwse-resize cursor. */
export async function resizeHandleBox(cf: Locator) {
    return cf.evaluate((host: Element) => {
        const deep = (root: ParentNode, out: Element[] = []): Element[] => {
            for (const el of root.querySelectorAll('*')) {
                out.push(el);
                if (el.shadowRoot)
                    deep(el.shadowRoot, out);
            }

            return out;
        };

        const handle = deep(host.shadowRoot!).find(el => getComputedStyle(el).cursor === 'nwse-resize' && el.checkVisibility());
        if (!handle)
            return null;

        const { x, y, width, height } = handle.getBoundingClientRect();
        return { x, y, width, height };
    });
}

/** The distinct row with exactly this text. */
export function distinctItem(cf: Locator, text: string): Locator {
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return cf.locator('.item').filter({ visible: true }).filter({ hasText: new RegExp(`^\\s*${escaped}\\s*$`) });
}

/** Clicks a distinct row and waits until the filter is done loading. */
export async function clickDistinct(cf: Locator, text: string) {
    await distinctItem(cf, text).click();
    await expect(cf).not.toHaveAttribute('loading');
}

/** The visible label of the filter button (its rendered text, '' when the label is hidden). */
export async function filterLabel(cf: Locator): Promise<string> {
    return (await filterButton(cf).innerText()).trim();
}

/** Opens the filter popup of a column with a mouse click and waits until the content is visible. */
export async function openFilter(grid: Locator, column: string): Promise<Locator> {
    const cf = columnFilter(grid, column);
    await filterButton(cf).click();
    await expect(clearItem(cf)).toBeVisible();
    await expect(cf).not.toHaveAttribute('loading');

    return cf;
}

export interface DistinctRow {
    text: string;
    hasMore: boolean;
    checked: boolean;
    type: string | null;
    color: string;
    opacity: string;
    html: string;
    top: number;
    bottom: number;
}

/**
 * The rendered distinct rows of an opened filter popup, in visual order. Rows outside the list's
 * scroll viewport are included (the list is virtualized, so long lists only render part).
 */
export async function distinctRows(cf: Locator): Promise<DistinctRow[]> {
    return cf.evaluate((host: Element) => {
        const deep = (root: ParentNode, out: Element[] = []): Element[] => {
            for (const el of root.querySelectorAll('*')) {
                out.push(el);
                if (el.shadowRoot)
                    deep(el.shadowRoot, out);
            }

            return out;
        };

        return deep(host.shadowRoot!)
            .filter(el => (el.classList.contains('item') || el.classList.contains('hasMore')) && el.checkVisibility())
            .map(el => {
                const span = el.querySelector('span[distinct-type]');
                const box = el.getBoundingClientRect();
                return {
                    text: (el as HTMLElement).innerText.trim(),
                    hasMore: el.classList.contains('hasMore'),
                    checked: !!el.querySelector('vi-checkbox[checked]'),
                    type: span?.getAttribute('distinct-type') ?? null,
                    color: span ? getComputedStyle(span).color : '',
                    opacity: getComputedStyle(el).opacity,
                    html: span?.innerHTML ?? '',
                    top: box.top,
                    bottom: box.bottom
                };
            })
            .sort((a, b) => a.top - b.top);
    });
}

/**
 * The distinct rows once the list stopped changing: the list renders its rows asynchronously after the
 * distincts or the selection change, so one-shot reads wait until two reads a few frames apart agree.
 */
export async function settledRows(cf: Locator): Promise<DistinctRow[]> {
    let previous = '';
    for (let attempt = 0; attempt < 100; attempt++) {
        const rows = await distinctRows(cf);
        const current = JSON.stringify(rows);
        if (rows.length > 0 && current === previous)
            return rows;

        previous = current;
        await cf.page().evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    }

    throw new Error('The distinct list did not settle');
}

export async function settledTexts(cf: Locator): Promise<string[]> {
    return (await settledRows(cf)).map(r => r.text);
}

export async function distinctTexts(cf: Locator): Promise<string[]> {
    return (await distinctRows(cf)).map(r => r.text);
}

/** The bounding box of the distinct list (vi-list) of an opened filter. */
export async function listBox(cf: Locator) {
    return cf.locator('vi-list').boundingBox();
}

/**
 * Scrolls the distinct list from top to bottom and collects every row once, in order.
 */
export async function allDistinctRows(cf: Locator): Promise<DistinctRow[]> {
    await settledRows(cf);

    const rows = new Map<number, DistinctRow>();
    let done = false;
    let offset = 0;
    while (!done) {
        const state = await cf.evaluate((host: Element, offset: number) => {
            const list = host.shadowRoot!.querySelector('vi-list')!;
            const scroller = (list.shadowRoot!.querySelector('vi-scroller') as any);
            const element = (scroller?.scroller ?? scroller) as HTMLElement;
            element.scrollTop = offset;
            return { top: element.scrollTop, max: element.scrollHeight - element.clientHeight, height: element.clientHeight };
        }, offset);

        await cf.page().evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
        const box = (await listBox(cf))!;
        for (const row of await distinctRows(cf)) {
            // The list recycles its rows: only rows inside the list viewport are current
            if (row.bottom <= box.y + 1 || row.top >= box.y + box.height - 1)
                continue;

            rows.set(Math.round((row.top - box.y + state.top) / Math.max(row.bottom - row.top, 1)), row);
        }

        // The list can still grow after a re-render, so re-read its size before deciding it is done
        const max = await cf.evaluate((host: Element) => {
            const scroller = (host.shadowRoot!.querySelector('vi-list')!.shadowRoot!.querySelector('vi-scroller') as any);
            const element = (scroller?.scroller ?? scroller) as HTMLElement;
            return element.scrollHeight - element.clientHeight;
        });
        done = state.top >= state.max && state.top >= max;
        offset = state.top + Math.max(state.height - 30, 20);
    }

    return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(e => e[1]);
}

/** Network spy for the column filter: RefreshColumn per column, ExecuteQuery count. */
export function filterLog(page: Page) {
    const log = requestLog(page);
    const refreshes = (column?: string) => log.of('ExecuteAction').filter(r => r.action === 'QueryFilter.RefreshColumn' && (!column || r.body?.parameters?.ColumnName === column));

    return {
        ...log,
        refreshes,
        queries: () => log.of('ExecuteQuery'),
        actions: (action?: string) => log.of('ExecuteAction').filter(r => !action || r.action === action)
    } as typeof log & { refreshes: (column?: string) => LoggedRequest[]; queries: () => LoggedRequest[]; actions: (action?: string) => LoggedRequest[] };
}

/** Column model state read in the page. */
export async function columnState(grid: Locator, column: string) {
    return grid.evaluate((g: any, column) => {
        const c = g.query.getColumn(column);
        return { selectedDistincts: [...c.selectedDistincts], inversed: !!c.selectedDistinctsInversed };
    }, column);
}

export async function totalItems(grid: Locator) {
    await waitForQueryIdle(grid);
    return grid.evaluate((g: any) => g.query.totalItems);
}

/** The vi-query-grid-filters control of the grid. */
export function filtersControl(grid: Locator): Locator {
    return grid.locator('vi-query-grid-filters');
}

/** Opens the filters menu (when it is not open yet). */
export async function openFiltersMenu(grid: Locator) {
    const control = filtersControl(grid);
    const popup = control.locator('vi-popup[open]');

    // The menu can still be open after an item that doesn't close it; clicking the button again would close it
    if (await popup.count() === 0)
        await control.locator('vi-popup-menu > vi-button[slot="header"]').click();

    await expect(popup).toHaveCount(1);
}

/** The visible items of the filters menu, as { tag, label, icon }. */
export async function filtersMenuItems(grid: Locator) {
    return filtersControl(grid).evaluate((host: Element) => {
        const deep = (root: ParentNode, out: Element[] = []): Element[] => {
            for (const el of root.querySelectorAll('*')) {
                out.push(el);
                if (el.shadowRoot)
                    deep(el.shadowRoot, out);
            }

            return out;
        };

        return deep(host.shadowRoot!)
            .filter(el => /^VI-POPUP-MENU-ITEM/.test(el.tagName) && el.checkVisibility())
            .map(el => {
                const box = el.getBoundingClientRect();
                return {
                    tag: el.tagName.toLowerCase(),
                    label: (el as any).label ?? null,
                    icon: el.shadowRoot?.querySelector('vi-icon#icon, vi-icon')?.getAttribute('source') ?? null,
                    buttons: [...el.querySelectorAll('vi-button')].map(b => b.getAttribute('icon')),
                    top: box.top
                };
            })
            .sort((a, b) => a.top - b.top);
    });
}

export interface InjectedFilter {
    name: string;
    isLocked?: boolean;
    isDefault?: boolean;
    /** The stored column filter data, e.g. [{ name: 'Gender', includes: ['|Female'], excludes: [] }] */
    columns?: { name: string; includes: string[]; excludes: string[] }[];
}

/**
 * Patches the GetQuery response of a query (People by default) so its filters PO holds these saved filters.
 * Nothing reaches the backend: the filters only exist in the page. Call before mountGrid.
 */
export async function injectFilters(page: Page, filters: InjectedFilter[], queryName = 'People') {
    await page.route('**/GetQuery', async route => {
        if (route.request().postDataJSON()?.id !== queryName)
            return route.continue();

        const response = await route.fetch();
        const json = await response.json();
        const attribute = json.query?.filters?.attributes?.find((a: any) => a.name === 'Filters');
        const template = attribute?.details?.persistentObject;
        if (!template)
            throw new Error(`The GetQuery response of ${queryName} has no filters to inject into`);

        const values: Record<string, (f: InjectedFilter) => string> = {
            Name: f => f.name,
            IsDefault: f => f.isDefault ? 'True' : 'False',
            IsLocked: f => f.isLocked ? 'True' : 'False',
            Columns: f => JSON.stringify(f.columns ?? [])
        };

        attribute.objects = [...(attribute.objects ?? []), ...filters.map((filter, index) => ({
            ...JSON.parse(JSON.stringify(template)),
            objectId: `pw-injected-${index}`,
            attributes: template.attributes.map((a: any) => ({ ...a, value: values[a.name]?.(filter) ?? a.value }))
        }))];

        await route.fulfill({ response, json });
    });
}

/** Patches the GetQuery response of a query (People by default) so it has no filters object. Call before mountGrid. */
export async function removeFilters(page: Page, queryName = 'People') {
    await page.route('**/GetQuery', async route => {
        if (route.request().postDataJSON()?.id !== queryName)
            return route.continue();

        const response = await route.fetch();
        const json = await response.json();
        delete json.query.filters;
        await route.fulfill({ response, json });
    });
}

export async function setSelectedDistincts(grid: Locator, column: string, values: string[], inversed?: boolean) {
    await grid.evaluate((g: any, { column, values, inversed }) => {
        const c = g.query.getColumn(column);
        c.selectedDistincts = values;
        if (inversed != null)
            c.selectedDistinctsInversed = inversed;
    }, { column, values, inversed });
}
