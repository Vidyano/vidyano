import { Page } from '@playwright/test';

export function getTestHtml(customStyles = '') {
    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          :root {
            /* Theme variables needed for components */
            --theme-h1: 40px;
            --theme-h2: 32px;
            --theme-h3: 22px;
            --theme-h4: 12px;
            --theme-h5: 6px;
            --theme-foreground: #333;
            --theme-light-border: #ddd;
            --theme-read-only: #f5f5f5;
            --theme-color-error: #f44336;
            --color: #1a73e8;
            --color-light: #4285f4;
            --color-lighter: #8ab4f8;
            --color-dark: #1557b0;
            --color-faint: rgba(26, 115, 232, 0.1);
          }
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
            body: getTestHtml(customStyles)
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

        // Add calculateAttributeHeight to service hooks
        service.hooks.calculateAttributeHeight = (attribute: any) => {
            // Check for Height in DataTypeHints
            const heightHint = attribute.getTypeHint("Height");
            if (heightHint)
                return parseInt(heightHint, 10);

            if (["CommonMark", "MultiLineString", "MultiString"].includes(attribute.type))
                return 3;
            if (attribute.type === "Image")
                return 2;
            if (attribute.type === "AsDetail")
                return 6;
            return 1;
        };

        // Create a minimal app mock for components that need app.showDialog
        // Includes addEventListener/removeEventListener stubs for component initialization
        (window as any).app = {
            showDialog: async () => null,
            service: service,
            addEventListener: () => {},
            removeEventListener: () => {},
            configuration: {
                getSetting: (_key: string, defaultValue?: string) => defaultValue,
                getAttributeConfig: () => ({ noLabel: false, hasTemplate: false })
            }
        };

        // Set the Symbol reference that components look for in connectedCallback
        (window as any)[Symbol.for("Vidyano.App")] = (window as any).app;
    }, port);
}
