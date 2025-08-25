import { test as base, expect, Page, Locator } from '@playwright/test';
import { navigateToPage, getAttribute, getActionButtons } from './navigation';

export interface AttributeTestContext {
    page: Page;
    attributeElement: Locator;
    actions: Record<string, Locator>;
}

export const attributeTest = base.extend<{}, { attributeContext: AttributeTestContext }>({
    attributeContext: [async ({}, use) => {
        const context: AttributeTestContext = {
            page: null as any,
            attributeElement: null as any,
            actions: {}
        };
        
        await use(context);
    }, { scope: 'worker' }]
});

export function createAttributeTestSuite(
    attributeName: string,
    persistentObjectId: string = '1cc61676-3aa6-450f-884b-bdc425c7b232'
) {
    let page: Page;
    let attributeElement: Locator;
    let actions: Record<string, Locator>;

    attributeTest.beforeAll(async ({ browser }) => {
        page = await browser.newPage();
        
        const url = `http://localhost:5000/attributes/persistent-object.${persistentObjectId}/${attributeName}`;
        await navigateToPage(page, url);
        
        attributeElement = await getAttribute(page, attributeName);
        actions = await getActionButtons(page);
    });

    attributeTest.beforeEach(async () => {
        await page.evaluate(async () => {
            const service = (window as any).app?.service;
            if (service && service.application) {
                await service.executeAction("PersistentObject.ResetTest", service.application);
            }
        });

        await page.reload();
        await page.waitForLoadState('networkidle');
        
        await page.waitForTimeout(500);
        
        attributeElement = await getAttribute(page, attributeName);
        actions = await getActionButtons(page);
    });

    attributeTest.afterAll(async () => {
        await page.close();
    });

    attributeTest('attribute can toggle between edit and non-edit', async () => {
        const element = attributeElement;
        
        await expect(element, 'Attribute element should be visible').toBeVisible();
        
        expect(actions['Edit'], 'Edit action should be defined').toBeDefined();
        expect(actions['EndEdit'], 'EndEdit action should be defined').toBeDefined();
        expect(actions['CancelEdit'], 'CancelEdit action should be defined').toBeDefined();
        
        await expect(actions['Edit'], 'Edit button should be hidden in edit mode').not.toBeVisible();
        await expect(actions['CancelEdit'], 'CancelEdit button should be visible in edit mode').toBeVisible();
        await expect(actions['EndEdit'], 'EndEdit button should be visible in edit mode').toBeVisible();
        await expect(actions['EndEdit'], 'EndEdit should be disabled when no changes').toHaveAttribute('disabled', '');
        
        await actions['CancelEdit'].click();
        await expect(actions['Edit'], 'Edit button should be visible after canceling edit').toBeVisible();
        await expect(actions['CancelEdit'], 'CancelEdit should be hidden in view mode').not.toBeVisible();
        await expect(actions['EndEdit'], 'EndEdit should be hidden in view mode').not.toBeVisible();
        
        await actions['Edit'].click();
        await expect(actions['CancelEdit'], 'CancelEdit should be visible after entering edit mode').toBeVisible();
        await expect(actions['EndEdit'], 'EndEdit should be visible after entering edit mode').toBeVisible();
        await expect(actions['Edit'], 'Edit button should be hidden after entering edit mode').not.toBeVisible();
    });

    return {
        getPage: () => page,
        getAttributeElement: () => attributeElement,
        getActions: () => actions
    };
}