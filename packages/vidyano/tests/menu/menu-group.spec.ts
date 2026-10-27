import { test, expect, Page } from '@playwright/test';

/**
 * Builds this tree in the page and renders its top group as vi-menu-group#group:
 *
 *   Reports (group)
 *     Sales
 *     Archive (group)
 *       Old sales
 *       Old orders
 *   Orders
 */
async function setupPage(page: Page) {
    await page.setContent(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              :not(:defined) { display: none; }
              body { margin: 0; --vi-menu-item-height: 32px; }
            </style>
          </head>
          <body>
            <div id="test-container"></div>
          </body>
        </html>
    `);
    await page.addScriptTag({ path: 'dev/wwwroot/index.js', type: 'module' });
    await page.waitForFunction(() => !!customElements.get('vi-menu-group'), { timeout: 10000 });

    await page.evaluate(() => {
        const Vidyano = (window as any).Vidyano;
        const url = (name: string, title: string) => new Vidyano.ProgramUnitItemUrl(null, { id: name, name, title, objectId: `https://example.com/${name}` });
        const group = (name: string, title: string, items: any[]) => new Vidyano.ProgramUnitItemGroup(null, { id: name, name, title }, items);

        const archive = group('Archive', 'Archive', [url('OldSales', 'Old sales'), url('OldOrders', 'Old orders')]);
        const reports = group('Reports', 'Reports', [url('Sales', 'Sales'), archive]);

        const element = document.createElement('vi-menu-group') as any;
        element.id = 'group';
        element.item = reports;
        document.getElementById('test-container')!.appendChild(element);
    });

    const group = page.locator('vi-menu-group#group');
    await expect(group.locator('#title').first()).toHaveText('Reports');

    return group;
}

function child(group: ReturnType<Page['locator']>, title: string) {
    return group.locator('.sub-items vi-menu-item, .sub-items vi-menu-group').filter({ has: group.page().locator('#title', { hasText: new RegExp(`^${title}$`) }) }).first();
}

function nested(group: ReturnType<Page['locator']>) {
    return group.locator('vi-menu-group');
}

test.describe('vi-menu-group', () => {
    test('starts collapsed with its children hidden', async ({ page }) => {
        const group = await setupPage(page);

        await expect(group).not.toHaveAttribute('expanded');
        await expect(group.locator('vi-menu-item').first()).toBeHidden();
    });

    test('a click on the title toggles the children', async ({ page }) => {
        const group = await setupPage(page);
        const title = group.locator('a.title').first();

        await title.click();
        await expect(group).toHaveAttribute('expanded', '');
        await expect(group.locator('vi-menu-item').first()).toBeVisible();
        await expect(nested(group)).toBeVisible();

        await title.click();
        await expect(group).not.toHaveAttribute('expanded');
        await expect(group.locator('vi-menu-item').first()).toBeHidden();
    });

    test('the title click does not navigate but still bubbles', async ({ page }) => {
        const group = await setupPage(page);
        await page.evaluate(() => {
            (window as any).__clicks = [];
            document.getElementById('test-container')!.addEventListener('click', e => (window as any).__clicks.push(e.defaultPrevented));
        });

        await group.locator('a.title').first().click();
        expect(await page.evaluate(() => (window as any).__clicks)).toEqual([true]);
        expect(await group.locator('a.title').first().getAttribute('href')).toBeNull();
    });

    test('nested groups toggle on their own', async ({ page }) => {
        const group = await setupPage(page);
        await group.locator('a.title').first().click();

        const archive = nested(group);
        const oldSales = archive.locator('vi-menu-item').first();
        await expect(oldSales).toBeHidden();

        await archive.locator('a.title').first().click();
        await expect(archive).toHaveAttribute('expanded', '');
        await expect(oldSales).toBeVisible();
        await expect(group).toHaveAttribute('expanded', '');
    });

    test('collapseAll collapses the group and every nested group', async ({ page }) => {
        const group = await setupPage(page);
        await group.locator('a.title').first().click();
        await nested(group).locator('a.title').first().click();
        await expect(nested(group)).toHaveAttribute('expanded', '');

        await group.evaluate((node: any) => node.collapseAll());

        await expect(group).not.toHaveAttribute('expanded');
        await expect(nested(group)).not.toHaveAttribute('expanded');
        await expect(group.locator('vi-menu-item').first()).toBeHidden();
    });

    test('filtering shows the matching children without expanding', async ({ page }) => {
        const group = await setupPage(page);

        await group.evaluate((node: any) => node.filter = 'old o');

        await expect(group).toHaveAttribute('filtering', '');
        await expect(group).not.toHaveAttribute('expanded');
        await expect(group).toBeVisible();
        await expect(child(nested(group), 'Old orders')).toBeVisible();
        await expect(child(nested(group), 'Old sales')).toBeHidden();
        await expect(child(group, 'Sales')).toBeHidden();
        await expect(nested(group).locator('span.match')).toHaveText(['Old o']);

        await group.evaluate((node: any) => node.filter = '');
        await expect(group.locator('vi-menu-item').first()).toBeHidden();
    });

    test('children of a group whose title matches stay visible', async ({ page }) => {
        const group = await setupPage(page);

        await group.evaluate((node: any) => node.filter = 'archive');

        const archive = nested(group);
        await expect(archive).toBeVisible();
        await expect(archive.locator('span.match')).toHaveText(['Archive']);
        await expect(child(archive, 'Old sales')).toBeVisible();
        await expect(child(archive, 'Old orders')).toBeVisible();
        await expect(child(group, 'Sales')).toBeHidden();
    });

    test('a group that matches nothing hides itself', async ({ page }) => {
        const group = await setupPage(page);

        await group.evaluate((node: any) => node.filter = 'nothing matches this');
        await expect(group).toBeHidden();
    });

    test('selecting a nested item expands its groups', async ({ page }) => {
        const group = await setupPage(page);

        await page.evaluate(() => (window as any).Vidyano.ServiceBus.send('vi-menu-item:select', { name: 'OldOrders' }));

        await expect(group).toHaveAttribute('expanded', '');
        await expect(nested(group)).toHaveAttribute('expanded', '');
        await expect(child(nested(group), 'Old orders')).toBeVisible();
    });

    test('closing blurs a focused child', async ({ page }) => {
        const group = await setupPage(page);
        await group.locator('a.title').first().click();
        await nested(group).locator('a.title').first().focus();

        await group.evaluate((node: any) => node.expanded = false);

        await expect.poll(() => nested(group).evaluate((node: any) => node.shadowRoot.activeElement)).toBeNull();
        await expect.poll(() => group.evaluate((node: any) => node.shadowRoot.activeElement)).toBeNull();
    });
});
