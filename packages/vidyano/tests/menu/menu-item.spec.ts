import { test, expect, Page } from '@playwright/test';

/**
 * Loads the components with a stub app and renders one vi-menu-item or vi-menu-separator per item.
 * Each item is created in the page by `create(Vidyano, parent)`, parent being a program unit with path "Home".
 */
async function setupPage(page: Page, options: { stickySearch?: boolean } = {}) {
    await page.setContent(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              :not(:defined) { display: none; }
              body { margin: 0; }
              #test-container {
                width: 240px;
                --vi-menu-item-height: 32px;
                --vi-menu-item-gap: 8px;
                --vi-menu-item-padding-left: 16px;
                --vi-menu-program-unit-icon-size: 20px;
                --vi-menu-item-icon-size: 16px;
                --vi-menu-separator-height: 9px;
              }
            </style>
          </head>
          <body>
            <div id="test-container"></div>
          </body>
        </html>
    `);
    await page.addScriptTag({ path: 'dev/wwwroot/index.js', type: 'module' });
    await page.waitForFunction(() => !!customElements.get('vi-menu-item') && !!customElements.get('vi-menu-separator') && !!(window as any).Vidyano, { timeout: 10000 });

    await page.evaluate(({ stickySearch }) => {
        const calls = { cacheRemove: [] as string[], changePath: [] as string[], resetFilter: 0, configure: [] as string[] };
        (window as any).__calls = calls;

        const app = {
            service: {},
            configuration: { getSetting: (key: string, defaultValue: string) => key === 'vi-menu.sticky-search' && stickySearch ? 'true' : defaultValue },
            cacheRemove: (entry: any) => { calls.cacheRemove.push(entry.constructor.name); },
            changePath: (path: string) => { calls.changePath.push(path); },
            addEventListener: () => { },
            removeEventListener: () => { },
        };
        (window as any).app = app;
        (window as any)[Symbol.for('Vidyano.App')] = app;

        // Keep the page where it is: links are followed by the app in a real application
        window.addEventListener('click', e => e.preventDefault(), true);
        document.addEventListener('reset-filter', () => calls.resetFilter++);
        document.addEventListener('vi:configure', (e: CustomEvent) => {
            (window as any).__actions = e.detail;
            calls.configure.push(...e.detail.map((a: any) => a.label));
        });
    }, { stickySearch: !!options.stickySearch });
}

type ItemFactory = (Vidyano: any, parent: { path: string }) => any;

async function addNode(page: Page, id: string, create: ItemFactory, filter = '') {
    await page.evaluate(({ id, create, filter }) => {
        const Vidyano = (window as any).Vidyano;
        const item = new Function('Vidyano', 'parent', `return (${create})(Vidyano, parent);`)(Vidyano, { path: 'Home' });
        const node = document.createElement(item instanceof Vidyano.ProgramUnitItemSeparator ? 'vi-menu-separator' : 'vi-menu-item') as any;
        node.id = id;
        node.item = item;
        node.filter = filter;
        document.getElementById('test-container')!.appendChild(node);
    }, { id, create: create.toString(), filter });

    const node = page.locator(`#${id}`);
    await node.evaluate((n: any) => n.updateComplete);
    return node;
}

const query: ItemFactory = (Vidyano, parent) => new Vidyano.ProgramUnitItemQuery(null, { queries: { People: 'q-people' }, persistentObjects: {} }, { id: '1', name: 'People', title: 'People', query: 'q-people' }, parent);
const persistentObject: ItemFactory = (Vidyano, parent) => new Vidyano.ProgramUnitItemPersistentObject(null, { queries: {}, persistentObjects: { Settings: 'po-settings' } }, { id: '2', name: 'Settings', title: 'Settings', persistentObject: 'po-settings', objectId: '42' }, parent);
const externalUrl: ItemFactory = Vidyano => new Vidyano.ProgramUnitItemUrl(null, { id: '3', name: 'Docs', title: 'Docs', objectId: 'https://www.vidyano.com/docs' });
const internalUrl: ItemFactory = Vidyano => new Vidyano.ProgramUnitItemUrl(null, { id: '4', name: 'Custom', title: 'Custom', objectId: 'Home/Custom' });
const management: ItemFactory = Vidyano => new Vidyano.ProgramUnitItemQuery(null, { queries: {}, persistentObjects: {} }, { id: '5', name: 'Users', title: 'Users', query: 'q-users' }, { path: 'Management' });
const separator: ItemFactory = Vidyano => new Vidyano.ProgramUnitItemSeparator(null, { id: '6', name: 'Separator', title: '' });

test.describe('vi-menu-item', () => {
    test.beforeEach(async ({ page }) => await setupPage(page));

    test('a query item links to its path under the app root', async ({ page }) => {
        const item = await addNode(page, 'item', query);
        const link = item.locator('a.title');

        await expect(link).toHaveAttribute('href', /Home\/People$/);
        // Outside vi-app no root path is set; the link is relative then
        await expect(link).not.toHaveAttribute('href', /^null/);
        await expect(link).not.toHaveAttribute('rel');
        await expect(link).not.toHaveAttribute('target');
        await expect(item.locator('#title')).toHaveText('People');
    });

    test('a persistent object item links to its path with the object id', async ({ page }) => {
        const item = await addNode(page, 'item', persistentObject);

        await expect(item.locator('a.title')).toHaveAttribute('href', /Home\/Settings\/42$/);
    });

    test('an http url item links to its url as external in a new tab', async ({ page }) => {
        const item = await addNode(page, 'item', externalUrl);
        const link = item.locator('a.title');

        await expect(link).toHaveAttribute('href', 'https://www.vidyano.com/docs');
        await expect(link).toHaveAttribute('rel', 'external noopener');
        await expect(link).toHaveAttribute('target', '_blank');
    });

    test('a url item without http keeps its path as is', async ({ page }) => {
        const item = await addNode(page, 'item', internalUrl);
        const link = item.locator('a.title');

        await expect(link).toHaveAttribute('href', 'Home/Custom');
        await expect(link).not.toHaveAttribute('rel');
        await expect(link).not.toHaveAttribute('target');
    });

    test('a click drops the cached query and leaves the filter alone when not filtering', async ({ page }) => {
        const item = await addNode(page, 'item', query);
        await item.locator('#title').click();

        const calls = await page.evaluate(() => (window as any).__calls);
        expect(calls.cacheRemove).toEqual(['AppCacheEntryQuery']);
        expect(calls.resetFilter).toBe(0);
    });

    test('a click drops the cached persistent object', async ({ page }) => {
        const item = await addNode(page, 'item', persistentObject);
        await item.locator('#title').click();

        expect(await page.evaluate(() => (window as any).__calls.cacheRemove)).toEqual(['AppCacheEntryPersistentObject']);
    });

    test('a click while filtering asks the menu to reset its filter', async ({ page }) => {
        const item = await addNode(page, 'item', query, 'peo');
        await item.locator('#title').click();

        expect(await page.evaluate(() => (window as any).__calls.resetFilter)).toBe(1);
    });

    test('a click reaches the app so it can follow the link', async ({ page }) => {
        const item = await addNode(page, 'item', query);
        await page.evaluate(() => document.getElementById('test-container')!.addEventListener('click', () => (window as any).__calls.appClick = true));
        await item.locator('#title').click();

        expect(await page.evaluate(() => (window as any).__calls.appClick)).toBe(true);
    });

    test('the filter highlights its matches in the title', async ({ page }) => {
        const item = await addNode(page, 'item', query, 'eop');

        await expect(item).toBeVisible();
        await expect(item).toHaveAttribute('filtering', '');
        await expect(item.locator('#title')).toHaveText('People');
        await expect(item.locator('#title span.match')).toHaveText('eop');
        await expect(item.locator('#title span.match')).toHaveCSS('color', 'rgb(255, 221, 0)');
    });

    test('the filter hides an item that does not match', async ({ page }) => {
        const item = await addNode(page, 'item', query, 'xyz');

        await expect(item).toHaveAttribute('hidden', '');
        await expect(item).toBeHidden();

        await item.evaluate((n: any) => n.filter = '');
        await expect(item).toBeVisible();
        await expect(item.locator('#title span.match')).toHaveCount(0);
    });

    test('the title row is indented past the program unit icon', async ({ page }) => {
        const item = await addNode(page, 'item', query);

        // padding-left: 16px + 20px + 8px
        await expect(item.locator('a.title')).toHaveCSS('padding-left', '44px');
        await expect(item.locator('a.title')).toHaveCSS('display', 'flex');
    });

    test('ctrl+right-click offers to configure the program unit item', async ({ page }) => {
        const item = await addNode(page, 'item', query);
        await item.locator('#title').click({ button: 'right', modifiers: ['Control'] });

        expect(await page.evaluate(() => (window as any).__calls.configure)).toEqual(['Program unit item: People']);

        const changePath = await page.evaluate(() => {
            (window as any).__actions[0].action();
            return (window as any).__calls.changePath;
        });
        expect(changePath).toEqual(['Management/PersistentObject.68f7b99e-ce10-4d43-80fb-191b6742d53c/People']);
    });

    test('ctrl+right-click offers nothing for management items', async ({ page }) => {
        const item = await addNode(page, 'item', management);
        await item.locator('#title').click({ button: 'right', modifiers: ['Control'] });

        expect(await page.evaluate(() => (window as any).__calls.configure)).toEqual([]);
    });
});

test.describe('vi-menu-item with vi-menu.sticky-search', () => {
    test('a click while filtering keeps the filter', async ({ page }) => {
        await setupPage(page, { stickySearch: true });
        const item = await addNode(page, 'item', query, 'peo');
        await item.locator('#title').click();

        expect(await page.evaluate(() => (window as any).__calls.resetFilter)).toBe(0);
    });
});

test.describe('vi-menu-separator', () => {
    test.beforeEach(async ({ page }) => await setupPage(page));

    test('renders a thin line of the separator height', async ({ page }) => {
        const node = await addNode(page, 'separator', separator);

        const box = await node.boundingBox();
        expect(box!.height).toBe(9);

        const line = node.locator('.line');
        await expect(line).toHaveCSS('height', '1px');
        await expect(line).toHaveCSS('background-color', 'rgba(255, 255, 255, 0.1)');
        await expect(line).toHaveCSS('left', '44px');
        await expect(node.locator('a')).toHaveCount(0);
        await expect(node).toHaveCSS('pointer-events', 'none');
    });

    test('is hidden while the filter is on', async ({ page }) => {
        const node = await addNode(page, 'separator', separator, 'peo');

        await expect(node).toBeHidden();

        await node.evaluate((n: any) => n.filter = '');
        await expect(node).toBeVisible();
    });
});
