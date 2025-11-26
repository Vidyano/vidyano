import { Page } from '@playwright/test';

export async function setupAttribute(
    page: Page,
    componentTag: string,
    attributeName: string,
    options?: { startInEditMode?: boolean; useBackendOpenInEdit?: boolean }
) {
    const componentId = `component-${Math.random().toString(36).substring(2, 15)}`;

    // Wait for the custom element to be defined
    await page.waitForFunction((tag) => !!customElements.get(tag), componentTag, { timeout: 10000 });

    await page.evaluate(async ({ componentTag, componentId, attributeName, startInEditMode, useBackendOpenInEdit }) => {
        // Generate truly unique objectId using timestamp + random to prevent any possibility of collision across tests
        const randomObjectId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
        // Note: The backend is configured with StateBehavior.OpenInEdit, so the object will be in edit mode by default
        // We skip this by default for most tests, unless explicitly requested with useBackendOpenInEdit
        const persistentObject = await (window as any).service.getPersistentObject(null, "Mock_Attribute", randomObjectId);
        const attribute = persistentObject.getAttribute(attributeName);

        // By default, cancel backend's OpenInEdit behavior (unless explicitly requested)
        if (!useBackendOpenInEdit && persistentObject.isEditing)
            persistentObject.cancelEdit();

        // Optionally start in edit mode (for manual testing)
        if (startInEditMode && !persistentObject.isEditing)
            persistentObject.beginEdit();

        // Create and add component to the page
        const container = document.getElementById('test-container');
        if (!container)
            throw new Error('Test container not found');

        const component = document.createElement(componentTag);
        component.id = componentId;
        (component as any).attribute = attribute;

        // Set app reference for components that need app.showDialog
        if ((window as any).app)
            (component as any).app = (window as any).app;

        // Store attribute reference by component ID for later operations
        if (!(window as any).attributeMap)
            (window as any).attributeMap = {};
        (window as any).attributeMap[componentId] = attribute;

        container.appendChild(component);
    }, { componentTag, componentId, attributeName, startInEditMode: options?.startInEditMode, useBackendOpenInEdit: options?.useBackendOpenInEdit });

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
    return await page.evaluate(async (id) => {
        const attribute = (window as any).attributeMap[id];
        await attribute.parent.save();
        return attribute.value;
    }, componentId);
}

export async function freeze(page: Page, component: any) {
    const componentId = await component.getAttribute('id');
    await page.evaluate((id) => {
        const attribute = (window as any).attributeMap[id];
        attribute.parent.freeze();
    }, componentId);
}

export async function unfreeze(page: Page, component: any) {
    const componentId = await component.getAttribute('id');
    await page.evaluate((id) => {
        const attribute = (window as any).attributeMap[id];
        attribute.parent.unfreeze();
    }, componentId);
}

export async function isDirty(page: Page, component: any): Promise<boolean> {
    const componentId = await component.getAttribute('id');
    return await page.evaluate((id) => {
        const attribute = (window as any).attributeMap[id];
        return attribute.parent.isDirty;
    }, componentId);
}

export type BrowseReferenceMockBehavior = 'selectFirst' | 'cancel';

/**
 * Mocks browse reference dialog to automatically search and select from the dialog's query.
 * Uses real backend data by searching the dialog's query and selecting the first result.
 * @param page - Playwright page
 * @param behavior - 'selectFirst' to search and return first item, 'cancel' to return null
 * @param itemSelector - Optional callback that receives items array and context, returns the item to select.
 *                       The function is serialized and executed in the browser context.
 *                       Example: `async (items, ctx) => await items.findAsync(item => item.id !== ctx.currentValue)`
 * @param selectorContext - Optional context object passed to the itemSelector callback (must be serializable)
 */
export async function mockBrowseReference(page: Page, behavior: BrowseReferenceMockBehavior = 'selectFirst', itemSelector?: (items: any[], context: any) => Promise<any> | any, selectorContext?: any) {
    const itemSelectorStr = itemSelector?.toString();

    await page.evaluate(async ({ behavior, itemSelectorStr, selectorContext }) => {
        const app = (window as any).app;
        if (!app)
            throw new Error('window.app is not available');

        app.showDialog = async (dialog: any) => {
            if (behavior === 'cancel')
                return null;

            // Get the query from the dialog and search it to get real backend data
            if (dialog?.query) {
                await dialog.query.search();
                if (dialog.query.items?.length > 0) {
                    const items = dialog.query.items;

                    if (itemSelectorStr) {
                        // Reconstruct the function from its string representation and call it
                        const selector = eval(`(${itemSelectorStr})`);
                        const selected = await selector(items, selectorContext);
                        return selected ? [selected] : null;
                    }

                    // Default: return first item
                    return [items[0]];
                }
            }
            return null;
        };
    }, { behavior, itemSelectorStr, selectorContext });
}
