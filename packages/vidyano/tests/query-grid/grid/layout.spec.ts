import { expect, Locator } from '@playwright/test';
import { getScrollOffset, gridPage, mountGrid, scrollGrid, test, waitForGridReady } from '../_helpers/query-grid';
import { attachGrid, controlsBox, headerBoxes, hostVar, rows, scrollerBox, settle } from '../_helpers/grid';

async function spinnerVisible(grid: Locator) {
    return grid.evaluate((g: any) => {
        const spinner = [...g.shadowRoot.querySelectorAll('vi-spinner')].find((s: Element) => !s.closest('vi-popup, vi-query-grid-row, header')) as HTMLElement;
        return !!spinner && spinner.checkVisibility();
    });
}

test.describe('Layout, row height, controls width and spinner', () => {
    test('row height comes from --vi-query-grid-row-height', { annotation: [{ type: 'case', description: 'grid.rh-custom-css' }] }, async ({ page }) => {
        await gridPage(page);

        await test.step('default 32px', async () => {
            const grid = await mountGrid(page);
            await expect.poll(() => hostVar(grid, '--vi-query-grid-row-height')).toBe('32px');

            const visible = await rows(grid);
            visible.forEach(r => {
                expect(r.height).toBe(32);
                r.cells.forEach(c => expect(c.height).toBe(32));
            });
            expect((await getScrollOffset(grid)).scrollHeight).toBe(10000 * 32);
            await grid.evaluate((g: any) => g.remove());
        });

        await test.step('outer CSS 40px', async () => {
            await page.addStyleTag({ content: 'vi-query-grid { --vi-query-grid-row-height: 40px; }' });
            const { grid } = await attachGrid(page);
            await waitForGridReady(grid);
            await expect.poll(() => hostVar(grid, '--vi-query-grid-row-height')).toBe('40px');

            const visible = await rows(grid);
            visible.forEach(r => {
                expect(r.height).toBe(40);
                r.cells.forEach(c => expect(c.height).toBe(40));
            });
            const lineHeights = await grid.evaluate((g: any) => [...g.shadowRoot.querySelectorAll('vi-query-grid-row:not(.hidden)')].flatMap((r: any) => [...r.querySelectorAll('.column'), ...(r.shadowRoot?.querySelectorAll('.column') ?? [])]).slice(0, 20).map((c: any) => getComputedStyle(c).lineHeight));
            lineHeights.forEach(l => expect(l).toBe('40px'));
            expect((await getScrollOffset(grid)).scrollHeight).toBe(10000 * 40);

            await scrollGrid(grid, { top: 4000 });
            await settle(grid);
            const top = (await rows(grid))[0];
            expect(top.index).toBe(100);
            expect(top.offset).toBeCloseTo(4000, 0);
        });
    });

    test('--vi-query-grid-controls-width mirrors the controls box', { annotation: [{ type: 'case', description: 'grid.cv-controls-width-var' }] }, async ({ page }) => {
        await gridPage(page);

        const expected: [string, number][] = [
            ['QueryGrid_Select', 32],
            ['QueryGrid_Filter', 32],
            ['QueryGrid_SelectAndFilter', 64],
            ['QueryGrid_SelectAndInlineActions', 64],
            ['People', 64]
        ];

        for (const [query, width] of expected) {
            const grid = await mountGrid(page, { query });
            await expect.poll(() => hostVar(grid, '--vi-query-grid-controls-width'), query).toBe(`${width}px`);
            const box = await controlsBox(grid);
            expect(Math.abs(box.width - width), query).toBeLessThanOrEqual(1);
            await grid.evaluate((g: any) => g.remove());
        }
    });

    test('spinner follows query.isBusy on every search', { annotation: [{ type: 'case', description: 'grid.sp-visible-busy' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        expect(await spinnerVisible(grid)).toBe(false);

        const held: (() => void)[] = [];
        let holding = false;
        await page.route('**/ExecuteQuery', async route => {
            if (holding)
                await new Promise<void>(resolve => held.push(resolve));
            await route.continue();
        });

        for (let i = 0; i < 3; i++) {
            holding = true;
            await page.evaluate(() => {
                (window as any).__search = (window as any).q.search();
            });
            await expect.poll(() => spinnerVisible(grid), `search ${i + 1} pending`).toBe(true);
            expect(await grid.evaluate((g: any) => g.query.isBusy)).toBe(true);

            await expect.poll(() => held.length).toBeGreaterThan(0);
            holding = false;
            held.splice(0).forEach(release => release());

            // Discard the result: returning it would serialize the lazy items proxy and load every row
            await page.evaluate(async () => { await (window as any).__search; });
            await expect.poll(() => spinnerVisible(grid), `search ${i + 1} done`).toBe(false);
            expect(await grid.evaluate((g: any) => g.query.isBusy)).toBe(false);
        }
    });

    test('a non-px row height resolves to its pixel size', { annotation: [{ type: 'case', description: 'grid.rh-non-px' }] }, async ({ page }) => {
        // 2.5em at the page's 14px font size is 35px
        await gridPage(page, { styles: 'vi-query-grid { --vi-query-grid-row-height: 2.5em; }' });
        const { grid } = await attachGrid(page);
        await waitForGridReady(grid);

        await expect.poll(async () => (await getScrollOffset(grid)).scrollHeight).toBe(10000 * 35);
        const visible = await rows(grid);
        expect(visible.length).toBeGreaterThan(0);
        visible.forEach(r => expect(r.height, `row ${r.index}`).toBe(35));
    });

    test('scroller fills the host below the header', { annotation: [{ type: 'case', description: 'grid.ly-scroller-fills' }] }, async ({ page }) => {
        await gridPage(page, { width: 1000, height: 600 });
        const grid = await mountGrid(page);

        const layout = await grid.evaluate((g: any) => {
            const host = g.getBoundingClientRect();
            const header = g.shadowRoot.querySelector('header').getBoundingClientRect();
            const scroller = ([...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as HTMLElement).getBoundingClientRect();
            const style = getComputedStyle(g);
            return { hostBottom: host.bottom, headerBottom: header.bottom, scrollerTop: scroller.top, scrollerBottom: scroller.bottom, display: style.display, flexDirection: style.flexDirection, overflow: style.overflow };
        });

        expect(Math.abs(layout.scrollerTop - layout.headerBottom)).toBeLessThanOrEqual(1);
        expect(Math.abs(layout.scrollerBottom - layout.hostBottom)).toBeLessThanOrEqual(1);
        expect(layout.hostBottom).toBe(600);
        expect({ display: layout.display, flexDirection: layout.flexDirection, overflow: layout.overflow }).toEqual({ display: 'flex', flexDirection: 'column', overflow: 'hidden' });
    });

    test('grid text is not selectable', { annotation: [{ type: 'case', description: 'grid.ly-user-select-none' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        expect(await grid.evaluate((g: any) => getComputedStyle(g).userSelect)).toBe('none');
    });

    test('controls width for the None view is zero', { annotation: [{ type: 'case', description: 'grid.cv-controls-width-none' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page, { query: 'QueryGrid_None' });

        expect((await controlsBox(grid)).width).toBe(0);
        // Unset or 0px: either way everything that is offset by the controls width starts at 0
        expect(['', '0px']).toContain(await hostVar(grid, '--vi-query-grid-controls-width'));

        const row = (await rows(grid))[0];
        const scroller = await scrollerBox(grid);
        expect(Math.abs(row.cells[0].x - scroller.x)).toBeLessThanOrEqual(1);
        expect(Math.abs((await headerBoxes(grid))[0].x - scroller.x)).toBeLessThanOrEqual(1);
    });

    test('controls width grows with the grouping control', { annotation: [{ type: 'case', description: 'grid.cv-controls-width-grouping' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await expect.poll(() => hostVar(grid, '--vi-query-grid-controls-width')).toBe('64px');

        await grid.evaluate(async (g: any) => { await g.query.group('Gender'); });
        await expect(grid).toHaveAttribute('has-grouping');
        await expect.poll(() => hostVar(grid, '--vi-query-grid-controls-width')).toBe('96px');
        expect((await controlsBox(grid)).width).toBe(96);

        await grid.evaluate(async (g: any) => { await g.query.group(''); });
        await expect(grid).not.toHaveAttribute('has-grouping');
        await expect.poll(() => hostVar(grid, '--vi-query-grid-controls-width')).toBe('64px');
        expect((await controlsBox(grid)).width).toBe(64);
    });

    test('spinner shows during a lazy page load', { annotation: [{ type: 'case', description: 'grid.sp-visible-lazy-load' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        expect(await spinnerVisible(grid)).toBe(false);

        let responded = false;
        await page.route('**/ExecuteQuery', async route => {
            await new Promise(resolve => setTimeout(resolve, 800));
            await route.continue();
            responded = true;
        });

        await scrollGrid(grid, { top: 5000 * 32 });
        await expect.poll(() => spinnerVisible(grid), 'page pending').toBe(true);
        expect(responded).toBe(false);

        await settle(grid);
        await expect.poll(() => spinnerVisible(grid), 'page arrived').toBe(false);
        expect(responded).toBe(true);
        expect((await rows(grid))[0].index).toBe(5000);
    });
});
