import { test, expect, Page } from '@playwright/test';

const popupHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          :not(:defined) { display: none; }
          body { margin: 0; }
          #test-container { padding: 20px; }
          #toggle { width: 120px; height: 30px; }
          #item { width: 200px; height: 40px; }
        </style>
      </head>
      <body>
        <div id="test-container">
          <vi-popup id="menu">
            <div slot="header" id="toggle">Open</div>
            <div id="item">Item</div>
          </vi-popup>
        </div>
      </body>
    </html>
`;

async function setupPage(page: Page) {
    await page.clock.install();
    await page.setContent(popupHtml);
    await page.addScriptTag({ path: 'dev/wwwroot/index.js', type: 'module' });
    await page.waitForFunction(() => !!customElements.get('vi-popup'), { timeout: 10000 });
    await page.evaluate(() => document.getElementById('item')!.addEventListener('click', () => (document.getElementById('menu') as any).close()));
    // From here on the popup's timers only run through page.clock.runFor
    await page.clock.pauseAt(await page.evaluate(() => Date.now()) + 1000);
}

test.describe('Popup', () => {
    test('a popup closed from its content stays open when it is opened again', async ({ page }) => {
        await setupPage(page);
        const popup = page.locator('vi-popup#menu');

        await page.locator('#toggle').click();
        await expect(popup).toHaveAttribute('open', '');

        await page.locator('#item').click();
        await expect(popup).not.toHaveAttribute('open');

        // The content is gone from under the mouse, so the next move leaves it
        await page.mouse.move(600, 400);
        await page.locator('#toggle').click();
        await expect(popup).toHaveAttribute('open', '');

        const closeDelay = await popup.evaluate((p: any) => p.closeDelay);
        await page.clock.runFor(closeDelay + 100);
        await expect(popup).toHaveAttribute('open', '');
    });
});
