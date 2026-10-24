import { expect, Locator, Page } from '@playwright/test';
import { waitForGridReady } from './query-grid';

/**
 * Helpers for the cell specs (vi-query-grid-cell-*). They only read public properties, rendered DOM
 * and computed styles.
 */

/**
 * Loads a query into `window.q` (sorted by FirstName when it has that column) without creating a grid,
 * so a test can change hints or values on the model first.
 */
export async function loadQuery(page: Page, query = 'People', options: { sortByFirstName?: boolean; queryOptions?: Record<string, any> } = {}) {
    const { sortByFirstName = true, queryOptions } = options;
    await page.evaluate(async ({ query, sortByFirstName, queryOptions }) => {
        const w = window as any;
        const q = await w.service.getQuery(query, queryOptions);
        if (sortByFirstName && q.columns.some((c: any) => c.name === 'FirstName') && q.sortOptions.map((o: any) => `${o.name} ${o.direction}`).join(';') !== 'FirstName ASC') {
            q.sortOptions = [{ name: 'FirstName', direction: 'ASC' }];
            await q.search();
        }

        w.q = q;
    }, { query, sortByFirstName, queryOptions });
}

/** Loads the Languages details query of person 3 into `window.q`. */
export async function loadLanguagesQuery(page: Page) {
    await page.evaluate(async () => {
        const w = window as any;
        const po = await w.service.getPersistentObject(null, 'Person', '3');
        const q = po.getAttribute('Languages').details;
        await q.search();
        w.q = q;
    });
}

/** Creates a vi-query-grid for `window.q`, appends it to the test container and waits until it is ready. */
export async function mountLoaded(page: Page, props: Record<string, any> = {}): Promise<Locator> {
    await page.evaluate(props => {
        const w = window as any;
        const grid = document.createElement('vi-query-grid') as any;
        Object.entries(props).forEach(([key, value]) => grid[key] = value);
        grid.query = w.q;
        document.getElementById('test-container')!.appendChild(grid);
        w.grid = grid;
    }, props);

    const grid = page.locator('#test-container > vi-query-grid');
    await waitForGridReady(grid);

    return grid;
}

/** Hides every column of `window.q` except the given ones (client-side, through QueryColumn.isHidden). */
export async function keepColumns(page: Page, names: string[]) {
    await page.evaluate(names => (window as any).q.columns.forEach((c: any) => c.isHidden = !names.includes(c.name)), names);
}

/** Merges type hints into the column of `window.q`. */
export async function setColumnHints(page: Page, column: string, hints: Record<string, string>) {
    await page.evaluate(({ column, hints }) => {
        const col = (window as any).q.getColumn(column);
        col.typeHints = { ...(col.typeHints ?? {}), ...hints };
    }, { column, hints });
}

export interface Box {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
}

export interface CellInfo {
    column: string;
    tag: string;
    classes: string[];
    attributes: string[];
    text: string;
    /** Computed styles of the element that holds the text (the host when the text is in no element) */
    textStyle: Record<string, string>;
    hostStyle: Record<string, string>;
    box: Box;
    /** Box of the element that holds the text */
    textElementBox: Box | null;
    /** Box of the rendered text (Range over the text nodes) */
    textBox: Box | null;
    /** Number of non-style elements inside the text element */
    textChildElements: number;
    /** Computed filters of the host and every element in its shadow root that is not a style */
    filters: string[];
    /** Visible images: computed background-image of shadow elements with one, or img src */
    images: { kind: 'background' | 'img'; value: string; visible: boolean }[];
    /** vi-icon elements in the shadow root, with the computed display of their check mark path */
    icons: { source: string; selected: boolean; hidden: boolean; checkDisplay: string | null }[];
}

export interface CellRow {
    index: number;
    top: number;
    cells: Record<string, CellInfo>;
}

const DEFAULT_STYLES = ['color', 'font-weight', 'font-style', 'text-align', 'background-color', 'border-radius', 'overflow', 'white-space', 'text-overflow', 'filter', 'padding-left', 'padding-right'];

/**
 * Describes every cell of the data rows that intersect the grid viewport, keyed by column name
 * (header order), with the absolute item index of the row.
 */
export async function readCells(grid: Locator, styles: string[] = DEFAULT_STYLES): Promise<CellRow[]> {
    return grid.evaluate((g: any, styles) => {
        const q = g.query;
        const scroller = [...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any;
        const view = scroller.getBoundingClientRect();
        const headers = [...g.shadowRoot.querySelectorAll('vi-query-grid-column-header')].filter((h: any) => getComputedStyle(h).display !== 'none').map((h: any) => h.getAttribute('name'));
        const toBox = (r: DOMRect | null): any => r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height } : null;
        const pick = (el: Element) => {
            const cs = getComputedStyle(el);
            return Object.fromEntries(styles.map(s => [s, cs.getPropertyValue(s)]));
        };

        const textNodes = (cell: Element) => {
            const root = cell.shadowRoot;
            const nodes: Text[] = [];
            if (!root)
                return nodes;

            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                if (node.parentElement?.closest('style'))
                    continue;

                nodes.push(node as Text);
            }

            return nodes;
        };

        const describe = (cell: HTMLElement, column: string) => {
            const nodes = textNodes(cell);
            const text = nodes.map(n => n.textContent).join('').trim();
            const firstText = nodes.find(n => n.textContent!.trim());
            const root = cell.shadowRoot;
            // The top-level shadow element that holds the text (markdown nests it in p/strong)
            const topLevel = root ? [...root.children].filter(c => !['STYLE', 'LINK'].includes(c.tagName)) : [];
            const textElement: Element = (firstText ? topLevel.find(c => c.contains(firstText)) : topLevel[0]) ?? null;

            let textBox = null;
            const visibleNodes = nodes.filter(n => n.textContent!.trim());
            if (visibleNodes.length) {
                const range = document.createRange();
                range.setStartBefore(visibleNodes[0]);
                range.setEndAfter(visibleNodes[visibleNodes.length - 1]);
                textBox = toBox(range.getBoundingClientRect());
            }

            const shadowElements = root ? [...root.querySelectorAll('*')].filter(e => !['STYLE', 'LINK'].includes(e.tagName)) : [];
            const images = shadowElements.flatMap((e: any) => {
                const visible = e.checkVisibility?.() !== false && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0;
                if (e.tagName === 'IMG')
                    return [{ kind: 'img', value: e.getAttribute('src') ?? '', visible }];

                const bg = getComputedStyle(e).backgroundImage;
                return bg && bg !== 'none' ? [{ kind: 'background', value: bg, visible }] : [];
            });

            return {
                column,
                tag: cell.tagName.toLowerCase(),
                classes: [...cell.classList],
                attributes: cell.getAttributeNames(),
                text,
                textStyle: pick(textElement ?? cell),
                hostStyle: pick(cell),
                box: toBox(cell.getBoundingClientRect()),
                textElementBox: textElement ? toBox(textElement.getBoundingClientRect()) : null,
                textBox,
                textChildElements: textElement && textElement !== cell ? textElement.querySelectorAll('*').length : 0,
                filters: [getComputedStyle(cell).filter, ...shadowElements.map(e => getComputedStyle(e).filter)],
                images,
                icons: shadowElements.filter(e => e.tagName === 'VI-ICON').map((e: any) => {
                    const check = e.shadowRoot?.querySelector('#check');
                    return { source: e.getAttribute('source'), selected: e.hasAttribute('is-selected'), hidden: e.checkVisibility?.() === false, checkDisplay: check ? getComputedStyle(check).display : null };
                })
            };
        };

        const lazy = q.disableLazyLoading;
        q.disableLazyLoading = true;
        try {
            return [...g.shadowRoot.querySelectorAll('vi-query-grid-row')]
                .map((r: any) => ({ r, b: r.getBoundingClientRect() }))
                .filter(({ r, b }) => !r.hasAttribute('is-group') && getComputedStyle(r).display !== 'none' && !r.classList.contains('hidden') && b.height > 0 && b.bottom > view.top + 1 && b.top < view.bottom - 1)
                .sort((a, b) => a.b.top - b.b.top)
                .map(({ r, b }) => {
                    const cells = [...r.querySelectorAll('.column'), ...(r.shadowRoot?.querySelectorAll('.column') ?? [])] as HTMLElement[];
                    return {
                        index: q.items.findIndex((i: any) => i === r.item),
                        top: Math.round(b.top - view.top),
                        cells: Object.fromEntries(cells.map((c, i) => [headers[i], describe(c, headers[i])]))
                    };
                });
        }
        finally {
            q.disableLazyLoading = lazy;
        }
    }, styles) as Promise<CellRow[]>;
}

/** The cells of the row that shows item `index` (fails when that row is not in the viewport). */
export async function rowCells(grid: Locator, index: number, styles?: string[]): Promise<Record<string, CellInfo>> {
    const rows = await readCells(grid, styles);
    const row = rows.find(r => r.index === index);
    expect(row, `row ${index} is in the viewport`).toBeTruthy();

    return row!.cells;
}

/** The center of the row that shows item `index`, in page coordinates. */
export async function rowCenter(grid: Locator, index: number) {
    return grid.evaluate((g: any, index) => {
        const q = g.query;
        const lazy = q.disableLazyLoading;
        q.disableLazyLoading = true;
        try {
            const row = [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].find((r: any) => r.item && r.item === q.items[index]) as HTMLElement;
            const b = row.getBoundingClientRect();
            return { x: b.left + Math.min(b.width / 2, 300), y: b.top + b.height / 2 };
        }
        finally {
            q.disableLazyLoading = lazy;
        }
    }, index);
}

/**
 * Moves the mouse over the grid body and scrolls it with the wheel, then waits until the grid settles.
 * With `move: false` the wheel turns wherever the pointer already is (e.g. over a hovered row).
 */
export async function wheelGrid(page: Page, grid: Locator, deltaY: number, options: { move?: boolean } = {}) {
    const { move = true } = options;
    const box = await grid.evaluate((g: any) => {
        const scroller = [...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any;
        const b = scroller.getBoundingClientRect();
        return { x: b.left + Math.min(b.width / 2, 300), y: b.top + b.height / 2 };
    });

    if (move)
        await page.mouse.move(box.x, box.y);
    const before = await scrollTop(grid);
    await page.mouse.wheel(0, deltaY);
    await expect.poll(() => scrollTop(grid)).not.toBe(before);
    let last = -1;
    await expect.poll(async () => {
        const top = await scrollTop(grid);
        const settled = top === last;
        last = top;
        return settled;
    }, { intervals: [100] }).toBe(true);
    await waitForGridReady(grid);
}

async function scrollTop(grid: Locator) {
    return grid.evaluate((g: any) => ([...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any).scroller.scrollTop as number);
}

/** Item values of `window.q` read without lazy loading. */
export async function itemsValues(grid: Locator, indexes: number[], columns: string[]) {
    return grid.evaluate((g: any, { indexes, columns }) => {
        const q = g.query;
        const lazy = q.disableLazyLoading;
        q.disableLazyLoading = true;
        try {
            return indexes.map(i => q.items[i] ? Object.fromEntries(columns.map(c => [c, q.items[i].getValue(c)])) : null);
        }
        finally {
            q.disableLazyLoading = lazy;
        }
    }, { indexes, columns });
}

export interface ItemDto {
    id: string;
    values: { key: string; value: string | null; objectId?: string; typeHints?: any }[];
    typeHints?: any;
}

/**
 * Patches the items of every GetQuery/ExecuteQuery response for the given query name before the client
 * sees them. `patch` gets each item dto and its Id value and changes it in place.
 */
export async function patchItems(page: Page, queryName: string, patch: (item: ItemDto, id: string | null) => void) {
    await page.route(/\/(GetQuery|ExecuteQuery)$/, async route => {
        const response = await route.fetch();
        let json: any;
        try {
            json = await response.json();
        }
        catch {
            return route.fulfill({ response });
        }

        const walk = (node: any, inQuery: boolean) => {
            if (!node || typeof node !== 'object')
                return;

            const isQuery = inQuery || node.name === queryName;
            if (Array.isArray(node.items) && isQuery) {
                node.items.forEach((item: any) => {
                    if (Array.isArray(item?.values))
                        patch(item, item.values.find((v: any) => v.key === 'Id')?.value ?? null);
                });
            }

            Object.values(node).forEach(child => walk(child, isQuery));
        };

        // ExecuteQuery responses carry the result only, the request names the query
        const body = route.request().postDataJSON?.();
        walk(json, body?.query?.name === queryName);

        await route.fulfill({ response, json });
    });
}

/** Sets (or removes, for null) one value of an item dto. */
export function setDtoValue(item: ItemDto, key: string, value: string | null) {
    const existing = item.values.find(v => v.key === key);
    if (value == null) {
        item.values = item.values.filter(v => v.key !== key);
        return;
    }

    if (existing)
        existing.value = value;
    else
        item.values.push({ key, value });
}

/** Loads a query of person 3 into `window.q`: an AsDetail attribute (e.g. 'Languages') or a detail query (e.g. 'Person_Addresses'). */
export async function loadPersonQuery(page: Page, name: string) {
    await page.evaluate(async name => {
        const w = window as any;
        const po = await w.service.getPersistentObject(null, 'Person', '3');
        const q = po.getAttribute(name)?.details ?? po.getQuery(name);
        await q.search();
        w.q = q;
    }, name);
}

export interface IconStyle {
    selected: boolean;
    /** False when the icon is not rendered (display none, hidden or zero size) */
    visible: boolean;
    iconBox: Box;
    svgBox: Box | null;
    cellBox: Box;
    /** Computed fill of the Selected icon's paths */
    fills: { box: string | null; backdrop: string | null; check: string | null };
    checkDisplay: string | null;
}

/**
 * The vi-icon of the given column's cell in every data row in the viewport (null when the cell has none),
 * with the absolute item index of the row.
 */
export async function iconStyles(grid: Locator, column: string): Promise<{ index: number; icon: IconStyle | null }[]> {
    return grid.evaluate((g: any, column) => {
        const q = g.query;
        const scroller = [...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any;
        const view = scroller.getBoundingClientRect();
        const headers = [...g.shadowRoot.querySelectorAll('vi-query-grid-column-header')].filter((h: any) => getComputedStyle(h).display !== 'none').map((h: any) => h.getAttribute('name'));
        const position = headers.indexOf(column);
        const toBox = (r: DOMRect): any => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height });

        const lazy = q.disableLazyLoading;
        q.disableLazyLoading = true;
        try {
            return [...g.shadowRoot.querySelectorAll('vi-query-grid-row')]
                .map((r: any) => ({ r, b: r.getBoundingClientRect() }))
                .filter(({ r, b }) => !r.hasAttribute('is-group') && getComputedStyle(r).display !== 'none' && !r.classList.contains('hidden') && b.height > 0 && b.bottom > view.top + 1 && b.top < view.bottom - 1)
                .sort((a, b) => a.b.top - b.b.top)
                .map(({ r }) => {
                    const cell = [...r.querySelectorAll('.column'), ...(r.shadowRoot?.querySelectorAll('.column') ?? [])][position] as HTMLElement;
                    const icon = cell.shadowRoot?.querySelector('vi-icon') as HTMLElement;
                    const index = q.items.findIndex((i: any) => i === r.item);
                    if (!icon)
                        return { index, icon: null };

                    const svg = icon.shadowRoot?.querySelector('svg');
                    const fill = (id: string) => {
                        const path = icon.shadowRoot?.querySelector(`#${id}`);
                        return path ? getComputedStyle(path).fill : null;
                    };
                    const check = icon.shadowRoot?.querySelector('#check');
                    const iconRect = icon.getBoundingClientRect();
                    return {
                        index,
                        icon: {
                            selected: icon.hasAttribute('is-selected'),
                            visible: icon.checkVisibility() && iconRect.width > 0 && iconRect.height > 0,
                            iconBox: toBox(iconRect),
                            svgBox: svg ? toBox(svg.getBoundingClientRect()) : null,
                            cellBox: toBox(cell.getBoundingClientRect()),
                            fills: { box: fill('box'), backdrop: fill('backdrop'), check: fill('check') },
                            checkDisplay: check ? getComputedStyle(check).display : null
                        }
                    };
                });
        }
        finally {
            q.disableLazyLoading = lazy;
        }
    }, column);
}

/** Reads RGBA pixels from a PNG screenshot (page coordinates relative to the screenshot), decoded in the page. */
export async function samplePixels(page: Page, png: Buffer, points: { x: number; y: number }[]): Promise<number[][]> {
    return page.evaluate(async ({ data, points }) => {
        const image = new Image();
        image.src = `data:image/png;base64,${data}`;
        await image.decode();

        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d')!;
        context.drawImage(image, 0, 0);

        return points.map(p => Array.from(context.getImageData(Math.round(p.x), Math.round(p.y), 1, 1).data));
    }, { data: png.toString('base64'), points });
}

/** Sets client-side values (and value-level type hints) on items of `window.q` before a grid renders them. */
export async function setItemValues(page: Page, values: { index: number; column: string; value?: any; valueHints?: Record<string, string> }[]) {
    await page.evaluate(values => {
        const q = (window as any).q;
        values.forEach(({ index, column, value, valueHints }) => {
            const item = q.items[index];
            if (value !== undefined)
                item.values[column] = value;
            if (valueHints)
                Object.assign(item.getFullValue(column).typeHints, valueHints);
        });
    }, values);
}

/**
 * Makes a value of an item dto an explicit null (the dev backend leaves null values out of the item,
 * which the client treats as a missing value).
 */
export function setDtoNull(item: ItemDto, key: string, typeHints?: Record<string, string>) {
    let value = item.values.find(v => v.key === key);
    if (!value)
        item.values.push(value = { key, value: null });

    value.value = null;
    if (typeHints)
        value.typeHints = { ...(value.typeHints ?? {}), ...typeHints };
}
