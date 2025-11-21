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

export async function setupAttribute(
    page: Page,
    componentTag: string,
    attributeName: string
) {
    const componentId = `component-${Math.random().toString(36).substring(2, 15)}`;

    // Wait for the custom element to be defined
    await page.waitForFunction((tag) => !!customElements.get(tag), componentTag, { timeout: 10000 });

    await page.evaluate(async ({ componentTag, componentId, attributeName }) => {
        const randomObjectId = Math.random().toString(36).substring(2, 15);
        const persistentObject = await (window as any).service.getPersistentObject(null, "Mock_Attribute", randomObjectId);
        const attribute = persistentObject.getAttribute(attributeName);

        // Create and add component to the page
        const container = document.getElementById('test-container');
        if (!container)
            throw new Error('Test container not found');

        const component = document.createElement(componentTag);
        component.id = componentId;
        (component as any).attribute = attribute;

        // Store attribute reference by component ID for later operations
        if (!(window as any).attributeMap)
            (window as any).attributeMap = {};
        (window as any).attributeMap[componentId] = attribute;

        container.appendChild(component);
    }, { componentTag, componentId, attributeName });

    return page.locator(`#${componentId}`);
}

export async function beginEdit(page: Page, component: any) {
    const componentId = await component.getAttribute('id');
    await page.evaluate((id) => {
        (window as any).attributeMap[id].parent.beginEdit();
    }, componentId);
}

export async function cancelEdit(page: Page, component: any) {
    const componentId = await component.getAttribute('id');
    await page.evaluate((id) => {
        (window as any).attributeMap[id].parent.cancelEdit();
    }, componentId);
}

export async function save(page: Page, component: any) {
    const componentId = await component.getAttribute('id');
    await page.evaluate(async (id) => {
        await (window as any).attributeMap[id].parent.save();
    }, componentId);
}
