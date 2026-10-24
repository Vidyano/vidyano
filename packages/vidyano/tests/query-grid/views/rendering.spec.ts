import { test, expect, Locator, Page } from '@playwright/test';
import { headerNames, nextFrames, openView, requestLog, savedSettings, visibleRows, waitForGridReady } from '../_helpers/query-grid';
import { box, cellTexts, columnMenuItem, expectAligned, groupBy, hostVar, PEOPLE_COLUMNS, physicalRowCount, prefixParts, rowBoxes, rowForItem, rowHeight, settle, tracks, VIEW_MATRIX, wheelGrid } from '../_helpers/views';

async function headerBoxes(grid: Locator) {
    return grid.evaluate((g: any) => Object.fromEntries([...g.shadowRoot.querySelectorAll('vi-query-grid-column-header')]
        .filter((h: any) => getComputedStyle(h).display !== 'none')
        .map((h: any) => {
            const b = h.getBoundingClientRect();
            return [h.getAttribute('name'), { x: b.x, width: b.width }];
        })));
}

async function expectRowHeights(grid: Locator, label: string) {
    const rh = await rowHeight(grid);
    const gridBox = await box(grid);
    const rows = await rowBoxes(grid);
    expect(rows.length, label).toBeGreaterThan(0);

    for (const row of rows) {
        expect(Math.round(row.height), `${label}: row height`).toBe(rh);
        expect(Math.round(row.width), `${label}: row width`).toBe(gridBox.width);
        for (const height of row.cellHeights)
            expect(Math.round(height), `${label}: cell height`).toBe(rh);
    }
}

/** The derived maximum horizontal offset: column tracks plus controls minus the host width. */
async function maxHorizontal(grid: Locator) {
    const widths = await tracks(grid);
    const controls = parseFloat(await hostVar(grid, '--vi-query-grid-controls-width') || '0');
    return widths.reduce((a, b) => a + b, 0) + controls - (await box(grid)).width;
}

/** The first cell background of every displayed data row in the viewport, with the absolute item index it shows. */
async function stripes(grid: Locator) {
    return grid.evaluate((g: any) => {
        const q = g.query;
        const scroller = [...g.shadowRoot.querySelectorAll('vi-scroller')].find((s: any) => !s.closest('header, vi-popup')) as HTMLElement;
        const view = scroller.getBoundingClientRect();
        const lazy = q.disableLazyLoading;
        q.disableLazyLoading = true;
        try {
            return ([...g.shadowRoot.querySelectorAll('vi-query-grid-row:not([is-group])')] as any[])
                .filter(r => {
                    const b = r.getBoundingClientRect();
                    return getComputedStyle(r).display !== 'none' && !r.classList.contains('hidden') && b.height > 0 && b.bottom > view.top + 1 && b.top < view.bottom - 1;
                })
                .map(r => ({ index: q.items.findIndex((i: any) => i === r.item), background: getComputedStyle(r.querySelector('.column')).backgroundColor }));
        }
        finally {
            q.disableLazyLoading = lazy;
        }
    });
}

/** The items of an open more-columns popup. */
function moreItems(grid: Locator, side: 'left' | 'right') {
    return grid.locator(`.more.${side} vi-popup-menu-item`);
}

async function moreLabels(grid: Locator, side: 'left' | 'right') {
    return moreItems(grid, side).evaluateAll(items => items.map((i: any) => i.label));
}

async function pickMore(grid: Locator, side: 'left' | 'right', label: string) {
    const index = (await moreLabels(grid, side)).indexOf(label);
    expect(index, `${label} in the ${side} more popup`).toBeGreaterThanOrEqual(0);
    await moreItems(grid, side).nth(index).click();
}

async function openMore(grid: Locator, side: 'left' | 'right') {
    await grid.locator(`.more.${side} vi-button[icon=${side === 'left' ? 'ChevronLeft' : 'ChevronRight'}]`).click();
    await expect(grid.locator(`.more.${side}`)).toHaveAttribute('open', '');
}

async function resize(page: Page, grid: Locator, width: number, height: number) {
    await page.setViewportSize({ width, height });
    await nextFrames(page, 2);
    await expect.poll(async () => {
        const b = await box(grid);
        return [b.x + b.width, b.y + b.height];
    }).toEqual([width, height]);
    await waitForGridReady(grid);
}

test.describe('Alignment and rendering', () => {
    for (const view of VIEW_MATRIX) {
        test(`${view.name} headers line up with their cells, ungrouped and grouped`, { annotation: [{ type: 'case', description: 'views.all-header-cell-alignment' }] }, async ({ page }) => {
            const grid = await openView(page, view.path);
            await page.mouse.move(0, 0);

            const result = await expectAligned(grid, 'ungrouped');
            expect(result.headers).toEqual(PEOPLE_COLUMNS);

            await groupBy(grid, 'Gender', 'Gender');
            const grouped = await expectAligned(grid, 'grouped');
            expect(grouped.headers).toEqual(PEOPLE_COLUMNS);
        });

        test(`${view.name} rows and cells are one row height tall`, { annotation: [{ type: 'case', description: 'views.all-row-height' }] }, async ({ page }) => {
            const grid = await openView(page, view.path);
            expect(await hostVar(grid, '--vi-query-grid-row-height')).toBe('32px');

            await expectRowHeights(grid, 'top');

            if (view.totalItems > 100) {
                await wheelGrid(page, grid, 0, 160000);
                await settle(grid);
                await expectRowHeights(grid, 'middle');
            }

            await groupBy(grid, 'Gender', 'Gender');
            expect((await rowBoxes(grid)).some(r => r.isGroup)).toBe(true);
            await expectRowHeights(grid, 'grouped');
        });

        test(`${view.name} --vi-query-grid-columns lists measured widths plus a filler`, { annotation: [{ type: 'case', description: 'views.all-columns-css-var' }] }, async ({ page }) => {
            const grid = await openView(page, view.path);

            const value = await hostVar(grid, '--vi-query-grid-columns');
            expect(value).toMatch(/^(\d+px\s+){9}minmax\(0(px)?,\s*1fr\)$/);
            const widths = await tracks(grid);
            expect(widths).toHaveLength(PEOPLE_COLUMNS.length);
            widths.forEach(w => expect(Number.isInteger(w), `${w}px is an integer`).toBe(true));

            const headers = await headerBoxes(grid);
            PEOPLE_COLUMNS.forEach((name, i) => expect(Math.abs(headers[name].width - widths[i]), name).toBeLessThanOrEqual(1));
            expect(await hostVar(grid, '--vi-query-grid-columns-no-data')).toBe('');

            // The measured widths are a per-platform snapshot (fonts blocked, Windows Chrome at 1280x720)
            if (process.platform === 'win32')
                expect(widths).toEqual(view.name === 'PeopleTop10' ? [125, 108, 103, 91, 158, 195, 133, 159, 95] : [125, 108, 103, 91, 158, 214, 133, 159, 95]);
        });

        test(`${view.name} striping follows the absolute item index`, { annotation: [{ type: 'case', description: 'views.all-row-striping-parity' }] }, async ({ page }) => {
            const grid = await openView(page, view.path);
            const rh = await rowHeight(grid);
            const even = 'rgb(250, 250, 250)';
            const odd = 'rgb(255, 255, 255)';

            // 100 rows, 3 more rows (an odd shift of the row window), the middle and the bottom
            const steps = view.totalItems > 100 ? [0, 100 * rh, 3 * rh, 160000, 400000] : [0];
            for (const step of steps) {
                if (step) {
                    await wheelGrid(page, grid, 0, step);
                    await settle(grid);
                }

                // Hovering a row recolors it
                await page.mouse.move(0, 0);
                await expect.poll(async () => {
                    const rows = await stripes(grid);
                    return rows.length > 0 && rows.every(r => r.index >= 0);
                }).toBe(true);

                const rows = await stripes(grid);
                const wrong = rows.filter(r => r.background !== (r.index % 2 === 0 ? even : odd));
                expect(wrong, `stripes after scrolling ${step}px`).toEqual([]);
            }
        });
    }
});

test.describe('Horizontal scroll, pin and hide', () => {
    for (const view of VIEW_MATRIX) {
        test(`${view.name} horizontal scroll moves headers and cells together`, { annotation: [{ type: 'case', description: 'views.all-hscroll-alignment' }] }, async ({ page }) => {
            const grid = await openView(page, view.path);
            const max = await maxHorizontal(grid);
            const before = await headerBoxes(grid);
            const controls = await box(grid.locator('header .controls'));
            const row = await rowForItem(grid, 0);
            const parts = await prefixParts(row);

            await wheelGrid(page, grid, 300, 0);
            await settle(grid);

            const h = parseFloat(await hostVar(grid, '--vi-query-grid-horizontal'));
            expect(h).toBeGreaterThan(0);
            expect(h).toBeLessThanOrEqual(max + 1);

            const after = await headerBoxes(grid);
            for (const name of PEOPLE_COLUMNS)
                expect(Math.abs(after[name].x - (before[name].x - h)), name).toBeLessThanOrEqual(1);

            await expectAligned(grid, 'scrolled');
            expect((await box(grid.locator('header .controls'))).x).toBe(controls.x);
            expect(await prefixParts(await rowForItem(grid, 0))).toEqual(parts);
        });

        test(`${view.name} a pinned column moves first and stays put on horizontal scroll`, { annotation: [{ type: 'case', description: 'views.all-hscroll-pinned' }] }, async ({ page }) => {
            const grid = await openView(page, view.path);
            const queryId = await grid.evaluate((g: any) => g.query.id);

            await columnMenuItem(grid, 'LastName', 'Pin');
            await expect.poll(() => headerNames(grid)).toEqual(['LastName', ...PEOPLE_COLUMNS.filter(c => c !== 'LastName')]);
            await waitForGridReady(grid);
            await expectAligned(grid, 'pinned');

            const row = await rowForItem(grid, 0);
            const border = await row.locator('.column').first().evaluate(c => parseFloat(getComputedStyle(c).borderRightWidth));
            expect(border).toBeGreaterThanOrEqual(1);

            await expect.poll(async () => (await savedSettings(page)).at(-1)?.QueryGridSettings?.[queryId]?.LastName?.isPinned).toBe(true);

            const controls = await box(grid.locator('header .controls'));
            const before = await headerBoxes(grid);

            await wheelGrid(page, grid, 250, 0);
            await settle(grid);
            const h = parseFloat(await hostVar(grid, '--vi-query-grid-horizontal'));
            expect(h).toBeGreaterThan(0);

            const after = await headerBoxes(grid);
            expect(Math.round(after.LastName.x)).toBe(controls.x + controls.width);
            const lastNameCell = await box((await rowForItem(grid, (await visibleRows(grid))[0].index)).locator('.column').first());
            expect(lastNameCell.x).toBe(controls.x + controls.width);

            for (const name of PEOPLE_COLUMNS.filter(c => c !== 'LastName'))
                expect(Math.abs(after[name].x - (before[name].x - h)), name).toBeLessThanOrEqual(1);

            await expectAligned(grid, 'pinned and scrolled');

            const hit = await grid.evaluate((g: any) => {
                const header = g.shadowRoot.querySelector('vi-query-grid-column-header[name=LastName]').getBoundingClientRect();
                const element = g.shadowRoot.elementFromPoint(header.x + header.width / 2, header.y + 8);
                return element?.closest('vi-query-grid-column-header')?.getAttribute('name') ?? null;
            });
            expect(hit).toBe('LastName');
        });

        test(`${view.name} pinning a column keeps each column's own width`, { annotation: [{ type: 'case', description: 'views.all-pin-width-reassignment' }, { type: 'case', description: 'views.all-pin-keeps-widths' }] }, async ({ page }) => {
            const grid = await openView(page, view.path);
            const before = await headerBoxes(grid);

            await columnMenuItem(grid, 'LastName', 'Pin');
            await expect.poll(() => headerNames(grid)).toEqual(['LastName', ...PEOPLE_COLUMNS.filter(c => c !== 'LastName')]);
            await waitForGridReady(grid);

            const after = await headerBoxes(grid);
            for (const name of PEOPLE_COLUMNS)
                expect(Math.abs(after[name].width - before[name].width), name).toBeLessThanOrEqual(1);

            await expectAligned(grid, 'pinned');
        });

        test(`${view.name} hiding a middle column removes it and keeps widths by name`, { annotation: [{ type: 'case', description: 'views.all-hide-column' }] }, async ({ page }) => {
            const grid = await openView(page, view.path);
            const queryId = await grid.evaluate((g: any) => g.query.id);
            const before = await headerBoxes(grid);
            const remaining = PEOPLE_COLUMNS.filter(c => c !== 'Gender');

            await columnMenuItem(grid, 'Gender', 'Hide column');
            await expect.poll(() => headerNames(grid)).toEqual(remaining);
            await waitForGridReady(grid);
            await expect(grid).not.toHaveAttribute('initializing');

            const after = await headerBoxes(grid);
            expect(Object.keys(after)).toEqual(remaining);
            for (const name of remaining)
                expect(Math.abs(after[name].width - before[name].width), name).toBeLessThanOrEqual(1);

            const result = await expectAligned(grid, 'hidden');
            expect(result.headers).toEqual(remaining);
            expect((await cellTexts(await rowForItem(grid, 0))).length).toBe(remaining.length);

            await expect.poll(async () => (await savedSettings(page)).at(-1)?.QueryGridSettings?.[queryId]?.Gender?.isHidden).toBe(true);
        });
    }
});

test.describe('Window resize and more columns', () => {
    for (const view of VIEW_MATRIX) {
        test(`${view.name} alignment and widths survive window resizes`, { annotation: [{ type: 'case', description: 'views.all-resize-alignment' }] }, async ({ page }) => {
            const grid = await openView(page, view.path);
            const columns = await hostVar(grid, '--vi-query-grid-columns');

            for (const [width, height] of [[800, 600], [1920, 1080], [1280, 720]]) {
                const label = `${width}x${height}`;
                await resize(page, grid, width, height);

                expect(await hostVar(grid, '--vi-query-grid-columns'), label).toBe(columns);
                await expectAligned(grid, label);
                await expectRowHeights(grid, label);

                if (width === 1920) {
                    const filler = await (await rowForItem(grid, 0)).evaluate(r => parseFloat(getComputedStyle(r).gridTemplateColumns.trim().split(/\s+/).at(-1)!));
                    expect(filler, 'filler track').toBeGreaterThan(0);
                }
            }
        });

        test(`${view.name} more-columns buttons appear only when columns overflow`, { annotation: [{ type: 'case', description: 'views.all-more-buttons-visibility' }] }, async ({ page }) => {
            const right = (grid: Locator) => grid.locator('.more.right vi-button[icon=ChevronRight]');
            const left = (grid: Locator) => grid.locator('.more.left vi-button[icon=ChevronLeft]');

            let grid = await openView(page, view.path);
            await expect(right(grid)).toBeVisible();
            await expect(left(grid)).toBeHidden();

            await resize(page, grid, 1920, 1080);
            await expect(right(grid)).toBeHidden();
            await expect(left(grid)).toBeHidden();

            grid = await openView(page, view.path, { width: 1920, height: 1080 });
            await expect(right(grid)).toBeHidden();
            await expect(left(grid)).toBeHidden();

            await resize(page, grid, 800, 600);
            await expect(right(grid)).toBeVisible();

            await resize(page, grid, 1280, 720);
            await wheelGrid(page, grid, 5000, 0);
            await settle(grid);
            expect(parseFloat(await hostVar(grid, '--vi-query-grid-horizontal'))).toBeCloseTo(await maxHorizontal(grid), 0);
            await expect(left(grid)).toBeVisible();
            await expect(right(grid)).toBeHidden();

            await wheelGrid(page, grid, -5000, 0);
            await settle(grid);
            expect(await hostVar(grid, '--vi-query-grid-horizontal')).toBe('0px');
            await expect(left(grid)).toBeHidden();
            await expect(right(grid)).toBeVisible();
        });

        test(`${view.name} right more popup lists off-screen columns sorted by label`, { annotation: [{ type: 'case', description: 'views.all-more-right-items' }] }, async ({ page }, testInfo) => {
            const grid = await openView(page, view.path);

            await openMore(grid, 'right');
            await expect(moreItems(grid, 'right').first()).toBeVisible();
            // A column is listed once its center is past the edge: views with 64px controls push EmergencyContact past it too,
            // except PeopleTop10 whose narrower Email column (195 instead of 214) keeps it in
            const twoListed = view.controls.slots === 2 && view.name !== 'PeopleTop10';
            expect(await moreLabels(grid, 'right')).toEqual(twoListed ? ['Emergency contact', 'Is active'] : ['Is active']);

            await page.keyboard.press('Escape');
            await expect(grid.locator('.more.right')).not.toHaveAttribute('open');
            await expect(moreItems(grid, 'right')).toHaveCount(0);

            if (view.name === 'People') {
                await resize(page, grid, 800, 600);
                await openMore(grid, 'right');
                await expect(moreItems(grid, 'right').first()).toBeVisible();
                const labels = await moreLabels(grid, 'right');
                expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
                testInfo.annotations.push({ type: 'recorded', description: `People more-right at 800x600: ${labels.join(', ')}` });
                await page.keyboard.press('Escape');
                await expect(moreItems(grid, 'right')).toHaveCount(0);
            }
        });

        test(`${view.name} picking a column from the more popup scrolls it into view`, { annotation: [{ type: 'case', description: 'views.all-more-pick-scrolls' }] }, async ({ page }) => {
            const grid = await openView(page, view.path);
            const max = await maxHorizontal(grid);
            const offsetLeft = await grid.evaluate((g: any) => g.shadowRoot.querySelector('vi-query-grid-column-header[name=IsActive]').offsetLeft);

            await openMore(grid, 'right');
            await pickMore(grid, 'right', 'Is active');
            await settle(grid);

            const h = parseFloat(await hostVar(grid, '--vi-query-grid-horizontal'));
            expect(Math.abs(h - Math.min(offsetLeft, max))).toBeLessThanOrEqual(1);

            const gridBox = await box(grid);
            const isActive = await box(grid.locator('vi-query-grid-column-header[name=IsActive]'));
            expect(isActive.x).toBeGreaterThanOrEqual(gridBox.x + (await box(grid.locator('header .controls'))).width - 1);
            expect(isActive.x + isActive.width).toBeLessThanOrEqual(gridBox.x + gridBox.width + 1);
            await expect(grid.locator('.more.left vi-button[icon=ChevronLeft]')).toBeVisible();
            await expect(grid.locator('.more.right vi-button[icon=ChevronRight]')).toBeHidden();

            await openMore(grid, 'left');
            await pickMore(grid, 'left', 'First name');
            await settle(grid);
            expect(await hostVar(grid, '--vi-query-grid-horizontal')).toBe('0px');
            await expect(grid.locator('.more.left vi-button[icon=ChevronLeft]')).toBeHidden();
            await expectAligned(grid, 'back at 0');
        });
    }
});

test.describe('People', () => {
    test('People first row shows Aaron Lemmens formatted for nl-BE', { annotation: [{ type: 'case', description: 'views.people-first-row' }] }, async ({ page }) => {
        const grid = await openView(page, 'home/people');
        const row = await rowForItem(grid, 0);

        expect(await grid.evaluate((g: any) => {
            g.query.disableLazyLoading = true;
            try {
                return g.query.items[0].id;
            }
            finally {
                g.query.disableLazyLoading = false;
            }
        })).toBe('3');
        expect((await visibleRows(grid))[0].index).toBe(0);
        expect(await cellTexts(row)).toEqual(['Aaron', 'Lemmens', '10/11/1947', 'Male', 'Email', 'Aaron_Lemmens59@skynet.be', '0475 26 85 00', 'Thomas Decock', '']);
        await expect(row.locator('vi-query-grid-cell-boolean vi-icon[source=Selected]')).toHaveAttribute('is-selected', '');
    });
});

test.describe('PeopleTop10', () => {
    test('PeopleTop10 shows exactly 10 rows without vertical scrolling', { annotation: [{ type: 'case', description: 'views.top10-ten-rows' }] }, async ({ page }) => {
        const log = requestLog(page);
        const grid = await openView(page, 'home/people-top10');
        await log.quiet();
        log.clear();

        expect((await visibleRows(grid)).length).toBe(10);
        const physical = await physicalRowCount(grid);
        const displayed = await grid.evaluate((g: any) => [...g.shadowRoot.querySelectorAll('vi-query-grid-row')].filter((r: any) => getComputedStyle(r).display !== 'none' && !r.classList.contains('hidden')).length);
        expect(displayed).toBe(10);
        // Surplus physical rows (if the implementation keeps any) must not be displayed
        expect(physical).toBeGreaterThanOrEqual(10);

        await wheelGrid(page, grid, 0, 2000);
        await settle(grid);

        const rows = await visibleRows(grid);
        expect(rows[0].texts.slice(0, 2)).toEqual(['Aaron', 'Lemmens']);
        expect(rows).toHaveLength(10);
        const boxes = await rowBoxes(grid);
        const gridBox = await box(grid);
        expect(boxes[9].bottom).toBeLessThanOrEqual(gridBox.y + gridBox.height);

        await log.quiet();
        expect(log.of('ExecuteQuery')).toEqual([]);
    });
});
