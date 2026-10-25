import { test, expect, Locator, Page } from '@playwright/test';
import { gridPage, mountGrid, getScrollOffset, scrollGrid, requestLog, nextFrames, openView } from '../_helpers/query-grid';
import { holdExecuteQuery, rowAt, rows, scrollerBox, settle, valuesOf, wheelGrid } from '../_helpers/grid';

/**
 * Unknown totals: QueryGrid_Continuation (see README.md) pages with continuation tokens.
 * 1,234 rows, pageSize 100, default sort Id, so row index i has id i + 1 and Code 'Row %04d'.
 * The server answers totalItems -1 and a token "offset:<n>" while rows follow; the last page (34 rows) has no token
 * and the real total.
 */

const RH = 32;
const QUERY = 'QueryGrid_Continuation';
const TOTAL = 1234;
/** Page height that gives the grid body a viewport of 640px (the header is 66px) */
const HEIGHT_640 = 706;
/** Every token the client sends while it walks the whole query, in order */
const ALL_TOKENS = Array.from({ length: 12 }, (_, i) => `offset:${(i + 1) * 100}`);

const code = (index: number) => `Row ${String(index + 1).padStart(4, '0')}`;

interface PageRequest {
    continuation: string | null;
    skip?: number;
    top?: number;
    /** Filled when the response arrived */
    items?: number;
    totalItems?: number;
    next?: string | null;
}

/** Records every ExecuteQuery with its continuation token and what the server answered. */
function pagingLog(page: Page) {
    const log = requestLog(page);
    const pages: PageRequest[] = [];
    const entries = new Map<any, PageRequest>();

    page.on('request', request => {
        if (!request.url().endsWith('/ExecuteQuery') || request.method() !== 'POST')
            return;

        const query = request.postDataJSON()?.query ?? {};
        const entry: PageRequest = { continuation: query.continuation ?? null, skip: query.skip, top: query.top };
        entries.set(request, entry);
        pages.push(entry);
    });
    page.on('requestfinished', async request => {
        const entry = entries.get(request);
        if (!entry)
            return;

        try {
            const json = await (await request.response())!.json();
            const result = json.result ?? json.query?.result;
            entry.items = result?.items?.length ?? 0;
            entry.totalItems = result?.totalItems;
            entry.next = result?.continuation ?? null;
        }
        catch {
            entry.items = -1;
        }
    });

    return {
        pages,
        tokens: () => pages.map(p => p.continuation),
        clear: () => pages.splice(0, pages.length),
        /** Waits until the network is quiet and every response was read */
        async quiet() {
            await log.quiet();
            await expect.poll(() => pages.every(p => p.items !== undefined)).toBe(true);
        }
    };
}

interface ContinuationState {
    hasMore: boolean;
    totalItems: number;
    itemsLength: number;
    label: string;
    busy: boolean;
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
}

async function state(grid: Locator): Promise<ContinuationState> {
    return grid.evaluate((g: any) => {
        const q = g.query;
        const se = ([...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any).scroller as HTMLElement;
        return {
            hasMore: q.hasMore,
            totalItems: q.totalItems,
            itemsLength: q.items.length,
            label: q.labelWithTotalItems,
            busy: q.isBusy,
            scrollTop: se.scrollTop,
            scrollHeight: se.scrollHeight,
            clientHeight: se.clientHeight
        };
    });
}

/** The ids of the loaded items by index (null when not loaded), read without lazy loading. */
async function loadedIds(grid: Locator): Promise<(string | null)[]> {
    return grid.evaluate((g: any) => {
        const q = g.query;
        const lazy = q.disableLazyLoading;
        q.disableLazyLoading = true;
        try {
            const ids: (string | null)[] = [];
            for (let i = 0; i < q.totalItems; i++)
                ids.push(q.items[i]?.id ?? null);

            return ids;
        }
        finally {
            q.disableLazyLoading = lazy;
        }
    });
}

/** Asserts that rows 0..count-1 are loaded with id index + 1 (default sort), without gaps or duplicates. */
async function expectLoadedInOrder(grid: Locator, count: number) {
    const ids = await loadedIds(grid);
    expect(ids.length, 'loaded rows').toBe(count);
    const wrong = ids.map((id, i) => id === String(i + 1) ? null : `items[${i}] is ${id}`).filter(x => x);
    expect(wrong.slice(0, 5), 'rows at their index').toEqual([]);
}

/** Records every hasMore and totalItems change of the grid's query in window.__history. */
async function recordTotals(grid: Locator) {
    await grid.evaluate((g: any) => {
        const w = window as any;
        w.__history = [];
        g.query.propertyChanged.attach((_: any, d: any) => {
            if (d.propertyName === 'hasMore' || d.propertyName === 'totalItems')
                w.__history.push(`${d.propertyName}=${d.newValue}`);
        });
    });
}

async function totalsHistory(page: Page): Promise<string[]> {
    return page.evaluate(() => (window as any).__history);
}

async function waitIdle(grid: Locator) {
    await expect.poll(() => grid.evaluate((g: any) => !g.query.isBusy)).toBe(true);
}

/** Scrolls the grid body to its current end. */
async function scrollToEnd(grid: Locator) {
    await scrollGrid(grid, { top: 1e8 });
}

/**
 * Scrolls to the end until the query has no more rows: each round must load at least one more page.
 * Returns the number of rounds.
 */
async function scrollUntilComplete(grid: Locator, scroll: (grid: Locator) => Promise<void> = scrollToEnd, maxRounds = 20) {
    for (let round = 1; round <= maxRounds; round++) {
        const before = await state(grid);
        if (!before.hasMore)
            return round - 1;

        await scroll(grid);
        await expect.poll(async () => {
            const s = await state(grid);
            return !s.busy && (!s.hasMore || s.totalItems > before.totalItems);
        }, { message: `round ${round}: the next page after ${before.totalItems} rows did not load` }).toBe(true);
    }

    if (maxRounds === 20)
        throw new Error('The query still has more rows after 20 rounds');

    return maxRounds;
}

/** Scrolls to the end once and waits for the next page. */
async function loadNextPage(grid: Locator) {
    await scrollUntilComplete(grid, scrollToEnd, 1);
}

async function mountContinuation(page: Page, props: Record<string, any> = {}) {
    await gridPage(page, { height: HEIGHT_640 });
    return mountGrid(page, { query: QUERY, sortByFirstName: false, props });
}

/** Clicks the selector of the row that shows the item at index. */
async function clickSelector(grid: Locator, index: number) {
    const domIndex = await grid.evaluate((g: any, index) => {
        const q = g.query;
        const lazy = q.disableLazyLoading;
        q.disableLazyLoading = true;
        try {
            return [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].findIndex((r: any) => !r.classList.contains('hidden') && q.items.indexOf(r.item) === index);
        }
        finally {
            q.disableLazyLoading = lazy;
        }
    }, index);
    expect(domIndex, `row ${index} is rendered`).toBeGreaterThanOrEqual(0);
    await rowAt(grid, domIndex).locator('[part~="selector"]').click();
}

async function selectedIds(grid: Locator): Promise<string[]> {
    return grid.evaluate((g: any) => g.query.selectedItems.map((i: any) => i.id));
}

/** Asserts every visible row sits at its index and shows that item's Code (default sort). */
async function expectRowsShowTheirCode(grid: Locator, step: string) {
    const visible = await rows(grid);
    expect(visible.length, step).toBeGreaterThan(0);
    visible.forEach(r => {
        expect(r.loading, `${step}: row at position ${r.position} loading`).toBe(false);
        expect(r.index, `${step}: row at position ${r.position}`).toBe(r.position);
        expect(r.cells.find(c => c.name === 'Code')?.text, `${step}: row ${r.index}`).toBe(code(r.index));
    });
}

/** The Amount of every loaded item by index, read without lazy loading. */
async function loadedAmounts(grid: Locator): Promise<{ id: string; amount: number }[]> {
    return grid.evaluate((g: any) => {
        const q = g.query;
        const lazy = q.disableLazyLoading;
        q.disableLazyLoading = true;
        try {
            return Array.from({ length: q.totalItems }, (_, i) => ({ id: q.items[i]?.id, amount: Number(q.items[i]?.getValue('Amount')) }));
        }
        finally {
            q.disableLazyLoading = lazy;
        }
    });
}

/** Grocery, Computers, Health and Home hold exactly 200 rows: two full pages. */
const DEPARTMENTS_200 = ['|Grocery', '|Computers', '|Health', '|Home'];

async function filterTo200(grid: Locator) {
    await grid.evaluate(async (g: any, departments) => {
        const column = g.query.getColumn('Department');
        column.selectedDistincts = departments;
        column.selectedDistinctsInversed = false;
        await g.query.search();
    }, DEPARTMENTS_200);
}

/** Asserts the 200-row result is complete and that the end of the grid sends nothing more. */
async function expectEndsAt200(grid: Locator, paging: ReturnType<typeof pagingLog>) {
    const s = await state(grid);
    expect(s.hasMore).toBe(false);
    expect(s.totalItems).toBe(200);
    expect(s.itemsLength).toBe(200);
    expect(s.label).toBe('200 Continuation (unknown total)');
    expect(s.scrollHeight).toBe(200 * RH);
    const ids = await loadedIds(grid);
    expect(ids.every(id => id !== null)).toBe(true);
    expect(new Set(ids).size).toBe(200);

    const requests = paging.pages.length;
    await scrollToEnd(grid);
    await settle(grid);
    const visible = await rows(grid);
    expect(visible.at(-1)!.index).toBe(199);
    expect(Math.abs(visible.at(-1)!.bottom - (await scrollerBox(grid)).bottom)).toBeLessThanOrEqual(1);
    expect((await rows(grid, { all: true })).filter(r => r.loading && r.height > 0).map(r => r.position), 'no visible placeholder').toEqual([]);
    await paging.quiet();
    expect(paging.pages).toHaveLength(requests);
}

test.describe('Unknown totals (continuation)', () => {
    test('first render shows the first page with an open end', { annotation: [{ type: 'case', description: 'grid.ct-first-render' }] }, async ({ page }) => {
        await gridPage(page, { height: HEIGHT_640 });
        const log = requestLog(page);
        const grid = await mountGrid(page, { query: QUERY, sortByFirstName: false });
        await log.quiet();

        expect(log.of('GetQuery')).toHaveLength(1);
        expect(log.of('ExecuteQuery')).toHaveLength(0);

        const s = await state(grid);
        expect(s.hasMore).toBe(true);
        expect(s.totalItems).toBe(100);
        expect(s.itemsLength).toBe(100);
        expect(s.label).toBe('100+ Continuation (unknown total)');
        expect(s.clientHeight).toBe(640);
        // The loaded rows are all reachable, and the open end lets the user scroll on into the next page
        expect(s.scrollHeight).toBeGreaterThanOrEqual(100 * RH);
        expect(s.scrollHeight).toBeLessThanOrEqual(100 * RH + s.clientHeight);

        await expectRowsShowTheirCode(grid, 'top');
        expect((await rows(grid)).map(r => r.index)).toEqual(Array.from({ length: 20 }, (_, i) => i));
        await expectLoadedInOrder(grid, 100);
    });

    test('reaching the last loaded row loads the next page', { annotation: [{ type: 'case', description: 'grid.ct-next-page-at-end' }] }, async ({ page }) => {
        const grid = await mountContinuation(page);
        const paging = pagingLog(page);
        const release = await holdExecuteQuery(page);

        // Reaching the last loaded row requests the next page with the token, once
        await scrollToEnd(grid);
        await expect.poll(() => paging.tokens()).toEqual(['offset:100']);
        const atEnd = await state(grid);
        const top = atEnd.scrollTop;
        // The last loaded row is in view; an open end may add up to a viewport of scroll room past it
        expect(top).toBeGreaterThanOrEqual(100 * RH - 640);
        expect(top).toBeLessThanOrEqual(100 * RH);
        expect(atEnd.scrollHeight).toBeLessThanOrEqual(100 * RH + atEnd.clientHeight);

        // The grid may or may not render rows past the loaded count while the page loads; any it renders are
        // loading placeholders without stale text
        const pending = (await rows(grid, { all: true })).filter(r => r.position >= 100 && r.height > 0);
        pending.forEach(r => {
            expect(r.loading, `position ${r.position}`).toBe(true);
            r.cells.forEach(c => expect(c.text, `position ${r.position}: no stale text`).toBe(''));
        });
        await scrollToEnd(grid);
        await nextFrames(page, 2);
        expect(paging.tokens(), 'the page is requested once').toEqual(['offset:100']);
        // Scrolling on into the open end stays within it while the page loads
        const loading = await state(grid);
        expect(loading.scrollTop).toBeGreaterThanOrEqual(top);
        expect(loading.scrollTop).toBeLessThanOrEqual(100 * RH);
        expect(loading.scrollHeight).toBeLessThanOrEqual(100 * RH + loading.clientHeight);

        await release();
        await paging.quiet();
        await waitIdle(grid);

        expect(paging.pages.map(p => ({ continuation: p.continuation, top: p.top, items: p.items, next: p.next }))).toEqual([
            { continuation: 'offset:100', top: 100, items: 100, next: 'offset:200' }
        ]);
        const s = await state(grid);
        expect(s.hasMore).toBe(true);
        expect(s.totalItems).toBe(200);
        expect(s.itemsLength).toBe(200);
        expect(s.label).toBe('200+ Continuation (unknown total)');
        expect(s.scrollHeight).toBeGreaterThanOrEqual(200 * RH);
        expect(s.scrollHeight).toBeLessThanOrEqual(200 * RH + s.clientHeight);
        // The arriving page does not move the scroll position
        expect(s.scrollTop).toBe(loading.scrollTop);
        await expectLoadedInOrder(grid, 200);

        // The new rows render at their index
        await scrollGrid(grid, { top: 95 * RH });
        await settle(grid);
        await expectRowsShowTheirCode(grid, 'rows 95..114');
        expect((await rows(grid)).map(r => r.index)).toEqual(Array.from({ length: 20 }, (_, i) => 95 + i));
        await paging.quiet();
        expect(paging.pages).toHaveLength(1);
    });

    test('scrolling to the end walks every token and stops at the real end', { annotation: [{ type: 'case', description: 'grid.ct-scroll-to-end' }] }, async ({ page }) => {
        const grid = await mountContinuation(page);
        await recordTotals(grid);
        const paging = pagingLog(page);

        const rounds = await scrollUntilComplete(grid);
        await settle(grid);
        await paging.quiet();
        expect(rounds).toBe(12);

        // One request per page, each with the token of the previous page and the page size
        expect(paging.tokens()).toEqual(ALL_TOKENS);
        paging.pages.forEach(p => expect(p.top, p.continuation!).toBe(100));
        paging.pages.slice(0, -1).forEach((p, i) => {
            expect(p.items, p.continuation!).toBe(100);
            expect(p.next, p.continuation!).toBe(ALL_TOKENS[i + 1]);
        });
        // The partial last page has no token and the real total
        expect(paging.pages.at(-1)).toMatchObject({ continuation: 'offset:1200', items: 34, next: null, totalItems: TOTAL });

        // While hasMore stays true the total only grows a page at a time; hasMore turns false once and the total ends at the real count
        const history = await totalsHistory(page);
        const totals = history.filter(h => h.startsWith('totalItems=')).map(h => Number(h.split('=')[1]));
        expect(totals).toEqual([...Array.from({ length: 11 }, (_, i) => (i + 2) * 100), TOTAL]);
        expect(history.filter(h => h.startsWith('hasMore='))).toEqual(['hasMore=false']);

        const s = await state(grid);
        expect(s.hasMore).toBe(false);
        expect(s.totalItems).toBe(TOTAL);
        expect(s.itemsLength).toBe(TOTAL);
        expect(s.label).toMatch(/^1[.,]?234 Continuation \(unknown total\)$/);
        expect(s.scrollHeight).toBe(TOTAL * RH);
        await expectLoadedInOrder(grid, TOTAL);

        // At the new end the last row is the last item, flush with the bottom, and nothing past it
        await scrollToEnd(grid);
        await settle(grid);
        const visible = await rows(grid);
        expect(visible.at(-1)!.index).toBe(TOTAL - 1);
        expect(visible.at(-1)!.cells.find(c => c.name === 'Code')?.text).toBe(code(TOTAL - 1));
        expect(Math.abs(visible.at(-1)!.bottom - (await scrollerBox(grid)).bottom)).toBeLessThanOrEqual(1);
        expect((await rows(grid, { all: true })).filter(r => r.loading)).toEqual([]);
        await expectRowsShowTheirCode(grid, 'bottom');

        // Further scrolling, at the end and back over loaded rows, sends nothing
        paging.clear();
        await scrollToEnd(grid);
        await wheelGrid(grid, 0, 2000);
        await scrollGrid(grid, { top: 0 });
        await settle(grid);
        await scrollGrid(grid, { top: 600 * RH });
        await settle(grid);
        await expectRowsShowTheirCode(grid, 'row 600');
        await scrollToEnd(grid);
        await settle(grid);
        await paging.quiet();
        expect(paging.pages).toEqual([]);
    });

    test('wheel flings while pages load keep tokens in order and rows at their index', { annotation: [{ type: 'case', description: 'grid.ct-fast-scroll' }] }, async ({ page }) => {
        const grid = await mountContinuation(page);
        const paging = pagingLog(page);

        const box = await scrollerBox(grid);
        await page.mouse.move(box.x + box.width * 0.75, box.top + box.height * 0.75);
        for (let i = 0; i < 60; i++) {
            await page.mouse.wheel(0, 600);
            await nextFrames(page, 1);
        }

        await waitIdle(grid);
        await scrollUntilComplete(grid);
        await settle(grid);
        await paging.quiet();

        // Every page is fetched exactly once, with the token current when the request was sent
        expect(paging.tokens()).toEqual(ALL_TOKENS);
        expect(paging.pages.reduce((sum, p) => sum + p.items!, 0)).toBe(TOTAL - 100);
        await expectLoadedInOrder(grid, TOTAL);
        await expectRowsShowTheirCode(grid, 'bottom');

        for (const row of [0, 99, 100, 555, 1199]) {
            await scrollGrid(grid, { top: row * RH });
            await settle(grid);
            await expectRowsShowTheirCode(grid, `row ${row}`);
        }
        expect(paging.pages).toHaveLength(12);
    });

    test('atAsync far ahead loads every row up to it in one request', { annotation: [{ type: 'case', description: 'grid.ct-jump-atasync' }] }, async ({ page }) => {
        const grid = await mountContinuation(page);
        const paging = pagingLog(page);

        const item = await grid.evaluate(async (g: any) => {
            const result = await g.query.items.atAsync(1000);
            return result ? { id: result.id, code: result.getValue('Code') } : null;
        });
        await paging.quiet();

        expect(item).toEqual({ id: '1001', code: 'Row 1001' });
        expect(paging.pages.map(p => ({ continuation: p.continuation, top: p.top, items: p.items, next: p.next }))).toEqual([
            { continuation: 'offset:100', top: 1000, items: 1000, next: 'offset:1100' }
        ]);
        const s = await state(grid);
        expect(s.hasMore).toBe(true);
        expect(s.totalItems).toBe(1100);
        await expectLoadedInOrder(grid, 1100);

        // The grid shows the jumped-to rows without another request
        await settle(grid);
        await scrollGrid(grid, { top: 1000 * RH });
        await settle(grid);
        await expectRowsShowTheirCode(grid, 'row 1000');
        await paging.quiet();
        expect(paging.pages).toHaveLength(1);

        // And continues from the current token
        await scrollUntilComplete(grid);
        await paging.quiet();
        expect(paging.tokens()).toEqual(['offset:100', 'offset:1100', 'offset:1200']);
        await expectLoadedInOrder(grid, TOTAL);
    });

    test('lazy access far ahead loads the rows up to it', { annotation: [{ type: 'case', description: 'grid.ct-jump-lazy-index' }] }, async ({ page }) => {
        const grid = await mountContinuation(page);
        const paging = pagingLog(page);

        const immediate = await grid.evaluate((g: any) => g.query.items[750] ?? null);
        expect(immediate).toBeNull();

        await expect.poll(() => valuesOf(grid, [750], 'Code')).toEqual(['Row 0751']);
        await waitIdle(grid);
        await paging.quiet();

        // One request with the current token, covering through the page of row 750 and not past it
        expect(paging.pages).toHaveLength(1);
        const [request] = paging.pages;
        expect(request.continuation).toBe('offset:100');
        expect(100 + request.top!).toBeGreaterThanOrEqual(751);
        expect(100 + request.top!).toBeLessThanOrEqual(800);
        const s = await state(grid);
        expect(s.hasMore).toBe(true);
        expect(s.totalItems).toBe(100 + request.top!);
        await expectLoadedInOrder(grid, s.totalItems);
    });

    test('concurrent requests for later pages never fetch a page twice', { annotation: [{ type: 'case', description: 'grid.ct-jump-concurrent' }] }, async ({ page }) => {
        const grid = await mountContinuation(page);
        const paging = pagingLog(page);

        const items = await grid.evaluate(async (g: any) => {
            const results = await Promise.all([150, 250, 350].map(i => g.query.items.atAsync(i)));
            return results.map((r: any) => r?.id ?? null);
        });
        await paging.quiet();

        expect(items).toEqual(['151', '251', '351']);
        // Each request starts at the token current when it is sent, so no row is fetched twice
        const tokens = paging.tokens();
        expect(new Set(tokens).size).toBe(tokens.length);
        expect(paging.pages.length).toBeGreaterThanOrEqual(1);
        expect(paging.pages.length).toBeLessThanOrEqual(3);
        const s = await state(grid);
        expect(s.hasMore).toBe(true);
        expect(paging.pages.reduce((sum, p) => sum + p.items!, 0)).toBe(s.totalItems - 100);
        expect(s.totalItems).toBe(400);
        await expectLoadedInOrder(grid, 400);
    });

    test('atAsync past the real end loads every row once and resolves to nothing', { annotation: [{ type: 'case', description: 'grid.ct-jump-past-end' }] }, async ({ page }) => {
        const grid = await mountContinuation(page);
        const paging = pagingLog(page);

        const item = await grid.evaluate(async (g: any) => (await g.query.items.atAsync(2000)) ?? null);
        await paging.quiet();
        expect(item).toBeNull();

        // One request with the current token that covers index 2000; the server ends early with the real total
        expect(paging.pages).toHaveLength(1);
        expect(paging.pages[0]).toMatchObject({ continuation: 'offset:100', items: TOTAL - 100, next: null, totalItems: TOTAL });
        expect(paging.pages[0].top).toBeGreaterThanOrEqual(1901);

        const s = await state(grid);
        expect(s.hasMore).toBe(false);
        expect(s.totalItems).toBe(TOTAL);
        expect(s.itemsLength).toBe(TOTAL);
        expect(s.label).toMatch(/^1[.,]?234 Continuation \(unknown total\)$/);
        await expectLoadedInOrder(grid, TOTAL);

        // The grid ends at Row 1234 flush with the bottom, without placeholders or another request
        await settle(grid);
        await scrollToEnd(grid);
        await settle(grid);
        expect((await state(grid)).scrollHeight).toBe(TOTAL * RH);
        const visible = await rows(grid);
        expect(visible.at(-1)!.index).toBe(TOTAL - 1);
        expect(Math.abs(visible.at(-1)!.bottom - (await scrollerBox(grid)).bottom)).toBeLessThanOrEqual(1);
        expect((await rows(grid, { all: true })).filter(r => r.loading)).toEqual([]);
        await expectRowsShowTheirCode(grid, 'bottom');
        await paging.quiet();
        expect(paging.pages).toHaveLength(1);
    });

    test('async helpers walk the continuation', { annotation: [{ type: 'case', description: 'grid.ct-async-helpers' }] }, async ({ page }) => {
        const grid = await mountContinuation(page);
        const paging = pagingLog(page);

        const slice = await grid.evaluate(async (g: any) => (await g.query.items.sliceAsync(95, 105)).map((i: any) => i.id));
        expect(slice).toEqual(Array.from({ length: 10 }, (_, i) => String(96 + i)));

        const all = await grid.evaluate(async (g: any) => (await g.query.items.toArrayAsync()).map((i: any) => i.id));
        expect(all).toHaveLength(TOTAL);
        expect(new Set(all).size).toBe(TOTAL);
        expect(all).toEqual(Array.from({ length: TOTAL }, (_, i) => String(i + 1)));

        const tail = await grid.evaluate(async (g: any) => (await g.query.items.sliceAsync(1230)).map((i: any) => i.id));
        expect(tail).toEqual(['1231', '1232', '1233', '1234']);

        await paging.quiet();
        const tokens = paging.tokens();
        expect(new Set(tokens).size, 'no token sent twice').toBe(tokens.length);
        expect(paging.pages.reduce((sum, p) => sum + p.items!, 0), 'no row fetched twice').toBe(TOTAL - 100);
        const s = await state(grid);
        expect(s.hasMore).toBe(false);
        expect(s.totalItems).toBe(TOTAL);
    });

    test('a header sort restarts at the first page under the new order', { annotation: [{ type: 'case', description: 'grid.ct-reset-sort' }] }, async ({ page }) => {
        const grid = await mountContinuation(page);
        await loadNextPage(grid);
        await scrollGrid(grid, { top: 150 * RH });
        await settle(grid);
        const paging = pagingLog(page);

        await grid.locator('vi-query-grid-column-header[name="Amount"] .label').click();
        await expect.poll(() => grid.evaluate((g: any) => !g.query.isBusy && g.query.sortOptions[0]?.name === 'Amount')).toBe(true);
        await settle(grid);
        await paging.quiet();

        // One request, without the old token and from the top
        expect(paging.pages).toHaveLength(1);
        expect(paging.pages[0].continuation).toBeNull();
        expect(paging.pages[0].skip ?? 0).toBe(0);
        expect(paging.pages[0]).toMatchObject({ items: 100, next: 'offset:100' });

        const s = await state(grid);
        expect(s.scrollTop).toBe(0);
        expect(s.hasMore).toBe(true);
        expect(s.totalItems).toBe(100);
        expect((await rows(grid))[0].index).toBe(0);
        expect((await rows(grid))[0].cells.find(c => c.name === 'Code')?.text).toBe('Row 0127');

        // Scrolling on pages with new tokens under the new sort
        paging.clear();
        await scrollUntilComplete(grid);
        await paging.quiet();
        expect(paging.tokens()).toEqual(ALL_TOKENS);

        const amounts = await loadedAmounts(grid);
        expect(amounts).toHaveLength(TOTAL);
        expect(new Set(amounts.map(a => a.id)).size).toBe(TOTAL);
        const unordered = amounts.findIndex((a, i) => i > 0 && !(a.amount > amounts[i - 1].amount));
        expect(unordered, 'Amount ascending across pages').toBe(-1);
    });

    test('a text search restarts at the first page and ends at its own total', { annotation: [{ type: 'case', description: 'grid.ct-reset-search' }] }, async ({ page }) => {
        const grid = await mountContinuation(page);
        await scrollUntilComplete(grid);
        await scrollGrid(grid, { top: 600 * RH });
        await settle(grid);
        const paging = pagingLog(page);

        await grid.evaluate(async (g: any) => {
            g.query.textSearch = '2021';
            await g.query.search();
        });
        await settle(grid);
        await paging.quiet();

        expect(paging.pages).toHaveLength(1);
        expect(paging.pages[0]).toMatchObject({ continuation: null, items: 100, next: 'offset:100' });
        expect(paging.pages[0].skip ?? 0).toBe(0);
        let s = await state(grid);
        expect(s.scrollTop).toBe(0);
        expect(s.hasMore).toBe(true);
        expect(s.totalItems).toBe(100);
        expect((await rows(grid))[0].cells.find(c => c.name === 'Code')?.text).toBe('Row 0001');

        await scrollUntilComplete(grid);
        await settle(grid);
        await paging.quiet();
        expect(paging.tokens()).toEqual([null, 'offset:100']);
        expect(paging.pages[1]).toMatchObject({ items: 89, next: null, totalItems: 189 });

        s = await state(grid);
        expect(s.hasMore).toBe(false);
        expect(s.totalItems).toBe(189);
        expect(s.scrollHeight).toBe(Math.max(189 * RH, s.clientHeight));
        await scrollToEnd(grid);
        await settle(grid);
        const ids = await loadedIds(grid);
        expect(ids.every(id => id !== null)).toBe(true);
        expect(new Set(ids).size).toBe(189);
        expect((await rows(grid)).at(-1)!.index).toBe(188);
        expect((await rows(grid, { all: true })).filter(r => r.loading)).toEqual([]);
    });

    test('a column filter restarts at the first page and ends at its own total', { annotation: [{ type: 'case', description: 'grid.ct-reset-filter' }] }, async ({ page }) => {
        const grid = await mountContinuation(page);
        await loadNextPage(grid);
        await scrollGrid(grid, { top: 150 * RH });
        await settle(grid);
        const paging = pagingLog(page);

        await grid.evaluate(async (g: any) => {
            const column = g.query.getColumn('Department');
            column.selectedDistincts = ['|Automotive', '|Books'];
            column.selectedDistinctsInversed = true;
            await g.query.search();
        });
        await settle(grid);
        await paging.quiet();

        expect(paging.pages).toHaveLength(1);
        expect(paging.pages[0]).toMatchObject({ continuation: null, items: 100, next: 'offset:100' });
        expect(paging.pages[0].skip ?? 0).toBe(0);
        const s = await state(grid);
        expect(s.scrollTop).toBe(0);
        expect(s.hasMore).toBe(true);
        expect(s.totalItems).toBe(100);
        expect((await rows(grid))[0].cells.find(c => c.name === 'Code')?.text).toBe('Row 0002');

        await scrollUntilComplete(grid);
        await paging.quiet();
        expect(paging.tokens()).toEqual([null, ...ALL_TOKENS.slice(0, 11)]);
        expect(paging.pages.at(-1)).toMatchObject({ items: 13, next: null, totalItems: 1113 });

        const departments = await grid.evaluate((g: any) => {
            const q = g.query;
            q.disableLazyLoading = true;
            try {
                return Array.from({ length: q.totalItems }, (_, i) => ({ id: q.items[i]?.id, department: q.items[i]?.getValue('Department') }));
            }
            finally {
                q.disableLazyLoading = false;
            }
        });
        expect(departments).toHaveLength(1113);
        expect(new Set(departments.map(d => d.id)).size).toBe(1113);
        expect(departments.filter(d => d.department === 'Automotive' || d.department === 'Books')).toEqual([]);
    });

    test('a header sort while a page loads restarts under the new order', { annotation: [{ type: 'case', description: 'grid.ct-reset-sort-in-flight' }] }, async ({ page }) => {
        const grid = await mountContinuation(page);
        const paging = pagingLog(page);
        const release = await holdExecuteQuery(page);

        await scrollToEnd(grid);
        await expect.poll(() => paging.tokens()).toEqual(['offset:100']);
        await grid.locator('vi-query-grid-column-header[name="Amount"] .label').click();
        await release();
        await expect.poll(() => grid.evaluate((g: any) => !g.query.isBusy && g.query.sortOptions[0]?.name === 'Amount')).toBe(true);
        await settle(grid);
        await paging.quiet();

        // The sort sends its own request without a token once the old page is answered
        expect(paging.tokens().slice(0, 2)).toEqual(['offset:100', null]);
        expect(paging.pages[1]).toMatchObject({ items: 100, next: 'offset:100' });
        expect(paging.pages[1].skip ?? 0).toBe(0);

        // The old page leaves nothing behind: the new result starts at the top with Row 0127
        expect((await state(grid)).scrollTop).toBe(0);
        expect((await rows(grid))[0].cells.find(c => c.name === 'Code')?.text).toBe('Row 0127');

        // And pages on with the new tokens to the real total, in Amount order, each page once
        // (the grid may already ask for the next page of the new order while it is still at the end)
        await scrollUntilComplete(grid);
        await paging.quiet();
        expect(paging.tokens()).toEqual(['offset:100', null, ...ALL_TOKENS]);
        const amounts = await loadedAmounts(grid);
        expect(amounts).toHaveLength(TOTAL);
        expect(new Set(amounts.map(a => a.id)).size).toBe(TOTAL);
        expect(amounts.findIndex((a, i) => i > 0 && !(a.amount > amounts[i - 1].amount)), 'Amount ascending across pages').toBe(-1);
    });

    test('a text search while a page loads restarts and ends at its own total', { annotation: [{ type: 'case', description: 'grid.ct-reset-search-in-flight' }] }, async ({ page }) => {
        const grid = await mountContinuation(page);
        const paging = pagingLog(page);
        const release = await holdExecuteQuery(page);

        await scrollToEnd(grid);
        await expect.poll(() => paging.tokens()).toEqual(['offset:100']);
        await grid.evaluate((g: any) => {
            g.query.textSearch = '2021';
            (window as any).__search = g.query.search().then((items: any[]) => items.map(i => i?.id ?? null));
        });
        await release();
        // search() resolves to its own result, not to the page that was loading
        const searched: (string | null)[] = await page.evaluate(() => (window as any).__search);
        expect(searched).toHaveLength(100);
        expect(searched.slice(0, 3)).toEqual(['1', '2', '7']);
        expect(searched.every(id => id !== null)).toBe(true);
        await waitIdle(grid);
        await settle(grid);
        await paging.quiet();

        expect(paging.tokens().slice(0, 2)).toEqual(['offset:100', null]);
        expect(paging.pages[1]).toMatchObject({ items: 100, next: 'offset:100' });
        expect((await state(grid)).scrollTop).toBe(0);
        // Under load the top row can still show an item of the old scroll position right after settle; polling keeps the
        // check strict for a persistent stale row
        await expect.poll(async () => (await rows(grid))[0].cells.find(c => c.name === 'Code')?.text).toBe('Row 0001');

        // The search's second page is fetched once with its own token (possibly already while the grid is still at the end)
        await scrollUntilComplete(grid);
        await settle(grid);
        await paging.quiet();
        expect(paging.tokens()).toEqual(['offset:100', null, 'offset:100']);
        expect(paging.pages[2]).toMatchObject({ items: 89, next: null, totalItems: 189 });

        const s = await state(grid);
        expect(s.hasMore).toBe(false);
        expect(s.totalItems).toBe(189);
        const ids = await loadedIds(grid);
        expect(ids.every(id => id !== null)).toBe(true);
        expect(new Set(ids).size).toBe(189);
        expect((await rows(grid, { all: true })).filter(r => r.loading)).toEqual([]);
    });

    test('a total that is an exact multiple of the page size ends without a trailing request', { annotation: [{ type: 'case', description: 'grid.ct-exact-multiple' }] }, async ({ page }) => {
        const grid = await mountContinuation(page);
        const paging = pagingLog(page);

        await filterTo200(grid);
        await settle(grid);
        await scrollUntilComplete(grid);
        await settle(grid);
        await paging.quiet();

        // The second page is full and already carries the real total, so no third request follows
        expect(paging.tokens()).toEqual([null, 'offset:100']);
        expect(paging.pages[1]).toMatchObject({ items: 100, next: null, totalItems: 200 });
        await expectEndsAt200(grid, paging);
    });

    test('a trailing token followed by an empty page ends at the real total', { annotation: [{ type: 'case', description: 'grid.ct-trailing-empty-page' }] }, async ({ page }) => {
        const grid = await mountContinuation(page);
        const paging = pagingLog(page);

        // A server that cannot tell it reached the end answers the last full page with a token
        await page.route('**/ExecuteQuery', async route => {
            const response = await route.fetch();
            const json = await response.json();
            const result = json.result ?? json.query?.result;
            if (route.request().postDataJSON()?.query?.continuation === 'offset:100' && result?.totalItems === 200 && !result.continuation) {
                result.totalItems = -1;
                result.continuation = 'offset:200';
            }

            await route.fulfill({ response, json });
        });

        await filterTo200(grid);
        await settle(grid);
        await scrollUntilComplete(grid);
        await settle(grid);
        await paging.quiet();

        // The empty page closes the query: one extra request, no rows, no token
        expect(paging.tokens()).toEqual([null, 'offset:100', 'offset:200']);
        expect(paging.pages[1]).toMatchObject({ items: 100, next: 'offset:200' });
        expect(paging.pages[2]).toMatchObject({ items: 0, next: null, totalItems: 200 });
        await expectEndsAt200(grid, paging);
    });

    test('selection survives page loads',{ annotation: [{ type: 'case', description: 'grid.ct-selection' }] }, async ({ page }) => {
        // The read-only query has no selection actions: as a lookup it can still select rows
        const grid = await mountContinuation(page, { asLookup: true });
        await expect(grid).toHaveAttribute('can-select');

        await clickSelector(grid, 2);
        await expect.poll(() => selectedIds(grid)).toEqual(['3']);

        // Loading the next page keeps the selection, and rows of the new page can be selected
        await loadNextPage(grid);
        await scrollGrid(grid, { top: 140 * RH });
        await settle(grid);
        await clickSelector(grid, 150);
        await expect.poll(() => selectedIds(grid)).toEqual(['3', '151']);
        expect((await rows(grid)).filter(r => r.selected).map(r => r.index)).toEqual([150]);

        await scrollUntilComplete(grid);
        expect(await selectedIds(grid)).toEqual(['3', '151']);
        expect(await grid.evaluate((g: any) => g.query.selectAll.allSelected)).toBe(false);

        await scrollGrid(grid, { top: 0 });
        await settle(grid);
        expect((await rows(grid)).filter(r => r.selected).map(r => r.index)).toEqual([2]);
    });

    test('select-all stays hidden while more pages follow and appears at the real end', { annotation: [{ type: 'case', description: 'grid.ct-select-all-at-end' }] }, async ({ page }) => {
        const grid = await mountContinuation(page, { asLookup: true });
        const paging = pagingLog(page);
        // Enabled the way a query config with select-all enables it
        await grid.evaluate((g: any) => g.query.selectAll.isAvailable = true);

        const selectAll = grid.locator('vi-query-grid-select-all');
        const icon = selectAll.locator('vi-icon[source=Selected]');
        await expect(selectAll).toBeAttached();
        await expect(selectAll).not.toHaveAttribute('can-select-all');
        await expect(icon).toBeHidden();
        expect(await grid.evaluate((g: any) => g.query.selectAll.isAvailable)).toBe(false);

        await loadNextPage(grid);
        expect((await state(grid)).hasMore).toBe(true);
        await expect(selectAll).not.toHaveAttribute('can-select-all');
        await expect(icon).toBeHidden();

        // The last page makes the total known: the box appears without a new search
        await scrollUntilComplete(grid);
        await paging.quiet();
        expect(paging.tokens()).toEqual(ALL_TOKENS);
        expect((await state(grid)).hasMore).toBe(false);
        await expect(selectAll).toHaveAttribute('can-select-all', '');
        await expect(icon).toBeVisible();
        expect(await grid.evaluate((g: any) => g.query.selectAll.isAvailable)).toBe(true);

        await selectAll.click();
        await expect.poll(() => grid.evaluate((g: any) => g.query.selectAll.allSelected)).toBe(true);
    });

    test('the app view pages to the real total with the mouse wheel', { annotation: [{ type: 'case', description: 'grid.ct-app-wheel' }] }, async ({ page }) => {
        const grid = await openView(page, 'components/query-grid_continuation');
        const paging = pagingLog(page);

        await expect(page.getByText('100+ Continuation (unknown total)').first()).toBeVisible();
        expect((await state(grid)).hasMore).toBe(true);

        await scrollUntilComplete(grid, async g => {
            for (let i = 0; i < 5; i++)
                await wheelGrid(g, 0, 1200);
        });
        await settle(grid);
        await paging.quiet();

        expect(paging.tokens()).toEqual(ALL_TOKENS);
        const s = await state(grid);
        expect(s.hasMore).toBe(false);
        expect(s.totalItems).toBe(TOTAL);
        await expect(page.getByText(/^1[.,]?234 Continuation \(unknown total\)$/).first()).toBeVisible();

        for (let i = 0; i < 5 && (await getScrollOffset(grid)).top + s.clientHeight < s.scrollHeight - 1; i++)
            await wheelGrid(grid, 0, 3000);
        await settle(grid);
        const visible = await rows(grid);
        expect(visible.at(-1)!.cells.find(c => c.name === 'Code')?.text).toBe(code(TOTAL - 1));
        expect((await rows(grid, { all: true })).filter(r => r.loading)).toEqual([]);
        await paging.quiet();
        expect(paging.pages).toHaveLength(12);
    });
});
