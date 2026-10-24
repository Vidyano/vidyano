import { test, expect, Locator } from '@playwright/test';
import { gridPage, mountGrid, getScrollOffset, scrollGrid, headerNames, nextFrames, savedSettings, waitForGridReady } from '../_helpers/query-grid';
import { clickHeaderMenuItem, controlsBox, header, headerBoxes, hostVar, initializingAdds, openHeaderMenu, openPopupCount, rowAt, rows, scrollerBox, settle, watchInitializing, wheelGrid } from '../_helpers/grid';

const PINNED_ORDER = ['Email', 'FirstName', 'LastName', 'BirthDate', 'Gender', 'ContactPreference', 'PhoneNumber', 'EmergencyContact', 'IsActive'];
const DEFAULT_ORDER = ['FirstName', 'LastName', 'BirthDate', 'Gender', 'ContactPreference', 'Email', 'PhoneNumber', 'EmergencyContact', 'IsActive'];

async function scrollLeftTo(grid: Locator, left: number) {
    await scrollGrid(grid, { left });
    await expect.poll(() => hostVar(grid, '--vi-query-grid-horizontal')).toBe(`${left}px`);
    await nextFrames(grid.page(), 2);
}

async function pinEmail(grid: Locator) {
    await clickHeaderMenuItem(grid, 'Email', 'Pin');
    await expect.poll(() => headerNames(grid)).toEqual(PINNED_ORDER);
    await scrollLeftTo(grid, 0);
    await settle(grid);
    expect(await grid.evaluate((g: HTMLElement) => g.scrollLeft)).toBe(0);
}

async function moreItems(grid: Locator, side: 'left' | 'right') {
    await expect(grid.locator(`vi-popup.more.${side} vi-popup-menu-item`).first()).toBeVisible();
    return grid.evaluate((g: any, side) => [...g.shadowRoot.querySelectorAll(`vi-popup.more.${side} vi-popup-menu-item`)].map((i: any) => i.label), side);
}

async function openRowActions(grid: Locator) {
    await rowAt(grid, 1).locator('[part~="actions"]').click();
    await expect(rowAt(grid, 1)).toHaveAttribute('actions-open');
}

async function openColumnFilter(grid: Locator) {
    await header(grid, 'FirstName').locator('vi-query-grid-column-filter vi-button').first().click();
    await expect.poll(() => openPopupCount(grid.page())).toBeGreaterThan(0);
}

async function expectPopupsClosed(grid: Locator, step: string) {
    await expect.poll(() => openPopupCount(grid.page()), step).toBe(0);
    expect((await rows(grid)).some(r => r.actionsOpen), `${step}: actions-open`).toBe(false);
}

test.describe('Horizontal scroll, pinning and more columns', () => {
    test('horizontal offset is published as --vi-query-grid-horizontal', { annotation: [{ type: 'case', description: 'grid.hs-var' }] }, async ({ page }) => {
        await gridPage(page, { width: 600, height: 600 });
        const grid = await mountGrid(page);

        expect(['', '0px']).toContain(await hostVar(grid, '--vi-query-grid-horizontal'));

        await page.keyboard.down('Shift');
        await wheelGrid(grid, 0, 100);
        await page.keyboard.up('Shift');

        await expect.poll(async () => (await getScrollOffset(grid)).left).toBeGreaterThan(0);
        await expect.poll(async () => `${(await getScrollOffset(grid)).left}px` === await hostVar(grid, '--vi-query-grid-horizontal')).toBe(true);
    });

    test('headers follow horizontal scroll and stay aligned with cells', { annotation: [{ type: 'case', description: 'grid.hs-header-row-aligned' }] }, async ({ page }) => {
        await gridPage(page, { width: 600, height: 600 });
        const grid = await mountGrid(page);

        const before = await headerBoxes(grid);
        const controls = await controlsBox(grid);
        await scrollLeftTo(grid, 250);

        const after = await headerBoxes(grid);
        const firstRow = (await rows(grid))[0];
        after.forEach((h, i) => {
            expect(Math.abs(h.x - (before[i].x - 250)), `${h.name} moved`).toBeLessThanOrEqual(1);
            expect(Math.abs(h.x - firstRow.cells[i].x), `${h.name} aligned`).toBeLessThanOrEqual(1);
        });
        expect((await controlsBox(grid)).x).toBe(controls.x);
    });

    test('horizontal scrolling closes open popups', { annotation: [{ type: 'case', description: 'grid.hs-closes-popup' }] }, async ({ page }) => {
        await gridPage(page, { width: 600, height: 600 });
        const grid = await mountGrid(page);

        const variants: [string, () => Promise<void>][] = [
            ['header menu', () => openHeaderMenu(grid, 'FirstName')],
            ['row actions', () => openRowActions(grid)],
            ['column filter', () => openColumnFilter(grid)]
        ];

        for (const [name, open] of variants) {
            await scrollLeftTo(grid, 0);
            await open();
            expect(await openPopupCount(page), name).toBeGreaterThan(0);

            await wheelGrid(grid, 50, 0);
            await expectPopupsClosed(grid, name);
        }
    });

    test('vertical scrolling closes open popups', { annotation: [{ type: 'case', description: 'grid.vs-closes-popup' }] }, async ({ page }) => {
        await gridPage(page);
        const grid = await mountGrid(page);

        const variants: [string, () => Promise<void>][] = [
            ['row actions', () => openRowActions(grid)],
            ['header menu', () => openHeaderMenu(grid, 'LastName')]
        ];

        for (const [name, open] of variants) {
            await scrollGrid(grid, { top: 0 });
            await settle(grid);
            await open();
            expect(await openPopupCount(page), name).toBeGreaterThan(0);

            await wheelGrid(grid, 0, 32);
            await expect.poll(async () => (await getScrollOffset(grid)).top, name).toBeGreaterThan(0);
            await expectPopupsClosed(grid, name);
        }
    });

    test('pinning moves a column to the front', { annotation: [{ type: 'case', description: 'grid.pn-order' }] }, async ({ page }) => {
        await gridPage(page, { width: 800, height: 600 });
        const grid = await mountGrid(page);
        await watchInitializing(grid);

        await pinEmail(grid);
        const visible = await rows(grid);
        expect(visible.length).toBeGreaterThan(0);
        visible.forEach(r => {
            expect(r.cells[0].name).toBe('Email');
            expect(r.cells[0].text).toMatch(/@/);
        });
        expect(await initializingAdds(page)).toBe(0);
    });

    test('pinned header stays fixed and on top', { annotation: [{ type: 'case', description: 'grid.pn-sticky-header' }] }, async ({ page }) => {
        await gridPage(page, { width: 800, height: 600 });
        const grid = await mountGrid(page);
        await pinEmail(grid);

        const before = await headerBoxes(grid);
        await scrollLeftTo(grid, 300);
        const after = await headerBoxes(grid);

        expect(Math.abs(after[0].x - before[0].x)).toBeLessThanOrEqual(1);
        expect(Math.abs(after[1].x - (before[1].x - 300))).toBeLessThanOrEqual(1);

        // FirstName now slides under Email: the pinned header must be the one hit
        const x = Math.max(after[0].x, after[1].x) + 5;
        expect(x).toBeLessThan(Math.min(after[0].right, after[1].right));
        const hit = await grid.evaluate((g: any, { x, y }) => {
            let element: Element | null = g.shadowRoot.elementFromPoint(x, y);
            while (element) {
                if (element.tagName === 'VI-QUERY-GRID-COLUMN-HEADER')
                    return element.getAttribute('name');

                element = element.parentElement ?? ((element.getRootNode() as ShadowRoot).host ?? null);
                if (element === g)
                    return null;
            }

            return null;
        }, { x, y: after[0].top + after[0].height / 2 });
        expect(hit).toBe('Email');
    });

    test('pinned cells stay fixed with a separator', { annotation: [{ type: 'case', description: 'grid.pn-sticky-cells-border' }] }, async ({ page }) => {
        await gridPage(page, { width: 800, height: 600 });
        const grid = await mountGrid(page);
        await pinEmail(grid);

        const before = await rows(grid);
        await scrollLeftTo(grid, 300);
        const after = await rows(grid);

        expect(after.length).toBe(before.length);
        after.forEach((r, i) => {
            expect(Math.abs(r.cells[0].x - before[i].cells[0].x), `row ${r.index} Email`).toBeLessThanOrEqual(1);
            r.cells.slice(1).forEach((c, k) => expect(Math.abs(c.x - (before[i].cells[k + 1].x - 300)), `row ${r.index} ${c.name}`).toBeLessThanOrEqual(1));
        });

        const borders = await grid.evaluate((g: any) => [...g.shadowRoot.querySelectorAll('vi-query-grid-row:not(.hidden)')].map((r: any) => [...r.querySelectorAll('.column'), ...(r.shadowRoot?.querySelectorAll('.column') ?? [])].map((c: any) => {
            const own = parseFloat(getComputedStyle(c).borderRightWidth) || 0;
            const after = parseFloat(getComputedStyle(c, '::after').borderRightWidth) || 0;
            return Math.max(own, after);
        })));
        borders.forEach(row => {
            expect(row[0]).toBeGreaterThanOrEqual(1);
            row.slice(1).forEach(b => expect(b).toBe(0));
        });
    });

    test('unpinning restores order and scrolling', { annotation: [{ type: 'case', description: 'grid.pn-unpin' }] }, async ({ page }) => {
        await gridPage(page, { width: 800, height: 600 });
        const grid = await mountGrid(page);
        await pinEmail(grid);

        await clickHeaderMenuItem(grid, 'Email', 'Pin');
        await expect.poll(() => headerNames(grid)).toEqual(DEFAULT_ORDER);
        await settle(grid);

        const before = await headerBoxes(grid);
        await scrollLeftTo(grid, 300);
        const after = await headerBoxes(grid);
        after.forEach((h, i) => expect(Math.abs(h.x - (before[i].x - 300)), h.name).toBeLessThanOrEqual(1));

        (await rows(grid)).forEach(r => r.cells.forEach(c => expect(c.borderRight, `row ${r.index} ${c.name}`).toBe(0)));
    });

    test('more-columns buttons follow overflow', { annotation: [{ type: 'case', description: 'grid.mc-right-visible' }] }, async ({ page }) => {
        await gridPage(page, { width: 600, height: 600 });
        const grid = await mountGrid(page);

        await expect(grid.locator('vi-popup.more.right')).toBeVisible();
        await expect(grid.locator('vi-popup.more.left')).toBeHidden();

        await page.setViewportSize({ width: 2500, height: 600 });
        await expect(grid.locator('vi-popup.more.right')).toBeHidden();
        await expect(grid.locator('vi-popup.more.left')).toBeHidden();

        await page.setViewportSize({ width: 600, height: 600 });
        await expect(grid.locator('vi-popup.more.right')).toBeVisible();
    });

    test('right popup lists overflowed columns alphabetically', { annotation: [{ type: 'case', description: 'grid.mc-right-items-sorted' }] }, async ({ page }) => {
        await gridPage(page, { width: 600, height: 600 });
        const grid = await mountGrid(page);

        const headers = await headerBoxes(grid);
        const area = await grid.evaluate((g: any) => g.shadowRoot.querySelector('header [grid]').getBoundingClientRect().right);
        const expected = headers.filter(h => h.x + h.width / 2 > area).map(h => h.label).sort((a, b) => a.localeCompare(b));
        expect(expected.length).toBeGreaterThan(0);

        await grid.locator('vi-popup.more.right vi-button').click();
        expect(await moreItems(grid, 'right')).toEqual(expected);
    });

    test('picking a listed column scrolls it to the left edge', { annotation: [{ type: 'case', description: 'grid.mc-right-click-scrolls' }] }, async ({ page }) => {
        await gridPage(page, { width: 600, height: 600 });
        const grid = await mountGrid(page);

        const pickEmail = async () => {
            await grid.locator('vi-popup.more.right vi-button').click();
            const labels = await moreItems(grid, 'right');
            await grid.locator('vi-popup.more.right vi-popup-menu-item').nth(labels.indexOf('Email')).click();
        };

        const emailOffset = await header(grid, 'Email').evaluate((h: HTMLElement) => h.offsetLeft);
        await pickEmail();

        const { scrollWidth, width } = await getScrollOffset(grid);
        const expected = Math.min(emailOffset, scrollWidth - width);
        await expect.poll(async () => (await getScrollOffset(grid)).left).toBe(expected);
        await expect.poll(() => hostVar(grid, '--vi-query-grid-horizontal')).toBe(`${expected}px`);
        await expect.poll(() => openPopupCount(page)).toBe(0);

        if (expected === emailOffset) {
            const email = (await headerBoxes(grid)).find(h => h.name === 'Email')!;
            expect(Math.abs(email.x - (await controlsBox(grid)).right)).toBeLessThanOrEqual(1);
        }

        await wheelGrid(grid, -5000, 0);
        await expect.poll(async () => (await getScrollOffset(grid)).left).toBe(0);
        await expect.poll(() => hostVar(grid, '--vi-query-grid-horizontal')).toBe('0px');
        // The more-columns lists follow the scroll after a short debounce: open the menu once they are back at offset 0
        await expect(grid.locator('vi-popup.more.left')).toBeHidden();

        await pickEmail();
        await expect.poll(async () => (await getScrollOffset(grid)).left).toBe(expected);
    });

    test('left popup appears after scrolling right', { annotation: [{ type: 'case', description: 'grid.mc-left-after-scroll' }] }, async ({ page }) => {
        await gridPage(page, { width: 600, height: 600 });
        const grid = await mountGrid(page);

        const { scrollWidth, width } = await getScrollOffset(grid);
        await scrollLeftTo(grid, scrollWidth - width);

        await expect(grid.locator('vi-popup.more.left')).toBeVisible();
        await expect(grid.locator('vi-popup.more.right')).toBeHidden();

        const controls = await controlsBox(grid);
        const expected = (await headerBoxes(grid)).filter(h => h.x < controls.right - 1).map(h => h.label).sort((a, b) => a.localeCompare(b));
        expect(expected.length).toBeGreaterThan(0);

        await grid.locator('vi-popup.more.left vi-button').click();
        expect(await moreItems(grid, 'left')).toEqual(expected);
    });

    test('attaching a grid leaves unrelated popups open', { annotation: [{ type: 'case', description: 'grid.hs-attach-keeps-popups-open' }] }, async ({ page }) => {
        await gridPage(page);
        await page.evaluate(() => {
            const popup = document.createElement('vi-popup') as any;
            popup.id = 'standalone';
            popup.innerHTML = '<div slot="header" style="width: 40px; height: 20px">open</div><div style="width: 100px; height: 50px">content</div>';
            document.getElementById('test-container')!.appendChild(popup);
            popup.popup();
        });
        const popup = page.locator('#standalone');
        await expect(popup).toHaveAttribute('open');

        const grid = await mountGrid(page, { wait: false });
        await nextFrames(page, 2);
        await expect(popup).toHaveAttribute('open');

        await waitForGridReady(grid);
        await expect(popup).toHaveAttribute('open');
    });

    test('several pinned columns keep offset order and stay fixed', { annotation: [{ type: 'case', description: 'grid.pn-multiple' }] }, async ({ page }) => {
        await gridPage(page, { width: 800, height: 600 });
        const grid = await mountGrid(page);

        await pinEmail(grid);
        await clickHeaderMenuItem(grid, 'Gender', 'Pin');
        await expect.poll(() => headerNames(grid)).toEqual(['Gender', 'Email', 'FirstName', 'LastName', 'BirthDate', 'ContactPreference', 'PhoneNumber', 'EmergencyContact', 'IsActive']);
        await scrollLeftTo(grid, 0);
        await settle(grid);

        await expectPinnedFixed(grid, 2, 300);
    });

    test('pinned state from user settings applies on first render', { annotation: [{ type: 'case', description: 'grid.pn-from-settings' }] }, async ({ page }) => {
        await gridPage(page, { width: 800, height: 600 });
        const grid = await mountGrid(page, { userSettings: { LastName: { isPinned: true } } });

        expect(await headerNames(grid)).toEqual(['LastName', 'FirstName', 'BirthDate', 'Gender', 'ContactPreference', 'Email', 'PhoneNumber', 'EmergencyContact', 'IsActive']);
        (await rows(grid)).forEach(r => expect(r.cells[0].name).toBe('LastName'));
        await expectPinnedFixed(grid, 1, 300);
    });

    test('pin and unpin persist through user settings', { annotation: [{ type: 'case', description: 'grid.pn-settings-saved' }] }, async ({ page }) => {
        await gridPage(page, { width: 800, height: 600 });
        const grid = await mountGrid(page);
        const queryId = await grid.evaluate((g: any) => g.query.id);

        await pinEmail(grid);
        await expect.poll(async () => (await savedSettings(page)).length).toBe(1);
        expect((await savedSettings(page))[0].QueryGridSettings[queryId]).toEqual({ Email: { isPinned: true } });

        await clickHeaderMenuItem(grid, 'Email', 'Pin');
        await expect.poll(() => headerNames(grid)).toEqual(DEFAULT_ORDER);
        await expect.poll(async () => (await savedSettings(page)).length).toBe(2);
        expect((await savedSettings(page))[1].QueryGridSettings[queryId]).toBeUndefined();
    });

    test('query swap removes and restores sticky columns', { annotation: [{ type: 'case', description: 'gap.grid-swap-pinned-to-unpinned' }] }, async ({ page }) => {
        await gridPage(page, { width: 800, height: 600 });
        const grid = await mountGrid(page, { userSettings: { Email: { isPinned: true } } });
        await page.evaluate(() => (window as any).people = (window as any).q);
        expect((await headerNames(grid))[0]).toBe('Email');
        await expectPinnedFixed(grid, 1, 200);

        await page.evaluate(async () => {
            const w = window as any;
            w.grid.query = await w.service.getQuery('PeopleTop10');
        });
        await waitForGridReady(grid);
        await scrollLeftTo(grid, 0);
        await settle(grid);
        expect((await headerNames(grid))[0]).toBe('FirstName');
        await expectPinnedFixed(grid, 0, 200);

        await page.evaluate(() => {
            const w = window as any;
            w.grid.query = w.people;
        });
        await waitForGridReady(grid);
        await scrollLeftTo(grid, 0);
        await settle(grid);
        expect((await headerNames(grid))[0]).toBe('Email');
        await expectPinnedFixed(grid, 1, 200);
    });

    test('a pinned column stays sticky after re-attach', { annotation: [{ type: 'case', description: 'grid.pinned-after-reattach' }] }, async ({ page }) => {
        await gridPage(page, { width: 800, height: 600 });
        const grid = await mountGrid(page);

        await clickHeaderMenuItem(grid, 'LastName', 'Pin');
        await expect.poll(async () => (await headerNames(grid))[0]).toBe('LastName');
        await scrollLeftTo(grid, 0);

        await page.evaluate(() => {
            const w = window as any;
            w.grid.remove();
            document.getElementById('test-container')!.appendChild(w.grid);
        });
        await waitForGridReady(grid);
        await scrollLeftTo(grid, 0);
        await settle(grid);

        await expectPinnedFixed(grid, 1, 300);
    });

    test('pinned cells stay fixed in every row after grouping', { annotation: [{ type: 'case', description: 'grid.pn-grouped-rows-fixed' }] }, async ({ page }) => {
        await gridPage(page, { width: 800, height: 600 });
        const grid = await mountGrid(page);
        await grid.evaluate(async (g: any) => { await g.query.group('Gender'); });
        await settle(grid);
        expect((await rows(grid))[0].isGroup).toBe(true);

        // The rows that showed the group header at the top now show items
        await scrollGrid(grid, { top: 10 * 32 });
        await expect.poll(async () => (await getScrollOffset(grid)).top).toBe(10 * 32);
        await settle(grid);

        await pinEmail(grid);
        await expectPinnedFixed(grid, 1, 300);
    });

    test('a left entry scrolls back to its column', { annotation: [{ type: 'case', description: 'grid.mc-left-click' }] }, async ({ page }) => {
        await gridPage(page, { width: 600, height: 600 });
        const grid = await mountGrid(page);

        const { scrollWidth, width } = await getScrollOffset(grid);
        await scrollLeftTo(grid, scrollWidth - width);
        await expect(grid.locator('vi-popup.more.left')).toBeVisible();

        await grid.locator('vi-popup.more.left vi-button').click();
        const labels = await moreItems(grid, 'left');
        expect(labels).toContain('First name');
        await grid.locator('vi-popup.more.left vi-popup-menu-item').nth(labels.indexOf('First name')).click();

        await expect.poll(async () => (await getScrollOffset(grid)).left).toBe(0);
        await expect.poll(() => hostVar(grid, '--vi-query-grid-horizontal')).toBe('0px');
    });

    test('reopening the popup does not duplicate entries', { annotation: [{ type: 'case', description: 'grid.mc-reopen-no-duplicates' }] }, async ({ page }) => {
        await gridPage(page, { width: 600, height: 600 });
        const grid = await mountGrid(page);

        await grid.locator('vi-popup.more.right vi-button').click();
        const first = await moreItems(grid, 'right');
        expect(first.length).toBeGreaterThan(0);

        // The empty spacer above the select-all and filter controls
        const controls = await controlsBox(grid);
        await page.mouse.click(controls.x + 10, controls.top + 8);
        await expect.poll(() => openPopupCount(page)).toBe(0);

        await grid.locator('vi-popup.more.right vi-button').click();
        expect(await moreItems(grid, 'right')).toEqual(first);
    });

    test('picking a column accounts for pinned widths', { annotation: [{ type: 'case', description: 'grid.mc-pinned-offset' }] }, async ({ page }) => {
        await gridPage(page, { width: 800, height: 600 });
        const grid = await mountGrid(page);
        await pinEmail(grid);

        await grid.locator('vi-popup.more.right vi-button').click();
        const labels = await moreItems(grid, 'right');
        expect(labels).toContain('Phone number');
        const phoneOffset = await header(grid, 'PhoneNumber').evaluate((h: HTMLElement) => h.offsetLeft);
        const emailWidth = (await headerBoxes(grid))[0].width;
        await grid.locator('vi-popup.more.right vi-popup-menu-item').nth(labels.indexOf('Phone number')).click();
        await expect.poll(() => openPopupCount(page)).toBe(0);

        const { scrollWidth, width } = await getScrollOffset(grid);
        const max = scrollWidth - width;
        await expect.poll(async () => (await getScrollOffset(grid)).left).toBeGreaterThan(0);
        await nextFrames(page, 2);
        const left = (await getScrollOffset(grid)).left;
        if (left < max) {
            const boxes = await headerBoxes(grid);
            const email = boxes.find(h => h.name === 'Email')!;
            const phone = boxes.find(h => h.name === 'PhoneNumber')!;
            expect(Math.abs(phone.x - email.right)).toBeLessThanOrEqual(1);
        }
        else
            expect(phoneOffset - emailWidth).toBeGreaterThanOrEqual(max - 1);
    });

    test('pinned columns are never listed in the more popups', { annotation: [{ type: 'case', description: 'grid.mc-pinned-not-listed' }] }, async ({ page }) => {
        await gridPage(page, { width: 800, height: 600 });
        const grid = await mountGrid(page);
        await pinEmail(grid);

        await scrollLeftTo(grid, 300);
        await expect(grid.locator('vi-popup.more.left')).toBeVisible();
        // The more lists follow the scroll after a short debounce
        await nextFrames(page, 6);

        const boxes = await headerBoxes(grid);
        const pinnedRight = boxes[0].right;
        const expected = boxes.slice(1).filter(h => h.x < pinnedRight - 1).map(h => h.label).sort((a, b) => a.localeCompare(b));
        expect(expected.length).toBeGreaterThan(0);

        await grid.locator('vi-popup.more.left vi-button').click();
        const labels = await moreItems(grid, 'left');
        expect(labels).not.toContain('Email');
        expect(labels).toEqual(expected);
    });

    test('more-columns buttons sit at the header edges above headers', { annotation: [{ type: 'case', description: 'gap.grid-more-buttons-geometry' }] }, async ({ page }) => {
        await gridPage(page, { width: 800, height: 600 });
        const grid = await mountGrid(page);

        const right = grid.locator('vi-popup.more.right');
        await expect(right).toBeVisible();
        const geometry = await grid.evaluate((g: any) => {
            const more = g.shadowRoot.querySelector('vi-popup.more.right') as HTMLElement;
            const b = more.getBoundingClientRect();
            const headerRight = g.shadowRoot.querySelector('header').getBoundingClientRect().right;
            let hit: Element | null = g.shadowRoot.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
            let hitsMore = false;
            while (hit) {
                if (hit === more) {
                    hitsMore = true;
                    break;
                }

                hit = hit.parentElement ?? ((hit.getRootNode() as ShadowRoot).host ?? null);
                if (hit === g)
                    break;
            }

            return { width: b.width, height: b.height, right: b.right, headerRight, background: getComputedStyle(more).backgroundColor, hitsMore };
        });
        expect(Math.abs(geometry.width - 32)).toBeLessThanOrEqual(1);
        expect(Math.abs(geometry.height - 32)).toBeLessThanOrEqual(1);
        expect(Math.abs(geometry.right - geometry.headerRight)).toBeLessThanOrEqual(1);
        expect(geometry.background).toBe('rgba(255, 255, 255, 0.75)');
        expect(geometry.hitsMore).toBe(true);

        await scrollLeftTo(grid, 300);
        const left = grid.locator('vi-popup.more.left');
        await expect(left).toBeVisible();
        const leftX = await left.evaluate((p: HTMLElement) => p.getBoundingClientRect().left);
        expect(Math.abs(leftX - (await controlsBox(grid)).right)).toBeLessThanOrEqual(1);
    });
});

/**
 * Scrolls horizontally by `distance` and checks that the first `pinned` headers and cells keep their x, the others move
 * by `distance`, and that only the last pinned cell of each row draws the separator.
 */
async function expectPinnedFixed(grid: Locator, pinned: number, distance: number) {
    await scrollLeftTo(grid, 0);
    await settle(grid);
    const headersBefore = await headerBoxes(grid);
    const rowsBefore = (await rows(grid)).filter(r => !r.isGroup);
    expect(rowsBefore.length).toBeGreaterThan(0);

    await scrollLeftTo(grid, distance);
    await settle(grid);
    const headersAfter = await headerBoxes(grid);
    headersAfter.forEach((h, i) => expect(Math.abs(h.x - (headersBefore[i].x - (i < pinned ? 0 : distance))), `header ${h.name}`).toBeLessThanOrEqual(1));

    const rowsAfter = (await rows(grid)).filter(r => !r.isGroup);
    expect(rowsAfter.map(r => r.index)).toEqual(rowsBefore.map(r => r.index));
    rowsAfter.forEach((r, k) => {
        expect(r.cells.map(c => c.name), `row ${r.index} cells`).toEqual(headersAfter.map(h => h.name));
        r.cells.forEach((c, i) => expect(Math.abs(c.x - (rowsBefore[k].cells[i].x - (i < pinned ? 0 : distance))), `row ${r.index} ${c.name}`).toBeLessThanOrEqual(1));
    });

    const borders = await grid.evaluate((g: any) => [...g.shadowRoot.querySelectorAll('vi-query-grid-row:not(.hidden):not([is-group])')].map((r: any) => [...r.querySelectorAll('.column'), ...(r.shadowRoot?.querySelectorAll('.column') ?? [])].map((c: any) => {
        const own = parseFloat(getComputedStyle(c).borderRightWidth) || 0;
        const after = parseFloat(getComputedStyle(c, '::after').borderRightWidth) || 0;
        return Math.max(own, after);
    })));
    borders.forEach((row, k) => row.forEach((b, i) => {
        if (pinned > 0 && i === pinned - 1)
            expect(b, `row ${k} separator`).toBeGreaterThanOrEqual(1);
        else
            expect(b, `row ${k} cell ${i}`).toBe(0);
    }));

    await scrollLeftTo(grid, 0);
}
