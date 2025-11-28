import { test, expect, Page } from '@playwright/test';
import { setupPage } from '../helpers/page';
import { setupAttribute, beginEdit, cancelEdit, save, freeze, unfreeze } from '../helpers/persistent-object';
import { startBackend, stopBackend } from '../helpers/backend';

test.describe.serial('NullableBoolean Attribute Tests', () => {
    let sharedBackend: Awaited<ReturnType<typeof startBackend>>;
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

test.describe.serial('NullableBoolean Attribute (Standard)', () => {
    test.describe('Non-edit mode', () => {
        test('displays em-dash for null value in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-nullable-boolean', 'NullableBoolean');

            const span = component.locator('span');
            await expect(span).toHaveText('—');
        });

        test('vi-select is hidden in non-edit mode', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-nullable-boolean', 'NullableBoolean');

            const select = component.locator('vi-select');
            await expect(select).toBeHidden();
        });
    });

    test.describe('Edit mode', () => {
        test('displays vi-select with empty value after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-nullable-boolean', 'NullableBoolean');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            await expect(select).toBeVisible();

            const input = select.locator('input');
            await expect(input).toHaveValue('');
        });

        test('displays empty placeholder for null value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-nullable-boolean', 'NullableBoolean');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const input = select.locator('input');
            await expect(input).toHaveValue('');
        });
    });

    test.describe('Dropdown selection', () => {
        test('opens dropdown when clicking on select', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-nullable-boolean', 'NullableBoolean');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const popup = select.locator('vi-popup');
            await popup.click();

            // Wait for popup to open (scroller becomes visible)
            const scroller = select.locator('vi-scroller');
            await expect(scroller).toBeVisible();
        });

        test('displays two visible options in dropdown: Yes, No', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-nullable-boolean', 'NullableBoolean');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const popup = select.locator('vi-popup');
            await popup.click();

            // Note: null option exists but is hidden
            const visibleOptions = select.locator('vi-select-option-item:visible');
            await expect(visibleOptions).toHaveCount(2); // true, false
        });

        test('selects "Yes" (true) from dropdown', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-nullable-boolean', 'NullableBoolean');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const popup = select.locator('vi-popup');
            await popup.click();

            // Select Yes (true)
            const optionYes = select.locator('vi-select-option-item').filter({ hasText: 'Yes' });
            await optionYes.click();

            const input = select.locator('input');
            await expect(input).toHaveValue('Yes');
        });

        test('selects "No" (false) from dropdown', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-nullable-boolean', 'NullableBoolean');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const popup = select.locator('vi-popup');
            await popup.click();

            // Select No (false)
            const optionNo = select.locator('vi-select-option-item').filter({ hasText: 'No' });
            await optionNo.click();

            const input = select.locator('input');
            await expect(input).toHaveValue('No');
        });

        test('can select empty (null) option from dropdown', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-nullable-boolean', 'NullableBooleanWithValue');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');

            // Verify initial value is "Yes"
            let input = select.locator('input');
            await expect(input).toHaveValue('Yes');

            const popup = select.locator('vi-popup');
            await popup.click();

            // Wait for dropdown to be visible
            const scroller = select.locator('vi-scroller');
            await expect(scroller).toBeVisible();

            // Get the first option (empty/null option) and verify it has empty text
            const options = select.locator('vi-select-option-item');
            const emptyOption = options.nth(0);

            // Verify the empty option has no text content (only whitespace like \n and spaces)
            const emptyOptionText = await emptyOption.textContent();
            expect(emptyOptionText?.trim()).toBe('');

            // Use evaluate to trigger the click event directly
            await emptyOption.evaluate((el: HTMLElement) => el.click());

            await expect(input).toHaveValue('');
        });
    });

    test.describe('Save and Cancel', () => {
        test('returns to non-edit mode with "Yes" after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-nullable-boolean', 'NullableBoolean');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const popup = select.locator('vi-popup');
            await popup.click();

            // Select Yes
            const optionYes = select.locator('vi-select-option-item').filter({ hasText: 'Yes' });
            await optionYes.click();

            const savedValue = await save(sharedPage, component);

            expect(savedValue).toBe(true);

            // Wait for component to exit edit mode
            const span = component.locator('span');
            await expect(span).toBeVisible();
            await expect(span).toHaveText('Yes');

            // vi-select should be hidden in non-edit mode
            await expect(component.locator('vi-select')).toBeHidden();
        });

        test('returns to non-edit mode with "No" after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-nullable-boolean', 'NullableBoolean');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const popup = select.locator('vi-popup');
            await popup.click();

            // Select No
            const optionNo = select.locator('vi-select-option-item').filter({ hasText: 'No' });
            await optionNo.click();

            const savedValue = await save(sharedPage, component);

            expect(savedValue).toBe(false);

            const span = component.locator('span');
            await expect(span).toBeVisible();
            await expect(span).toHaveText('No');

            await expect(component.locator('vi-select')).toBeHidden();
        });

        test('returns to non-edit mode with null value after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-nullable-boolean', 'NullableBooleanWithValue');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const popup = select.locator('vi-popup');
            await popup.click();

            // Wait for dropdown to be visible
            const scroller = select.locator('vi-scroller');
            await expect(scroller).toBeVisible();

            // Select empty (null) option using JavaScript click
            const options = select.locator('vi-select-option-item');
            const emptyOption = options.nth(0);
            await emptyOption.evaluate((el: HTMLElement) => el.click());

            const savedValue = await save(sharedPage, component);

            expect(savedValue).toBeNull();

            const span = component.locator('span');
            await expect(span).toBeVisible();
            await expect(span).toHaveText('—');

            await expect(component.locator('vi-select')).toBeHidden();
        });

        test('returns to non-edit mode with original value after cancel', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-nullable-boolean', 'NullableBoolean');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const popup = select.locator('vi-popup');
            await popup.click();

            // Select Yes
            const optionYes = select.locator('vi-select-option-item').filter({ hasText: 'Yes' });
            await optionYes.click();

            await cancelEdit(sharedPage, component);

            const span = component.locator('span');
            await expect(span).toBeVisible();
            await expect(span).toHaveText('—');

            await expect(component.locator('vi-select')).toBeHidden();
        });
    });
});

test.describe('NullableBoolean Attribute (ReadOnly)', () => {



    test.describe('Non-edit mode', () => {
        test('displays initial value "Yes" in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-nullable-boolean', 'NullableBooleanReadOnly');

            const span = component.locator('span');
            await expect(span).toHaveText('Yes');
        });
    });

    test.describe('Edit mode', () => {
        test('displays readonly vi-select', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-nullable-boolean', 'NullableBooleanReadOnly');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            await expect(select).toBeVisible();
            await expect(select).toHaveAttribute('readonly');
        });

        test('displays readonly input with correct value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-nullable-boolean', 'NullableBooleanReadOnly');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const input = select.locator('input');
            await expect(input).toHaveAttribute('readonly');
            await expect(input).toHaveValue('Yes');
        });
    });
});

test.describe('NullableBoolean Attribute (Required)', () => {



    test.describe('Non-edit mode', () => {
        test('displays initial value "No"', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-nullable-boolean', 'NullableBooleanRequired');

            const span = component.locator('span');
            await expect(span).toHaveText('No');
        });

        test('has required attribute set', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-nullable-boolean', 'NullableBooleanRequired');

            const required = await component.getAttribute('required');
            expect(required).not.toBeNull();
        });
    });

    test.describe('Edit mode', () => {
        test('displays vi-select with initial value "No" after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-nullable-boolean', 'NullableBooleanRequired');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            await expect(select).toBeVisible();

            const input = select.locator('input');
            await expect(input).toHaveValue('No');
        });

        test('can select Yes from options', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-nullable-boolean', 'NullableBooleanRequired');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const popup = select.locator('vi-popup');
            await popup.click();

            // Select Yes
            const optionYes = select.locator('vi-select-option-item').filter({ hasText: 'Yes' });
            await optionYes.click();

            const input = select.locator('input');
            await expect(input).toHaveValue('Yes');
        });

        test('can select No from options', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-nullable-boolean', 'NullableBooleanRequired');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            const popup = select.locator('vi-popup');
            await popup.click();

            // Select No
            const optionNo = select.locator('vi-select-option-item').filter({ hasText: 'No' });
            await optionNo.click();

            const input = select.locator('input');
            await expect(input).toHaveValue('No');
        });
    });
});

test.describe('NullableBoolean Attribute (Frozen)', () => {



    test.describe('Edit mode', () => {
        test('vi-select becomes disabled when parent is frozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-nullable-boolean', 'NullableBoolean');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            await expect(select).toBeVisible();

            await expect(select).not.toHaveAttribute('disabled');

            await freeze(sharedPage, component);

            await expect(select).toHaveAttribute('disabled');
        });

        test('vi-select becomes enabled when parent is unfrozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-nullable-boolean', 'NullableBoolean');

            await beginEdit(sharedPage, component);
            await freeze(sharedPage, component);

            const select = component.locator('vi-select');
            await expect(select).toHaveAttribute('disabled');

            await unfreeze(sharedPage, component);

            await expect(select).not.toHaveAttribute('disabled');
        });
    });
});

}); // End of NullableBoolean Attribute Tests wrapper
