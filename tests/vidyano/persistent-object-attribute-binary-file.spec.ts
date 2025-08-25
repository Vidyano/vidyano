import { expect } from '@playwright/test';
import { attributeTest, createAttributeTestSuite } from './helpers/attributes';
import { getActionButtons } from './helpers/navigation';

attributeTest.describe.serial('BinaryFile Attribute', () => {
    const getters = createAttributeTestSuite('BinaryFile');
    
    // Helper methods for BinaryFile elements
    const getFileInput = () => getters.getAttributeElement().locator('button.browse input[type="file"]');
    const getClearButton = () => getters.getAttributeElement().locator('button:has(vi-icon[source="Remove"])');
    
    // Helper methods with assertions for filename checks
    const expectFilenameDisplayed = async (expectedText?: string) => {
        const filenameDisplay = getters.getAttributeElement().locator('vi-sensitive > span');
        await expect(filenameDisplay).toBeVisible();
        
        const text = await filenameDisplay.textContent();
        expect(text).toBe(expectedText ? expectedText : "—");

        return text as string;
    };
    
    const expectFilenameInInput = async (expectedValue?: string) => {
        const filenameInput = getters.getAttributeElement().locator('input[type="text"][readonly]');
        await expect(filenameInput).toBeVisible();
        
        const value = await filenameInput.inputValue();
        expect(value).toBe(expectedValue ? expectedValue : "");

        return value as string;
    };
    
    attributeTest('is a binary file element', async () => {
        const element = getters.getAttributeElement();
        const tagName = await element.evaluate(el => el.tagName.toLowerCase());
        expect(tagName).toBe('vi-persistent-object-attribute-binary-file');
    });
    
    attributeTest('has file input in edit mode', async () => {
        await expect(getFileInput()).toBeAttached();
    });
    
    attributeTest('can upload and save a file', async () => {
        const page = getters.getPage();
        const actions = getters.getActions();
        const uploadedFileName = __filename.split('/').pop()!;
        
        await getFileInput().setInputFiles(__filename);
        await page.waitForTimeout(500);
        
        await actions['EndEdit'].click();
        await page.waitForTimeout(1000);
        
        await expectFilenameDisplayed(uploadedFileName);
        
        await actions['Edit'].click();
        await page.waitForTimeout(500);
        
        await expect(getClearButton()).toBeVisible();
        
        // Reload to verify the save persisted
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        // Re-get actions after reload
        const reloadedActions = await getActionButtons(page);
        
        // Check the input field has the filename value in edit mode
        await expectFilenameInInput(uploadedFileName);
        
        // Exit edit mode to verify non-edit filename display
        await reloadedActions['CancelEdit'].click();
        await page.waitForTimeout(500);
        
        // Check filename in view mode matches what was saved
        await expectFilenameDisplayed(uploadedFileName);
    });
    
    attributeTest('can clear an uploaded file', async () => {
        const page = getters.getPage();
        
        await getFileInput().setInputFiles(__filename);
        await page.waitForTimeout(500);
        
        await getClearButton().click();
        await page.waitForTimeout(500);
        
        await expect(getFileInput()).toBeAttached();
        await expect(getClearButton()).not.toBeVisible();
    });
    
    attributeTest('shows file name when file is present', async () => {
        const page = getters.getPage();
        const actions = getters.getActions();
        const uploadedFileName = __filename.split('/').pop()!;
        
        await getFileInput().setInputFiles(__filename);
        await page.waitForTimeout(500);
        
        await actions['EndEdit'].click();
        await page.waitForTimeout(1000);
        
        await expectFilenameDisplayed(uploadedFileName);
    });
});