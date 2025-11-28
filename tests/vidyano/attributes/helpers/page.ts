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
    customStyles = '',
    port = 44355
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

    await page.goto(`http://localhost:${port}/test-page`);
    await page.addScriptTag({ path: "dev/wwwroot/index.js", type: 'module' });

    // Wait for Vidyano to load
    await page.waitForFunction(() => typeof (window as any).Vidyano !== 'undefined', { timeout: 10000 });

    // Initialize service once
    await page.evaluate(async (backendPort) => {
        const Service = (window as any).Vidyano.Service;

        const service = new Service(`http://localhost:${backendPort}`);
        await service.initialize();
        (window as any).service = service;

        // Create a minimal app mock for components that need app.showDialog
        // Includes addEventListener/removeEventListener stubs for component initialization
        (window as any).app = {
            showDialog: async () => null,
            service: service,
            addEventListener: () => {},
            removeEventListener: () => {},
            configuration: {
                getSetting: (_key: string, defaultValue?: string) => defaultValue
            }
        };

        // Set the Symbol reference that components look for in connectedCallback
        (window as any)[Symbol.for("Vidyano.App")] = (window as any).app;
    }, port);
}
