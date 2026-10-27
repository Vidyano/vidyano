import { test, expect, Locator, Page } from '@playwright/test';
import { BASE, getScrollOffset, headerNames, openView, pageErrors, requestLog, VIEWS, visibleRows, waitForGridReady } from '../_helpers/query-grid';
import { activeGrid, expectAligned, hostVar, itemDisplay, PEOPLE_ID, rowBoxes, rowForItem, rowHeight, settle, TOP10_ID, VIEW_MATRIX, ViewName, wheelGrid } from '../_helpers/views';

/** The menu titles that lead to each view: program unit, optional item group, item. */
const MENU: Partial<Record<ViewName, string[]>> = {
    People: ['Home', 'People'],
    QueryGrid_None: ['Components', 'Query Grid', 'None'],
    QueryGrid_Select: ['Components', 'Query Grid', 'Select'],
    QueryGrid_Filter: ['Components', 'Query Grid', 'Filter'],
    QueryGrid_InlineActions: ['Components', 'Query Grid', 'Inline actions'],
    QueryGrid_SelectAndFilter: ['Components', 'Query Grid', 'Select + Filter'],
    QueryGrid_SelectAndInlineActions: ['Components', 'Query Grid', 'Select + Inline Actions'],
    QueryGrid_SelectAndFilterAndInlineActions: ['Components', 'Query Grid', 'Select + Filter + Inline Actions']
};

/** The visible menu node whose own title reads exactly `title`. */
async function menuItem(page: Page, title: string): Promise<Locator> {
    const items = page.locator('vi-menu-program-unit, vi-menu-group, vi-menu-item');
    await expect.poll(() => items.evaluateAll((els, title) => els.findIndex(e => e.checkVisibility() && e.getBoundingClientRect().height > 0 && (e.shadowRoot?.querySelector('.title')?.textContent ?? '').trim() === title), title), { message: `menu item ${title}` }).toBeGreaterThanOrEqual(0);
    const index = await items.evaluateAll((els, title) => els.findIndex(e => e.checkVisibility() && e.getBoundingClientRect().height > 0 && (e.shadowRoot?.querySelector('.title')?.textContent ?? '').trim() === title), title);

    return items.nth(index);
}

test.describe('Menu links', () => {
    for (const modifier of ['Control', 'Shift'] as const) {
        test(`${modifier}+click on a menu item is left to the browser`, async ({ page }) => {
            await openView(page, VIEWS.People);
            const opened = page.context().waitForEvent('page', { timeout: 5000 });

            await (await menuItem(page, 'People')).locator('.title').first().click({ modifiers: [modifier] });

            // vi-app no longer routes it in place, so the browser opens the link in a new tab or window
            const popup = await opened;
            await popup.waitForURL(`${BASE}/home/people`);
            await popup.close();
        });
    }
});

test.describe('Routing', () => {
    for (const view of VIEW_MATRIX) {
        if (MENU[view.name]) {
            test(`${view.name} is reachable through vi-menu`, { annotation: [{ type: 'case', description: 'views.all-route-menu' }] }, async ({ page }) => {
                // Start on another program unit so the menu has to switch
                await openView(page, view.name === 'People' ? VIEWS.QueryGrid_None : VIEWS.People);

                for (const title of MENU[view.name]!)
                    await (await menuItem(page, title)).locator('.title').first().click();

                await expect(page).toHaveURL(`${BASE}/${view.path}`);
                await expect.poll(() => activeGrid(page).evaluate((g: any) => g.query?.name)).toBe(view.name);
                const grid = activeGrid(page);
                await waitForGridReady(grid);
                await expect(page.locator('vi-query').filter({ visible: true }).first().locator('header').first()).toHaveText(view.title);
            });
        }
        else {
            test(`${view.name} has no vi-menu item`, { annotation: [{ type: 'case', description: 'views.all-route-menu' }] }, async ({ page }) => {
                await openView(page, view.path);
                const targets = await page.locator('vi-menu-item').evaluateAll(items => items.map((m: any) => m.shadowRoot?.querySelector('a')?.getAttribute('href') ?? ''));
                expect(targets.filter(href => href.endsWith(`/${view.path}`) || href.includes(TOP10_ID))).toEqual([]);
            });
        }

        test(`${view.name} opens by deep link with one initialized grid`, { annotation: [{ type: 'case', description: 'views.all-route-deeplink' }] }, async ({ page }) => {
            const grid = await openView(page, view.path);

            // BASE includes the worktree prefix when the dev supervisor serves a worktree
            expect(page.url()).toBe(`${BASE}/${view.path}`);
            await expect(page.locator('vi-query-grid')).toHaveCount(1);
            await expect(page.locator('vi-query-items-presenter > vi-query-grid')).toHaveCount(1);
            await expect(grid).not.toHaveAttribute('initializing');
            await expect(grid.locator('vi-spinner').filter({ visible: true })).toHaveCount(0);
            expect(await grid.evaluate((g: any) => g.query.name)).toBe(view.name);
        });
    }

    test('dev app signs in as Admin by default and through /sign-in', { annotation: [{ type: 'case', description: 'views.all-signin-default-user' }] }, async ({ browser }) => {
        for (const via of ['default', 'sign-in'] as const) {
            const context = await browser.newContext();
            const page = await context.newPage();
            try {
                if (via === 'default') {
                    const grid = await openView(page, '/');
                    await expect(page).toHaveURL(`${BASE}/home/people`);
                    expect(await page.evaluate(() => {
                        const service = (document.querySelector('vi-app') as any).service;
                        return [service.isSignedIn, service.isUsingDefaultCredentials, service.application.friendlyUserName ?? service.userName];
                    })).toEqual([true, true, 'Admin']);
                    expect(await grid.evaluate((g: any) => g.query.name)).toBe('People');
                }
                else {
                    await page.setViewportSize({ width: 1280, height: 720 });
                    await page.goto(`${BASE}/sign-in`);
                    const signIn = page.locator('vi-sign-in');
                    await signIn.waitFor({ timeout: 30000 });
                    // Two steps: the user name, Next, then the password
                    await page.getByRole('textbox', { name: 'User name' }).fill('admin');
                    await page.getByText('Next', { exact: true }).filter({ visible: true }).click();
                    const password = signIn.locator('input[type=password]').filter({ visible: true }).first();
                    await password.fill('admin');
                    await password.press('Enter');

                    await expect(page).toHaveURL(`${BASE}/home/people`, { timeout: 30000 });
                    const grid = activeGrid(page);
                    await grid.waitFor({ timeout: 30000 });
                    await waitForGridReady(grid, 30000);
                    expect(await grid.evaluate((g: any) => g.query.name)).toBe('People');
                    expect(await page.evaluate(() => (document.querySelector('vi-app') as any).service.isSignedIn)).toBe(true);
                }
            }
            finally {
                await context.close();
            }
        }
    });

    test(`'/' redirects to /home/people and shows the People grid`, { annotation: [{ type: 'case', description: 'views.people-route' }] }, async ({ page }) => {
        const grid = await openView(page, '/');

        await expect(page).toHaveURL(`${BASE}/home/people`);
        await expect(page.locator('vi-query header').first()).toHaveText('10.000 People');
        expect(await grid.evaluate((g: any) => [g.query.name, g.query.id])).toEqual(['People', PEOPLE_ID]);
    });

    test('PeopleTop10 opens by route and by query id', { annotation: [{ type: 'case', description: 'views.top10-route' }] }, async ({ page }) => {
        for (const path of ['home/people-top10', `query.${TOP10_ID}`]) {
            const grid = await openView(page, path);

            expect(page.url(), path).toBe(`${BASE}/${path}`);
            expect(await grid.evaluate((g: any) => g.query.name), path).toBe('PeopleTop10');
            await expect(page.locator('vi-query header').first(), path).toHaveText('10 People (Top 10)');
        }

        const menuTargets = await page.locator('vi-menu-item').evaluateAll(items => items.map((m: any) => m.shadowRoot?.querySelector('a')?.getAttribute('href') ?? ''));
        expect(menuTargets.length).toBeGreaterThan(0);
        expect(menuTargets.filter(href => href.includes('people-top10') || href.includes(TOP10_ID))).toEqual([]);
    });
});

test.describe('Presenter contract', () => {
    test('presenter renders one grid bound to its query', { annotation: [{ type: 'case', description: 'views.qip-creates-grid' }] }, async ({ page }) => {
        await openView(page, 'home/people');

        const presenter = page.locator('vi-query-items-presenter');
        await expect(presenter).toHaveCount(1);
        await expect(page.locator('vi-query-items-presenter > vi-query-grid')).toHaveCount(1);
        expect(await presenter.evaluate((p: any) => p.querySelector(':scope > vi-query-grid').query === p.query && !!p.query)).toBe(true);
        await expect(presenter.locator('vi-spinner').first()).toBeHidden();
    });

    test('QueryGrid can be constructed without arguments and given a query before connection', { annotation: [{ type: 'case', description: 'views.qip-imperative-construct' }] }, async ({ page }) => {
        await openView(page, 'home/people');

        const created = await page.evaluate(async () => {
            const m = await import((document.querySelector('script[type=module]') as HTMLScriptElement).src);
            const grid = new m.QueryGrid();
            const result = { isElement: grid instanceof HTMLElement, tagName: grid.tagName };

            const container = document.createElement('div');
            container.id = 'pw-imperative';
            container.style.cssText = 'position: fixed; left: 0; top: 0; width: 1000px; height: 500px; display: flex; flex-direction: column; background: white; z-index: 100';
            // The theme variables (--theme-h2 drives the row height) are defined on vi-app, so a grid outside the app needs them
            const theme = getComputedStyle(document.querySelector('vi-app')!);
            ['--theme-h1', '--theme-h2', '--theme-h3', '--theme-h4', '--theme-h5', '--theme-light-border', '--theme-foreground'].forEach(name => container.style.setProperty(name, theme.getPropertyValue(name)));
            grid.style.flex = '1';
            grid.query = await (document.querySelector('vi-app') as any).service.getQuery('PeopleTop10');
            container.appendChild(grid);
            document.body.appendChild(container);

            return result;
        });
        expect(created).toEqual({ isElement: true, tagName: 'VI-QUERY-GRID' });

        const grid = page.locator('#pw-imperative > vi-query-grid');
        await waitForGridReady(grid);
        await expect(grid).not.toHaveAttribute('initializing');
        expect((await visibleRows(grid)).length).toBe(10);

        await page.evaluate(() => document.getElementById('pw-imperative')!.remove());
    });

    test('navigating between views replaces the grid', { annotation: [{ type: 'case', description: 'views.qip-route-replaces-grid' }] }, async ({ page }) => {
        await openView(page, VIEWS.People);
        let previous = await activeGrid(page).elementHandle();
        expect(await previous!.evaluate((g: any) => g.query.name)).toBe('People');

        for (const name of ['QueryGrid_Select', 'QueryGrid_None'] as const) {
            await page.evaluate(path => (document.querySelector('vi-app') as any).changePath(path), VIEWS[name]);
            await expect(page).toHaveURL(`${BASE}/${VIEWS[name]}`);
            await expect.poll(() => activeGrid(page).evaluate((g: any) => g.query?.name)).toBe(name);
            await waitForGridReady(activeGrid(page));

            await expect(page.locator('vi-query-grid'), name).toHaveCount(1);
            expect(await previous!.evaluate(g => g.isConnected), `the previous grid after opening ${name}`).toBe(false);
            previous = await activeGrid(page).elementHandle();
        }
    });
});

test.describe('Detail query tab', () => {
    test('Person Addresses detail tab renders an initialized grid', { annotation: [{ type: 'case', description: 'gap.views-detail-query-grid' }] }, async ({ page }) => {
        const errors = pageErrors(page);
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.route('**/fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
        await page.route('**/fonts.gstatic.com/**', route => route.abort());
        await page.goto(`${BASE}/home/person/3`);

        const grids = page.locator('vi-persistent-object vi-query-grid');
        const grid = grids.first();
        await grid.waitFor({ timeout: 30000 });
        await waitForGridReady(grid, 30000);

        await expect(grids).toHaveCount(1);
        expect(await grid.evaluate((g: any) => g.query.name)).toBe('Person_Addresses');
        await expect(grid).not.toHaveAttribute('initializing');
        expect(await headerNames(grid)).toEqual(['Street', 'City', 'State', 'ZipCode', 'Country', 'IsPrimary']);

        const cells = await grid.evaluate((g: any) => [...g.shadowRoot.querySelectorAll('vi-query-grid-row:not([is-group])')]
            .filter((r: any) => getComputedStyle(r).display !== 'none' && !r.classList.contains('hidden'))
            .map((r: any) => [...r.querySelectorAll(':scope > .column')].map((c: Element) => c.tagName.toLowerCase()).join(',')));
        expect(cells.length).toBeGreaterThan(0);
        expect(new Set(cells)).toEqual(new Set([[...Array(5).fill('vi-query-grid-cell-default'), 'vi-query-grid-cell-boolean'].join(',')]));
        await expectAligned(grid, 'addresses');

        // Switch to the Person tab and back to the Addresses tab
        for (const label of ['Person', 'Addresses']) {
            const items = page.locator('vi-persistent-object-tab-bar-item');
            const index = await items.evaluateAll((els, label) => els.findIndex((e: any) => e.tab?.label === label), label);
            expect(index, label).toBeGreaterThanOrEqual(0);
            await items.nth(index).click();
        }

        await waitForGridReady(grid);
        await expect(grids).toHaveCount(1);
        await expectAligned(grid, 'after switching tabs');
        expect(errors).toEqual([]);
    });
});

test.describe('Keybindings', () => {
    test('F5 refreshes the query inside the grid', { annotation: [{ type: 'case', description: 'views.qip-refresh-keybinding' }] }, async ({ page }) => {
        const grid = await openView(page, VIEWS.People);
        await page.evaluate(() => (window as any).__pwMarker = true);
        const rh = await rowHeight(grid);

        await wheelGrid(page, grid, 0, 100 * rh);
        await settle(grid);
        expect((await visibleRows(grid))[0].index).toBe(100);

        const log = requestLog(page);
        await log.quiet();
        log.clear();

        await page.keyboard.press('F5');

        await expect.poll(() => log.of('ExecuteQuery').length).toBe(1);
        await log.quiet();
        expect(log.of('ExecuteQuery')).toHaveLength(1);
        // No page reload: the window marker survives
        expect(await page.evaluate(() => (window as any).__pwMarker)).toBe(true);

        await waitForGridReady(grid);
        await expect.poll(async () => (await getScrollOffset(grid)).top).toBe(0);
        await waitForGridReady(grid);
        expect((await visibleRows(grid))[0].index).toBe(0);
        await expectAligned(grid, 'refreshed');
    });
});

test.describe('Opening rows', () => {
    for (const view of VIEW_MATRIX) {
        test(`${view.name} clicking a data cell opens the person and Back returns`, { annotation: [{ type: 'case', description: 'gap.views-all-row-click-opens' }] }, async ({ page }) => {
            const grid = await openView(page, view.path);
            const item = (await itemDisplay(grid, 1, ['FirstName', 'LastName']))!;
            const row = await rowForItem(grid, 1);
            const before = (await rowBoxes(grid))[1].top;

            await row.locator('.column').nth(1).click();

            await expect(page).toHaveURL(`${BASE}/${view.unit}/person/${item.id}`);
            const po = page.locator('vi-persistent-object').filter({ visible: true }).first();
            await expect(po.locator('header').filter({ hasText: `${item.values[0]} ${item.values[1]}` }).first()).toBeVisible();

            await page.goBack();
            await expect(page).toHaveURL(`${BASE}/${view.path}`);
            const back = activeGrid(page);
            await waitForGridReady(back);
            expect(await back.evaluate((g: any) => g.query.name)).toBe(view.name);

            const rows = await visibleRows(back);
            expect(rows[1].index).toBe(1);
            expect((await rowBoxes(back))[1].top).toBe(before);
        });
    }
});

test.describe('Scroll restore', () => {
    /** Scrolls the grid down `rows` rows and `right` px to the right, returns the top item index and --vi-query-grid-horizontal. */
    async function scrollAway(page: Page, grid: Locator, rows: number, right: number) {
        const rh = await rowHeight(grid);

        await wheelGrid(page, grid, 0, rows * rh);
        await settle(grid);
        await wheelGrid(page, grid, right, 0);
        await settle(grid);

        const top = (await visibleRows(grid))[0].index;
        const horizontal = await hostVar(grid, '--vi-query-grid-horizontal');
        expect(parseFloat(horizontal)).toBeGreaterThan(0);

        return { top, horizontal };
    }

    /** Waits until the active grid shows the named query at the given offsets. */
    async function expectRestored(page: Page, name: string, offsets: { top: number; horizontal: string }) {
        await expect.poll(() => activeGrid(page).evaluate((g: any) => g.query?.name)).toBe(name);
        const grid = activeGrid(page);
        await waitForGridReady(grid);
        await expect.poll(async () => Math.abs((await visibleRows(grid))[0].index - offsets.top), { message: `${name} top item` }).toBeLessThanOrEqual(1);
        await expect.poll(() => hostVar(grid, '--vi-query-grid-horizontal'), { message: `${name} horizontal offset` }).toBe(offsets.horizontal);
    }

    async function openOtherView(page: Page) {
        await page.evaluate(() => (document.querySelector('vi-app') as any).changePath('components/query-grid_none'));
        await expect(page).toHaveURL(`${BASE}/components/query-grid_none`);
        await expect.poll(() => activeGrid(page).evaluate((g: any) => g.query?.name)).toBe('QueryGrid_None');
        const grid = activeGrid(page);
        await waitForGridReady(grid);

        return grid;
    }

    test('scroll offsets are restored after opening a row or another query view and going back', { annotation: [{ type: 'case', description: 'views.route-restore-vertical' }] }, async ({ page }) => {
        const grid = await openView(page, 'home/people');
        const people = await scrollAway(page, grid, 100, 300);
        expect(people.top).toBe(100);
        expect((await itemDisplay(grid, 100, ['FirstName', 'LastName']))!.values).toEqual(['Adam', 'Mertens']);

        const third = (await visibleRows(grid))[2];
        const id = (await itemDisplay(grid, third.index, []))!.id;
        // Click by position: a locator click would scroll the cell into view and change the horizontal offset
        const thirdBox = (await rowBoxes(grid))[2];
        await page.mouse.click(thirdBox.left + thirdBox.width / 2, thirdBox.top + thirdBox.height / 2);
        await expect(page).toHaveURL(`${BASE}/home/person/${id}`);

        await page.goBack();
        await expect(page).toHaveURL(`${BASE}/home/people`);
        await expectRestored(page, 'People', people);

        // Visiting another query view replaces the grid (both views share the :programUnitName/query.:id route),
        // the new People grid must not overwrite the stored offsets with its own initial 0/0
        await openOtherView(page);

        await page.goBack();
        await expect(page).toHaveURL(`${BASE}/home/people`);
        await expectRestored(page, 'People', people);
    });

    test('Back and Forward restore each query view its own scroll offsets', { annotation: [{ type: 'case', description: 'views.route-restore-both-views' }] }, async ({ page }) => {
        const people = await scrollAway(page, await openView(page, 'home/people'), 100, 300);
        const other = await scrollAway(page, await openOtherView(page), 40, 150);
        expect(Math.abs(other.top - people.top)).toBeGreaterThan(10);
        expect(other.horizontal).not.toBe(people.horizontal);

        await page.goBack();
        await expect(page).toHaveURL(`${BASE}/home/people`);
        await expectRestored(page, 'People', people);

        await page.goForward();
        await expect(page).toHaveURL(`${BASE}/components/query-grid_none`);
        await expectRestored(page, 'QueryGrid_None', other);

        await page.goBack();
        await expect(page).toHaveURL(`${BASE}/home/people`);
        await expectRestored(page, 'People', people);
    });
});

test.describe('User settings isolation', () => {
    test('admin user settings are unchanged after the suite', { annotation: [{ type: 'case', description: 'gap.views-user-settings-isolation-guard' }] }, async ({ browser }) => {
        // A fresh context signs in again, so the settings come from the backend. This fails when any spec
        // (in this or an earlier run) persisted grid or sort settings for the shared Admin user.
        const context = await browser.newContext();
        const page = await context.newPage();
        try {
            const grid = await openView(page, 'home/people', { storedSettings: true });
            await grid.waitFor();

            const settings = await page.evaluate(() => {
                const application = (document.querySelector('vi-app') as any).service.application;
                return JSON.parse(JSON.stringify({ grid: application.userSettings.QueryGridSettings ?? {}, query: application.userSettings.QuerySettings ?? {} }));
            });

            const viewIds = await page.evaluate(async (names) => {
                const service = (document.querySelector('vi-app') as any).service;
                const result: string[] = [];
                for (const name of names)
                    result.push((await service.getQuery(name)).id);

                return result;
            }, VIEW_MATRIX.map(v => v.name));
            expect(viewIds).toContain(PEOPLE_ID);
            expect(viewIds).toContain(TOP10_ID);

            expect(Object.keys(settings.grid).filter(id => viewIds.includes(id))).toEqual([]);
            expect(settings.query[PEOPLE_ID]?.sortOptions).toBe('FirstName ASC');
        }
        finally {
            await context.close();
        }
    });
});
