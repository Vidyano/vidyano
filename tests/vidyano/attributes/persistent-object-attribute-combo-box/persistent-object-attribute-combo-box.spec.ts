import { test, expect, Page } from '@playwright/test';
import { setupPage } from '../helpers/page';
import { setupAttribute, beginEdit, cancelEdit, save, freeze, unfreeze } from '../helpers/persistent-object';
import { startBackend, stopBackend } from '../helpers/backend';

test.describe.serial('ComboBox Attribute Tests', () => {
    let sharedBackend: Awaited<ReturnType<typeof startBackend>>;

    test.beforeAll(async ({}, testInfo) => {
        sharedBackend = await startBackend(testInfo);
    });

    test.afterAll(async () => {
        await stopBackend(sharedBackend);
    });

test.describe('ComboBox Attribute (Standard)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

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

test.describe('ComboBox Attribute (ReadOnly)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

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

test.describe('ComboBox Attribute (Required)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

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

test.describe('ComboBox Attribute (Frozen)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

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

}); // End of ComboBox Attribute Tests wrapper
