import { test, expect } from '@playwright/test';
import { gridPage, mountGrid, getScrollOffset, requestLog } from '../_helpers/query-grid';
import { rows, scrollerBox, settle } from '../_helpers/grid';

/** Page height that gives the People grid body a viewport of exactly 640px (the header is 66px) */
const HEIGHT_640 = 706;

// Chrome animates keyboard scrolling; when a frame of that animation takes longer than the grid's page load debounce,
// the grid loads the page for that point of the scroll, which makes the requested pages depend on the machine's load
test.use({ launchOptions: { args: ['--disable-smooth-scrolling'] } });

test('End and Home jump to the last and first rows', { annotation: [{ type: 'case', description: 'gap.grid-kb-end-home' }] }, async ({ page }) => {
    await gridPage(page, { height: HEIGHT_640 });
    const grid = await mountGrid(page);
    const log = requestLog(page);

    const stableTop = async () => {
        let last = -1;
        await expect.poll(async () => {
            const { top } = await getScrollOffset(grid);
            const stable = top === last;
            last = top;
            return stable;
        }, { intervals: [100, 100, 150, 200] }).toBe(true);
    };

    await grid.evaluate((g: any) => ([...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as any).scroller.focus());
    await page.keyboard.press('End');
    await expect.poll(async () => {
        const o = await getScrollOffset(grid);
        return o.top === o.scrollHeight - o.height;
    }).toBe(true);
    await stableTop();
    await settle(grid);
    await log.quiet();

    expect(log.of('ExecuteQuery').map(r => r.skip)).toEqual([9900]);
    const visible = await rows(grid);
    expect(visible.at(-1)!.index).toBe(9999);
    expect(Math.abs(visible.at(-1)!.bottom - (await scrollerBox(grid)).bottom)).toBeLessThanOrEqual(1);

    log.clear();
    await page.keyboard.press('Home');
    await expect.poll(async () => (await getScrollOffset(grid)).top).toBe(0);
    await stableTop();
    await settle(grid);
    await log.quiet();

    expect(log.of('ExecuteQuery')).toHaveLength(0);
    expect((await rows(grid))[0].index).toBe(0);
});
