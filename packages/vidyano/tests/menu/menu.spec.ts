import { test, expect, Page, Locator } from '@playwright/test';

/**
 * `vi-menu` against a mock app and service, no backend: collapsing and its cookie, hovering the collapsed menu,
 * resizing and its cookie, filtering, the global and the instant search, the label slot and the first-run "Add menu item".
 */

const origin = 'http://localhost:4445';
const globalSearchId = '11111111-2222-3333-4444-555555555555';
const emptyGuid = '00000000-0000-0000-0000-000000000000';

const testHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          :root { --theme-h1: 40px; --theme-h2: 32px; --theme-h3: 22px; --theme-h4: 12px; --theme-h5: 6px; --theme-foreground: #333; --color: #1a73e8; --color-dark: #1557b0; font-size: 16px; }
          :not(:defined) { display: none; }
          body { margin: 0; display: flex; height: 100vh; }
          #test-container { display: flex; height: 100%; }
        </style>
      </head>
      <body>
        <div id="test-container"></div>
      </body>
    </html>`;

interface Options {
    cookies?: Record<string, string>;
    settings?: Record<string, string>;
    globalSearchId?: string;
    instantSearchDelay?: number;
    programUnits?: { name: string; title: string; path: string; items: any[] }[];
    label?: string;
    labelSlot?: boolean;
}

async function setupPage(page: Page, options: Options = {}): Promise<Locator> {
    await page.setViewportSize({ width: 1000, height: 600 });
    await page.route(`${origin}/**`, route => route.fulfill({ contentType: 'text/html', body: testHtml }));
    await page.goto(`${origin}/test-page`);
    await page.addScriptTag({ path: 'dev/wwwroot/index.js', type: 'module' });
    await page.waitForFunction(() => !!customElements.get('vi-menu') && !!(window as any).Vidyano, { timeout: 10000 });

    await page.evaluate(options => {
        const Vidyano = (window as any).Vidyano;

        for (const [key, value] of Object.entries(options.cookies ?? {}))
            Vidyano.cookie(key, value);

        class MockLanguage extends Vidyano.Observable {
            culture = 'en';
            messages = {};
        }

        // Each instant search waits until the test resolves it with resolveSearch
        const searches: { filter: string; resolve: (results: any[]) => void }[] = [];
        (window as any).__searches = searches;
        (window as any).resolveSearch = (index: number, results: any[]) => searches[index].resolve(results);

        class MockService extends Vidyano.Observable {
            isSignedIn = false;
            language = new MockLanguage();
            application = {
                globalSearchId: options.globalSearchId,
                programUnits: options.programUnits ?? [],
                getAttributeValue: (name: string) => name === 'InstantSearchDelay' ? options.instantSearchDelay : undefined
            };
            getTranslatedMessage(key: string) { return key; }
            getInstantSearch(filter: string) { return new Promise(resolve => searches.push({ filter, resolve })); }
        }

        const changedPaths: string[] = [];
        (window as any).__changedPaths = changedPaths;

        const app = {
            service: new MockService(),
            isTracking: false,
            changePath: (path: string) => { changedPaths.push(path); },
            getUrlForPersistentObject: (id: string, objectId: string) => `PersistentObject.${id}/${objectId}`,
            addEventListener: () => { },
            removeEventListener: () => { },
            configuration: {
                getSetting: (key: string, defaultValue?: string) => options.settings?.[key] ?? defaultValue
            }
        };
        (window as any).app = app;
        (window as any)[Symbol.for('Vidyano.App')] = app;

        const menu = document.createElement('vi-menu') as any;
        menu.id = 'menu';
        menu.label = options.label ?? 'My App';
        menu.programUnits = app.service.application.programUnits;
        if (options.labelSlot) {
            const label = document.createElement('span');
            label.slot = 'label';
            label.id = 'custom-label';
            label.textContent = 'Custom label';
            menu.appendChild(label);
        }

        document.getElementById('test-container')!.appendChild(menu);
    }, { ...options, globalSearchId: options.globalSearchId ?? emptyGuid });

    const menu = page.locator('#menu');
    await expect(menu.locator('vi-input-search')).toBeAttached();

    return menu;
}

const cookie = (page: Page, key: string) => page.evaluate(key => (window as any).Vidyano.cookie(key), key);
const prop = (locator: Locator, name: string) => locator.evaluate((e: any, name) => e[name], name);
const searchInput = (menu: Locator) => menu.locator('vi-input-search input');

const programUnits = [
    { name: 'Home', title: 'Home', path: 'Home', items: [] },
    { name: 'Vidyano', title: 'Vidyano', path: 'Management/e683de37-2b39-45e9-9522-ef69c3f0287f', items: [] }
];

test.describe('vi-menu', () => {
    test('the toggle collapses the menu and remembers it in the menu-collapsed cookie', async ({ page }) => {
        const menu = await setupPage(page);
        await expect(menu).not.toHaveAttribute('collapsed');

        await menu.locator('#toggleCollapse').click();
        await expect(menu).toHaveAttribute('collapsed', '');
        expect(await cookie(page, 'menu-collapsed')).toBe('true');
        expect((await menu.boundingBox())!.width).toBe(40);

        await menu.locator('#toggleCollapse').click();
        await expect(menu).not.toHaveAttribute('collapsed');
        expect(await cookie(page, 'menu-collapsed')).toBe('false');
    });

    test('a menu-collapsed cookie starts the menu collapsed', async ({ page }) => {
        const menu = await setupPage(page, { cookies: { 'menu-collapsed': 'true' }, programUnits });
        await expect(menu).toHaveAttribute('collapsed', '');
        expect(await prop(menu.locator('vi-menu-program-unit').first(), 'collapsed')).toBe(true);
    });

    test('hovering the collapsed menu shows it in full and tells the program units', async ({ page }) => {
        const menu = await setupPage(page, { cookies: { 'menu-collapsed': 'true' }, programUnits });
        const unit = menu.locator('vi-menu-program-unit').first();
        expect(await prop(unit, 'hovering')).toBe(false);

        await page.mouse.move(20, 300);
        await expect.poll(() => prop(unit, 'hovering')).toBe(true);
        await expect.poll(async () => (await menu.locator('.container').boundingBox())!.width).toBeGreaterThan(200);

        await page.mouse.move(800, 300);
        await expect.poll(() => prop(unit, 'hovering')).toBe(false);
    });

    test('focus in the search keeps the collapsed menu open until it blurs away from the menu', async ({ page }) => {
        const menu = await setupPage(page, { cookies: { 'menu-collapsed': 'true' }, programUnits });
        const unit = menu.locator('vi-menu-program-unit').first();

        // Right after the menu shows: its initial unfocused search must not count as a blur that closes it later
        await page.mouse.move(20, 300);
        await searchInput(menu).focus();
        await expect(menu).toHaveAttribute('search-focused', '');

        await page.mouse.move(800, 300);
        await page.waitForTimeout(200);
        expect(await prop(unit, 'hovering')).toBe(true);

        await searchInput(menu).blur();
        await expect(menu).not.toHaveAttribute('search-focused');
        await expect.poll(() => prop(unit, 'hovering')).toBe(false);
    });

    test('dragging the resizer resizes the menu, never below its initial width, and remembers it', async ({ page }) => {
        const menu = await setupPage(page);
        const initial = (await menu.boundingBox())!.width;
        const resizer = (await menu.locator('#resizer').boundingBox())!;
        const x = resizer.x + resizer.width / 2, y = resizer.y + resizer.height / 2;

        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 50, y, { steps: 5 });
        await page.mouse.move(x + 100, y, { steps: 5 });
        await expect(menu).toHaveAttribute('is-resizing', '');
        expect(await page.evaluate(() => (window as any).app.isTracking)).toBe(true);
        await page.mouse.up();

        await expect(menu).not.toHaveAttribute('is-resizing');
        expect(await page.evaluate(() => (window as any).app.isTracking)).toBe(false);
        expect((await menu.boundingBox())!.width).toBe(initial + 100);
        expect(await menu.evaluate(e => e.style.getPropertyValue('--vi-menu--expand-width'))).toBe(`${initial + 100}px`);
        expect(await cookie(page, 'menu-width')).toBe(String(initial + 100));

        const wide = (await menu.locator('#resizer').boundingBox())!;
        await page.mouse.move(wide.x + wide.width / 2, y);
        await page.mouse.down();
        await page.mouse.move(wide.x - 300, y, { steps: 5 });
        await page.mouse.up();
        expect((await menu.boundingBox())!.width).toBe(initial);
        expect(await cookie(page, 'menu-width')).toBe(String(initial));
    });

    test('a menu-width cookie sets the width', async ({ page }) => {
        const menu = await setupPage(page, { cookies: { 'menu-width': '400' } });
        expect(await menu.evaluate(e => e.style.getPropertyValue('--vi-menu--expand-width'))).toBe('400px');
        expect((await menu.boundingBox())!.width).toBe(400);
    });

    test('the search filters the program units and reset-filter clears it', async ({ page }) => {
        const menu = await setupPage(page, { programUnits });
        const unit = menu.locator('vi-menu-program-unit').first();

        await searchInput(menu).fill('Hom');
        await expect(menu).toHaveAttribute('filtering', '');
        expect(await prop(unit, 'filter')).toBe('Hom');

        await unit.evaluate(e => e.dispatchEvent(new CustomEvent('reset-filter', { bubbles: true, composed: true })));
        await expect(menu).not.toHaveAttribute('filtering');
        expect(await prop(unit, 'filter')).toBe('');
        await expect(searchInput(menu)).toHaveValue('');
    });

    test('Enter runs the global search and clears the filter', async ({ page }) => {
        const menu = await setupPage(page, { globalSearchId });

        await searchInput(menu).fill('alice');
        await searchInput(menu).press('Enter');

        expect(await page.evaluate(() => (window as any).__changedPaths)).toEqual([`PersistentObject.${globalSearchId}/alice`]);
        await expect(searchInput(menu)).toHaveValue('');
        await expect(menu).not.toHaveAttribute('filtering');
    });

    test('Enter does nothing without a global search', async ({ page }) => {
        const menu = await setupPage(page);

        await searchInput(menu).fill('alice');
        await searchInput(menu).press('Enter');

        expect(await page.evaluate(() => (window as any).__changedPaths)).toEqual([]);
        await expect(searchInput(menu)).toHaveValue('alice');
    });

    test('the hide-search setting hides the search', async ({ page }) => {
        const menu = await setupPage(page, { settings: { 'vi-menu.hide-search': 'True' } });
        await expect(menu).toHaveAttribute('hide-search', '');
        await expect(menu.locator('vi-input-search')).toBeHidden();
    });

    test('instant search shows the results with the matches highlighted as text', async ({ page }) => {
        const menu = await setupPage(page, { instantSearchDelay: 10 });

        await searchInput(menu).fill('(b');
        await expect.poll(() => page.evaluate(() => (window as any).__searches.map((s: any) => s.filter))).toEqual(['(b']);
        await page.evaluate(() => (window as any).resolveSearch(0, [
            { id: 'po1', objectId: '1', breadcrumb: 'Alice (Bob) <img src=x onerror=alert(1)> (b', label: 'Customer' }
        ]));

        const result = menu.locator('.instantSearch a');
        await expect(result).toHaveCount(1);
        await expect(result).toHaveAttribute('href', /PersistentObject\.po1\/1$/);
        await expect(result.locator('.label')).toHaveText('Customer');
        await expect(result.locator('.match')).toHaveText(['(B', '(b']);
        await expect(result.locator('div')).toHaveText('Alice (Bob) <img src=x onerror=alert(1)> (b');
        await expect(result.locator('img')).toHaveCount(0);

        await searchInput(menu).fill('');
        await expect(result).toHaveCount(0);
    });

    test('instant search drops results for a filter that changed meanwhile', async ({ page }) => {
        const menu = await setupPage(page, { instantSearchDelay: 10 });

        await searchInput(menu).fill('al');
        await expect.poll(() => page.evaluate(() => (window as any).__searches.length)).toBe(1);
        await searchInput(menu).fill('ali');
        await expect.poll(() => page.evaluate(() => (window as any).__searches.length)).toBe(2);

        await page.evaluate(() => (window as any).resolveSearch(0, [{ id: 'po1', objectId: '1', breadcrumb: 'Stale', label: 'X' }]));
        await page.waitForTimeout(50);
        await expect(menu.locator('.instantSearch a')).toHaveCount(0);

        await page.evaluate(() => (window as any).resolveSearch(1, [{ id: 'po1', objectId: '2', breadcrumb: 'Alice', label: 'X' }]));
        await expect(menu.locator('.instantSearch a div')).toHaveText('Alice');
    });

    test('an instant search result gets a tooltip only when its text is truncated', async ({ page }) => {
        const menu = await setupPage(page, { instantSearchDelay: 10 });
        const long = 'Alice '.repeat(30).trim();

        await searchInput(menu).fill('al');
        await expect.poll(() => page.evaluate(() => (window as any).__searches.length)).toBe(1);
        await page.evaluate(long => (window as any).resolveSearch(0, [
            { id: 'po1', objectId: '1', breadcrumb: 'Alice', label: 'X' },
            { id: 'po1', objectId: '2', breadcrumb: long, label: 'X' }
        ]), long);

        const results = menu.locator('.instantSearch a');
        await results.nth(0).hover();
        await expect(results.nth(0)).toHaveAttribute('title', '');
        await results.nth(1).hover();
        await expect(results.nth(1)).toHaveAttribute('title', long);
    });

    test('the label shows unless the label slot has content', async ({ page }) => {
        const menu = await setupPage(page, { label: 'My App' });
        await expect(menu.locator('header .label > span')).toHaveText('My App');
        await expect(menu.locator('header .label > span')).toBeVisible();

        const custom = await setupPage(page, { label: 'My App', labelSlot: true });
        await expect(custom.locator('#custom-label')).toBeVisible();
        await expect(custom.locator('header .label > span')).toBeHidden();
    });

    test('the first-run program unit offers to add a menu item', async ({ page }) => {
        const menu = await setupPage(page, { programUnits });
        await expect(menu.locator('#add')).toHaveCount(1);
        await expect(menu.locator('#add')).toHaveText('+ Add menu item');
        expect(await menu.locator('#add').evaluate(e => e.previousElementSibling?.getAttribute('id') ?? (e.previousElementSibling as any)?.item?.name)).toBe('Home');
    });
});
