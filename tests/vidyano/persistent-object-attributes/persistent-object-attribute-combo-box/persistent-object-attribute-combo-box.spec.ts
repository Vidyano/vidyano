import { test, expect, Page } from '@playwright/test';
import { setupPage } from '../../_helpers/page';
import { setupAttribute, beginEdit, cancelEdit, save, freeze, unfreeze } from '../_helpers/attribute';
import { startBackend, stopBackend, BackendProcess } from '../../_helpers/backend';

test.describe.serial('ComboBox Attribute', () => {
    let sharedBackend: BackendProcess;
    let sharedPage: Page;

    test.beforeAll(async ({}, testInfo) => {
        sharedBackend = await startBackend(testInfo);
    });

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage, '', sharedBackend.port);
    });

    test.afterAll(async () => {
        await sharedPage?.close();
        await stopBackend(sharedBackend);
    });

test.describe('Standard', () => {
    test.describe('Non-edit mode', () => {
        test('displays initial value "Option A" in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-combo-box', 'ComboBox');

            const span = component.locator('span');
            await expect(span).toHaveText('Option A');
        });

        test('does not render vi-select element', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-combo-box', 'ComboBox');

            const select = component.locator('vi-select');
            await expect(select).toHaveCount(0);
        });
    });

    test.describe('Edit mode', () => {
        test('displays vi-select with initial value after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-combo-box', 'ComboBox');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            await expect(select).toBeVisible();

            const input = select.locator('input');
            await expect(input).toHaveValue('Option A');
        });

        test('can type custom value in input', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-combo-box', 'ComboBox');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const input = select.locator('input');

            await input.clear();
            await input.fill('Custom Value');

            await expect(input).toHaveValue('Custom Value');
        });

        test('Enter commits custom value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-combo-box', 'ComboBox');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const input = select.locator('input');

            await input.clear();
            await input.fill('Brand New Option');
            await input.press('Enter');

            // After Enter, the value should be set
            await expect(input).toHaveValue('Brand New Option');
        });
    });

    test.describe('Dropdown selection', () => {
        test('opens dropdown when clicking on select', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-combo-box', 'ComboBox');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const popup = select.locator('vi-popup');
            await popup.click();

            // Wait for popup to open (scroller becomes visible)
            const scroller = select.locator('vi-scroller');
            await expect(scroller).toBeVisible();
        });

        test('displays options in dropdown', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-combo-box', 'ComboBox');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const popup = select.locator('vi-popup');
            await popup.click();

            const options = select.locator('vi-select-option-item');
            await expect(options).toHaveCount(3); // Option A, Option B, Option C
        });

        test('selects option from dropdown', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-combo-box', 'ComboBox');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const popup = select.locator('vi-popup');
            await popup.click();

            // Select Option C
            const optionC = select.locator('vi-select-option-item').filter({ hasText: 'Option C' });
            await optionC.click();

            const input = select.locator('input');
            await expect(input).toHaveValue('Option C');
        });

        test('custom value disappears from options when selecting a default option after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-combo-box', 'ComboBox');

            // Step 1: Add and save a custom value using Enter
            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const input = select.locator('input');

            await input.clear();
            await input.fill('My Custom Value');
            await input.press('Enter');

            await save(sharedPage, component);

            // Step 2: Begin edit again and verify custom value is in the dropdown
            await beginEdit(sharedPage, component);

            const popup = select.locator('vi-popup');
            await popup.click();

            let options = select.locator('vi-select-option-item');
            await expect(options).toHaveCount(4); // Option A, Option B, Option C + My Custom Value

            const customOption = select.locator('vi-select-option-item').filter({ hasText: 'My Custom Value' });
            await expect(customOption).toBeVisible();

            // Step 3: Select a default option and save
            const optionB = select.locator('vi-select-option-item').filter({ hasText: 'Option B' });
            await optionB.click();

            await save(sharedPage, component);

            // Step 4: Begin edit again and verify custom value is gone from dropdown
            await beginEdit(sharedPage, component);

            await popup.click();

            options = select.locator('vi-select-option-item');
            await expect(options).toHaveCount(3); // Back to original: Option A, Option B, Option C

            await expect(select.locator('vi-select-option-item').filter({ hasText: 'My Custom Value' })).toHaveCount(0);
        });
    });

    test.describe('Save and Cancel', () => {
        test('returns to non-edit mode with new value after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-combo-box', 'ComboBox');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const popup = select.locator('vi-popup');
            await popup.click();

            // Select Option B
            const optionB = select.locator('vi-select-option-item').filter({ hasText: 'Option B' });
            await optionB.click();

            const savedValue = await save(sharedPage, component);

            expect(savedValue).toBe('Option B');
            const span = component.locator('span');
            await expect(span).toHaveText('Option B');
            await expect(component.locator('vi-select')).toHaveCount(0);
        });

        test('returns to non-edit mode with original value after cancel', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-combo-box', 'ComboBox');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const popup = select.locator('vi-popup');
            await popup.click();

            // Select Option C
            const optionC = select.locator('vi-select-option-item').filter({ hasText: 'Option C' });
            await optionC.click();

            await cancelEdit(sharedPage, component);

            const span = component.locator('span');
            await expect(span).toHaveText('Option A');
            await expect(component.locator('vi-select')).toHaveCount(0);
        });

        test('saves custom value after pressing Enter', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-combo-box', 'ComboBox');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const input = select.locator('input');

            await input.clear();
            await input.fill('My Custom Entry');
            await input.press('Enter');

            const savedValue = await save(sharedPage, component);

            expect(savedValue).toBe('My Custom Entry');
            const span = component.locator('span');
            await expect(span).toHaveText('My Custom Entry');
        });
    });
});

test.describe('ReadOnly', () => {

    test.describe('Non-edit mode', () => {
        test('displays initial value in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-combo-box', 'ComboBoxReadOnly');

            const span = component.locator('span');
            await expect(span).toHaveText('Option B');
        });
    });

    test.describe('Edit mode', () => {
        test('displays readonly vi-select', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-combo-box', 'ComboBoxReadOnly');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            await expect(select).toBeVisible();
            await expect(select).toHaveAttribute('readonly');
        });

        test('displays readonly input', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-combo-box', 'ComboBoxReadOnly');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const input = select.locator('input');
            await expect(input).toHaveAttribute('readonly');
        });
    });
});

test.describe('Required', () => {

    test.describe('Non-edit mode', () => {
        test('displays em-dash when value is empty', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-combo-box', 'ComboBoxRequired');

            const span = component.locator('span');
            await expect(span).toHaveText('—');
        });
    });

    test.describe('Edit mode', () => {
        test('displays vi-select with empty value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-combo-box', 'ComboBoxRequired');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            await expect(select).toBeVisible();

            const input = select.locator('input');
            await expect(input).toHaveValue('');
        });

        test('can select value from options', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-combo-box', 'ComboBoxRequired');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const popup = select.locator('vi-popup');
            await popup.click();

            // Select Option A
            const optionA = select.locator('vi-select-option-item').filter({ hasText: 'Option A' });
            await optionA.click();

            const input = select.locator('input');
            await expect(input).toHaveValue('Option A');
        });
    });
});

test.describe('Frozen', () => {

    test.describe('Edit mode', () => {
        test('vi-select becomes disabled when parent is frozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-combo-box', 'ComboBox');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            await expect(select).toBeVisible();

            await expect(select).not.toHaveAttribute('disabled');

            await freeze(sharedPage, component);

            await expect(select).toHaveAttribute('disabled');
        });

        test('vi-select becomes enabled when parent is unfrozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-combo-box', 'ComboBox');

            await beginEdit(sharedPage, component);
            await freeze(sharedPage, component);

            const select = component.locator('vi-select');
            await expect(select).toHaveAttribute('disabled');

            await unfreeze(sharedPage, component);

            await expect(select).not.toHaveAttribute('disabled');
        });
    });
});

test.describe('Clear button', () => {

    test('should show clear button for non-required field with value', async () => {
        const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-combo-box', 'ComboBox');

        await beginEdit(sharedPage, component);

        const clearButton = component.locator('vi-button vi-icon[source="Remove"]');
        await expect(clearButton).toBeVisible();
    });

    test('should hide clear button for required field', async () => {
        const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-combo-box', 'ComboBoxRequired');

        await beginEdit(sharedPage, component);

        const clearButton = component.locator('vi-button vi-icon[source="Remove"]');
        await expect(clearButton).not.toBeVisible();
    });

    test('should hide clear button for readonly field', async () => {
        const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-combo-box', 'ComboBoxReadOnly');

        await beginEdit(sharedPage, component);

        const clearButton = component.locator('vi-button vi-icon[source="Remove"]');
        await expect(clearButton).not.toBeVisible();
    });

    test('should hide clear button when value is empty', async () => {
        const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-combo-box', 'ComboBoxEmpty');

        await beginEdit(sharedPage, component);

        const clearButton = component.locator('vi-button vi-icon[source="Remove"]');
        await expect(clearButton).not.toBeVisible();
    });

    test('should clear value when clear button is clicked', async () => {
        const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-combo-box', 'ComboBox');

        await beginEdit(sharedPage, component);

        const select = component.locator('vi-select');
        const input = select.locator('input');

        // Verify has value
        await expect(input).toHaveValue('Option A');

        // Click clear button
        const clearButton = component.locator('vi-button').filter({ has: sharedPage.locator('vi-icon[source="Remove"]') });
        await expect(clearButton).toBeVisible();
        await clearButton.click();

        // Verify value cleared and dash placeholder shown
        await expect(input).toHaveValue('');
        await expect(input).toHaveAttribute('placeholder', '—');

        // Verify clear button is now hidden
        await expect(clearButton).not.toBeVisible();
    });

    test('should disable clear button when frozen', async () => {
        const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-combo-box', 'ComboBox');

        await beginEdit(sharedPage, component);

        await freeze(sharedPage, component);

        const clearButton = component.locator('vi-button').filter({ has: sharedPage.locator('vi-icon[source="Remove"]') });
        await expect(clearButton).toBeVisible();
        await expect(clearButton).toHaveAttribute('disabled');
    });

    test('clear button should hide after clearing and reappear when value is set again', async () => {
        const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-combo-box', 'ComboBox');

        await beginEdit(sharedPage, component);

        const select = component.locator('vi-select');
        const input = select.locator('input');
        const clearButton = component.locator('vi-button').filter({ has: sharedPage.locator('vi-icon[source="Remove"]') });

        // Initially has value and clear button is visible
        await expect(input).toHaveValue('Option A');
        await expect(clearButton).toBeVisible();

        // Clear the value
        await clearButton.click();
        await expect(input).toHaveValue('');
        await expect(clearButton).not.toBeVisible();

        // Set a new value
        await input.fill('New Value');
        await input.press('Enter');
        await expect(input).toHaveValue('New Value');

        // Clear button should reappear
        await expect(clearButton).toBeVisible();
    });
});

}); // End of ComboBox Attribute wrapper
