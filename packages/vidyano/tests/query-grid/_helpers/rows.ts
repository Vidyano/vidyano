import { expect, Locator, Page } from '@playwright/test';
import { scrollGrid, waitForGridReady } from './query-grid';

/**
 * Helpers for the rows group (vi-query-grid-row, -row-group, -footer and -select-all).
 */

/** The grid rows, in DOM order. */
export function rows(grid: Locator) {
    return grid.locator('vi-query-grid-row');
}

/**
 * The row element that currently shows q.items[index]. Resolved by item identity, so it also works
 * when the rows are rendered in another DOM order.
 */
export async function rowOf(grid: Locator, index: number): Promise<Locator> {
    const domIndex = await grid.evaluate((g: any, index) => {
        const q = g.query;
        const lazy = q.disableLazyLoading;
        q.disableLazyLoading = true;
        try {
            const item = q.items[index];
            return [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].findIndex((r: any) => r.item === item && !r.hasAttribute('is-group'));
        }
        finally {
            q.disableLazyLoading = lazy;
        }
    }, index);

    expect(domIndex, `a row shows item ${index}`).toBeGreaterThanOrEqual(0);
    return rows(grid).nth(domIndex);
}

/** The row element that currently shows the group header with the given group index. */
export async function groupRowOf(grid: Locator, groupIndex: number): Promise<Locator> {
    const domIndex = await grid.evaluate((g: any, groupIndex) => {
        const group = g.query.groupingInfo.groups[groupIndex];
        return [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].findIndex((r: any) => r.item === group && r.hasAttribute('is-group'));
    }, groupIndex);

    expect(domIndex, `a row shows group ${groupIndex}`).toBeGreaterThanOrEqual(0);
    return rows(grid).nth(domIndex);
}

/** The height of one row in px (from --vi-query-grid-row-height via a rendered row). */
export async function rowHeight(grid: Locator): Promise<number> {
    return grid.evaluate((g: any) => {
        const row = [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].find((r: any) => r.getBoundingClientRect().height > 0) as HTMLElement;
        return row.getBoundingClientRect().height;
    });
}

/** Scrolls the grid body so that row `index` is at the top. */
export async function scrollToRow(grid: Locator, index: number) {
    const height = await rowHeight(grid);
    await scrollGrid(grid, { top: index * height });
}

/** Scrolls to row `index` and waits until the grid shows loaded rows again. */
export async function scrollToRowAndWait(grid: Locator, index: number) {
    await scrollToRow(grid, index);
    await expect.poll(() => firstVisibleIndex(grid)).toBeGreaterThanOrEqual(0);
    await waitForGridReady(grid);
}

/** The absolute index of the first visible item row, -1 when none. */
export async function firstVisibleIndex(grid: Locator): Promise<number> {
    return grid.evaluate((g: any) => {
        const q = g.query;
        const scroller = [...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any;
        const view = scroller.getBoundingClientRect();
        const lazy = q.disableLazyLoading;
        q.disableLazyLoading = true;
        try {
            const row = [...g.shadowRoot.querySelectorAll('vi-query-grid-row')]
                .map((r: any) => ({ r, b: r.getBoundingClientRect() }))
                .filter(({ r, b }) => getComputedStyle(r).display !== 'none' && b.height > 0 && b.bottom > view.top + 1 && b.top < view.bottom - 1)
                .sort((a, b) => a.b.top - b.b.top)[0];

            return row && !row.r.hasAttribute('is-group') ? q.items.findIndex((i: any) => i === row.r.item) : -1;
        }
        finally {
            q.disableLazyLoading = lazy;
        }
    });
}

/**
 * Records item-tap events (item ids in window.__taps) and replaces service.hooks.onOpen with a spy
 * (window.__opens: objectId and whether ownerQuery is window.q). The spy does not call through.
 */
export async function spyTapAndOpen(page: Page) {
    await page.evaluate(() => {
        const w = window as any;
        w.__taps = [];
        w.__opens = [];
        document.addEventListener('item-tap', (e: any) => w.__taps.push(e.detail?.item?.id ?? null));
        w.service.hooks.onOpen = (obj: any) => w.__opens.push({ objectId: obj?.objectId, ownerIsQ: obj?.ownerQuery === w.q, type: obj?.constructor?.name });
    });
}

export async function taps(page: Page): Promise<any[]> {
    return page.evaluate(() => (window as any).__taps);
}

export async function opens(page: Page): Promise<{ objectId: string; ownerIsQ: boolean }[]> {
    return page.evaluate(() => (window as any).__opens);
}

/** The indexes (in q.items) of the selected items. */
export async function selectedIndexes(grid: Locator): Promise<number[]> {
    return grid.evaluate((g: any) => {
        const q = g.query;
        const lazy = q.disableLazyLoading;
        q.disableLazyLoading = true;
        try {
            return q.selectedItems.map((i: any) => q.items.indexOf(i)).sort((a: number, b: number) => a - b);
        }
        finally {
            q.disableLazyLoading = lazy;
        }
    });
}

export async function selectAllState(grid: Locator) {
    return grid.evaluate((g: any) => ({
        allSelected: g.query.selectAll.allSelected,
        inverse: g.query.selectAll.inverse,
        selectedItems: g.query.selectedItems.length,
        selectedItemCount: g.query.selectedItemCount
    }));
}

/** Sets isSelected on q.items[index] from the model. */
export async function setSelected(grid: Locator, index: number, selected: boolean) {
    await grid.evaluate((g: any, { index, selected }) => {
        const q = g.query;
        const lazy = q.disableLazyLoading;
        q.disableLazyLoading = true;
        try {
            q.items[index].isSelected = selected;
        }
        finally {
            q.disableLazyLoading = lazy;
        }
    }, { index, selected });
}

/**
 * Patches the GetQuery and ExecuteQuery responses of the given query so the result carries a total item.
 */
export async function injectTotalItem(page: Page, values: { key: string; value: string | null }[], typeHints?: Record<string, string>) {
    const totalItem = { id: 'total', values, ...(typeHints ? { typeHints } : {}) };
    const patch = (result: any) => {
        if (result)
            result.totalItem = totalItem;
    };

    await page.route(/\/(GetQuery|ExecuteQuery)$/, async route => {
        const response = await route.fetch();
        const json = await response.json();
        if (/GetQuery$/.test(route.request().url()))
            patch(json.query?.result);
        else
            patch(json.result);

        await route.fulfill({ response, json });
    });
}

/**
 * Holds every ExecuteQuery request for a page beyond the first (skip > 0) until `release` is called.
 */
export async function holdPageLoads(page: Page) {
    const held: (() => Promise<void>)[] = [];
    let holding = true;

    await page.route(/\/ExecuteQuery$/, async route => {
        const body = route.request().postDataJSON();
        if (!holding || !(body?.query?.skip > 0))
            return route.continue();

        await new Promise<void>(resolve => held.push(async () => {
            await route.continue().catch(() => {});
            resolve();
        }));
    });

    return {
        get count() {
            return held.length;
        },
        async release() {
            holding = false;
            await Promise.all(held.splice(0).map(r => r()));
        }
    };
}

/** The bounding x of every element matching `selector` inside the rows, keyed per row in DOM order. */
export async function boxes(locator: Locator) {
    return locator.evaluateAll((els: Element[]) => els.map(e => {
        const b = e.getBoundingClientRect();
        return { x: b.x, y: b.y, width: b.width, height: b.height };
    }));
}

/**
 * Patches every item in the GetQuery and ExecuteQuery responses whose id is a key of `hints` so it carries
 * those item type hints (e.g. { '1': { extraclass: 'disabled' } }), as the server would send them.
 */
export async function patchItemHints(page: Page, hints: Record<string, Record<string, string>>) {
    await page.route(/\/(GetQuery|ExecuteQuery)$/, async route => {
        const response = await route.fetch();
        let json: any;
        try {
            json = await response.json();
        }
        catch {
            return route.fulfill({ response });
        }

        const walk = (node: any) => {
            if (!node || typeof node !== 'object')
                return;

            if (Array.isArray(node.items)) {
                node.items.forEach((item: any) => {
                    if (item && typeof item.id === 'string' && hints[item.id])
                        item.typeHints = { ...(item.typeHints ?? {}), ...hints[item.id] };
                });
            }

            Object.values(node).forEach(walk);
        };

        walk(json);
        await route.fulfill({ response, json });
    });
}

/**
 * Like mountGrid, but runs `prepare(q, window)` in the page on the fresh query before the grid is created
 * (e.g. to set maxSelectedItems, column type hints or a grouping before the grid binds the query).
 */
export async function mountPrepared(page: Page, options: { query?: string; queryOptions?: Record<string, any>; props?: Record<string, any>; prepare?: (q: any, w: any) => any; wait?: boolean } = {}): Promise<Locator> {
    const { query = 'People', queryOptions, props = {}, prepare, wait = true } = options;

    await page.evaluate(async ({ query, queryOptions, props, prepare }) => {
        const w = window as any;
        const q = await w.service.getQuery(query, queryOptions);
        if (q.columns.some((c: any) => c.name === 'FirstName') && q.sortOptions.map((o: any) => `${o.name} ${o.direction}`).join(';') !== 'FirstName ASC') {
            q.sortOptions = [{ name: 'FirstName', direction: 'ASC' }];
            await q.search();
        }

        if (prepare)
            await new Function(`return (${prepare})`)()(q, w);

        const grid = document.createElement('vi-query-grid') as any;
        Object.entries(props).forEach(([key, value]) => grid[key] = value);
        grid.query = q;
        document.getElementById('test-container')!.appendChild(grid);

        w.grid = grid;
        w.q = q;
    }, { query, queryOptions, props, prepare: prepare?.toString() });

    const grid = page.locator('#test-container > vi-query-grid');
    if (wait)
        await waitForGridReady(grid);

    return grid;
}

/**
 * Swaps grid.query to a fresh query (sorted on FirstName when it has that column), after `prepare(q, window)`.
 * The new query becomes window.q; the previous one is kept as window.previousQ.
 */
export async function swapQuery(grid: Locator, query: string, prepare?: (q: any, w: any) => any) {
    await grid.evaluate(async (g: any, { query, prepare }) => {
        const w = window as any;
        const q = await w.service.getQuery(query);
        if (q.columns.some((c: any) => c.name === 'FirstName') && q.sortOptions.map((o: any) => `${o.name} ${o.direction}`).join(';') !== 'FirstName ASC') {
            q.sortOptions = [{ name: 'FirstName', direction: 'ASC' }];
            await q.search();
        }

        if (prepare)
            await new Function(`return (${prepare})`)()(q, w);

        w.previousQ = g.query;
        g.query = q;
        w.q = q;
    }, { query, prepare: prepare?.toString() });

    await waitForGridReady(grid);
}

/** The open context-menu popup of the grid (not an inline [part=actions] popup). */
export function contextPopup(grid: Locator) {
    return grid.locator('vi-popup[open]:not([part=actions])');
}

/** The number of context-menu popups (open or not) the rows added to the grid's shadow root. */
export async function contextPopupCount(grid: Locator) {
    return grid.evaluate((g: any) => [...g.shadowRoot.children].filter((c: Element) => c.tagName === 'VI-POPUP').length);
}

/** Records whether each document contextmenu event was defaultPrevented (read with `contextMenuEvents`). */
export async function recordContextMenu(page: Page) {
    await page.evaluate(() => {
        const w = window as any;
        w.__contextmenu = [];
        // Bubble phase on window, after the grid's own listeners ran
        window.addEventListener('contextmenu', e => w.__contextmenu.push(e.defaultPrevented));
    });
}

export async function contextMenuEvents(page: Page): Promise<boolean[]> {
    return page.evaluate(() => (window as any).__contextmenu);
}

/**
 * Every element under the point, from the document down through the open shadow roots
 * (the deepest hit last), described by tag name, part and classes.
 */
export async function deepHitChain(page: Page, x: number, y: number) {
    return page.evaluate(({ x, y }) => {
        const chain: Element[] = [];
        let root: Document | ShadowRoot = document;
        for (let el = root.elementFromPoint(x, y); el && !chain.includes(el); el = root.elementFromPoint(x, y)) {
            chain.push(el);
            if (!el.shadowRoot)
                break;

            root = el.shadowRoot;
        }

        return chain.map(e => ({ tag: e.tagName.toLowerCase(), part: e.getAttribute('part'), classes: [...e.classList], marked: !!(e as any).__marker }));
    }, { x, y });
}

/** The number of vi-popup elements in the document, including every open shadow root. */
export async function deepPopupCount(page: Page) {
    return page.evaluate(() => {
        let count = 0;
        const walk = (root: Document | ShadowRoot) => {
            root.querySelectorAll('*').forEach(e => {
                if (e.tagName === 'VI-POPUP')
                    count++;

                if (e.shadowRoot)
                    walk(e.shadowRoot);
            });
        };
        walk(document);
        return count;
    });
}
