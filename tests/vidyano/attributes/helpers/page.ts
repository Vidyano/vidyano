import { Page } from '@playwright/test';

export function getAttributeHtml(customStyles = '') {
    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          :not(:defined) { display: none; }
          * { display: block; padding: 1px; }
          ${customStyles}
        </style>
      </head>
      <body>
        <div id="test-container"></div>
      </body>
    </html>
    `;
}

export async function setupPage(
    page: Page,
    customStyles = ''
) {
    // Log browser console messages to the terminal
    page.on('console', msg => {
        const type = msg.type();
        const text = msg.text();
        if (type === 'error')
            console.error(`[Browser] ${text}`);
        else if (type === 'warning')
            console.warn(`[Browser] ${text}`);
        else
            console.log(`[Browser] ${text}`);
    });

    // Serve the test page with a container
    await page.route('**/test-page', route => {
        route.fulfill({
            contentType: 'text/html',
            body: getAttributeHtml(customStyles)
        });
    });

    await page.goto('http://localhost:44355/test-page');
    await page.addScriptTag({ path: "dev/wwwroot/index.js", type: 'module' });

    // Wait for Vidyano to load
    await page.waitForFunction(() => typeof (window as any).Vidyano !== 'undefined', { timeout: 10000 });

    // Initialize service once
    await page.evaluate(async () => {
        const Service = (window as any).Vidyano.Service;

        const service = new Service("http://localhost:44355");
        await service.initialize();
        await service.signInUsingCredentials("admin", "admin");
        (window as any).service = service;
    });
}
