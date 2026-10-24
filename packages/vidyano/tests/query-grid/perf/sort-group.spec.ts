import { Locator, Page } from '@playwright/test';
import { mountGrid, nextFrames, requestLog, savedSettings, waitForGridReady } from '../_helpers/query-grid';
import { expect, frameStats, median, mountPrefetched, parkMouse, perfCase, perfPage, recordPerf, round, scrollToRow, setCpuThrottle, test, waitFilled } from '../_helpers/perf';

/** Groups the grid's query by BirthDate through the model and waits for the grouped grid. */
async function groupByBirthDate(grid: Locator) {
    await grid.evaluate(async (g: any) => { await g.query.group('BirthDate'); });
    await expect(grid).toHaveAttribute('has-grouping', '');
    await waitForGridReady(grid);
}

/** Label texts of the visible group rows, top to bottom. */
function visibleGroupLabels(grid: Locator) {
    return grid.evaluate((g: any) => (window as any).__perf.visibleRows(g).map(({ r }: any) => r.hasAttribute('is-group') ? r.querySelector('vi-query-grid-row-group').shadowRoot.querySelector('label').textContent.trim() : null));
}

async function collapseAll(page: Page, grid: Locator) {
    await grid.locator('vi-query-grid-grouping').click();
    const item = grid.locator('vi-query-grid-grouping vi-popup-menu-item[label="Collapse all"]');
    await expect(item).toBeVisible();
    return item;
}

test.describe('Sort, search & grouping', () => {
    test.setTimeout(180000);

    test('header sort sends exactly one query', perfCase('perf.sq-sort-single-request'), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountGrid(page);
        const log = requestLog(page);
        const label = grid.locator('vi-query-grid-column-header[name="LastName"] .label');

        const clicks: { requests: any[]; saves: number }[] = [];
        for (let i = 0; i < 2; i++) {
            log.clear();
            const saves = (await savedSettings(page)).length;
            await label.click();
            await waitForGridReady(grid);
            await log.quiet();
            clicks.push({ requests: log.requests.map(r => ({ endpoint: r.endpoint, sortOptions: r.sortOptions, skip: r.skip })), saves: (await savedSettings(page)).length - saves });
        }

        expect(clicks[0].requests).toEqual([{ endpoint: 'ExecuteQuery', sortOptions: 'LastName', skip: undefined }]);
        expect(clicks[1].requests).toEqual([{ endpoint: 'ExecuteQuery', sortOptions: 'LastName DESC', skip: undefined }]);
        expect(clicks.map(c => c.saves)).toEqual([1, 1]);

        await recordPerf(page, testInfo, 'perf.sq-sort-single-request', { counts: { requestsPerClick: clicks.map(c => c.requests.length), savesPerClick: clicks.map(c => c.saves) } });
    });

    for (const rate of [1, 4]) {
        test(`time from sort click to sorted rows (${rate}x CPU)`, perfCase('perf.sq-sort-turnaround', { timing: true }), async ({ page }, testInfo) => {
            await perfPage(page);
            const grid = await mountGrid(page);
            const label = grid.locator('vi-query-grid-column-header[name="LastName"] .label');
            await setCpuThrottle(page, rate);

            const times: number[] = [];
            for (let i = 0; i < 5; i++) {
                await grid.evaluate((g: any) => {
                    const w = window as any;
                    const perf = w.__perf;
                    w.__sorted = new Promise(resolve => window.addEventListener('pointerup', () => {
                        const start = performance.now();
                        const items = g.query.items;
                        perf.whenFrame(() => {
                            if (g.query.items === items || g.query.isBusy)
                                return false;

                            const first = perf.visibleRows(g)[0]?.r;
                            const cell = first && [...first.querySelectorAll('.column')].find((c: any) => c.column.name === 'LastName');
                            const q = g.query;
                            const lazy = q.disableLazyLoading;
                            q.disableLazyLoading = true;
                            try {
                                return !!cell && perf.cellText(cell) === q.items[0].getValue('LastName');
                            }
                            finally {
                                q.disableLazyLoading = lazy;
                            }
                        }).then((result: any) => resolve(result.time - start));
                    }, { capture: true, once: true }));
                });

                await label.click();
                times.push(round(await page.evaluate(() => (window as any).__sorted)));
                await waitForGridReady(grid);
            }

            await setCpuThrottle(page, 1);
            expect(times).toHaveLength(5);
            expect.soft(median(times), 'median sort turnaround').toBeLessThanOrEqual(rate === 1 ? 800 : 2000);

            await recordPerf(page, testInfo, `perf.sq-sort-turnaround.${rate}x`, { cpuThrottle: rate, timings: { sortTurnaround: times }, repetitions: 5 });
        });
    }

    test('grouping sends one query and stays virtualized', perfCase('perf.gr-group-request-and-headers'), async ({ page }, testInfo) => {
        await perfPage(page);
        const grid = await mountGrid(page);
        const log = requestLog(page);
        const rowsBefore = await grid.evaluate((g: any) => (window as any).__perf.rows(g).length);

        const start = Date.now();
        await groupByBirthDate(grid);
        await waitFilled(grid);
        const settleMs = Date.now() - start;
        await log.quiet();

        // Grouping is one query; the other pages stay unloaded (the helper does not return the group() result: Playwright
        // would serialize the lazy items proxy and load all 9900 remaining rows)
        const requests = log.of('ExecuteQuery').map(r => [r.skip, r.top]);
        expect(requests).toEqual([[undefined, undefined]]);

        const loaded = () => grid.evaluate((g: any) => {
            const q = g.query;
            const lazy = q.disableLazyLoading;
            q.disableLazyLoading = true;
            try {
                const first = q.groupingInfo.groups[0];
                return { items: q.items.filter((i: any) => !!i).length, firstGroup: first.items.filter((i: any) => !!i).length, firstGroupCount: first.count };
            }
            finally {
                q.disableLazyLoading = lazy;
            }
        });
        expect(await loaded()).toEqual({ items: 100, firstGroup: 100, firstGroupCount: 166 });

        const labels = await visibleGroupLabels(grid);
        expect(labels[0]).toBe('1945 (166)');
        expect(await grid.evaluate((g: any) => (window as any).__perf.rows(g).length)).toBe(rowsBefore);

        // Rows of other pages still load lazily, one page at a time, when scrolled to
        log.clear();
        await scrollToRow(grid, 5000);
        await waitFilled(grid);
        await log.quiet();
        const scrolled = log.of('ExecuteQuery').map(r => [r.skip, r.top]);
        expect(scrolled.length).toBeGreaterThan(0);
        expect(scrolled.every(([skip, top]) => skip > 100 && top <= 200)).toBe(true);
        const after = (await loaded()).items;
        expect(after).toBeGreaterThan(100);
        expect(after).toBeLessThanOrEqual(100 + scrolled.reduce((sum, [, top]) => sum + top, 0));
        await scrollToRow(grid, 0);
        await waitFilled(grid);

        // Grouping again by the same column sends nothing
        log.clear();
        await grid.evaluate(async (g: any) => { await g.query.group('BirthDate'); });
        await log.quiet(300);
        expect(log.of('ExecuteQuery')).toHaveLength(0);

        await recordPerf(page, testInfo, 'perf.gr-group-request-and-headers', { counts: { requests: requests.length, rowElements: rowsBefore }, timings: { settleMs: [settleMs] }, requests: { group: requests } });
    });

    test('collapse-all of 56 groups is local and coalesced', perfCase('perf.gr-collapse-all-coalesced', { timing: true }), async ({ page }, testInfo) => {
        await perfPage(page);
        const { grid } = await mountPrefetched(page, 'People');
        await groupByBirthDate(grid);
        await waitFilled(grid);
        const log = requestLog(page);
        await log.quiet();
        log.clear();

        const groups = await grid.evaluate((g: any) => g.query.groupingInfo.groups.length);
        expect(groups).toBe(56);

        const item = await collapseAll(page, grid);
        await grid.evaluate((g: any) => {
            const w = window as any;
            const perf = w.__perf;
            perf.observe(g);
            w.__collapse = new Promise(resolve => window.addEventListener('pointerup', () => {
                const start = performance.now();
                const frameTimes: number[] = [];
                let shownAt = NaN;
                perf.whenFrame(() => {
                    frameTimes.push(performance.now());
                    const scroller = perf.scroller(g).scroller;
                    const rows = perf.visibleRows(g);
                    if (Number.isNaN(shownAt) && rows.length > 0 && rows.every(({ r }: any) => r.hasAttribute('is-group')) && scroller.scrollHeight <= 56 * g.rowHeight + 1)
                        shownAt = performance.now() - start;

                    return frameTimes.length >= 30;
                }).then(() => {
                    // Map every row mutation to the frame it was rendered in (records are delivered before that frame's check)
                    const state = perf.__observer;
                    const late = state.observer.takeRecords();
                    state.records.push(...late);
                    late.forEach(() => state.times.push(performance.now()));
                    const inRow = (r: MutationRecord) => {
                        for (let n: any = r.target; n; n = n.parentNode instanceof ShadowRoot ? n.parentNode.host : n.parentNode) {
                            if (n.tagName === 'VI-QUERY-GRID-ROW')
                                return true;
                        }
                        return false;
                    };
                    const commitFrames = [...new Set(state.records.map((r: MutationRecord, i: number) => inRow(r) && state.times[i] >= start ? frameTimes.findIndex(t => t >= state.times[i]) + 1 : null).filter((f: number | null) => f !== null))];
                    resolve({ commitFrames, shownAt, start });
                });
            }, { capture: true, once: true }));
        });

        await item.click();
        const result = await page.evaluate(() => (window as any).__collapse);
        const blocking = await page.evaluate(start => (window as any).__perf.tbt(start, performance.now()), result.start);
        await grid.evaluate(() => (window as any).__perf.takeMutations());
        await log.quiet();

        expect(new Set(result.commitFrames).size, `frames with row mutations: ${result.commitFrames}`).toBeLessThanOrEqual(2);
        expect(result.shownAt).not.toBeNaN();
        expect.soft(result.shownAt, 'collapsed groups shown').toBeLessThanOrEqual(300);
        expect.soft(blocking.longest, 'no task over 100ms').toBeLessThanOrEqual(100);
        expect(log.requests).toHaveLength(0);

        // Collapse all closes the grouping menu
        await expect(item).toBeHidden();

        // 10 single-group toggles are local too; each one really expands or collapses the 1945 group
        const firstGroup = grid.locator('vi-query-grid-row[is-group] vi-query-grid-row-group').first();
        for (let i = 0; i < 10; i++) {
            await firstGroup.click();
            await expect.poll(async () => (await visibleGroupLabels(grid))[1], `toggle ${i + 1}`).toEqual(i % 2 === 0 ? null : expect.stringMatching(/^1946 /));
        }

        await waitFilled(grid);
        await log.quiet(300);
        expect(log.requests).toHaveLength(0);

        await recordPerf(page, testInfo, 'perf.gr-collapse-all-coalesced', { counts: { groups, commitFrames: new Set(result.commitFrames).size, requests: log.requests.length }, timings: { shownMs: [round(result.shownAt)], longestTask: [round(blocking.longest)] } });
    });

    test('expanding one group only touches rows below it', perfCase('perf.gr-toggle-one-group'), async ({ page }, testInfo) => {
        await perfPage(page);
        const { grid } = await mountPrefetched(page, 'People');
        await groupByBirthDate(grid);
        await waitFilled(grid);

        // Load the first 1946 items (page 100-199) up front, so the toggle below is measured without a lazy page load
        await scrollToRow(grid, 168);
        await waitFilled(grid);
        await scrollToRow(grid, 0);
        await waitFilled(grid);

        const collapse = await collapseAll(page, grid);
        await collapse.click();
        await expect.poll(() => visibleGroupLabels(grid)).toEqual(expect.arrayContaining([expect.stringMatching(/^1946 /)]));

        // Collapse all closes the grouping menu, so the rows below it can be clicked
        await expect(collapse).toBeHidden();
        await parkMouse(page);
        await nextFrames(page, 2);

        const log = requestLog(page);
        const target = await grid.evaluate((g: any) => {
            const perf = (window as any).__perf;
            const rows = perf.visibleRows(g);
            const label = (r: any) => r.querySelector('vi-query-grid-row-group').shadowRoot.querySelector('label').textContent.trim();
            const first = rows[0].r;
            const second = rows.find(({ r }: any) => label(r).startsWith('1946 ')).r;
            const b = second.querySelector('vi-query-grid-row-group').getBoundingClientRect();
            perf.observe(g);
            return { firstPool: perf.rows(g).indexOf(first), firstLabel: label(first), x: b.left + 100, y: b.top + b.height / 2, start: performance.now() };
        });
        expect(target.firstLabel).toMatch(/^1945 /);

        await page.mouse.click(target.x, target.y);
        await waitFilled(grid);
        await nextFrames(page, 2);
        await log.quiet();

        const after = await grid.evaluate((g: any, start) => {
            const w = window as any;
            const perf = w.__perf;
            const q = g.query;
            const lazy = q.disableLazyLoading;
            q.disableLazyLoading = true;
            try {
                const rows = perf.visibleRows(g).map(({ r }: any) => r.hasAttribute('is-group') ? `group:${r.item.name}` : `item:${r.item.getValue('BirthDate')?.getFullYear()}`);
                const events = perf.events.filter((e: any) => e.start >= start - 50 && ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click'].includes(e.name));
                return { mutations: perf.takeMutations(), rows, eventDuration: Math.max(0, ...events.map((e: any) => e.duration)) };
            }
            finally {
                q.disableLazyLoading = lazy;
            }
        }, target.start);

        expect(after.rows.slice(0, 3)).toEqual(['group:1945', 'group:1946', 'item:1946']);
        expect(after.mutations.perRow[target.firstPool] ?? 0, 'mutations on the 1945 header row').toBe(0);
        expect(log.of('ExecuteQuery').length).toBeLessThanOrEqual(1);

        await recordPerf(page, testInfo, 'perf.gr-toggle-one-group', { counts: { requests: log.requests.length, rowsMutated: Object.keys(after.mutations.perRow).length }, timings: { eventDuration: [after.eventDuration] } });
    });

    test('a page load leaves unchanged group headers alone', perfCase('perf.gr-page-load-headers'), async ({ page }, testInfo) => {
        await perfPage(page);
        const { grid } = await mountPrefetched(page, 'People');
        await groupByBirthDate(grid);
        await waitFilled(grid);
        await parkMouse(page);
        await nextFrames(page, 2);

        const target = await grid.evaluate((g: any) => {
            const perf = (window as any).__perf;
            const first = perf.visibleRows(g)[0].r;
            (window as any).__groups = g.query.groupingInfo.groups;
            perf.observe(g);
            return { firstPool: perf.rows(g).indexOf(first), label: first.querySelector('vi-query-grid-row-group').shadowRoot.querySelector('label').textContent.trim() };
        });
        expect(target.label).toBe('1945 (166)');

        // Load a page far below the viewport; the groups in its response did not change
        const log = requestLog(page);
        await grid.evaluate(async (g: any) => { await g.query.items.sliceAsync(5000, 5000 + g.query.pageSize); });
        await nextFrames(page, 4);
        await log.quiet();

        const after = await grid.evaluate((g: any) => {
            const perf = (window as any).__perf;
            const groups = (window as any).__groups;
            const first = perf.visibleRows(g)[0].r;
            return {
                mutations: perf.takeMutations(),
                sameGroups: g.query.groupingInfo.groups.length === groups.length && g.query.groupingInfo.groups.every((group: any, i: number) => group === groups[i]),
                label: first.querySelector('vi-query-grid-row-group').shadowRoot.querySelector('label').textContent.trim()
            };
        });

        expect(log.of('ExecuteQuery')).toHaveLength(1);
        expect(after.label).toBe('1945 (166)');
        expect(after.mutations.perRow[target.firstPool] ?? 0, 'mutations on the 1945 header row').toBe(0);
        expect(after.sameGroups, 'the unchanged group objects are kept').toBe(true);

        await recordPerf(page, testInfo, 'perf.gr-page-load-headers', { counts: { requests: log.requests.length, rowsMutated: Object.keys(after.mutations.perRow).length } });
    });

    test('re-query from deep scroll sends no stale fetches', perfCase('perf.sq-sort-from-scrolled', { timing: true }), async ({ page }, testInfo) => {
        await perfPage(page);
        const { grid } = await mountPrefetched(page, 'People');
        await parkMouse(page);
        const log = requestLog(page);

        const runs: Record<string, any> = {};
        for (const [label, trigger] of [
            ['sort', () => grid.locator('vi-query-grid-column-header[name="LastName"] .label').click()],
            ['search', () => grid.evaluate((g: any) => { g.query.search(); })]
        ] as [string, () => Promise<void>][]) {
            await scrollToRow(grid, 5000);
            await waitFilled(grid);
            await log.quiet();
            log.clear();

            // Sample the viewport coverage in every frame from the trigger until the grid settles at the top; the grid is empty
            // while the search runs, so only the frames after it count
            await grid.evaluate((g: any) => {
                const w = window as any;
                const perf = w.__perf;
                const samples = w.__coverage = [] as any[];
                w.__stopCoverage = false;
                perf.whenFrame(() => {
                    samples.push(perf.coverage(g));
                    return w.__stopCoverage;
                }, 30000);
            });

            await trigger();
            await waitForGridReady(grid);
            await waitFilled(grid);
            await log.quiet();
            const samples: any[] = await page.evaluate(() => {
                const w = window as any;
                w.__stopCoverage = true;
                return w.__coverage;
            });

            runs[label] = {
                requests: log.of('ExecuteQuery').map(r => ({ skip: r.skip, top: r.top })),
                frames: samples.length,
                uncovered: samples.filter(s => s.gap > 1 && !s.busy).length,
                uncoveredSamples: samples.map((s, frame) => ({ frame, ...s })).filter(s => s.gap > 1 && !s.busy),
                top: await grid.evaluate((g: any) => (window as any).__perf.topRowIndex(g))
            };
        }

        for (const [label, run] of Object.entries<any>(runs)) {
            expect(run.requests, `${label}: requests`).toEqual([{ skip: undefined, top: undefined }]);
            expect.soft(run.uncovered, `${label}: uncovered frames ${JSON.stringify(run.uncoveredSamples)} of ${run.frames}`).toBe(0);
            expect(run.top, `${label}: top row after the reset`).toBe(0);
        }

        await recordPerf(page, testInfo, 'perf.sq-sort-from-scrolled', { counts: { sortRequests: runs.sort.requests.length, searchRequests: runs.search.requests.length, uncoveredFrames: runs.sort.uncovered + runs.search.uncovered } });
    });

    test('text search narrows rows and spacer with one request', perfCase('perf.sq-text-search', { timing: true }), async ({ page }, testInfo) => {
        await perfPage(page);
        const { grid } = await mountPrefetched(page, 'People');
        await parkMouse(page);
        const log = requestLog(page);

        const search = (text: string) => grid.evaluate(async (g: any, text) => {
            const perf = (window as any).__perf;
            const q = g.query;
            const items = q.items;
            const start = performance.now();
            q.textSearch = text;
            q.search();
            const { time } = await perf.whenFrame(() => {
                if (q.items === items || q.isBusy)
                    return false;

                const rows = perf.visibleRows(g);
                return rows.length > 0 && perf.firstColumnMatches(g, 'FirstName') && (!text || rows.every(({ r }: any) => r.item.getValue('FirstName').startsWith('A')));
            });
            const scroller = perf.scroller(g).scroller;
            return { ms: time - start, totalItems: q.totalItems, scrollHeight: scroller.scrollHeight, expectedHeight: q.totalItems * g.rowHeight };
        }, text);

        const narrowed = await search('FirstName:A*');
        await log.quiet();
        const narrowRequests = log.of('ExecuteQuery').length;
        log.clear();

        const cleared = await search('');
        await log.quiet();
        const clearRequests = log.of('ExecuteQuery').length;

        expect(narrowed.totalItems).toBeLessThan(10000);
        expect(narrowed.totalItems).toBeGreaterThan(0);
        expect(Math.abs(narrowed.scrollHeight - narrowed.expectedHeight), `scrollHeight ${narrowed.scrollHeight} for ${narrowed.totalItems} rows`).toBeLessThanOrEqual(1);
        expect(narrowRequests).toBe(1);
        expect(cleared.totalItems).toBe(10000);
        expect(Math.abs(cleared.scrollHeight - cleared.expectedHeight)).toBeLessThanOrEqual(1);
        expect(clearRequests).toBe(1);
        expect.soft(narrowed.ms, 'time to matching rows').toBeLessThanOrEqual(1500);

        await recordPerf(page, testInfo, 'perf.sq-text-search', { counts: { narrowRequests, clearRequests }, timings: { narrowMs: [round(narrowed.ms)], clearMs: [round(cleared.ms)] } });
    });

    test('back-to-back searches settle once', perfCase('perf.sq-double-search'), async ({ page }, testInfo) => {
        await perfPage(page);
        const consoleErrors: string[] = [];
        page.on('console', msg => {
            if (msg.type() === 'error')
                consoleErrors.push(msg.text());
        });
        const { grid } = await mountPrefetched(page, 'People');
        await parkMouse(page);
        const rowsBefore = await grid.evaluate((g: any) => (window as any).__perf.rows(g).length);
        const log = requestLog(page);

        const finalItems = await grid.evaluate(async (g: any) => {
            const q = g.query;
            const w = window as any;
            const first = q.search();
            const second = q.search();
            await Promise.all([first, second]);
            w.__finalItems = q.items;
            return true;
        });
        expect(finalItems).toBe(true);
        await waitForGridReady(grid);
        await waitFilled(grid);
        await log.quiet();

        const result = await grid.evaluate((g: any) => {
            const perf = (window as any).__perf;
            return { sameItems: g.query.items === (window as any).__finalItems, rows: perf.rows(g).length, matches: perf.firstColumnMatches(g, 'FirstName'), top: perf.topRowIndex(g) };
        });

        expect(log.of('ExecuteQuery').length).toBeLessThanOrEqual(2);
        expect(result).toEqual({ sameItems: true, rows: rowsBefore, matches: true, top: 0 });
        expect(consoleErrors).toEqual([]);

        await recordPerf(page, testInfo, 'perf.sq-double-search', { counts: { requests: log.of('ExecuteQuery').length, rowElements: result.rows } });
    });

    test('expand-all cost', perfCase('perf.gr-expand-all'), async ({ page }, testInfo) => {
        await perfPage(page);
        const { grid } = await mountPrefetched(page, 'People');
        await groupByBirthDate(grid);
        await waitFilled(grid);

        const collapse = await collapseAll(page, grid);
        await collapse.click();
        await expect.poll(async () => (await visibleGroupLabels(grid)).every(l => l !== null)).toBe(true);
        await expect(collapse).toBeHidden();
        await parkMouse(page);
        await nextFrames(page, 2);

        await grid.locator('vi-query-grid-grouping').click();
        const expand = grid.locator('vi-query-grid-grouping vi-popup-menu-item[label="Expand all"]');
        await expect(expand).toBeVisible();
        const log = requestLog(page);

        await grid.evaluate((g: any) => {
            const w = window as any;
            const perf = w.__perf;
            perf.observe(g);
            w.__expand = new Promise(resolve => window.addEventListener('pointerup', () => {
                const start = performance.now();
                const frameTimes: number[] = [];
                perf.whenFrame(() => {
                    frameTimes.push(performance.now());
                    return frameTimes.length >= 30;
                }).then(() => {
                    const state = perf.__observer;
                    const late = state.observer.takeRecords();
                    state.records.push(...late);
                    late.forEach(() => state.times.push(performance.now()));
                    const inRow = (r: MutationRecord) => {
                        for (let n: any = r.target; n; n = n.parentNode instanceof ShadowRoot ? n.parentNode.host : n.parentNode) {
                            if (n.tagName === 'VI-QUERY-GRID-ROW')
                                return true;
                        }
                        return false;
                    };
                    const commitFrames = [...new Set(state.records.map((r: MutationRecord, i: number) => inRow(r) && state.times[i] >= start ? frameTimes.findIndex(t => t >= state.times[i]) + 1 : null).filter((f: number | null) => f !== null))];
                    resolve({ commitFrames, start });
                });
            }, { capture: true, once: true }));
        });

        await expand.click();
        const result = await page.evaluate(() => (window as any).__expand);
        await grid.evaluate(() => (window as any).__perf.takeMutations());
        await waitFilled(grid);
        await log.quiet();

        // The groups are expanded again: the 1945 header is followed by its items
        const labels = await visibleGroupLabels(grid);
        expect(labels[0]).toBe('1945 (166)');
        expect(labels[1]).toBeNull();
        expect(new Set(result.commitFrames).size, `frames with row mutations: ${result.commitFrames}`).toBeLessThanOrEqual(2);
        expect(log.of('ExecuteQuery').length).toBeLessThanOrEqual(1);
        await expect(expand).toBeHidden();

        await recordPerf(page, testInfo, 'perf.gr-expand-all', { counts: { commitFrames: new Set(result.commitFrames).size, requests: log.of('ExecuteQuery').length } });
    });

    test('fling through a grouped result', perfCase('perf.gr-grouped-fling'), async ({ page }, testInfo) => {
        await perfPage(page);
        const { grid } = await mountPrefetched(page, 'People');
        await groupByBirthDate(grid);
        await waitFilled(grid);
        await parkMouse(page);

        const fling = await grid.evaluate(async (g: any) => {
            const perf = (window as any).__perf;
            const scroller = perf.scroller(g).scroller;
            const max = scroller.scrollHeight - scroller.clientHeight;
            const run = await perf.runFrames(120, (i: number) => scroller.scrollTop = max * (1 - Math.pow(1 - (i + 1) / 120, 3)), () => perf.coverage(g));
            return { deltas: run.deltas, uncovered: run.samples.filter((s: any) => s.gap > 1).length, frames: run.samples.length };
        });
        await waitFilled(grid);
        const frames = frameStats(fling.deltas);

        // At 3 settled offsets the row right after a group's header is that group's first item
        const checks: any[] = [];
        for (const groupIndex of [10, 30, 50]) {
            const headerRow = await grid.evaluate((g: any, groupIndex) => g.query.groupingInfo.groups.slice(0, groupIndex).reduce((n: number, group: any) => n + 1 + group.count, 0), groupIndex);
            await scrollToRow(grid, headerRow - 3);
            await waitFilled(grid);
            checks.push(await grid.evaluate((g: any, groupIndex) => {
                const perf = (window as any).__perf;
                const q = g.query;
                const group = q.groupingInfo.groups[groupIndex];
                const firstItemIndex = q.groupingInfo.groups.slice(0, groupIndex).reduce((n: number, group: any) => n + group.count, 0);
                const lazy = q.disableLazyLoading;
                q.disableLazyLoading = true;
                try {
                    const rows = perf.visibleRows(g).map(({ r }: any) => r);
                    const at = rows.findIndex((r: any) => r.item === group);
                    const next = rows[at + 1];
                    return { group: group.name, header: at >= 0, firstItem: !!next && next.item === q.items[firstItemIndex], year: next?.item?.getValue?.('BirthDate')?.getFullYear()?.toString() };
                }
                finally {
                    q.disableLazyLoading = lazy;
                }
            }, groupIndex));
        }

        expect(fling.frames).toBe(120);
        expect(fling.uncovered, 'uncovered frames').toBe(0);
        for (const check of checks)
            expect(check, `group ${check.group}`).toEqual({ group: check.group, header: true, firstItem: true, year: check.group });

        await recordPerf(page, testInfo, 'perf.gr-grouped-fling', { counts: { uncoveredFrames: fling.uncovered }, frames });
    });
});
