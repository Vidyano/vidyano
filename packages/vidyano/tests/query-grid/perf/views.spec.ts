import { Page } from '@playwright/test';
import { nextFrames, openView, requestLog, VIEWS, waitForGridReady } from '../_helpers/query-grid';
import { browseReference, dialogButton, openEmergencyContact, referenceDialog } from '../_helpers/views';
import { cdpMetrics, collectGarbage, droppedFrames, expect, frameStats, installPerf, median, parkMouse, perfCase, recordPerf, round, test } from '../_helpers/perf';

/**
 * Navigates the app to `path` with app.changePath (after clearing the app cache so the query is fetched again) and
 * resolves with the ms until the grid of `queryName` is settled: no [initializing], query idle, visible rows filled.
 */
function navigate(page: Page, queryName: string, path: string) {
    return page.evaluate(async ({ queryName, path }) => {
        const perf = (window as any).__perf;
        const app = document.querySelector('vi-app') as any;
        app.cacheClear();

        const start = performance.now();
        app.changePath(path);

        let found: any = null;
        const { time } = await perf.whenFrame(() => {
            const grid = perf.deepAll(document, 'vi-query-grid').find((g: any) => g.query?.name === queryName && g.getBoundingClientRect().height > 0);
            if (!grid || grid.hasAttribute('initializing') || grid.query.isBusy)
                return false;

            const coverage = perf.coverage(grid);
            if (coverage.blank > 0 || (grid.query.totalItems > 0 && coverage.rows === 0))
                return false;

            found = grid;
            return true;
        }, 30000);

        const rows = perf.rows(found);
        const dataRow = rows.find((r: any) => !r.classList.contains('hidden') && !r.hasAttribute('is-group'));
        const scroller = perf.scroller(found).scroller;
        return {
            ms: time - start,
            rowElements: rows.length,
            shownRows: rows.filter((r: any) => !r.classList.contains('hidden') && r.getBoundingClientRect().height > 0).length,
            elementsPerDataRow: dataRow ? perf.deepCount(dataRow) : 0,
            deepElementCount: perf.deepCount(found),
            verticalScroll: scroller.scrollHeight > scroller.clientHeight
        };
    }, { queryName, path });
}

/** Opens the app on a grid view that is not part of the matrix, so the first matrix view is a real navigation. */
async function openApp(page: Page) {
    await openView(page, 'components/query-grid_data-types');
    await installPerf(page);
}

/** Installs window.__peopleGrid (the shown People grid) and window.__peopleSettled (that grid is ready with filled rows). */
async function installPeopleSettled(page: Page) {
    await page.evaluate(() => {
        const w = window as any;
        const perf = w.__perf;
        w.__peopleGrid = () => perf.deepAll(document, 'vi-query-grid').find((g: any) => g.query?.name === 'People' && g.getBoundingClientRect().height > 0);
        w.__peopleSettled = () => {
            const grid = w.__peopleGrid();
            if (!grid || grid.hasAttribute('initializing') || grid.query.isBusy)
                return false;

            const c = perf.coverage(grid);
            return c.rows > 0 && c.blank === 0;
        };
    });
}

test.describe('View matrix', () => {
    test.setTimeout(300000);

    test('each of the 9 views is ready within budget', perfCase('views.perf-initial-render-all-views', { timing: true }), async ({ page }, testInfo) => {
        await openApp(page);

        // Warm-up round: code paths and styles of every view are loaded once
        for (const [name, path] of Object.entries(VIEWS))
            await navigate(page, name, path);

        const times: Record<string, number[]> = Object.fromEntries(Object.keys(VIEWS).map(name => [name, []]));
        for (let round_ = 0; round_ < 5; round_++) {
            for (const [name, path] of Object.entries(VIEWS))
                times[name].push(round((await navigate(page, name, path)).ms));
        }

        for (const [name, samples] of Object.entries(times))
            expect.soft(median(samples), `${name}: median time to a settled grid`).toBeLessThanOrEqual(1500);

        await recordPerf(page, testInfo, 'views.perf-initial-render-all-views', { timings: times, repetitions: 5 });
    });

    test('view matrix: requests and DOM budget per view', perfCase('perf.vm-people'), async ({ page }, testInfo) => {
        await openApp(page);
        const log = requestLog(page);
        await log.quiet();

        const table: Record<string, any> = {};
        for (const [name, path] of Object.entries(VIEWS)) {
            log.clear();
            const result = await navigate(page, name, path);
            await log.quiet();
            table[name] = { ...result, ms: undefined, getQuery: log.of('GetQuery').length, executeQuery: log.of('ExecuteQuery').length };

            expect(table[name].getQuery, `${name}: GetQuery`).toBe(1);
            expect(table[name].executeQuery, `${name}: ExecuteQuery`).toBe(0);
            expect(result.rowElements, `${name}: row pool`).toBeGreaterThan(0);
        }

        expect(table['PeopleTop10'].shownRows).toBe(10);
        expect(table['PeopleTop10'].verticalScroll).toBe(false);

        await recordPerf(page, testInfo, 'perf.vm-people', { counts: table });
    });
});

test.describe('Scrolling & selection', () => {
    test.setTimeout(180000);

    test('no long tasks or slow frames during wheel scrolling', perfCase('views.perf-no-long-tasks', { timing: true }), async ({ page }, testInfo) => {
        const grid = await openView(page, VIEWS.People);
        await installPerf(page);
        const box = (await grid.boundingBox())!;
        await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 300));

        const start = await page.evaluate(() => {
            (window as any).__perf.startFrames();
            return performance.now();
        });
        for (let i = 0; i < 40; i++)
            await page.mouse.wheel(0, 400);

        const deltas: number[] = await page.evaluate(() => (window as any).__perf.stopFrames());
        const blocking = await page.evaluate(start => (window as any).__perf.tbt(start, performance.now()), start);
        await expect.poll(() => grid.evaluate((g: any) => {
            const c = (window as any).__perf.coverage(g);
            return !g.query.isBusy && c.blank === 0 && c.gap <= 1;
        })).toBe(true);
        await parkMouse(page);

        const frames = { ...frameStats(deltas), ...droppedFrames(deltas) };
        expect(frames.count).toBeGreaterThan(10);
        expect.soft(blocking.longest, 'no long task over 200ms').toBeLessThanOrEqual(200);
        expect.soft(frames.p95, 'rAF interval p95').toBeLessThan(50);

        await recordPerf(page, testInfo, 'views.perf-no-long-tasks', { frames, timings: { longestTask: [round(blocking.longest)], tbt: [round(blocking.tbt)] }, counts: { longTasks: blocking.count } });
    });

    test('select-all on 10,000 rows selects every row and fetches nothing', perfCase('views.perf-select-all-state'), async ({ page }, testInfo) => {
        const grid = await openView(page, VIEWS.People);
        await installPerf(page);
        const log = requestLog(page);
        await log.quiet();
        log.clear();

        const selectAll = grid.locator('vi-query-grid-select-all');
        await selectAll.click();
        await expect.poll(() => grid.evaluate((g: any) => {
            const rows = (window as any).__perf.visibleRows(g);
            return rows.length > 0 && rows.every(({ r }: any) => r.hasAttribute('selected'));
        }), 'every rendered row is [selected]').toBe(true);
        await nextFrames(page, 2);
        await log.quiet();

        expect(await grid.evaluate((g: any) => [g.query.selectAll.allSelected, g.query.selectedItemCount])).toEqual([true, 10000]);
        expect(log.of('ExecuteQuery')).toHaveLength(0);

        // Leave the selection as it was
        await selectAll.click();
        await expect.poll(() => grid.evaluate((g: any) => g.query.selectedItemCount)).toBe(0);

        await recordPerf(page, testInfo, 'views.perf-select-all-state', { counts: { executeQuery: log.of('ExecuteQuery').length } });
    });

    test('select-all on 10,000 rows is fast', perfCase('views.perf-select-all-no-fetch', { timing: true }), async ({ page }, testInfo) => {
        const grid = await openView(page, VIEWS.People);
        await installPerf(page);

        const selectAll = grid.locator('vi-query-grid-select-all');
        const box = (await selectAll.boundingBox())!;
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await grid.evaluate((g: any) => {
            const w = window as any;
            const perf = w.__perf;
            w.__selectAll = new Promise(resolve => window.addEventListener('pointerdown', () => {
                const start = performance.now();
                perf.whenFrame(() => {
                    const rows = perf.visibleRows(g);
                    return rows.length > 0 && rows.every(({ r }: any) => r.hasAttribute('selected'));
                }).then((r: any) => resolve(r.time - start));
            }, { capture: true, once: true }));
        });

        await page.mouse.down();
        await page.mouse.up();
        const ms = await page.evaluate(() => (window as any).__selectAll);

        expect.soft(ms, 'select-all until every rendered row is [selected]').toBeLessThan(300);

        // Leave the selection as it was
        await selectAll.click();
        await expect.poll(() => grid.evaluate((g: any) => g.query.selectedItemCount)).toBe(0);

        await recordPerf(page, testInfo, 'views.perf-select-all-no-fetch', { timings: { selectAllMs: [round(ms)] } });
    });
});

test.describe('Navigation & consumers', () => {
    test.setTimeout(240000);

    test('returning to a cached query shows it again without GetQuery', perfCase('views.perf-cached-return-requests'), async ({ page }, testInfo) => {
        const grid = await openView(page, VIEWS.People);
        await installPerf(page);
        await installPeopleSettled(page);
        const log = requestLog(page);
        const firstRows = () => page.evaluate(() => {
            const w = window as any;
            return w.__perf.visibleRows(w.__peopleGrid()).slice(0, 5).map(({ r }: any) => w.__perf.cellText(r.querySelector('.column')));
        });
        const rowsBefore = await firstRows();
        await grid.evaluate((g: any) => (window as any).__peopleQuery = g.query);

        // Open the first person
        await grid.locator('vi-query-grid-row:not(.hidden)').first().locator('.column').nth(1).click();
        await page.waitForURL(/\/person\//);
        await expect(page.locator('vi-persistent-object').filter({ visible: true }).first()).toBeVisible();
        await log.quiet();
        log.clear();

        await page.goBack();
        await page.waitForURL(/\/people$/);
        await expect.poll(() => page.evaluate(() => (window as any).__peopleSettled()), 'the People grid is settled after Back').toBe(true);
        await waitForGridReady(page.locator('vi-query-grid').filter({ visible: true }).first());
        await log.quiet();

        expect(await page.evaluate(() => (window as any).__peopleGrid().query === (window as any).__peopleQuery), 'the grid shows the cached query').toBe(true);
        expect(await firstRows(), 'the first rows after Back').toEqual(rowsBefore);
        expect(log.of('GetQuery'), 'GetQuery for the cached query').toHaveLength(0);
        expect(log.of('ExecuteQuery'), 'ExecuteQuery for the cached query').toHaveLength(0);

        await recordPerf(page, testInfo, 'views.perf-cached-return-requests', { counts: { getQuery: log.of('GetQuery').length, executeQuery: log.of('ExecuteQuery').length } });
    });

    test('returning to a cached query is fast', perfCase('views.perf-cached-return', { timing: true }), async ({ page }, testInfo) => {
        const grid = await openView(page, VIEWS.People);
        await installPerf(page);
        await installPeopleSettled(page);

        // Open the first person
        await grid.locator('vi-query-grid-row:not(.hidden)').first().locator('.column').nth(1).click();
        await page.waitForURL(/\/person\//);
        await expect(page.locator('vi-persistent-object').filter({ visible: true }).first()).toBeVisible();

        const start = await page.evaluate(() => performance.now());
        await page.goBack();
        await page.waitForURL(/\/people$/);
        const ms = await page.evaluate(async start => {
            const w = window as any;
            const { time } = await w.__perf.whenFrame(w.__peopleSettled, 30000);
            return time - start;
        }, start);
        await waitForGridReady(page.locator('vi-query-grid').filter({ visible: true }).first());

        expect.soft(ms, 'grid ready after Back').toBeLessThanOrEqual(1000);

        await recordPerf(page, testInfo, 'views.perf-cached-return', { timings: { readyMs: [round(ms)] } });
    });

    test('switching across the 9 views leaves one grid', perfCase('views.perf-view-switch-single-grid'), async ({ page }, testInfo) => {
        await openView(page, 'components/query-grid_data-types');
        await installPerf(page);
        await collectGarbage(page);
        const before = await cdpMetrics(page);

        const counts: Record<string, number> = {};
        for (let round_ = 0; round_ < 2; round_++) {
            for (const [name, path] of Object.entries(VIEWS)) {
                await page.evaluate(path => (document.querySelector('vi-app') as any).changePath(path), path);
                const grid = page.locator('vi-query-grid').filter({ visible: true }).first();
                await expect.poll(() => grid.evaluate((g: any) => g.query?.name)).toBe(name);
                await waitForGridReady(grid);
                counts[name] = await page.evaluate(() => (window as any).__perf.deepAll(document, 'vi-query-grid').filter((g: any) => g.isConnected).length);
            }
        }

        await collectGarbage(page);
        const after = await cdpMetrics(page);
        const heapGrowth = after.JSHeapUsedSize - before.JSHeapUsedSize;

        for (const [name, count] of Object.entries(counts))
            expect(count, `${name}: vi-query-grid elements in the document`).toBe(1);
        expect(heapGrowth, 'heap growth after visiting the 9 views twice').toBeLessThan(30 * 1024 * 1024);

        await recordPerf(page, testInfo, 'views.perf-view-switch-single-grid', { counts: { maxGrids: Math.max(...Object.values(counts)) }, memory: { heapGrowth, heapBefore: before.JSHeapUsedSize, heapAfter: after.JSHeapUsedSize } });
    });

    test('reference lookup dialog opens within budget', perfCase('views.perf-lookup-dialog-open', { timing: true }), async ({ page }, testInfo) => {
        const { po, reference } = await openEmergencyContact(page);
        await installPerf(page);

        await page.evaluate(() => {
            const w = window as any;
            const perf = w.__perf;
            w.__lookup = new Promise(resolve => window.addEventListener('pointerdown', () => {
                const start = performance.now();
                perf.whenFrame(() => {
                    const grid = perf.deepAll(document, 'vi-query-grid').find((g: any) => {
                        for (let n: any = g; n; n = n.parentNode ?? n.host)
                            if (n.tagName === 'VI-SELECT-REFERENCE-DIALOG')
                                return true;
                        return false;
                    });
                    return !!grid && grid.isConnected && !grid.hasAttribute('initializing');
                }, 30000).then((r: any) => resolve(r.time - start));
            }, { capture: true, once: true }));
        });

        const { dialog, grid } = await browseReference(reference);
        const ms = await page.evaluate(() => (window as any).__lookup);
        const rows = await grid.evaluate((g: any) => (window as any).__perf.rows(g).length);

        await dialogButton(dialog, 'Cancel').click();
        await expect(referenceDialog(page)).toHaveCount(0);
        await po.locator('vi-action-button[name=CancelEdit]').click();

        expect(rows).toBeGreaterThan(0);
        expect.soft(ms, 'Browse to a ready dialog grid').toBeLessThan(2000);

        await recordPerf(page, testInfo, 'views.perf-lookup-dialog-open', { counts: { rowElements: rows }, timings: { openMs: [round(ms)] } });
    });
});
