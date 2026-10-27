import { test, expect, Page, Locator } from '@playwright/test';

const pageHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          :not(:defined) { display: none; }
          body { margin: 0; }
          #test-container {
            width: 280px;
            --vi-menu-item-height: 36px;
            --vi-menu-item-gap: 8px;
            --vi-menu-item-padding-left: 12px;
            --vi-menu-item-padding-right: 12px;
            --vi-menu-item-icon-size: 16px;
            --vi-menu-program-unit-icon-size: 20px;
            --vi-menu-program-unit-spacing: 4px;
            --vi-menu-collapsed-width: 56px;
            --vi-menu-group-indent: 16px;
          }
        </style>
      </head>
      <body>
        <div id="test-container"></div>
      </body>
    </html>
`;

async function setupPage(page: Page) {
    await page.setContent(pageHtml);
    await page.addScriptTag({ path: 'dev/wwwroot/index.js', type: 'module' });
    await page.waitForFunction(() => !!customElements.get('vi-menu-program-unit') && !!(window as any).Vidyano, { timeout: 10000 });

    // Keep the links from navigating the test page away
    await page.evaluate(() => document.addEventListener('click', e => e.preventDefault()));
}

/**
 * Adds a vi-menu-program-unit for a "Sales" program unit holding an "Orders" group (with "Open orders") and a "Customers" item.
 */
async function addProgramUnit(page: Page, options: { active?: boolean; collapsed?: boolean; hovering?: boolean; filter?: string; path?: string | null } = {}): Promise<Locator> {
    await page.evaluate(async options => {
        const Vidyano = (window as any).Vidyano;
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
        if (options.path !== undefined)
            unit.path = options.path ?? undefined;

        const element = document.createElement('vi-menu-program-unit') as any;
        element.id = 'pu';
        element.item = unit;
        element.activeProgramUnit = options.active ? unit : null;
        element.collapsed = !!options.collapsed;
        element.hovering = !!options.hovering;
        element.filter = options.filter ?? '';

        document.getElementById('test-container')!.appendChild(element);
        await element.updateComplete;
    }, options);

    return page.locator('vi-menu-program-unit#pu');
}

/**
 * The program unit's own element: the nested groups render the same ids and classes further down.
 */
function own(pu: Locator, selector: string): Locator {
    return pu.locator(selector).first();
}

function setProperty(pu: Locator, name: string, value: any) {
    return pu.evaluate(async (el: any, { name, value }) => {
        el[name] = value === '$item' ? el.item : value;
        await el.updateComplete;
    }, { name, value });
}

test.describe('vi-menu-program-unit', () => {
    test.beforeEach(async ({ page }) => {
        await setupPage(page);
    });

    test('is expanded while its program unit is the active one', async ({ page }) => {
        const pu = await addProgramUnit(page, { active: true });
        await expect(pu).toHaveAttribute('expanded', '');
        await expect(own(pu, '#subItems')).toHaveAttribute('open', '');

        await setProperty(pu, 'activeProgramUnit', null);
        await expect(pu).not.toHaveAttribute('expanded');
        await expect(own(pu, '#subItems')).not.toHaveAttribute('open');

        await setProperty(pu, 'activeProgramUnit', '$item');
        await expect(pu).toHaveAttribute('expanded', '');
    });

    test('closing blurs a focused child, however deep in the nested shadow roots', async ({ page }) => {
        const pu = await addProgramUnit(page, { active: true });
        const link = pu.locator('vi-menu-item').filter({ hasText: 'Customers' }).locator('a.title');
        await link.focus();
        await expect.poll(() => link.evaluate(a => (a.getRootNode() as ShadowRoot).activeElement === a)).toBe(true);

        // Blurred before the children are hidden, by the program unit itself
        const blurredBeforeClose = await pu.evaluate(async (el: any) => {
            const item = [...el.shadowRoot.querySelectorAll('vi-menu-item')].find((i: any) => i.item.title === 'Customers');
            const a = item.shadowRoot.querySelector('a.title');
            let blurred = false;
            a.addEventListener('blur', () => blurred = true, { once: true });
            el.expanded = false;
            await el.updateComplete;
            return blurred && !el.shadowRoot.getElementById('subItems').hasAttribute('open');
        });
        expect(blurredBeforeClose).toBe(true);
    });

    test('renders its children as group and item nodes', async ({ page }) => {
        const pu = await addProgramUnit(page, { active: true });
        await expect(pu.locator('vi-menu-group')).toHaveCount(1);
        await expect(pu.locator('vi-menu-item').filter({ hasText: 'Customers' })).toHaveCount(1);
    });

    test('closes its children to zero height when not expanded', async ({ page }) => {
        const pu = await addProgramUnit(page);
        await expect.poll(() => own(pu, '#subItems').evaluate(el => el.getBoundingClientRect().height)).toBe(0);
        await expect(own(pu, '#subItems')).toHaveAttribute('inert', '');

        await setProperty(pu, 'expanded', true);
        await expect.poll(() => own(pu, '#subItems').evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThan(0);
        await expect(own(pu, '#subItems')).not.toHaveAttribute('inert');
    });

    test('shows only its icon while the menu is collapsed and not hovered', async ({ page }) => {
        const pu = await addProgramUnit(page, { active: true, collapsed: true });
        await expect(own(pu, 'a.title vi-icon')).toBeVisible();
        await expect(own(pu, '#title')).toBeHidden();
        await expect(own(pu, '#subItems')).not.toHaveAttribute('open');

        await setProperty(pu, 'hovering', true);
        await expect(own(pu, '#title')).toBeVisible();
        await expect(own(pu, '#title')).toHaveText('Sales');
        await expect(own(pu, '#subItems')).toHaveAttribute('open', '');
    });

    test('opens and highlights matches while filtering', async ({ page }) => {
        const pu = await addProgramUnit(page, { filter: 'open' });
        await expect(pu).toHaveAttribute('filtering', '');
        await expect(own(pu, '#subItems')).toHaveAttribute('open', '');
        await expect(pu).toBeVisible();

        await setProperty(pu, 'filter', 'sal');
        await expect(own(pu, '#title span.match')).toHaveText('Sal');

        await setProperty(pu, 'filter', 'nothing matches');
        await expect(pu).toBeHidden();
    });

    test('toggles expanded on click when it has no path', async ({ page }) => {
        const pu = await addProgramUnit(page, { path: null });
        await expect(own(pu, 'a.title')).not.toHaveAttribute('href');

        await own(pu, 'a.title').click();
        await expect(pu).toHaveAttribute('expanded', '');

        await own(pu, 'a.title').click();
        await expect(pu).not.toHaveAttribute('expanded');
    });

    test('links to its path and stays expanded on click when it has one', async ({ page }) => {
        const pu = await addProgramUnit(page, { active: true });
        await expect(own(pu, 'a.title')).toHaveAttribute('href', /sales$/);

        await own(pu, 'a.title').click();
        await expect(pu).toHaveAttribute('expanded', '');
    });

    test('collapses its groups on click', async ({ page }) => {
        const pu = await addProgramUnit(page, { active: true });
        const group = pu.locator('vi-menu-group');
        await group.evaluate(async (el: any) => {
            el.expanded = true;
            await el.updateComplete;
        });
        await expect(group).toHaveAttribute('expanded', '');

        await own(pu, 'a.title').click();
        await expect(group).not.toHaveAttribute('expanded');
        await expect(pu).toHaveAttribute('expanded', '');
    });

    test('keeps its groups open on click while filtering', async ({ page }) => {
        const pu = await addProgramUnit(page, { active: true, path: null });
        const group = pu.locator('vi-menu-group');
        await group.evaluate(async (el: any) => {
            el.expanded = true;
            await el.updateComplete;
        });
        await setProperty(pu, 'filter', 'orders');

        await own(pu, 'a.title').click();
        await expect(group).toHaveAttribute('expanded', '');
    });

    test('offers the program unit on the configure menu', async ({ page }) => {
        const pu = await addProgramUnit(page);
        const labels = await pu.evaluate((el: HTMLElement) => {
            const e = new MouseEvent('contextmenu', { ctrlKey: true, bubbles: true, composed: true, cancelable: true });
            el.dispatchEvent(e);
            return ((e as any)['vi:configure'] ?? []).map((item: any) => [item.label, ...Array.from(item.children ?? []).map((child: any) => child.label)]);
        });
        expect(labels).toEqual([['Program unit: Sales', 'Add Query']]);
    });

    test('offers no configure menu without a path', async ({ page }) => {
        const pu = await addProgramUnit(page, { path: null });
        const configure = await pu.evaluate((el: HTMLElement) => {
            const e = new MouseEvent('contextmenu', { ctrlKey: true, bubbles: true, composed: true, cancelable: true });
            el.dispatchEvent(e);
            return (e as any)['vi:configure'] ?? null;
        });
        expect(configure).toBeNull();
    });
});
