import { test, expect, Page, Locator } from '@playwright/test';

/**
 * `Menu.extend` and `Menu.replace` against a mock app and service, no backend: content added before and after the
 * built-in content of each region, replaced regions, the item regions on every tree node, re-rendering on menu state
 * changes, and disposing.
 */

const origin = 'http://localhost:4445';

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

async function setupPage(page: Page) {
    await page.setViewportSize({ width: 1000, height: 600 });
    await page.route(`${origin}/**`, route => route.fulfill({ contentType: 'text/html', body: testHtml }));
    await page.goto(`${origin}/test-page`);
    await page.addScriptTag({ path: 'dev/wwwroot/index.js', type: 'module' });
    await page.waitForFunction(() => !!customElements.get('vi-menu') && !!(window as any).Vidyano, { timeout: 10000 });

    await page.evaluate(() => {
        const w = window as any;
        const Vidyano = w.Vidyano;
        w.Menu = customElements.get('vi-menu');

        // Keep the menu links from navigating the test page away
        document.addEventListener('click', e => e.preventDefault());

        /** An element with an id and text, as an extension's render function returns it. */
        w.el = (id: string, text = id) => {
            const span = document.createElement('span');
            span.id = id;
            span.textContent = text;
            return span;
        };

        class MockLanguage extends Vidyano.Observable {
            culture = 'en';
            messages = {};
        }

        const unit = new Vidyano.ProgramUnit(null, {}, {
            id: 'pu-sales',
            name: 'Sales',
            title: 'Sales',
            offset: 0,
            openFirst: false,
            items: [
                { id: 'item-open', name: 'Orders\\OpenOrders', title: 'Open orders', objectId: 'https://example.com/open' },
                { id: 'item-customers', name: 'Customers', title: 'Customers', objectId: 'https://example.com/customers' }
            ]
        });

        class MockService extends Vidyano.Observable {
            isSignedIn = false;
            language = new MockLanguage();
            application = { globalSearchId: '00000000-0000-0000-0000-000000000000', programUnits: [unit], getAttributeValue: () => undefined };
            getTranslatedMessage(key: string) { return key; }
        }

        const app = {
            service: new MockService(),
            isTracking: false,
            changePath: () => { },
            addEventListener: () => { },
            removeEventListener: () => { },
            configuration: { getSetting: (_key: string, defaultValue?: string) => defaultValue }
        };
        w.app = app;
        w[Symbol.for('Vidyano.App')] = app;
    });
}

async function addMenu(page: Page): Promise<Locator> {
    await page.evaluate(async () => {
        const w = window as any;
        const menu = document.createElement('vi-menu') as any;
        menu.id = 'menu';
        menu.label = 'My App';
        menu.programUnits = w.app.service.application.programUnits;
        menu.activeProgramUnit = menu.programUnits[0];

        const footer = document.createElement('span');
        footer.slot = 'footer';
        footer.id = 'slotted-footer';
        menu.appendChild(footer);

        document.getElementById('test-container')!.appendChild(menu);
        await menu.updateComplete;
    });

    const menu = page.locator('#menu');
    await expect(menu.locator('header')).toBeAttached();

    return menu;
}

/** The ids of the given elements, and of the menu's built-in parts among them, in document order. */
function order(menu: Locator, ids: string[]): Promise<string[]> {
    return menu.evaluate((menu: any, ids) => {
        const root = menu.shadowRoot as ShadowRoot;
        const found = ids.map(id => ({ id, node: id === 'label' ? root.querySelector('header .label') : id === 'search' ? root.querySelector('vi-input-search') : id === 'program-units' ? root.querySelector('vi-menu-program-unit') : id === 'footer-slot' ? root.querySelector('slot[name="footer"]') : id === 'user' ? root.querySelector('vi-user') : root.getElementById(id) })).filter(f => f.node);
        return found.sort((a, b) => a.node!.compareDocumentPosition(b.node!) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1).map(f => f.id);
    }, ids);
}

test.describe('Menu.extend', () => {
    test.beforeEach(async ({ page }) => await setupPage(page));

    test('adds content after the built-in header, or before it', async ({ page }) => {
        await page.evaluate(() => {
            const w = window as any;
            w.Menu.extend('header', () => w.el('after-header'));
            w.Menu.extend('header', () => w.el('before-header'), { before: true });
        });
        const menu = await addMenu(page);

        await expect(menu.locator('header .label')).toContainText('My App');
        expect(await order(menu, ['before-header', 'label', 'after-header'])).toEqual(['before-header', 'label', 'after-header']);
    });

    test('adds content around the search box', async ({ page }) => {
        await page.evaluate(() => {
            const w = window as any;
            w.Menu.extend('search', () => w.el('after-search'));
            w.Menu.extend('search', () => w.el('before-search'), { before: true });
        });
        const menu = await addMenu(page);

        expect(await order(menu, ['before-search', 'search', 'after-search'])).toEqual(['before-search', 'search', 'after-search']);
    });

    test('adds content before and after the program units', async ({ page }) => {
        await page.evaluate(() => {
            const w = window as any;
            w.Menu.extend('after-items', () => w.el('after-items'));
            w.Menu.extend('before-items', () => w.el('before-items'));
        });
        const menu = await addMenu(page);

        expect(await order(menu, ['after-items', 'program-units', 'before-items'])).toEqual(['before-items', 'program-units', 'after-items']);
    });

    test('adds footer content above the user bar, or before the footer slot', async ({ page }) => {
        await page.evaluate(() => {
            const w = window as any;
            w.Menu.extend('footer', () => w.el('footer-after'));
            w.Menu.extend('footer', () => w.el('footer-before'), { before: true });
        });
        const menu = await addMenu(page);

        expect(await order(menu, ['user', 'footer-after', 'footer-slot', 'footer-before'])).toEqual(['footer-before', 'footer-slot', 'footer-after', 'user']);
    });

    test('adds content around the user bar and the toggle', async ({ page }) => {
        await page.evaluate(() => {
            const w = window as any;
            w.Menu.extend('user', () => w.el('after-user'));
            w.Menu.extend('toggle', () => w.el('after-toggle'));
        });
        const menu = await addMenu(page);

        await expect(menu.locator('vi-user')).toBeAttached();
        expect(await order(menu, ['after-user', 'user'])).toEqual(['user', 'after-user']);
        await expect(menu.locator('#toggleCollapse')).toBeAttached();
        await expect(menu.locator('#after-toggle')).toBeAttached();
    });

    test('several extensions of one region show in the order they were added', async ({ page }) => {
        await page.evaluate(() => {
            const w = window as any;
            w.Menu.extend('footer', () => w.el('first'));
            w.Menu.extend('footer', () => w.el('second'));
        });
        const menu = await addMenu(page);

        expect(await order(menu, ['second', 'first'])).toEqual(['first', 'second']);
    });

    test('a menu that already shows picks up a new extension, and drops it on dispose', async ({ page }) => {
        const menu = await addMenu(page);

        await page.evaluate(() => {
            const w = window as any;
            w.dispose = w.Menu.extend('footer', () => w.el('late'));
        });
        await expect(menu.locator('#late')).toBeAttached();

        await page.evaluate(() => (window as any).dispose());
        await expect(menu.locator('#late')).toHaveCount(0);
    });

    test('an extension that throws is logged and skipped; the rest of every menu still renders', async ({ page }) => {
        const errors: string[] = [];
        page.on('console', message => message.type() === 'error' && errors.push(message.text()));

        await page.evaluate(() => {
            const w = window as any;
            w.Menu.extend('footer', () => { throw new Error('footer boom'); });
            w.Menu.extend('footer', () => w.el('after-boom'));
            w.Menu.extend('item-end', () => { throw new Error('item boom'); });
        });
        const menu = await addMenu(page);

        await expect(menu.locator('header .label')).toContainText('My App');
        await expect(menu.locator('#after-boom')).toBeAttached();
        await expect(menu.locator('vi-menu-item').first()).toBeAttached();
        await expect.poll(() => errors.some(e => e.includes('footer boom')) && errors.some(e => e.includes('item boom'))).toBe(true);
    });

    test('the render function gets the menu and follows its state', async ({ page }) => {
        await page.evaluate(() => {
            const w = window as any;
            w.Menu.extend('header', (menu: any) => w.el('state', `${menu === document.getElementById('menu')} ${menu.collapsed ? 'collapsed' : 'open'} ${menu.filter || '-'}`));
        });
        const menu = await addMenu(page);
        const state = menu.locator('#state');

        await expect(state).toHaveText('true open -');

        await menu.evaluate(async (m: any) => { m.collapsed = true; m.filter = 'sal'; await m.updateComplete; });
        await expect(state).toHaveText('true collapsed sal');
    });

    test('a render function may return nothing, a string or a Lit template result', async ({ page }) => {
        await page.evaluate(() => {
            const w = window as any;
            w.Menu.extend('footer', () => null);
            w.Menu.extend('footer', () => 'plain text');
        });
        const menu = await addMenu(page);

        await expect(menu.locator('footer')).toContainText('plain text');
    });

    test('an unknown region throws', async ({ page }) => {
        const error = await page.evaluate(() => {
            try {
                (window as any).Menu.extend('nowhere', () => null);
                return null;
            }
            catch (e) {
                return String(e);
            }
        });

        expect(error).toContain('nowhere');
    });
});

test.describe('Menu.replace', () => {
    test.beforeEach(async ({ page }) => await setupPage(page));

    test('replaces the built-in header and brings it back on dispose', async ({ page }) => {
        await page.evaluate(() => {
            const w = window as any;
            w.dispose = w.Menu.replace('header', () => w.el('my-header'));
        });
        const menu = await addMenu(page);

        await expect(menu.locator('#my-header')).toBeAttached();
        await expect(menu.locator('header .label')).toHaveCount(0);

        await page.evaluate(() => (window as any).dispose());
        await expect(menu.locator('#my-header')).toHaveCount(0);
        await expect(menu.locator('header .label')).toContainText('My App');
    });

    test('keeps the extensions of a replaced region', async ({ page }) => {
        await page.evaluate(() => {
            const w = window as any;
            w.Menu.replace('header', () => w.el('my-header'));
            w.Menu.extend('header', () => w.el('env'));
        });
        const menu = await addMenu(page);

        expect(await order(menu, ['env', 'my-header'])).toEqual(['my-header', 'env']);
    });

    test('the last replacement wins, and disposing it brings back the one before', async ({ page }) => {
        await page.evaluate(() => {
            const w = window as any;
            w.Menu.replace('user', () => w.el('first-user'));
            w.dispose = w.Menu.replace('user', () => w.el('second-user'));
        });
        const menu = await addMenu(page);

        await expect(menu.locator('#second-user')).toBeAttached();
        await expect(menu.locator('#first-user')).toHaveCount(0);
        await expect(menu.locator('vi-user')).toHaveCount(0);

        await page.evaluate(() => (window as any).dispose());
        await expect(menu.locator('#first-user')).toBeAttached();
    });

    test('disposing a repeated replacement removes that registration, not an earlier one of the same function', async ({ page }) => {
        await page.evaluate(() => {
            const w = window as any;
            const same = () => w.el('same-user');
            w.Menu.replace('user', same);
            w.Menu.replace('user', () => w.el('other-user'));
            w.dispose = w.Menu.replace('user', same);
        });
        const menu = await addMenu(page);
        await expect(menu.locator('#same-user')).toBeAttached();

        await page.evaluate(() => (window as any).dispose());
        await expect(menu.locator('#other-user')).toBeAttached();
        await expect(menu.locator('#same-user')).toHaveCount(0);
    });

    test('replaces the search box and the toggle', async ({ page }) => {
        await page.evaluate(() => {
            const w = window as any;
            w.Menu.replace('search', () => w.el('my-search'));
            w.Menu.replace('toggle', () => w.el('my-toggle'));
        });
        const menu = await addMenu(page);

        await expect(menu.locator('vi-input-search')).toHaveCount(0);
        await expect(menu.locator('#my-search')).toBeAttached();
        await expect(menu.locator('#toggleCollapse')).toHaveCount(0);
        await expect(menu.locator('#my-toggle')).toBeAttached();
    });

    test('regions without built-in content cannot be replaced', async ({ page }) => {
        const errors = await page.evaluate(() => ['footer', 'before-items', 'after-items', 'item-start', 'item-end'].map(region => {
            try {
                (window as any).Menu.replace(region, () => null);
                return null;
            }
            catch (e) {
                return String(e);
            }
        }));

        expect(errors.every(e => e !== null)).toBe(true);
    });
});

test.describe('Menu.extend item regions', () => {
    test.beforeEach(async ({ page }) => await setupPage(page));

    test('a click in an item region stays with the extension: it is not inside the row link and does not navigate', async ({ page }) => {
        await page.evaluate(() => {
            const w = window as any;
            w.clicks = 0;
            w.Menu.extend('item-end', (_menu: any, item: any) => {
                if (item.name !== 'Customers')
                    return null;

                // A plain button, without preventDefault or stopPropagation
                const button = document.createElement('button');
                button.id = 'region-button';
                button.onclick = () => w.clicks++;
                return button;
            });
        });
        const menu = await addMenu(page);
        await menu.evaluate(async (m: any) => { m.filter = 'Cust'; await m.updateComplete; });

        const button = menu.locator('#region-button');
        await button.click();

        expect(await page.evaluate(() => (window as any).clicks)).toBe(1);
        expect(await button.evaluate(b => !!b.closest('a'))).toBe(false);
        expect(await menu.evaluate((m: any) => m.filter)).toBe('Cust');
    });

    test('item regions and icons can be styled from outside with ::part', async ({ page }) => {
        await page.addStyleTag({ content: 'vi-menu::part(item-end) { outline: 3px solid rgb(255, 0, 0); } vi-menu::part(icon) { outline: 3px solid rgb(0, 0, 255); }' });
        await page.evaluate(() => {
            const w = window as any;
            w.Menu.extend('item-end', (_menu: any, item: any) => item.name === 'Customers' ? w.el('styled') : null);
        });
        const menu = await addMenu(page);

        const region = menu.locator('vi-menu-item').filter({ has: page.locator('#styled') }).locator('.item-end');
        await expect(region).toHaveCSS('outline-color', 'rgb(255, 0, 0)');
        await expect(menu.locator('vi-menu-program-unit').first().locator('vi-icon').first()).toHaveCSS('outline-color', 'rgb(0, 0, 255)');
    });

    test('decorates every tree node with its own item', async ({ page }) => {
        await page.evaluate(() => {
            const w = window as any;
            w.Menu.extend('item-end', (menu: any, item: any) => menu?.tagName === 'VI-MENU' ? w.el(`end-${item.id}`, item.title) : null);
            w.Menu.extend('item-start', (_menu: any, item: any) => item.name === 'Customers' ? w.el('pin') : null);
        });
        const menu = await addMenu(page);

        // The program unit, its group and both items
        await expect(menu.locator('vi-menu-program-unit #end-pu-sales')).toBeAttached();
        await expect(menu.locator('vi-menu-group span[id^="end-"]').first()).toBeAttached();
        await expect(menu.locator('vi-menu-item #end-item-customers')).toBeAttached();
        await expect(menu.locator('vi-menu-item #end-item-open')).toBeAttached();
        await expect(menu.locator('#pin')).toHaveCount(1);
    });

    test('item-start goes before the icon and item-end after the title, inside the row', async ({ page }) => {
        await page.evaluate(() => {
            const w = window as any;
            w.Menu.extend('item-start', (_menu: any, item: any) => item.name === 'Customers' ? w.el('start') : null);
            w.Menu.extend('item-end', (_menu: any, item: any) => item.name === 'Customers' ? w.el('end') : null);
        });
        const menu = await addMenu(page);
        const item = menu.locator('vi-menu-item').filter({ has: page.locator('#end') });

        // In the row, next to the link rather than inside it
        const parts = await item.evaluate((el: any) => Array.from(el.shadowRoot.querySelector('.item').querySelectorAll('#start, .title, #end')).map((n: any) => n.id || n.className));
        expect(parts).toEqual(['start', 'title', 'end']);
        expect(await item.evaluate((el: any) => !!el.shadowRoot.querySelector('a.link #start, a.link #end'))).toBe(false);
    });

    test('item regions follow the menu state', async ({ page }) => {
        await page.evaluate(() => {
            const w = window as any;
            w.Menu.extend('item-end', (menu: any, item: any) => item.name === 'Customers' ? w.el('badge', menu.collapsed && !menu.hovering ? 'dot' : '12') : null);
        });
        const menu = await addMenu(page);
        const badge = menu.locator('#badge');

        await expect(badge).toHaveText('12');

        await menu.evaluate(async (m: any) => { m.collapsed = true; await m.updateComplete; });
        await expect(badge).toHaveText('dot');
    });

    test('a new item extension shows on a menu that already shows, and goes on dispose', async ({ page }) => {
        const menu = await addMenu(page);

        await page.evaluate(() => {
            const w = window as any;
            w.dispose = w.Menu.extend('item-end', (_menu: any, item: any) => item.name === 'Customers' ? w.el('late-badge') : null);
        });
        await expect(menu.locator('#late-badge')).toBeAttached();

        await page.evaluate(() => (window as any).dispose());
        await expect(menu.locator('#late-badge')).toHaveCount(0);
    });
});
