import { Locator, Page } from '@playwright/test';
import { closeMenu, configureDialog, dialogButton, openConfigure, openMenuByCaret, pressRowButton } from '../_helpers/header';
import { mountGrid, nextFrames, openView, requestLog, VIEWS } from '../_helpers/query-grid';
import { cdpMetrics, collectGarbage, droppedFrames, expect, frameStats, installPerf, liveInstances, mountPrefetched, openFilter, parkMouse, perfCase, perfPage, recordPerf, round, setCpuThrottle, test } from '../_helpers/perf';

const refreshes = (log: ReturnType<typeof requestLog>) => log.of('ExecuteAction').filter(r => r.action === 'QueryFilter.RefreshColumn');

const filterItems = (grid: Locator, column: string) => grid.locator(`vi-query-grid-column-header[name="${column}"] vi-query-grid-column-filter .item`);

/** Opens the filter of `column` and resolves with the ms from pointerdown to the first frame with a visible distinct row. */
async function timedOpen(page: Page, grid: Locator, column: string) {
    await grid.evaluate((g: any, column) => {
        const w = window as any;
        const perf = w.__perf;
        w.__opened = new Promise(resolve => window.addEventListener('pointerdown', () => {
            const start = performance.now();
            perf.whenFrame(() => perf.filterItems(g, column).length > 0).then((r: any) => resolve({ ms: r.time - start, start }));
        }, { capture: true, once: true }));
    }, column);

    await openFilter(grid, column);
    const result = await page.evaluate(() => (window as any).__opened);
    await expect(filterItems(grid, column).first()).toBeVisible();
    return result as { ms: number; start: number };
}

async function closeFilter(page: Page, grid: Locator, column: string) {
    await page.keyboard.press('Escape');
    await expect(filterItems(grid, column).first()).toBeHidden();
}

test.describe('Lazy menus', () => {
    test('header menus and filter popups render lazily', perfCase('perf.init-lazy-header-popups'), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountGrid(page);

        const census = () => grid.evaluate((g: any) => {
            const perf = (window as any).__perf;
            return Object.fromEntries([...g.shadowRoot.querySelectorAll('vi-query-grid-column-header')].map((h: any) => {
                const filter = h.shadowRoot.querySelector('vi-query-grid-column-filter');
                return [h.column.name, { menus: perf.deepAll(h, 'vi-popup-menu').length, filterPopups: filter ? perf.deepAll(filter, 'vi-popup, vi-list, vi-input-search').length : 0 }];
            }));
        });

        const initial = await census();
        for (const [name, counts] of Object.entries<any>(initial))
            expect(counts, `${name} before interaction`).toEqual({ menus: 0, filterPopups: 0 });

        // Open the FirstName header menu: only that header renders a popup menu
        await grid.locator('vi-query-grid-column-header[name="FirstName"] vi-button[icon="CaretDown"]').click();
        await expect(grid.locator('vi-query-grid-column-header[name="FirstName"] vi-popup-menu-item').first()).toBeVisible();
        const afterMenu = await census();
        expect(afterMenu['FirstName'].menus).toBeGreaterThan(0);
        for (const [name, counts] of Object.entries<any>(afterMenu).filter(([name]) => name !== 'FirstName'))
            expect(counts, name).toEqual({ menus: 0, filterPopups: 0 });

        await page.keyboard.press('Escape');

        // Open the LastName filter: only that filter renders its popup, search and distinct list
        await openFilter(grid, 'LastName');
        await expect(filterItems(grid, 'LastName').first()).toBeVisible();
        const afterFilter = await census();
        expect(afterFilter['LastName'].filterPopups).toBeGreaterThanOrEqual(3);
        for (const [name, counts] of Object.entries<any>(afterFilter).filter(([name]) => name !== 'LastName'))
            expect(counts.filterPopups, name).toBe(0);

        await recordPerf(page, testInfo, 'perf.init-lazy-header-popups', { counts: { popupsBefore: Object.values<any>(initial).reduce((n, c) => n + c.menus + c.filterPopups, 0), firstNameMenus: afterMenu['FirstName'].menus, lastNameFilterElements: afterFilter['LastName'].filterPopups } });
    });

    test('header menu is rendered once and reused', perfCase('perf.pm-header-menu-render-once'), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountGrid(page);

        const menus = () => grid.evaluate((g: any) => {
            const perf = (window as any).__perf;
            return Object.fromEntries([...g.shadowRoot.querySelectorAll('vi-query-grid-column-header')].map((h: any) => [h.column.name, perf.deepAll(h, 'vi-popup-menu').length]));
        });

        const counts: Record<string, number>[] = [];
        for (let open = 0; open < 6; open++) {
            const header = await openMenuByCaret(grid, 'LastName');
            counts.push(await menus());
            await closeMenu(header);
        }

        for (const [open, census] of counts.entries()) {
            expect(census['LastName'], `open ${open + 1}: LastName menus`).toBe(1);
            for (const [name, n] of Object.entries(census).filter(([name]) => name !== 'LastName'))
                expect(n, `open ${open + 1}: ${name} menus`).toBe(0);
        }

        await recordPerf(page, testInfo, 'perf.pm-header-menu-render-once', { counts: { menusPerHeader: Math.max(...counts.map(c => c['LastName'])), opens: counts.length } });
    });
});

test.describe('Distinct list', () => {
    test.setTimeout(120000);

    test('opening a filter loads distincts once', perfCase('perf.cf-open-single-refresh'), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountGrid(page);
        const log = requestLog(page);

        const counts: Record<string, number[]> = {};
        for (const column of ['FirstName', 'Gender']) {
            counts[column] = [];
            for (let open = 0; open < 2; open++) {
                log.clear();
                await openFilter(grid, column);
                await expect(filterItems(grid, column).first()).toBeVisible();
                await log.quiet();
                counts[column].push(refreshes(log).length);
                if (open === 0)
                    expect(refreshes(log).map(r => r.body?.parameters?.ColumnName)).toEqual([column]);

                await closeFilter(page, grid, column);
            }
        }

        expect(counts).toEqual({ FirstName: [1, 0], Gender: [1, 0] });

        await recordPerf(page, testInfo, 'perf.cf-open-single-refresh', { counts: { refreshColumn: counts } });
    });

    for (const rate of [1, 4]) {
        test(`time to first distinct rows (${rate}x CPU)`, perfCase('perf.cf-open-latency', { timing: true }), async ({ page }, testInfo) => {
            await perfPage(page);
            const { grid } = await mountPrefetched(page, 'People');
            await setCpuThrottle(page, rate);

            const firstName = await timedOpen(page, grid, 'FirstName');
            await closeFilter(page, grid, 'FirstName');
            const gender = await timedOpen(page, grid, 'Gender');
            await closeFilter(page, grid, 'Gender');
            const cached = await timedOpen(page, grid, 'FirstName');
            await closeFilter(page, grid, 'FirstName');
            const email = await timedOpen(page, grid, 'Email');
            await nextFrames(page, 2);
            const blocking = await page.evaluate(start => (window as any).__perf.tbt(start, performance.now()), email.start);
            await closeFilter(page, grid, 'Email');
            await setCpuThrottle(page, 1);

            expect.soft(firstName.ms, 'FirstName first open').toBeLessThanOrEqual(rate === 1 ? 800 : 2000);
            expect.soft(gender.ms, 'Gender first open').toBeLessThanOrEqual(rate === 1 ? 500 : 2000);
            expect.soft(cached.ms, 'cached reopen').toBeLessThanOrEqual(200 * rate);
            // The 100ms long-task ceiling is for 1x; tasks scale with the CPU throttle
            expect.soft(blocking.longest, 'Email open: no task over 100ms (x rate)').toBeLessThanOrEqual(100 * rate);

            await recordPerf(page, testInfo, `perf.cf-open-latency.${rate}x`, { cpuThrottle: rate, timings: { firstName: [round(firstName.ms)], gender: [round(gender.ms)], cachedReopen: [round(cached.ms)], email: [round(email.ms)], emailLongestTask: [round(blocking.longest)] } });
        });
    }

    test('distinct list renders a bounded number of rows', perfCase('perf.cf-list-virtualized'), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountGrid(page);

        const census = (column: string) => grid.evaluate((g: any, column) => {
            const perf = (window as any).__perf;
            const header = g.shadowRoot.querySelector(`vi-query-grid-column-header[name="${column}"]`);
            const list = perf.deepAll(header, 'vi-list')[0];
            const rendered = perf.deepAll(list, '.item').filter((e: any) => e.isConnected && e.getBoundingClientRect().height > 0);
            const visible = perf.filterItems(g, column);
            return {
                rendered: rendered.length,
                listHeight: list.getBoundingClientRect().height,
                rowHeight: visible[0]?.getBoundingClientRect().height ?? 0,
                distincts: g.query.getColumn(column).distincts.matching.length + g.query.getColumn(column).distincts.remaining.length
            };
        }, column);

        const scrollToEnd = (column: string) => grid.evaluate((g: any, column) => {
            const perf = (window as any).__perf;
            const header = g.shadowRoot.querySelector(`vi-query-grid-column-header[name="${column}"]`);
            const list = perf.deepAll(header, 'vi-list')[0];
            const scrollable = [list, ...perf.deepAll(list, '*')].filter((e: any) => e.scrollHeight > e.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(e).overflowY));
            scrollable.forEach((e: any) => e.scrollTop = e.scrollHeight);
            return scrollable.length;
        }, column);

        const results: Record<string, any> = {};
        for (const column of ['LastName', 'Email']) {
            await openFilter(grid, column);
            await expect(filterItems(grid, column).first()).toBeVisible();
            await nextFrames(page, 2);
            const top = await census(column);
            const scrolled = await scrollToEnd(column);
            await nextFrames(page, 3);
            const end = await census(column);
            const bound = 3 * Math.ceil(top.listHeight / top.rowHeight) + 5;

            expect(top.rowHeight).toBeGreaterThan(0);
            expect(top.rendered, `${column}: rendered rows at the top`).toBeLessThanOrEqual(bound);
            expect(end.rendered, `${column}: rendered rows at the end`).toBeLessThanOrEqual(bound);
            results[column] = { top, end, bound, scrolled };
            await closeFilter(page, grid, column);
        }

        // Email has more distincts than the bound, so its list must be virtualized
        expect(results['Email'].top.distincts).toBeGreaterThan(results['Email'].bound);

        await recordPerf(page, testInfo, 'perf.cf-list-virtualized', { counts: results });
    });

    test('scrolling the distinct list', perfCase('perf.cf-list-scroll', { timing: true }), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountGrid(page);
        await openFilter(grid, 'Email');
        await expect(filterItems(grid, 'Email').first()).toBeVisible();
        const log = requestLog(page);
        await log.quiet();
        const hasMore = await grid.evaluate((g: any) => !!g.query.getColumn('Email').distincts.hasMore);

        // The scrollable element of the distinct list, and the list rows (distinct or has-more marker) in its view
        await grid.evaluate((g: any) => {
            const w = window as any;
            const perf = w.__perf;
            const header = g.shadowRoot.querySelector('vi-query-grid-column-header[name="Email"]');
            const list = perf.deepAll(header, 'vi-list')[0];
            const scrollable = [list, ...perf.deepAll(list, '*')].find((e: any) => e.scrollHeight > e.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(e).overflowY));
            w.__list = {
                scrollable,
                sample: () => {
                    const view = scrollable.getBoundingClientRect();
                    const rows = perf.deepAll(list, '.item, .hasMore')
                        .map((e: any) => ({ e, b: e.getBoundingClientRect() }))
                        .filter(({ e, b }: any) => b.height > 0 && b.bottom > view.top + 1 && b.top < view.bottom - 1 && e.checkVisibility())
                        .sort((a: any, b: any) => a.b.top - b.b.top);
                    let covered = view.top;
                    let gap = 0;
                    for (const { b } of rows) {
                        gap = Math.max(gap, b.top - covered);
                        covered = Math.max(covered, b.bottom);
                    }
                    gap = Math.max(gap, Math.min(view.bottom, view.top + scrollable.scrollHeight - scrollable.scrollTop) - covered);
                    const blank = rows.filter(({ e }: any) => e.classList.contains('item') && e.textContent.trim() === '').length;
                    return { rows: rows.length, gap: Math.round(gap), blank, last: rows[rows.length - 1]?.e.classList.contains('hasMore') ?? false };
                }
            };
        });

        // 30 rAF steps top -> bottom
        const start = await page.evaluate(() => performance.now());
        const raf = await page.evaluate(async () => {
            const w = window as any;
            const { scrollable, sample } = w.__list;
            const max = scrollable.scrollHeight - scrollable.clientHeight;
            const run = await w.__perf.runFrames(30, (i: number) => scrollable.scrollTop = Math.round(max * (i + 1) / 30), sample);
            return { deltas: run.deltas, samples: run.samples, end: scrollable.scrollTop, max };
        });

        // 20 wheel steps back up
        const box = await page.evaluate(() => {
            const b = (window as any).__list.scrollable.getBoundingClientRect();
            return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
        });
        await page.mouse.move(box.x, box.y);
        await page.evaluate(() => (window as any).__perf.startFrames());
        for (let i = 0; i < 20; i++)
            await page.mouse.wheel(0, -200);
        const wheelDeltas: number[] = await page.evaluate(() => (window as any).__perf.stopFrames());
        await nextFrames(page, 2);
        const wheelEnd = await page.evaluate(() => (window as any).__list.sample());
        const blocking = await page.evaluate(start => (window as any).__perf.tbt(start, performance.now()), start);
        await log.quiet();

        const frames = { ...frameStats(raf.deltas), ...droppedFrames(raf.deltas) };
        const wheelFrames = frameStats(wheelDeltas);
        const blankFrames = raf.samples.filter((s: any) => s.blank > 0 || s.gap > 1).length;
        const atEnd = raf.samples[raf.samples.length - 1];

        expect(raf.end).toBe(raf.max);
        expect(blankFrames, `frames with blank list rows: ${JSON.stringify(raf.samples.filter((s: any) => s.blank > 0 || s.gap > 1))}`).toBe(0);
        expect(wheelEnd.blank).toBe(0);
        expect(atEnd.last, 'the last row at the end is the has-more marker').toBe(hasMore);
        expect(log.requests, 'scrolling the list sends nothing').toHaveLength(0);
        expect.soft(frames.p95, 'distinct list scroll p95').toBeLessThanOrEqual(50);
        expect.soft(blocking.longest, 'no task over 50ms').toBeLessThanOrEqual(50);

        await recordPerf(page, testInfo, 'perf.cf-list-scroll', { counts: { blankFrames }, frames: { raf: frames, wheel: wheelFrames }, timings: { longestTask: [round(blocking.longest)] } });
    });
});

test.describe('Filter search & apply', () => {
    test.setTimeout(120000);

    test('client-side distinct search sends nothing and keeps up with typing', perfCase('perf.cf-client-side-search', { timing: true }), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountGrid(page);
        const log = requestLog(page);

        const results: Record<string, any> = {};
        for (const column of ['Gender', 'ContactPreference']) {
            await openFilter(grid, column);
            await expect(filterItems(grid, column).first()).toBeVisible();
            await log.quiet();
            expect(await grid.evaluate((g: any, column) => !!g.query.getColumn(column).distincts.hasMore, column)).toBe(false);

            const values: string[] = await grid.evaluate((g: any, column) => (window as any).__perf.filterItems(g, column).map((e: any) => e.textContent.trim()), column);
            const text = column === 'Gender' ? 'ma' : values[values.length - 1].slice(0, 2).toLowerCase();
            const expected = [...text].map((_, i) => values.filter(v => v.toLowerCase().includes(text.slice(0, i + 1))));

            await grid.evaluate((g: any, { column, expected }) => {
                const w = window as any;
                const perf = w.__perf;
                const state = w.__typing = { key: 0, frames: [] as number[], start: performance.now() };
                if (w.__typingListener)
                    window.removeEventListener('keydown', w.__typingListener, { capture: true });

                window.addEventListener('keydown', w.__typingListener = () => {
                    const index = state.key++;
                    const want = JSON.stringify(expected[index]);
                    perf.whenFrame(() => JSON.stringify(perf.filterItems(g, column).map((e: any) => e.textContent.trim())) === want, 5000).then((r: any) => state.frames[index] = r.frames, () => state.frames[index] = -1);
                }, { capture: true });
            }, { column, expected });

            log.clear();
            await page.keyboard.type(text, { delay: 100 });
            await expect.poll(() => page.evaluate(n => (window as any).__typing.frames.filter((f: number) => f != null).length, text.length)).toBe(text.length);
            const typing = await page.evaluate(() => (window as any).__typing);
            const blocking = await page.evaluate(start => (window as any).__perf.tbt(start, performance.now()), typing.start);
            await log.quiet();

            expect(refreshes(log), `${column}: RefreshColumn while typing`).toHaveLength(0);
            expect(typing.frames.every((f: number) => f >= 0 && f <= 2), `${column}: frames per key ${typing.frames}`).toBe(true);
            expect.soft(blocking.longest, `${column}: no task over 50ms`).toBeLessThanOrEqual(50);
            results[column] = { text, framesPerKey: typing.frames, longestTask: round(blocking.longest) };

            await page.evaluate(() => window.removeEventListener('keydown', (window as any).__typingListener, { capture: true }));
            await page.keyboard.press('Escape');
        }

        await recordPerf(page, testInfo, 'perf.cf-client-side-search', { counts: results });
    });

    test('a distinct toggle sends a bounded number of requests', perfCase('perf.cf-distinct-click-requests'), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountGrid(page);
        await openFilter(grid, 'FirstName');
        await expect(filterItems(grid, 'FirstName').first()).toBeVisible();
        const log = requestLog(page);
        await log.quiet();

        const toggle = async (item: Locator, value: string | null) => {
            log.clear();
            await grid.evaluate((g: any, value) => {
                const w = window as any;
                const perf = w.__perf;
                w.__filtered = new Promise(resolve => window.addEventListener('pointerdown', () => {
                    const start = performance.now();
                    const items = g.query.items;
                    perf.whenFrame(() => {
                        if (g.query.items === items || g.query.isBusy)
                            return false;

                        const rows = perf.visibleRows(g);
                        return rows.length > 0 && (value === null || rows.every(({ r }: any) => perf.cellText(r.querySelector('.column')) === value));
                    }).then((r: any) => resolve(r.time - start));
                }, { capture: true, once: true }));
            }, value);

            await item.click();
            const ms = await page.evaluate(() => (window as any).__filtered);
            await log.quiet();
            return {
                ms: round(ms),
                executeQuery: log.of('ExecuteQuery').length,
                refreshColumn: refreshes(log).length,
                newFilter: log.of('ExecuteAction').filter(r => r.action === 'Query.New').length,
                other: log.of('ExecuteAction').filter(r => !['Query.New', 'QueryFilter.RefreshColumn'].includes(r.action!)).map(r => r.action)
            };
        };

        const first = filterItems(grid, 'FirstName').first();
        const value = (await first.textContent())!.trim();
        const on = await toggle(first, value);
        const off = await toggle(grid.locator('vi-query-grid-column-header[name="FirstName"] vi-query-grid-column-filter .item:has(span[distinct-type="include"])').first(), null);

        expect(on).toMatchObject({ executeQuery: 1, refreshColumn: 1, newFilter: 1, other: [] });
        expect(off).toMatchObject({ executeQuery: 1, refreshColumn: 1, newFilter: 0, other: [] });

        await recordPerf(page, testInfo, 'perf.cf-distinct-click-requests', { counts: { on, off }, timings: { filteredRowsMs: [on.ms], unfilteredRowsMs: [off.ms] } });
    });

    test('other columns refresh distincts only when dirty', perfCase('perf.cf-dirty-refresh-other-column'), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountGrid(page);
        const log = requestLog(page);

        const open = async (column: string) => {
            log.clear();
            await openFilter(grid, column);
            await expect(filterItems(grid, column).first()).toBeVisible();
            await log.quiet();
            const columns = refreshes(log).map(r => r.body?.parameters?.ColumnName);
            await closeFilter(page, grid, column);
            return columns;
        };

        // LastName's distincts are loaded before the FirstName filter changes the result
        expect(await open('LastName')).toEqual(['LastName']);

        await openFilter(grid, 'FirstName');
        await expect(filterItems(grid, 'FirstName').first()).toBeVisible();
        await filterItems(grid, 'FirstName').first().click();
        await expect(grid.locator('vi-query-grid-column-header[name="FirstName"] vi-query-grid-column-filter')).toHaveAttribute('filtered', '');
        await log.quiet();
        await closeFilter(page, grid, 'FirstName');

        const lastName = await open('LastName');
        const firstName = await open('FirstName');

        expect(lastName, 'LastName after the FirstName filter (dirty)').toEqual(['LastName']);
        expect(firstName, 'FirstName reopened').toEqual([]);

        await recordPerf(page, testInfo, 'perf.cf-dirty-refresh-other-column', { counts: { lastNameRefresh: lastName.length, firstNameRefresh: firstName.length } });
    });
});

test.describe('Dialogs, menus & leaks', () => {
    test.setTimeout(180000);

    test('opening the filters menu sends no request', perfCase('filters.fl-perf-open-no-request'), async ({ page }, testInfo) => {
        const grid = await openView(page, VIEWS.People);
        await installPerf(page);

        // A current (unsaved) filter, created by a distinct click
        await openFilter(grid, 'FirstName');
        await expect(filterItems(grid, 'FirstName').first()).toBeVisible();
        await filterItems(grid, 'FirstName').first().click();
        await expect.poll(() => grid.evaluate((g: any) => !!g.query.filters?.currentFilter)).toBe(true);
        const log = requestLog(page);
        await log.quiet();
        await page.keyboard.press('Escape');
        await expect(filterItems(grid, 'FirstName').first()).toBeHidden();
        log.clear();

        await grid.locator('vi-query-grid-filters vi-button[icon="Filter_Menu"]').click();
        await expect(grid.locator('vi-query-grid-filters vi-popup-menu-item').first()).toBeVisible();
        await log.quiet(500);

        expect(log.requests, 'requests when opening the filters menu').toHaveLength(0);
        await page.keyboard.press('Escape');

        await recordPerf(page, testInfo, 'filters.fl-perf-open-no-request', { counts: { requests: log.requests.length } });
    });

    test('configure dialog Save saves once without re-querying', perfCase('header.dlg-save-requests'), async ({ page }, testInfo) => {
        const grid = await openView(page, VIEWS.People);
        await installPerf(page);
        const log = requestLog(page);
        const saves = () => page.evaluate(() => (window as any).__saves.length);
        const savesBefore = await saves();

        const dialog = await openConfigure(grid);
        await pressRowButton(dialog, 'Gender', 'Eye');
        log.clear();
        await dialogButton(dialog, 'Save').click();
        await expect(configureDialog(page)).toHaveCount(0);
        await expect(grid.locator('vi-query-grid-column-header[name="Gender"]')).toHaveCount(0);
        await log.quiet();

        expect(await saves() - savesBefore, 'settings saves').toBe(1);
        expect(log.of('ExecuteQuery')).toHaveLength(0);

        await recordPerf(page, testInfo, 'header.dlg-save-requests', { counts: { saves: await saves() - savesBefore, executeQuery: log.of('ExecuteQuery').length } });
    });

    test('configure dialog open/cancel cycles do not leak', perfCase('gap.perf-configure-dialog-cycles'), async ({ page }, testInfo) => {
        const grid = await openView(page, VIEWS.People);
        await installPerf(page);
        const saves = () => page.evaluate(() => (window as any).__saves.length);
        const savesBefore = await saves();

        const cycle = async () => {
            const dialog = await openConfigure(grid);
            await dialogButton(dialog, 'Cancel').click();
            await expect(configureDialog(page)).toHaveCount(0);
        };

        // Warm-up cycle, then the baseline
        await cycle();
        await collectGarbage(page);
        const before = await cdpMetrics(page);
        for (let i = 0; i < 20; i++)
            await cycle();

        await parkMouse(page);

        // The ripple of the clicked Cancel button keeps animating for a moment and holds the last dialog until it
        // ends; a leaked dialog is never collected
        let liveDialogs: number;
        await expect.poll(async () => {
            await collectGarbage(page);
            return liveDialogs = await liveInstances(page, 'vi-query-grid-configure-dialog');
        }, { message: 'live vi-query-grid-configure-dialog instances after 21 closed dialogs', timeout: 3000 }).toBe(0);
        const after = await cdpMetrics(page);

        expect(await configureDialog(page).count()).toBe(0);
        expect(await saves() - savesBefore, 'settings saves').toBe(0);
        expect.soft(after.Nodes, 'DOM nodes after 20 cycles').toBeLessThanOrEqual(before.Nodes * 1.10);
        expect.soft(after.JSHeapUsedSize, 'JS heap after 20 cycles').toBeLessThanOrEqual(before.JSHeapUsedSize * 1.10);

        await recordPerf(page, testInfo, 'gap.perf-configure-dialog-cycles', { counts: { dialogsLeft: 0, liveDialogs, saves: await saves() - savesBefore }, memory: { nodesBefore: before.Nodes, nodesAfter: after.Nodes, heapBefore: before.JSHeapUsedSize, heapAfter: after.JSHeapUsedSize }, repetitions: 20 });
    });

    test('repeated filter open/close does not grow DOM', perfCase('perf.cf-open-close-cycles'), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountGrid(page);
        const log = requestLog(page);
        const readCount = () => grid.evaluate((g: any) => (window as any).__perf.deepCount(g.shadowRoot.querySelector('vi-query-grid-column-header[name="Gender"]')));
        // The element count once the closed popup stopped changing (it tears down after the close)
        const headerCount = async () => {
            let last = -1;
            await expect.poll(async () => {
                const count = await readCount();
                const stable = count === last;
                last = count;
                return stable;
            }, { intervals: [100] }).toBe(true);
            return last;
        };
        const headerTags = () => grid.evaluate((g: any) => {
            const header = g.shadowRoot.querySelector('vi-query-grid-column-header[name="Gender"]');
            const tags: Record<string, number> = {};
            (window as any).__perf.deepAll(header, '*').forEach((e: Element) => {
                const key = `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : ''}`;
                tags[key] = (tags[key] ?? 0) + 1;
            });
            return tags;
        });

        const counts: number[] = [];
        let tagsAfterFirst: Record<string, number> = {};
        let checkboxesAfterFirst = 0;
        for (let i = 0; i < 10; i++) {
            await openFilter(grid, 'Gender');
            await expect(filterItems(grid, 'Gender').first()).toBeVisible();
            await closeFilter(page, grid, 'Gender');
            await nextFrames(page, 2);
            if (i === 0)
                counts.push(await headerCount());
            else {
                // Once the close completed the header is back at (or below) its size after the first close; a few
                // elements come and go briefly after a close, a leak never gets back
                await expect.poll(readCount, { message: `cycle ${i + 1}: header elements after closing`, timeout: 3000 }).toBeLessThanOrEqual(counts[0]);
                counts.push(counts[0]);
            }
            if (i === 0) {
                tagsAfterFirst = await headerTags();
                await collectGarbage(page);
                checkboxesAfterFirst = await liveInstances(page, 'vi-checkbox');
            }
        }
        await log.quiet();
        await collectGarbage(page);
        const checkboxes = await liveInstances(page, 'vi-checkbox');

        expect(refreshes(log), 'RefreshColumn requests').toHaveLength(1);
        expect(log.requests).toHaveLength(1);
        const tagsAfter = await headerTags();
        const grown = Object.fromEntries(Object.entries(tagsAfter).filter(([tag, n]) => n !== (tagsAfterFirst[tag] ?? 0)).map(([tag, n]) => [tag, `${tagsAfterFirst[tag] ?? 0} -> ${n}`]));
        expect(new Set(counts).size, `header element counts after each close: ${counts}; changed: ${JSON.stringify(grown)}`).toBe(1);
        expect(checkboxes, 'live vi-checkbox instances').toBeLessThanOrEqual(checkboxesAfterFirst);

        await recordPerf(page, testInfo, 'perf.cf-open-close-cycles', { counts: { requests: log.requests.length, headerElements: counts[0], liveCheckboxes: checkboxes }, repetitions: 10 });
    });

    test('row context menu is created on demand and fully removed', perfCase('perf.pm-contextmenu-cleanup'), async ({ page }, testInfo) => {
        await perfPage(page, { styles: '#test-container { bottom: 40px; }' });
        const grid = await mountGrid(page);
        await parkMouse(page);
        const log = requestLog(page);

        const census = () => page.evaluate(() => {
            const perf = (window as any).__perf;
            return {
                popups: perf.deepAll(document, 'vi-popup').length,
                actionButtons: perf.deepAll(document, 'vi-action-button').length,
                open: perf.deepAll(document, 'vi-popup[open]').length,
                actionsOpen: perf.deepAll(document, '[actions-open]').length,
                deep: perf.deepCount(document)
            };
        });
        const start = await census();
        const viewport = page.viewportSize()!;

        const cycles: any[] = [];
        for (let i = 0; i < 12; i++) {
            const row = await grid.evaluate((g: any, i) => {
                const { b } = (window as any).__perf.visibleRows(g)[2 + i];
                return { x: b.left + 300, y: b.top + b.height / 2 };
            }, i);
            await page.mouse.click(row.x, row.y, { button: 'right' });
            await expect.poll(() => page.evaluate(() => (window as any).__perf.deepAll(document, 'vi-action-button').length)).toBeGreaterThan(0);
            const open = await census();

            // Close with Escape or an outside click (below the grid)
            if (i % 2 === 0)
                await page.keyboard.press('Escape');
            else
                await page.mouse.click(viewport.width / 2, viewport.height - 20);

            await expect.poll(async () => (await census()).actionButtons, `cycle ${i + 1}: action buttons after closing`).toBe(0);
            await nextFrames(page, 2);
            cycles.push({ open, closed: await census() });
        }
        await log.quiet();

        for (const [i, cycle] of cycles.entries()) {
            expect(cycle.closed, `cycle ${i + 1} closed`).toEqual(start);
            expect(cycle.open.actionButtons, `cycle ${i + 1}: actions shown`).toBeGreaterThan(0);
        }
        expect(log.requests).toHaveLength(0);

        await recordPerf(page, testInfo, 'perf.pm-contextmenu-cleanup', { counts: { cycles: cycles.length, requests: log.requests.length, actionButtonsOpen: cycles[0].open.actionButtons }, dataset: { start } });
    });
});
