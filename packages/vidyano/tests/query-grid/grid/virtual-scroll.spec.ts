import { test, expect, Locator } from '@playwright/test';
import { gridPage, mountGrid, getScrollOffset, scrollGrid, requestLog, nextFrames, writePerf, waitForGridReady } from '../_helpers/query-grid';
import { attachGrid, holdExecuteQuery, rows, scrollerBox, settle, valuesOf, wheelGrid } from '../_helpers/grid';

const RH = 32;
/** Page height that gives the People grid body a viewport of exactly 640px (the header is 66px) */
const HEIGHT_640 = 706;

/** Every row of the pool in DOM order */
async function rowPool(grid: Locator) {
    return grid.evaluate((g: any) => {
        const q = g.query;
        const lazy = q.disableLazyLoading;
        q.disableLazyLoading = true;
        try {
            return [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].map((r: any) => ({
                hidden: r.classList.contains('hidden'),
                display: getComputedStyle(r).display,
                loading: r.classList.contains('loading'),
                index: q.items.indexOf(r.item),
                top: r.getBoundingClientRect().top,
                background: getComputedStyle(r).backgroundColor
            }));
        }
        finally {
            q.disableLazyLoading = lazy;
        }
    });
}

async function expectCoverage(grid: Locator, step: string) {
    await expect.poll(async () => {
        const { top, height } = await getScrollOffset(grid);
        const first = Math.floor(top / RH);
        const last = Math.min(Math.ceil((top + height) / RH) - 1, 9999);
        const positions = new Set((await rows(grid)).map(r => r.position));
        const missing: number[] = [];
        for (let i = first; i <= last; i++) {
            if (!positions.has(i))
                missing.push(i);
        }

        return missing;
    }, { message: `${step}: rows missing from the viewport`, timeout: 3000 }).toEqual([]);
}

async function expectRowsAtTheirIndex(grid: Locator, step: string) {
    const visible = await rows(grid);
    expect(visible.length, step).toBeGreaterThan(0);
    const names = await valuesOf(grid, visible.map(r => r.index), 'FirstName');
    visible.forEach((r, i) => {
        expect(r.index, `${step}: row at position ${r.position}`).toBeGreaterThanOrEqual(0);
        expect(Math.abs(r.offset - r.index * RH), `${step}: row ${r.index} offset`).toBeLessThanOrEqual(1);
        expect(r.cells[0].text, `${step}: row ${r.index} FirstName`).toBe(names[i]);
    });
}

test.describe('Virtual scrolling and lazy loading', () => {
    test('row pool is bounded by the viewport', { annotation: [{ type: 'case', description: 'grid.vs-row-count' }] }, async ({ page }, testInfo) => {
        await gridPage(page, { height: HEIGHT_640 });
        const grid = await mountGrid(page);
        const counts: Record<string, number> = {};

        for (const [label, pageHeight] of [['640', HEIGHT_640], ['900', HEIGHT_640 + 260]] as const) {
            await page.setViewportSize({ width: 1280, height: pageHeight });
            await expect.poll(async () => (await getScrollOffset(grid)).height).toBe(Number(label));
            await settle(grid);

            const vh = Number(label);
            const visibleRows = Math.ceil(vh / RH);
            await expect.poll(() => grid.evaluate((g: any) => g.shadowRoot.querySelectorAll('vi-query-grid-row').length)).toBeGreaterThanOrEqual(visibleRows + 1);

            const count = await grid.evaluate((g: any) => g.shadowRoot.querySelectorAll('vi-query-grid-row').length);
            expect(count, `VH ${vh}`).toBeLessThanOrEqual(Math.ceil(visibleRows * 1.5) + 1);
            counts[`vh${vh}`] = count;

            const positions = (await rows(grid)).map(r => r.position);
            expect(positions, `VH ${vh}`).toEqual(Array.from({ length: visibleRows }, (_, i) => i));
        }

        await writePerf(testInfo, 'grid.vs-row-count', { rowElements: counts });
    });

    test('scroll height equals total rows times row height', { annotation: [{ type: 'case', description: 'grid.vs-spacer-height' }] }, async ({ page }) => {
        await gridPage(page);
        const people = await mountGrid(page);
        expect((await getScrollOffset(people)).scrollHeight).toBe(10000 * RH);
        await people.evaluate((g: any) => g.remove());

        const top10 = await mountGrid(page, { query: 'PeopleTop10' });
        const offset = await getScrollOffset(top10);
        expect(offset.scrollHeight).toBe(Math.max(10 * RH, offset.height));
    });

    test('rows past the end of the result are hidden', { annotation: [{ type: 'case', description: 'grid.vs-no-rows-past-end' }] }, async ({ page }) => {
        await gridPage(page);
        const top10 = await mountGrid(page, { query: 'PeopleTop10' });

        const pool = await rowPool(top10);
        const shown = pool.filter(r => !r.hidden);
        expect(shown.map(r => r.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
        expect(pool.slice(0, 10).every(r => !r.hidden)).toBe(true);
        pool.slice(10).forEach(r => {
            expect(r.hidden).toBe(true);
            expect(r.display).toBe('none');
        });
        expect(pool.some(r => r.loading)).toBe(false);
        expect((await rows(top10)).map(r => r.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
        await top10.evaluate((g: any) => g.remove());

        const people = await mountGrid(page);
        const { scrollHeight } = await getScrollOffset(people);
        await scrollGrid(people, { top: scrollHeight });
        await settle(people);

        const visible = await rows(people);
        expect(Math.max(...visible.map(r => r.index))).toBe(9999);
        visible.forEach(r => expect(r.index).toBeLessThanOrEqual(9999));
        (await rowPool(people)).filter(r => !r.hidden).forEach(r => expect(r.loading).toBe(false));
    });

    test('each visible row sits at its absolute index and shows that item', { annotation: [{ type: 'case', description: 'grid.vs-row-position-invariant' }] }, async ({ page }) => {
        await gridPage(page, { width: 1000, height: 600 });
        const grid = await mountGrid(page);
        const { scrollHeight, height } = await getScrollOffset(grid);

        for (const top of [0, 1000, 33 * RH, 3001 * RH, 5000 * RH, scrollHeight - height]) {
            await scrollGrid(grid, { top });
            await settle(grid);
            await expectRowsAtTheirIndex(grid, `scrollTop ${top}`);
        }
    });

    test('scrolling down leaves no blank rows', { annotation: [{ type: 'case', description: 'grid.vs-viewport-coverage-down' }] }, async ({ page }) => {
        await gridPage(page, { height: HEIGHT_640 });
        const grid = await mountGrid(page);
        expect((await getScrollOffset(grid)).height).toBe(640);

        await scrollGrid(grid, { top: 9 * RH });
        await expectCoverage(grid, 'jump to row 9');

        await wheelGrid(grid, 0, 2 * RH);
        await expect.poll(async () => (await getScrollOffset(grid)).top).toBeGreaterThan(9 * RH);
        await expectCoverage(grid, 'wheel to row 11');

        await scrollGrid(grid, { top: 3001 * RH });
        await expectCoverage(grid, 'jump to row 3001');

        await wheelGrid(grid, 0, 49 * RH);
        await expect.poll(async () => (await getScrollOffset(grid)).top).toBeGreaterThan(3001 * RH);
        await expectCoverage(grid, 'wheel to row 3050');
    });

    test('scrolling up leaves no blank rows', { annotation: [{ type: 'case', description: 'grid.vs-viewport-coverage-up' }] }, async ({ page }) => {
        await gridPage(page, { height: HEIGHT_640 });
        const grid = await mountGrid(page);
        expect((await getScrollOffset(grid)).height).toBe(640);

        // Scrolling up aligns the window to the viewport end; one of the two targets gives it an odd start
        for (const target of [2995, 2994]) {
            await scrollGrid(grid, { top: 3001 * RH });
            await expectCoverage(grid, `jump to row 3001 before ${target}`);

            await scrollGrid(grid, { top: target * RH });
            await expectCoverage(grid, `up to row ${target}`);
        }

        for (const step of [1, 2]) {
            const { top } = await getScrollOffset(grid);
            await wheelGrid(grid, 0, -25 * RH);
            await expect.poll(async () => (await getScrollOffset(grid)).top).toBeLessThan(top);
            await expectCoverage(grid, `wheel up ${step}`);
        }
    });

    test('row DOM order and stripes follow the absolute index', { annotation: [{ type: 'case', description: 'grid.vs-even-start-zebra' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await page.mouse.move(0, 0);

        const check = async (step: string) => {
            await settle(grid);
            const { top, height } = await getScrollOffset(grid);
            const box = await grid.evaluate((g: any) => {
                const vs = [...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any;
                return vs.scroller.getBoundingClientRect().top;
            });

            const pool = (await rowPool(grid)).filter(r => !r.hidden);
            const inView = pool.filter(r => r.top + RH > box && r.top < box + height);
            expect(inView.length, step).toBeGreaterThan(0);
            for (let i = 1; i < pool.length; i++)
                expect(pool[i].top, `${step}: DOM order`).toBeGreaterThan(pool[i - 1].top);

            inView.forEach(r => expect(r.background, `${step}: row ${r.index}`).toBe(r.index % 2 === 0 ? 'rgb(250, 250, 250)' : 'rgb(255, 255, 255)'));
            expect(inView[0].index, `${step}: first row near scrollTop ${top}`).toBeGreaterThanOrEqual(Math.floor(top / RH) - 1);
        };

        await scrollGrid(grid, { top: 3001 * RH });
        await check('row 3001');

        await scrollGrid(grid, { top: 1235 * RH });
        await check('row 1235');

        for (const [step, delta] of [['+7', 7], ['+50', 50], ['-3', -3]] as const) {
            const { top } = await getScrollOffset(grid);
            await scrollGrid(grid, { top: top + delta * RH });
            await check(step);
        }

        await scrollGrid(grid, { top: 5000 * RH });
        await check('jump 5000');

        const { top } = await getScrollOffset(grid);
        await scrollGrid(grid, { top: top - 20 * RH });
        await check('-20');
    });

    test('unloaded rows show loading placeholders until their page arrives', { annotation: [{ type: 'case', description: 'grid.vs-placeholder-loading' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        const release = await holdExecuteQuery(page);

        await scrollGrid(grid, { top: 5000 * RH });
        // The placeholders must be in place within two frames of the jump (the page is still held)
        await nextFrames(page, 2);
        const placeholders = await rows(grid);
        expect(placeholders.length).toBeGreaterThan(0);
        placeholders.forEach(r => expect(r.loading, `position ${r.position}`).toBe(true));

        const state = await grid.evaluate((g: any) => {
            const vs = [...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any;
            const view = vs.scroller.getBoundingClientRect();
            return [...g.shadowRoot.querySelectorAll('vi-query-grid-row')]
                .filter((r: any) => {
                    const b = r.getBoundingClientRect();
                    return !r.classList.contains('hidden') && b.bottom > view.top + 1 && b.top < view.bottom - 1;
                })
                .map((r: any) => ({
                    cells: [...r.querySelectorAll('.column'), ...(r.shadowRoot?.querySelectorAll('.column') ?? [])].map((c: any) => getComputedStyle(c).visibility),
                    selector: [...r.shadowRoot.querySelectorAll('[part~="selector"]')].map((e: any) => getComputedStyle(e).visibility),
                    actions: [...r.shadowRoot.querySelectorAll('[part~="actions"]')].map((e: any) => getComputedStyle(e).visibility),
                    selected: r.hasAttribute('selected'),
                    isItem: !!r.item && r.item.constructor?.name !== 'Object'
                }));
        });
        state.forEach(r => {
            r.cells.forEach(v => expect(v).toBe('hidden'));
            r.selector.forEach(v => expect(v).toBe('hidden'));
            r.actions.forEach(v => expect(v).toBe('hidden'));
            expect(r.selected).toBe(false);
            expect(r.isItem).toBe(false);
        });
        (await rows(grid)).forEach(r => r.cells.forEach(c => expect(c.text, 'no stale text').toBe('')));

        await release();
        await settle(grid);
        const visible = await rows(grid);
        expect(visible[0].index).toBe(5000);
        await expectRowsAtTheirIndex(grid, 'after release');
    });

    test('rows of a page that is loading stay placeholders while scrolling', { annotation: [{ type: 'case', description: 'grid.vs-placeholder-while-loading' }] }, async ({ page }) => {
        await gridPage(page, { height: HEIGHT_640 });
        const grid = await mountGrid(page);
        const log = requestLog(page);
        const release = await holdExecuteQuery(page);

        await scrollGrid(grid, { top: 5000 * RH });
        await expect.poll(() => log.of('ExecuteQuery').length).toBe(1);

        // The page is requested and still held: a scroll within it must keep its rows as placeholders
        for (const row of [5003, 4999]) {
            await scrollGrid(grid, { top: row * RH });
            await nextFrames(page, 2);
            const visible = await rows(grid);
            expect(visible.map(r => r.position), `row ${row}: rows in the viewport`).toEqual(Array.from({ length: 640 / RH }, (_, i) => row + i));
            visible.forEach(r => expect(r.loading, `row ${row}: position ${r.position}`).toBe(true));
            if (row === 5003)
                expect(log.of('ExecuteQuery').map(r => r.skip), 'no second request for the loading page').toEqual([5000]);
        }

        await release();
        await settle(grid);
        await log.quiet();
        // Row 4999 lies in the page before: each page is requested once
        expect(log.of('ExecuteQuery').map(r => r.skip)).toEqual([5000, 4900]);
        expect((await rows(grid))[0].index).toBe(4999);
        await expectRowsAtTheirIndex(grid, 'after release');
    });

    test('jumping into one unloaded page requests exactly that page', { annotation: [{ type: 'case', description: 'grid.vs-lazy-request-single-page' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        const log = requestLog(page);

        await scrollGrid(grid, { top: 5000 * RH });
        await settle(grid);
        await log.quiet();

        expect(log.of('ExecuteQuery').map(r => ({ skip: r.skip, top: r.top }))).toEqual([{ skip: 5000, top: 100 }]);
    });

    test('rapid jumps load only the final position', { annotation: [{ type: 'case', description: 'grid.vs-lazy-debounce' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        const log = requestLog(page);

        await grid.evaluate(async (g: any) => {
            const scroller = ([...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any).scroller as HTMLElement;
            // Each jump reaches the grid at once (the scroll event itself waits for a frame), and a 0ms timer always runs
            // before the grid's longer page load timer, so slow frames can't let an intermediate page load slip through
            for (let row = 1000; row <= 7000; row += 1000) {
                scroller.scrollTop = row * 32;
                scroller.dispatchEvent(new Event('scroll'));
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        });

        await settle(grid);
        await log.quiet();
        expect([...new Set(log.of('ExecuteQuery').map(r => r.skip))]).toEqual([7000]);
    });

    test('continuous wheel scrolling never jumps backwards', { annotation: [{ type: 'case', description: 'grid.scroll-no-snapback-during-wheel' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        await grid.evaluate((g: any) => {
            const w = window as any;
            const scroller = ([...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any).scroller as HTMLElement;
            w.__samples = [];
            w.__sampling = true;
            const sample = () => {
                w.__samples.push(scroller.scrollTop);
                if (w.__sampling)
                    requestAnimationFrame(sample);
            };
            requestAnimationFrame(sample);
        });

        const box = await grid.evaluate((g: any) => {
            const b = ([...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any).scroller.getBoundingClientRect();
            return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
        });
        await page.mouse.move(box.x, box.y);
        for (let i = 0; i < 40; i++) {
            await page.mouse.wheel(0, 120);
            await nextFrames(page, 1);
        }

        const samples: number[] = await page.evaluate(() => {
            (window as any).__sampling = false;
            return (window as any).__samples;
        });
        expect(samples.at(-1)!).toBeGreaterThan(0);
        for (let i = 1; i < samples.length; i++)
            expect(samples[i], `sample ${i}`).toBeGreaterThanOrEqual(samples[i - 1]);

        const final = (await getScrollOffset(grid)).top;
        // Pages keep loading after the last wheel: the offset must not move during that second
        await page.waitForTimeout(1000);
        expect((await getScrollOffset(grid)).top).toBe(final);
    });

    test('wheel scrolling moves exactly the wheel distance while pages arrive', { annotation: [{ type: 'case', description: 'grid.vs-wheel-no-jump-on-page-load' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        const log = requestLog(page);

        await wheelGrid(grid, 0, 0);
        for (let i = 0; i < 40; i++) {
            await page.mouse.wheel(0, 600);
            // One wheel event per 16ms, like a real wheel
            await page.waitForTimeout(16);
        }

        await settle(grid);
        await log.quiet();
        expect(log.of('ExecuteQuery').length, 'pages loaded during the wheel').toBeGreaterThan(0);
        expect((await getScrollOffset(grid)).top).toBe(24000);
        await expectRowsAtTheirIndex(grid, 'after the wheel');
    });

    test('the bottom shows the last item flush', { annotation: [{ type: 'case', description: 'grid.vs-bottom-last-row' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        const { scrollHeight } = await getScrollOffset(grid);

        await scrollGrid(grid, { top: scrollHeight });
        await settle(grid);

        const visible = await rows(grid);
        const last = visible.at(-1)!;
        expect(last.index).toBe(9999);

        const view = await grid.evaluate((g: any) => ([...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any).scroller.getBoundingClientRect().bottom);
        expect(Math.abs(last.bottom - view)).toBeLessThanOrEqual(1);
    });

    test('a viewport spanning two pages loads both once', { annotation: [{ type: 'case', description: 'grid.vs-lazy-request-two-pages' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        const log = requestLog(page);

        await scrollGrid(grid, { top: 5090 * RH });
        await settle(grid);
        await log.quiet();

        const requested = new Map<number, number>();
        for (const r of log.of('ExecuteQuery')) {
            for (let i = r.skip!; i < r.skip! + r.top!; i++)
                requested.set(i, (requested.get(i) ?? 0) + 1);
        }

        const expected = Array.from({ length: 200 }, (_, i) => 5000 + i);
        expect([...requested.keys()].sort((a, b) => a - b)).toEqual(expected);
        expect([...requested.values()].every(n => n === 1)).toBe(true);
        await expectRowsAtTheirIndex(grid, 'pages 50 and 51');
    });

    test('returning to a loaded region before the load cancels it', { annotation: [{ type: 'case', description: 'grid.vs-lazy-cancel-on-return' }] }, async ({ page }) => {
        // The page clock holds the grid's page fetch debounce, so returning within it does not depend on the frame rate
        await page.clock.install();
        await gridPage(page);
        const grid = await mountGrid(page);
        const log = requestLog(page);
        // pauseAt throws for a time in the past and fires every timer due by then; a second ahead covers the round trip
        await page.clock.pauseAt(await page.evaluate(() => Date.now()) + 1000);

        const scrollTo = async (top: number) => {
            await grid.evaluate((g: any, top) => {
                ([...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any).scroller.scrollTop = top;
            }, top);
            await expect.poll(() => grid.evaluate((g: any) => g.verticalScrollOffset)).toBe(top);
        };

        await scrollTo(6000 * RH);
        await page.clock.runFor(19);
        await scrollTo(0);
        await page.clock.runFor(1000);
        await page.clock.resume();

        await settle(grid);
        await log.quiet(500);
        expect(log.of('ExecuteQuery')).toHaveLength(0);
        await expectRowsAtTheirIndex(grid, 'back at the top');
    });

    test('scrolling over loaded rows makes no requests', { annotation: [{ type: 'case', description: 'grid.vs-no-request-loaded-region' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        const log = requestLog(page);

        await scrollGrid(grid, { top: 5000 * RH });
        await settle(grid);
        await log.quiet();
        expect(log.of('ExecuteQuery').map(r => r.skip)).toEqual([5000]);
        log.clear();

        await scrollGrid(grid, { top: 0 });
        await settle(grid);
        await scrollGrid(grid, { top: 5000 * RH });
        await settle(grid);
        await log.quiet();

        expect(log.of('ExecuteQuery')).toHaveLength(0);
        await expectRowsAtTheirIndex(grid, 'back at row 5000');
    });

    test('a completed page load does not move the scroll position', { annotation: [{ type: 'case', description: 'grid.vs-scrolltop-stable-after-load' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        const log = requestLog(page);

        await scrollGrid(grid, { top: 5000 * RH });
        await settle(grid);
        await log.quiet();
        expect(log.of('ExecuteQuery')).toHaveLength(1);

        expect((await getScrollOffset(grid)).top).toBe(5000 * RH);
        await expectRowsAtTheirIndex(grid, 'after the page arrived');
        expect((await rows(grid))[0].index).toBe(5000);
    });

    test('jumps down and back up cover the viewport with rows at their index', { annotation: [{ type: 'case', description: 'grid.vs-window-jump-down' }] }, async ({ page }) => {
        // Where the row window starts is an implementation detail; coverage and position are the contract
        await gridPage(page, { height: HEIGHT_640 });
        const grid = await mountGrid(page);

        for (const row of [3001, 2996]) {
            await scrollGrid(grid, { top: row * RH });
            await expectCoverage(grid, `row ${row}`);
            await settle(grid);
            await expectRowsAtTheirIndex(grid, `row ${row}`);
            expect((await rows(grid))[0].index, `row ${row}`).toBe(row);
        }
    });

    test('growing the host fills the new area with rows', { annotation: [{ type: 'case', description: 'grid.vs-resize-taller-coverage' }] }, async ({ page }) => {
        await gridPage(page, { height: 400 });
        const grid = await mountGrid(page);

        await page.setViewportSize({ width: 1280, height: 900 });
        await expect.poll(async () => (await getScrollOffset(grid)).height).toBeGreaterThan(800);
        await settle(grid);

        const { height } = await getScrollOffset(grid);
        const visibleRows = Math.ceil(height / RH);
        await expectCoverage(grid, 'after growing');
        expect((await rows(grid)).map(r => r.position)).toEqual(Array.from({ length: visibleRows }, (_, i) => i));
        await expectRowsAtTheirIndex(grid, 'after growing');

        const count = await grid.evaluate((g: any) => g.shadowRoot.querySelectorAll('vi-query-grid-row').length);
        expect(count).toBeGreaterThanOrEqual(visibleRows + 1);
        expect(count).toBeLessThanOrEqual(Math.ceil(visibleRows * 1.5) + 1);
    });

    test('a total height beyond the browser limit still reaches the last row', { annotation: [{ type: 'case', description: 'grid.vs-correction-huge-rowheight' }] }, async ({ page }) => {
        // 10,000 rows of 4000px is 40,000,000px, more than Chrome lets an element be. The header has two rows of
        // that height too, so the page is tall enough to leave the body a viewport of about 1100px.
        await gridPage(page, { height: 9100, styles: 'vi-query-grid { --vi-query-grid-row-height: 4000px; }' });
        const { grid } = await attachGrid(page);
        await waitForGridReady(grid);

        const { scrollHeight, height } = await getScrollOffset(grid);
        expect(scrollHeight).toBeLessThan(40_000_000);

        await scrollGrid(grid, { top: scrollHeight - height });
        await settle(grid);

        const visible = await rows(grid);
        expect(visible.length).toBeGreaterThan(0);
        expect(visible.at(-1)!.index).toBe(9999);
        const view = await scrollerBox(grid);
        expect(Math.abs(visible.at(-1)!.bottom - view.bottom)).toBeLessThanOrEqual(1);
    });

    test('more than 100,000 rows shows the ellipsis marker', { annotation: [{ type: 'case', description: 'grid.vs-upper-limit-ellipsis' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'PeopleBig' });
        expect(await grid.evaluate((g: any) => g.query.totalItems)).toBe(150000);

        await scrollGrid(grid, { top: (await getScrollOffset(grid)).scrollHeight });
        await settle(grid);

        const marker = grid.locator('.physical-upper-limit-exceeded');
        await expect(marker).toBeVisible();
        await expect(marker.locator('vi-icon[source="Ellipsis"]')).toBeVisible();

        const last = (await rows(grid)).filter(r => r.index >= 0).at(-1)!;
        expect(last.index).toBe(99999);

        const markerBox = await marker.evaluate((m: HTMLElement) => {
            const b = m.getBoundingClientRect();
            return { top: b.top, paddingLeft: getComputedStyle(m).paddingLeft };
        });
        expect(Math.abs(markerBox.top - last.bottom)).toBeLessThanOrEqual(1);
        const controls = parseFloat(await grid.evaluate((g: any) => getComputedStyle(g).getPropertyValue('--vi-query-grid-controls-width')));
        expect(markerBox.paddingLeft).toBe(`${controls + 6}px`);
    });

    test('scroll height caps at 100,000 rows', { annotation: [{ type: 'case', description: 'grid.vs-upper-limit-spacer-cap' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'PeopleBig' });

        const { scrollHeight } = await getScrollOffset(grid);
        expect(scrollHeight).toBe(100000 * RH);

        await scrollGrid(grid, { top: scrollHeight });
        await settle(grid);
        const visible = await rows(grid);
        expect(visible.length).toBeGreaterThan(0);
        visible.forEach(r => expect(r.index).toBeLessThan(100000));
        expect(visible.at(-1)!.index).toBe(99999);
    });

    test('no ellipsis marker for normal queries', { annotation: [{ type: 'case', description: 'grid.vs-upper-limit-absent' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        const marker = grid.locator('.physical-upper-limit-exceeded');
        await expect(marker).toBeHidden();

        await scrollGrid(grid, { top: (await getScrollOffset(grid)).scrollHeight });
        await settle(grid);
        await expect(marker).toBeHidden();
    });

    test('continuation results keep placeholders and load more at the end', { annotation: [{ type: 'case', description: 'grid.vs-hasmore-placeholders' }] }, async ({ page }) => {
        await gridPage(page, { height: HEIGHT_640 });
        const grid = await mountGrid(page, { query: 'QueryGrid_Continuation' });
        const state = () => grid.evaluate((g: any) => ({ hasMore: g.query.hasMore, totalItems: g.query.totalItems }));
        expect(await state()).toEqual({ hasMore: true, totalItems: 100 });
        const before = (await getScrollOffset(grid)).scrollHeight;

        const tokens: (string | null)[] = [];
        page.on('request', request => {
            if (request.url().endsWith('/ExecuteQuery') && request.method() === 'POST')
                tokens.push(request.postDataJSON()?.query?.continuation ?? null);
        });

        const release = await holdExecuteQuery(page);
        await scrollGrid(grid, { top: before });
        await nextFrames(page, 2);

        // The row window past the loaded rows (below the viewport, the scroll range ends near row 100) holds
        // loading placeholders, not hidden rows
        await expect.poll(async () => (await rows(grid, { all: true })).filter(r => r.position >= 100 && r.height > 0).length).toBeGreaterThan(0);
        const past = (await rows(grid, { all: true })).filter(r => r.position >= 100 && r.height > 0);
        past.forEach(r => {
            expect(r.loading, `position ${r.position}`).toBe(true);
            r.cells.forEach(c => expect(c.text, `position ${r.position}: no stale text`).toBe(''));
        });
        await expect.poll(() => tokens).toEqual(['offset:100']);

        await release();
        await expect.poll(state).toEqual({ hasMore: true, totalItems: 200 });
        await settle(grid);
        expect((await getScrollOffset(grid)).scrollHeight).toBeGreaterThan(before);

        // The new rows render at their index
        await scrollGrid(grid, { top: 95 * RH });
        await settle(grid);
        const loaded = (await rows(grid)).filter(r => r.position >= 100);
        expect(loaded.length).toBeGreaterThan(0);
        loaded.forEach(r => {
            expect(r.loading).toBe(false);
            expect(r.index).toBe(r.position);
        });
        expect(tokens).toEqual(['offset:100']);
    });

    test('PageDown scrolls the focused scroller', { annotation: [{ type: 'case', description: 'grid.kb-pagedown' }] }, async ({ page }) => {
        await gridPage(page, { height: HEIGHT_640 });
        const grid = await mountGrid(page);

        await grid.evaluate((g: any) => ([...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any).scroller.focus());
        for (let i = 0; i < 3; i++)
            await page.keyboard.press('PageDown');

        await expect.poll(async () => (await getScrollOffset(grid)).top).toBeGreaterThan(640);
        let last = -1;
        await expect.poll(async () => {
            const { top } = await getScrollOffset(grid);
            const stable = top === last;
            last = top;
            return stable;
        }, { intervals: [100, 100, 150, 200] }).toBe(true);
        await expectCoverage(grid, 'after PageDown');
        await settle(grid);
        await expectRowsAtTheirIndex(grid, 'after PageDown');
    });
});
