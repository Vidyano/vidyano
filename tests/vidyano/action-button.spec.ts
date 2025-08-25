import { test, expect, Page, Locator } from '@playwright/test';
import { Service } from '@vidyano/core';
import { navigateToPage, getActionButtons } from './helpers/navigation';

test.describe('Action Buttons', () => {
    test.describe.configure({ mode: 'serial' });
    
    let page: Page;
    let actions: Record<string, Locator> = {};

    test.beforeAll(async ({ browser }) => {
        page = await browser.newPage();
        // Initial navigation
        await navigateToPage(page, 'http://localhost:5000/home/person/1');
        actions = await getActionButtons(page);
    });

    test.beforeEach(async () => {
        // Reload the page to reset state between tests
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        // Get all action buttons again after reload
        actions = await getActionButtons(page);
    });

    test.afterAll(async () => {
        await page.close();
    });

    test('has Edit, EndEdit and CancelEdit actions', async () => {
        // Check if the expected actions are present
        expect(actions['Edit']).toBeDefined();
        expect(actions['EndEdit']).toBeDefined();
        expect(actions['CancelEdit']).toBeDefined();
    });


    test('can toggle between edit and view modes', async () => {
        // Page starts in view mode - verify initial state
        await expect(actions['Edit']).toBeVisible();
        await expect(actions['CancelEdit']).not.toBeVisible();
        await expect(actions['EndEdit']).not.toBeVisible();
        
        // Click Edit to enter edit mode
        await actions['Edit'].click();
        
        // Wait for CancelEdit to become visible
        await expect(actions['CancelEdit']).toBeVisible();
        
        // Verify we're now in edit mode
        await expect(actions['EndEdit']).toBeVisible();
        await expect(actions['EndEdit']).toHaveAttribute('disabled', ''); // No changes yet, so EndEdit is disabled
        await expect(actions['Edit']).not.toBeVisible();
        
        // Click CancelEdit to exit edit mode
        await actions['CancelEdit'].click();
        
        // Wait for Edit button to become visible again
        await expect(actions['Edit']).toBeVisible();
        
        // Verify we're back in view mode
        await expect(actions['CancelEdit']).not.toBeVisible();
        await expect(actions['EndEdit']).not.toBeVisible();
    });

    test('action buttons are vi-action-button elements', async () => {
        // Check that each action button has the correct tag name
        for (const [actionName, actionLocator] of Object.entries(actions)) {
            const tagName = await actionLocator.evaluate(el => el.tagName.toLowerCase());
            expect(tagName).toBe('vi-action-button');
        }
    });
});