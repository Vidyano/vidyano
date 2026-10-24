import { test, expect, Locator, Page } from '@playwright/test';
import { gridPage, mountGrid, getScrollOffset, scrollGrid, nextFrames, requestLog, waitForGridReady } from '../_helpers/query-grid';
import { attachGrid, clickGroupingMenuItem, rows, settle, valuesOf } from '../_helpers/grid';

const RH = 32;

async function scrolledTo(grid: Locator, top: number) {
    await scrollGrid(grid, { top });
    await expect.poll(async () => (await getScrollOffset(grid)).top).toBe(top);
    await settle(grid);
}

test.describe('Scroll to top and offset restore', () => {
    test('new search results scroll back to the top', { annotation: [{ type: 'case', description: 'grid.stt-search' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await scrolledTo(grid, 5000);

        await grid.evaluate(async (g: any) => {
            g.query.textSearch = 'an';
            await g.query.search();
        });
        await expect.poll(async () => (await getScrollOffset(grid)).top).toBe(0);
        await settle(grid);

        const first = (await rows(grid))[0];
        expect(first.index).toBe(0);
        expect(first.cells[0].text).toBe((await valuesOf(grid, [0], 'FirstName'))[0]);
    });

    test('sorting scrolls back to the top', { annotation: [{ type: 'case', description: 'grid.stt-sort' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await scrolledTo(grid, 5000);

        await grid.locator('vi-query-grid-column-header[name="LastName"] .label').click();
        await expect.poll(() => grid.evaluate((g: any) => !g.query.isBusy && g.query.sortOptions[0]?.name === 'LastName')).toBe(true);
        await expect.poll(async () => (await getScrollOffset(grid)).top).toBe(0);
    });

    test('scroll-to-top works repeatedly', { annotation: [{ type: 'case', description: 'grid.scroll-repeated-programmatic-top' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        const triggers: [string, () => Promise<void>, 'item' | 'group'][] = [
            ['same-text search', () => grid.evaluate(async (g: any) => { await g.query.search(); }), 'item'],
            ['group by Gender', () => grid.evaluate(async (g: any) => { await g.query.group('Gender'); }), 'group'],
            ['Collapse all', () => clickGroupingMenuItem(grid, 'QueryGrid_Group_Collapse'), 'group']
        ];

        for (const [name, trigger, first] of triggers) {
            await scrolledTo(grid, 4000);
            await trigger();
            await expect.poll(async () => (await getScrollOffset(grid)).top, { message: name, timeout: 2000 }).toBe(0);
            await settle(grid);

            const top = (await rows(grid))[0];
            if (first === 'item')
                expect(top.index, name).toBe(0);
            else {
                const firstGroup = await grid.evaluate((g: any) => g.query.groupingInfo.groups[0].name);
                expect(top.isGroup, name).toBe(true);
                expect(top.groupLabel!.startsWith(`${firstGroup} (`), name).toBe(true);
            }
        }
    });

    test('offsets saved on route deactivate restore on the next grid', { annotation: [{ type: 'case', description: 'grid.rs-restore' }] }, async ({ page }) => {
        await gridPage(page, { width: 600, height: 600, styles: '.wrapper { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; } .wrapper > vi-query-grid { flex: 1 1 auto; min-height: 0; }' });
        await page.evaluate(() => {
            for (const id of ['w1', 'w2']) {
                const wrapper = document.createElement('div');
                wrapper.id = id;
                wrapper.className = 'wrapper';
                document.getElementById('test-container')!.appendChild(wrapper);
            }
            document.getElementById('w2')!.style.display = 'none';
        });

        const { grid: grid1 } = await attachGrid(page, { container: '#w1' });
        await waitForGridReady(grid1);
        await scrollGrid(grid1, { top: 4000, left: 150 });
        await expect.poll(() => getScrollOffset(grid1)).toMatchObject({ top: 4000, left: 150 });
        await settle(grid1);

        await page.evaluate(() => {
            const w = window as any;
            const w1 = document.getElementById('w1')!;
            w.Vidyano.ServiceBus.send(w1, 'app-route:deactivate', { route: w1, cancel: false });
            w.grid.remove();
            w1.style.display = 'none';
            document.getElementById('w2')!.style.display = 'flex';
        });

        const { grid: grid2 } = await attachGrid(page, { container: '#w2', reuseQuery: true });
        await expect(grid2).not.toHaveAttribute('initializing');
        await nextFrames(page, 1);
        await expect.poll(() => getScrollOffset(grid2)).toMatchObject({ top: 4000, left: 150 });
        await settle(grid2);

        const visible = await rows(grid2);
        // At scrollLeft 150 FirstName is behind the pinned controls (its cell may be deferred), LastName is in view
        const names = await valuesOf(grid2, visible.map(r => r.index), 'LastName');
        visible.forEach((r, i) => {
            expect(Math.abs(r.offset - r.index * RH), `row ${r.index}`).toBeLessThanOrEqual(1);
            expect(r.cells.find(c => c.name === 'LastName')!.text).toBe(names[i]);
        });
        expect(visible[0].index).toBe(Math.floor(4000 / RH));
    });

    test('a grid connected inside the last deactivated route keeps the saved offsets', { annotation: [{ type: 'case', description: 'grid.rs-receive-last-keeps-offsets' }] }, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', e => errors.push(e.message));

        await gridPage(page, { width: 600, height: 600, styles: '.wrapper { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; } .wrapper > vi-query-grid { flex: 1 1 auto; min-height: 0; }' });
        await page.evaluate(() => {
            const wrapper = document.createElement('div');
            wrapper.id = 'w1';
            wrapper.className = 'wrapper';
            document.getElementById('test-container')!.appendChild(wrapper);
        });

        const { grid: grid1 } = await attachGrid(page, { container: '#w1' });
        await waitForGridReady(grid1);
        await scrollGrid(grid1, { top: 4000, left: 150 });
        await expect.poll(() => getScrollOffset(grid1)).toMatchObject({ top: 4000, left: 150 });
        await settle(grid1);

        // The next grid connects inside the same route (as with the shared :programUnitName/query.:id route), so the
        // ServiceBus hands it the last app-route:deactivate message on subscribe
        await page.evaluate(() => {
            const w = window as any;
            const w1 = document.getElementById('w1')!;
            w.Vidyano.ServiceBus.send(w1, 'app-route:deactivate', { route: w1, cancel: false });
            w.grid.remove();
        });

        const { grid: grid2 } = await attachGrid(page, { container: '#w1', reuseQuery: true });
        await expect(grid2).not.toHaveAttribute('initializing');
        await expect.poll(() => getScrollOffset(grid2)).toMatchObject({ top: 4000, left: 150 });
        await settle(grid2);
        expect((await rows(grid2))[0].index).toBe(Math.floor(4000 / RH));
        expect(errors).toEqual([]);
    });

    test('a route deactivate while the grid has no query raises no error', { annotation: [{ type: 'case', description: 'grid.rs-no-query-deactivate' }] }, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', e => errors.push(e.message));

        await gridPage(page);
        await page.evaluate(async () => {
            const w = window as any;
            const w1 = document.createElement('div');
            w1.id = 'w1';
            document.getElementById('test-container')!.appendChild(w1);

            w.grid = document.createElement('vi-query-grid');
            w1.appendChild(w.grid);
            await new Promise(resolve => requestAnimationFrame(resolve));

            w.Vidyano.ServiceBus.send(w1, 'app-route:deactivate', { route: w1, cancel: false });
        });
        await nextFrames(page, 2);

        await expect(page.locator('#w1 vi-query-grid')).toHaveAttribute('initializing');
        expect(errors).toEqual([]);
    });

    test('search keeps the horizontal offset', { annotation: [{ type: 'case', description: 'grid.stt-horizontal-kept' }] }, async ({ page }) => {
        await gridPage(page, { width: 600, height: 600 });
        const grid = await mountGrid(page);

        await scrollGrid(grid, { top: 3000, left: 200 });
        await expect.poll(() => getScrollOffset(grid)).toMatchObject({ top: 3000, left: 200 });
        await settle(grid);

        await grid.evaluate(async (g: any) => {
            g.query.textSearch = 'an';
            await g.query.search();
        });
        await expect.poll(async () => (await getScrollOffset(grid)).top).toBe(0);
        await settle(grid);
        expect((await getScrollOffset(grid)).left).toBe(200);
    });

    test('searching while deep fetches no pages at the old offset', { annotation: [{ type: 'case', description: 'grid.stt-search-from-deep-no-stale-page' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);
        await scrolledTo(grid, 6000 * RH);

        const log = requestLog(page);
        await grid.evaluate(async (g: any) => {
            g.query.textSearch = 'Aaron';
            await g.query.search();
        });
        await log.quiet();

        expect(log.of('ExecuteQuery').filter(r => (r.skip ?? 0) >= 1000)).toEqual([]);
        expect((await getScrollOffset(grid)).top).toBe(0);
        await settle(grid);

        const first = (await rows(grid))[0];
        expect(first.index).toBe(0);
        expect(first.cells.find(c => c.name === 'Email')!.text).toBe((await valuesOf(grid, [0], 'Email'))[0]);
    });

    test('a saved offset restores only once', { annotation: [{ type: 'case', description: 'grid.rs-consumed-once' }] }, async ({ page }) => {
        await routePage(page, ['w1', 'w2', 'w3']);
        await scrolledGridIn(page, 'w1');
        await deactivate(page, 'w1');
        await show(page, 'w2');

        const { grid: grid2 } = await attachGrid(page, { container: '#w2', reuseQuery: true });
        await waitForGridReady(grid2);
        await expect.poll(() => getScrollOffset(grid2)).toMatchObject({ top: 4000, left: 150 });

        await page.evaluate(() => (window as any).grid.remove());
        await show(page, 'w3');
        const { grid: grid3 } = await attachGrid(page, { container: '#w3', reuseQuery: true });
        await waitForGridReady(grid3);
        await nextFrames(page, 2);
        expect(await getScrollOffset(grid3)).toMatchObject({ top: 0, left: 0 });
    });

    test('deactivate of an unrelated route is ignored', { annotation: [{ type: 'case', description: 'grid.rs-non-ancestor-sender' }] }, async ({ page }) => {
        await routePage(page, ['w1', 'w2']);
        await scrolledGridIn(page, 'w1');

        // The sender does not contain the grid
        await deactivate(page, 'w2');
        await show(page, 'w2');

        const { grid: grid2 } = await attachGrid(page, { container: '#w2', reuseQuery: true });
        await waitForGridReady(grid2);
        await nextFrames(page, 2);
        expect(await getScrollOffset(grid2)).toMatchObject({ top: 0, left: 0 });
    });

    test('offsets are keyed by Query instance', { annotation: [{ type: 'case', description: 'grid.rs-other-query-instance' }] }, async ({ page }) => {
        await routePage(page, ['w1', 'w2']);
        await scrolledGridIn(page, 'w1');
        await deactivate(page, 'w1');
        await show(page, 'w2');

        const { grid: grid2 } = await attachGrid(page, { container: '#w2' });
        await waitForGridReady(grid2);
        await nextFrames(page, 2);
        expect(await getScrollOffset(grid2)).toMatchObject({ top: 0, left: 0 });
    });
});

const WRAPPER_STYLES = '.wrapper { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; } .wrapper > vi-query-grid { flex: 1 1 auto; min-height: 0; }';

/** Opens the bare page with route wrappers; only the first one is shown. */
async function routePage(page: Page, ids: string[]) {
    await gridPage(page, { width: 600, height: 600, styles: WRAPPER_STYLES });
    await page.evaluate(ids => {
        ids.forEach((id, i) => {
            const wrapper = document.createElement('div');
            wrapper.id = id;
            wrapper.className = 'wrapper';
            wrapper.style.display = i === 0 ? 'flex' : 'none';
            document.getElementById('test-container')!.appendChild(wrapper);
        });
    }, ids);
}

/** Mounts a People grid in a wrapper and scrolls it to (4000, 150). */
async function scrolledGridIn(page: Page, id: string) {
    const { grid } = await attachGrid(page, { container: `#${id}` });
    await waitForGridReady(grid);
    await scrollGrid(grid, { top: 4000, left: 150 });
    await expect.poll(() => getScrollOffset(grid)).toMatchObject({ top: 4000, left: 150 });
    await settle(grid);

    return grid;
}

/** Sends app-route:deactivate from a wrapper, then removes the current grid. */
async function deactivate(page: Page, senderId: string) {
    await page.evaluate(senderId => {
        const w = window as any;
        const sender = document.getElementById(senderId)!;
        w.Vidyano.ServiceBus.send(sender, 'app-route:deactivate', { route: sender, cancel: false });
        w.grid.remove();
    }, senderId);
}

/** Shows one wrapper and hides the others. */
async function show(page: Page, id: string) {
    await page.evaluate(id => document.querySelectorAll<HTMLElement>('.wrapper').forEach(w => w.style.display = w.id === id ? 'flex' : 'none'), id);
}
