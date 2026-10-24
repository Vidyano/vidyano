import { expect, Locator, Page } from '@playwright/test';
import { nextFrames } from './query-grid';

/**
 * Helpers for the vi-query-grid "grid" specs (the grid host itself: initialization, layout,
 * virtual scrolling, grouping, horizontal scroll, selection, resize and settings).
 */

export interface AttachOptions {
    /** Query name. Default 'People'. */
    query?: string;
    /** textSearch applied (and searched) before the grid is attached */
    textSearch?: string;
    /** Normalizes the sort to FirstName ASC. Default true. */
    sortByFirstName?: boolean;
    /** Properties set on the grid before it is attached */
    props?: Record<string, any>;
    /** In-memory QueryGridSettings for the query, seeded before the grid loads them */
    userSettings?: Record<string, any>;
    /** QueryColumn widths set on the model before the grid is attached */
    columnWidths?: Record<string, string>;
    /** Selector of the element the grid is appended to. Default '#test-container'. */
    container?: string;
    /** Records every initializing-changed event (window.__initEvents) and [initializing] additions (window.__initAdds) from the start */
    record?: boolean;
    /** Reuse the query in window.q instead of getting a new one */
    reuseQuery?: boolean;
}

/**
 * Like mountGrid, but with more control over the moment the grid is attached. Returns the computed
 * --vi-query-grid-columns right after the grid was appended (the initial template).
 * The grid and its query are available in the page as `window.grid` and `window.q`.
 */
export async function attachGrid(page: Page, options: AttachOptions = {}): Promise<{ grid: Locator; initialColumns: string }> {
    const { query = 'People', textSearch, sortByFirstName = true, props = {}, userSettings, columnWidths, container = '#test-container', record = false, reuseQuery = false } = options;

    const initialColumns = await page.evaluate(async ({ query, textSearch, sortByFirstName, props, userSettings, columnWidths, container, record, reuseQuery }) => {
        const w = window as any;
        const q = reuseQuery ? w.q : await w.service.getQuery(query);
        if (!reuseQuery) {
            let search = false;
            if (sortByFirstName && q.columns.some((c: any) => c.name === 'FirstName') && q.sortOptions.map((o: any) => `${o.name} ${o.direction}`).join(';') !== 'FirstName ASC') {
                q.sortOptions = [{ name: 'FirstName', direction: 'ASC' }];
                search = true;
            }

            if (textSearch != null) {
                q.textSearch = textSearch;
                search = true;
            }

            if (search)
                await q.search();
        }

        if (userSettings)
            w.service.application.userSettings.QueryGridSettings[q.id] = userSettings;

        if (columnWidths)
            Object.entries(columnWidths).forEach(([name, width]) => q.getColumn(name).width = width);

        const grid = document.createElement('vi-query-grid') as any;
        if (record) {
            w.__initEvents = [];
            w.__initAdds = 0;
            grid.addEventListener('initializing-changed', (e: CustomEvent) => w.__initEvents.push({ value: e.detail.value, columns: getComputedStyle(grid).getPropertyValue('--vi-query-grid-columns').trim() }));
            new MutationObserver(() => {
                if (grid.hasAttribute('initializing'))
                    w.__initAdds++;
            }).observe(grid, { attributes: true, attributeFilter: ['initializing'] });
        }

        Object.entries(props).forEach(([key, value]) => grid[key] = value);
        grid.query = q;
        document.querySelector(container)!.appendChild(grid);

        w.grid = grid;
        w.q = q;

        return getComputedStyle(grid).getPropertyValue('--vi-query-grid-columns').trim();
    }, { query, textSearch, sortByFirstName, props, userSettings, columnWidths, container, record, reuseQuery });

    return { grid: page.locator(`${container} > vi-query-grid`), initialColumns };
}

/**
 * Starts counting [initializing] additions (window.__initAdds) and initializing-changed events (window.__initEvents) on an attached grid.
 */
export async function watchInitializing(grid: Locator) {
    await grid.evaluate((g: any) => {
        const w = window as any;
        w.__initEvents = [];
        w.__initAdds = 0;
        g.addEventListener('initializing-changed', (e: CustomEvent) => w.__initEvents.push({ value: e.detail.value, columns: getComputedStyle(g).getPropertyValue('--vi-query-grid-columns').trim() }));
        new MutationObserver(() => {
            if (g.hasAttribute('initializing'))
                w.__initAdds++;
        }).observe(g, { attributes: true, attributeFilter: ['initializing'] });
    });
}

export async function initializingAdds(page: Page): Promise<number> {
    return page.evaluate(() => (window as any).__initAdds);
}

export async function initializingEvents(page: Page): Promise<{ value: boolean; columns: string }[]> {
    return page.evaluate(() => (window as any).__initEvents);
}

/** A computed custom property of the grid host, trimmed. */
export async function hostVar(grid: Locator, name: string): Promise<string> {
    return grid.evaluate((g: any, name) => getComputedStyle(g).getPropertyValue(name).trim(), name);
}

/** The --vi-query-grid-columns tokens (split on whitespace outside parentheses). */
export async function columnTokens(grid: Locator, name = '--vi-query-grid-columns'): Promise<string[]> {
    const value = await hostVar(grid, name);
    return value.match(/[^\s(]+(\([^)]*\))?/g) ?? [];
}

export interface Box {
    x: number;
    right: number;
    width: number;
    top: number;
    bottom: number;
    height: number;
}

export interface HeaderBox extends Box {
    name: string;
    label: string;
    labelScrollWidth: number;
    labelClientWidth: number;
}

/** The visible column headers in DOM order with their boxes and label metrics. */
export async function headerBoxes(grid: Locator): Promise<HeaderBox[]> {
    return grid.evaluate((g: any) => [...g.shadowRoot.querySelectorAll('vi-query-grid-column-header')]
        .filter((h: any) => getComputedStyle(h).display !== 'none')
        .map((h: any) => {
            const b = h.getBoundingClientRect();
            const label = h.shadowRoot.querySelector('label') as HTMLElement;
            return {
                name: h.getAttribute('name'),
                label: label?.textContent?.trim() ?? '',
                labelScrollWidth: label?.scrollWidth ?? 0,
                labelClientWidth: label?.clientWidth ?? 0,
                x: b.left, right: b.right, width: b.width, top: b.top, bottom: b.bottom, height: b.height
            };
        }));
}

export interface CellBox extends Box {
    name: string;
    text: string;
    scrollWidth: number;
    clientWidth: number;
    textScrollWidth: number;
    textClientWidth: number;
    textOverflow: string;
    borderRight: number;
}

export interface RowInfo extends Box {
    /** Absolute position in the grid (content offset / row height) */
    position: number;
    /** Offset of the row top from the top of the scroll content */
    offset: number;
    /** Index of the row's item in query.items, -1 for groups and placeholders */
    index: number;
    isGroup: boolean;
    groupLabel: string | null;
    collapsed: boolean;
    loading: boolean;
    selected: boolean;
    actionsOpen: boolean;
    background: string;
    cells: CellBox[];
}

/**
 * The rows intersecting the grid viewport, sorted by position. Reads the model without lazy loading.
 */
export async function rows(grid: Locator, options: { all?: boolean } = {}): Promise<RowInfo[]> {
    return grid.evaluate((g: any, all) => {
        const q = g.query;
        const vs = [...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any;
        const se = vs.scroller as HTMLElement;
        const view = se.getBoundingClientRect();
        const contentTop = view.top - se.scrollTop;
        const rowHeight = parseFloat(getComputedStyle(g).getPropertyValue('--vi-query-grid-row-height'));
        const box = (b: DOMRect) => ({ x: b.left, right: b.right, width: b.width, top: b.top, bottom: b.bottom, height: b.height });

        const textOf = (cell: Element) => {
            const root = cell.shadowRoot;
            if (!root)
                return (cell.textContent ?? '').trim();

            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            let text = '';
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                if (node.parentElement?.closest('style'))
                    continue;

                text += node.textContent;
            }

            return text.trim();
        };

        const lazy = q.disableLazyLoading;
        q.disableLazyLoading = true;
        try {
            const items = q.items;
            return [...g.shadowRoot.querySelectorAll('vi-query-grid-row')]
                .map((r: any) => ({ r, b: r.getBoundingClientRect() }))
                .filter(({ r, b }) => all || (getComputedStyle(r).display !== 'none' && !r.classList.contains('hidden') && b.height > 0 && b.bottom > view.top + 1 && b.top < view.bottom - 1))
                .sort((a, b) => a.b.top - b.b.top)
                .map(({ r, b }) => {
                    const group = r.querySelector('vi-query-grid-row-group') ?? r.shadowRoot?.querySelector('vi-query-grid-row-group');
                    const isGroup = r.hasAttribute('is-group');
                    return {
                        ...box(b),
                        position: Math.round((b.top - contentTop) / rowHeight),
                        offset: b.top - contentTop,
                        index: isGroup ? -1 : items.indexOf(r.item),
                        isGroup,
                        groupLabel: isGroup && group ? (group.shadowRoot.querySelector('label')?.textContent ?? '').replace(/\s+/g, ' ').trim() : null,
                        collapsed: isGroup && !!group?.hasAttribute('collapsed'),
                        loading: r.classList.contains('loading'),
                        selected: r.hasAttribute('selected'),
                        actionsOpen: r.hasAttribute('actions-open'),
                        background: getComputedStyle(r).backgroundColor,
                        cells: [...r.querySelectorAll('.column'), ...(r.shadowRoot?.querySelectorAll('.column') ?? [])].map((c: any) => {
                            const t = c.shadowRoot?.querySelector('#text') as HTMLElement;
                            return {
                                ...box(c.getBoundingClientRect()),
                                name: c.column?.name,
                                text: textOf(c),
                                scrollWidth: c.scrollWidth,
                                clientWidth: c.clientWidth,
                                textScrollWidth: t?.scrollWidth ?? 0,
                                textClientWidth: t?.clientWidth ?? 0,
                                textOverflow: t ? getComputedStyle(t).textOverflow : '',
                                borderRight: parseFloat(getComputedStyle(c).borderRightWidth) || 0
                            };
                        })
                    };
                });
        }
        finally {
            q.disableLazyLoading = lazy;
        }
    }, !!options.all);
}

/** The bounding box of the grid body's scroll element. */
export async function scrollerBox(grid: Locator): Promise<Box> {
    return grid.evaluate((g: any) => {
        const vs = [...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any;
        const b = vs.scroller.getBoundingClientRect();
        return { x: b.left, right: b.right, width: b.width, top: b.top, bottom: b.bottom, height: b.height };
    });
}

export async function controlsBox(grid: Locator): Promise<Box> {
    return grid.evaluate((g: any) => {
        const b = g.shadowRoot.querySelector('.controls').getBoundingClientRect();
        return { x: b.left, right: b.right, width: b.width, top: b.top, bottom: b.bottom, height: b.height };
    });
}

/**
 * Waits until the rows in the viewport are rendered and loaded: at least one visible row, none loading, the rows
 * covering the viewport without a gap, the query idle. Waits two frames first so a pending scroll update is applied.
 */
export async function settle(grid: Locator, timeout = 15000) {
    await nextFrames(grid.page(), 2);
    await expect.poll(() => grid.evaluate((g: any) => {
        if (!g.query || g.query.isBusy)
            return false;

        const vs = [...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any;
        const view = vs.scroller.getBoundingClientRect();
        const pool = [...g.shadowRoot.querySelectorAll('vi-query-grid-row')];
        const visible = pool.filter((r: any) => {
            const b = r.getBoundingClientRect();
            return getComputedStyle(r).display !== 'none' && !r.classList.contains('hidden') && b.height > 0 && b.bottom > view.top + 1 && b.top < view.bottom - 1;
        });

        // Every strip of the viewport has a row, down to the last row when the rows run out (rows past the end are hidden)
        // or the grid content ends (maxRows rows fit in the viewport)
        const contentBottom = Math.min(view.bottom, view.top + vs.scroller.scrollHeight - vs.scroller.scrollTop, g.shadowRoot.querySelector('#gridWrapper').getBoundingClientRect().bottom);
        let covered = view.top;
        for (const b of visible.map((r: any) => r.getBoundingClientRect()).sort((a: DOMRect, b: DOMRect) => a.top - b.top)) {
            if (b.top > covered + 1)
                return false;

            covered = Math.max(covered, b.bottom);
        }

        if (covered < contentBottom - 1 && !pool.some((r: any) => r.classList.contains('hidden')))
            return false;

        return visible.length > 0 && visible.every((r: any) => !r.classList.contains('loading') && r.item && r.item.constructor?.name !== 'Object');
    }), { timeout }).toBe(true);
    await nextFrames(grid.page(), 2);
}

/** Moves the mouse over the grid body (away from the top-left popups) and sends a wheel event. */
export async function wheelGrid(grid: Locator, deltaX: number, deltaY: number) {
    const b = await scrollerBox(grid);
    await grid.page().mouse.move(b.x + b.width * 0.75, b.top + b.height * 0.75);
    await grid.page().mouse.wheel(deltaX, deltaY);
}

/** Number of open vi-popup elements anywhere in the document, including shadow roots. */
export async function openPopupCount(page: Page): Promise<number> {
    return page.evaluate(() => {
        let count = 0;
        const walk = (root: Document | ShadowRoot) => {
            root.querySelectorAll('*').forEach(el => {
                if (el.tagName === 'VI-POPUP' && el.hasAttribute('open'))
                    count++;

                if (el.shadowRoot)
                    walk(el.shadowRoot);
            });
        };
        walk(document);

        return count;
    });
}

export function header(grid: Locator, name: string): Locator {
    return grid.locator(`vi-query-grid-column-header[name="${name}"]`);
}

/**
 * Opens the column header menu (the caret button) and waits for it to be open. When the caret is outside the
 * grid viewport, the grid is scrolled horizontally first: a click outside it would make Playwright scroll the
 * overflow:hidden host itself, which no user can do.
 */
export async function openHeaderMenu(grid: Locator, name: string) {
    const h = header(grid, name);
    const caret = h.locator('vi-button[icon="CaretDown"]').first();
    await grid.evaluate((g: any, name) => {
        const scroller = ([...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any).scroller as HTMLElement;
        const headerElement = g.shadowRoot.querySelector(`vi-query-grid-column-header[name="${name}"]`) as HTMLElement;
        const button = headerElement.shadowRoot!.querySelector('vi-button[icon="CaretDown"]')!.getBoundingClientRect();
        const view = scroller.getBoundingClientRect();
        // Keep clear of the "more columns" chevron at the right edge
        const limit = view.right - 40;
        if (button.right > limit)
            scroller.scrollLeft += button.right - limit;
    }, name);
    await expect.poll(() => caret.evaluate((b: HTMLElement) => b.getBoundingClientRect().right <= document.documentElement.clientWidth - 40)).toBe(true);
    await caret.click();
    await expect(h.locator('vi-popup-menu-item[icon="Eye"]')).toBeVisible();
}

/** Clicks a header menu item by icon (SortAsc, SortDesc, QueryGrid_Group, Pin, Eye, Configure). */
export async function clickHeaderMenuItem(grid: Locator, name: string, icon: string) {
    await openHeaderMenu(grid, name);
    await header(grid, name).locator(`vi-popup-menu-item[icon="${icon}"]`).click();
}

/** Opens the grouping menu in the controls and clicks an item by icon. */
export async function clickGroupingMenuItem(grid: Locator, icon: 'QueryGrid_Group_Collapse' | 'QueryGrid_Group_Expand' | 'Remove') {
    await grid.locator('vi-query-grid-grouping vi-button[icon="QueryGrid_Group"]').click();
    const item = grid.locator(`vi-query-grid-grouping vi-popup-menu-item[icon="${icon}"]`);
    await expect(item).toBeVisible();
    await item.click();
}

/** The row element at a DOM position (rows are in grid order unless a reorder drag is in progress). */
export function rowAt(grid: Locator, domIndex: number): Locator {
    return grid.locator('vi-query-grid-row').nth(domIndex);
}

/** Selected item indexes of the grid's query, in selection order. */
export async function selectedIndexes(grid: Locator): Promise<number[]> {
    return grid.evaluate((g: any) => {
        const q = g.query;
        const lazy = q.disableLazyLoading;
        q.disableLazyLoading = true;
        try {
            return q.selectedItems.map((i: any) => q.items.indexOf(i));
        }
        finally {
            q.disableLazyLoading = lazy;
        }
    });
}

/** The values of a column for item indexes as strings, read without lazy loading (undefined when not loaded). */
export async function valuesOf(grid: Locator, indexes: number[], column: string): Promise<(string | undefined)[]> {
    return grid.evaluate((g: any, { indexes, column }) => {
        const q = g.query;
        const lazy = q.disableLazyLoading;
        q.disableLazyLoading = true;
        try {
            return indexes.map(i => {
                const item = q.items[i];
                if (!item)
                    return undefined;

                const value = item.getValue(column);
                return value == null ? '' : String(value);
            });
        }
        finally {
            q.disableLazyLoading = lazy;
        }
    }, { indexes, column });
}

/** Holds ExecuteQuery responses until the returned release function is called. */
export async function holdExecuteQuery(page: Page) {
    let release!: () => void;
    const gate = new Promise<void>(resolve => release = resolve);
    await page.route('**/ExecuteQuery', async route => {
        await gate;
        await route.continue();
    });

    return async () => {
        release();
    };
}

/** Collects console errors of the page. */
export function consoleErrors(page: Page) {
    const errors: string[] = [];
    page.on('console', msg => {
        if (msg.type() === 'error')
            errors.push(msg.text());
    });

    return errors;
}
