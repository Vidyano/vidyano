import { test, expect, Page } from '@playwright/test';
import { setupPage } from '../helpers/page';
import { setupAttribute, beginEdit, cancelEdit, save, freeze, unfreeze, mockBrowseReference } from '../helpers/persistent-object';
import { startBackend, stopBackend } from '../helpers/backend';

test.describe.serial('User Attribute Tests', () => {
    let sharedBackend: Awaited<ReturnType<typeof startBackend>>;

    test.beforeAll(async ({}, testInfo) => {
        sharedBackend = await startBackend(testInfo);
    });

    test.afterAll(async () => {
        await stopBackend(sharedBackend);
    });

test.describe('User Attribute (Standard)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Non-edit mode', () => {
        test('displays initial friendly name in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-user', 'User');

            const span = component.locator('span');
            await expect(span).toHaveText('admin');
        });

        test('does not render input element', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-user', 'User');

            const input = component.locator('input');
            await expect(input).toHaveCount(0);
        });

        test('does not render browse button', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-user', 'User');

            const browseButton = component.locator('vi-button vi-icon[source="Ellipsis"]');
            await expect(browseButton).toHaveCount(0);
        });
    });

    test.describe('Edit mode', () => {
        test('displays readonly input with friendly name after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-user', 'User');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await expect(input).toBeVisible();
            await expect(input).toHaveAttribute('readonly');
            await expect(input).toHaveValue('admin');
        });

        test('displays browse button in edit mode', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-user', 'User');

            await beginEdit(sharedPage, component);

            const browseButton = component.locator('vi-button vi-icon[source="Ellipsis"]');
            await expect(browseButton).toHaveCount(1);
        });

        test('does not display clear button when value is required (non-nullable)', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-user', 'User');

            await beginEdit(sharedPage, component);

            // User (Guid) is non-nullable, so isRequired = true, canClear should be false
            const clearButton = component.locator('vi-button vi-icon[source="Remove"]');
            await expect(clearButton).toHaveCount(0);
        });
    });

    test.describe('Browse functionality', () => {
        test('clicking browse button opens dialog and updates value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-user', 'User');
            const componentId = await component.getAttribute('id') as string;

            await beginEdit(sharedPage, component);

            // Get current value to ensure we select a different user
            const currentValue = await sharedPage.evaluate((id) => {
                return (window as any).attributeMap[id].value;
            }, componentId);

            // Mock app.showDialog to search and select a different user from the query
            await mockBrowseReference(sharedPage, 'selectFirst', async (items: any, ctx: any) => {
                return await items.findAsync((item: any) => item.id !== ctx.currentValue);
            }, { currentValue });

            // Click the browse button
            const browseButton = component.locator('vi-button:has(vi-icon[source="Ellipsis"])');
            await browseButton.click();

            // Verify the value was updated (should be a different user from the query)
            const input = component.locator('input');
            await expect(input).not.toHaveValue('admin');
        });

        test('canceling browse dialog does not change value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-user', 'User');

            await beginEdit(sharedPage, component);

            // Mock app.showDialog to return null (canceled)
            await mockBrowseReference(sharedPage, 'cancel');

            // Click the browse button by clicking on the Ellipsis icon
            const browseButton = component.locator('vi-button:has(vi-icon[source="Ellipsis"])');
            await browseButton.click();

            // Verify the value was not changed
            const input = component.locator('input');
            await expect(input).toHaveValue('admin');
        });
    });

    test.describe('Save and Cancel', () => {
        test('returns to non-edit mode with new value after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-user', 'User');
            const componentId = await component.getAttribute('id') as string;

            await beginEdit(sharedPage, component);

            // Get current value to ensure we select a different user
            const currentValue = await sharedPage.evaluate((id) => {
                return (window as any).attributeMap[id].value;
            }, componentId);

            // Use browse to select a different user from the backend
            await mockBrowseReference(sharedPage, 'selectFirst', async (items: any, ctx: any) => {
                return await items.findAsync((item: any) => item.id !== ctx.currentValue);
            }, { currentValue });
            const browseButton = component.locator('vi-button:has(vi-icon[source="Ellipsis"])');
            await browseButton.click();
            // Get the new value from the input before saving
            const input = component.locator('input');
            const newValue = await input.inputValue();

            await save(sharedPage, component);

            const span = component.locator('span');
            await expect(span).toHaveText(newValue);
            await expect(component.locator('input')).toHaveCount(0);
        });

        test('returns to non-edit mode with original value after cancel', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-user', 'User');
            const componentId = await component.getAttribute('id') as string;

            await beginEdit(sharedPage, component);

            // Get current value to ensure we select a different user
            const currentValue = await sharedPage.evaluate((id) => {
                return (window as any).attributeMap[id].value;
            }, componentId);

            // Use browse to select a different user from the backend
            await mockBrowseReference(sharedPage, 'selectFirst', async (items: any, ctx: any) => {
                return await items.findAsync((item: any) => item.id !== ctx.currentValue);
            }, { currentValue });
            const browseButton = component.locator('vi-button:has(vi-icon[source="Ellipsis"])');
            await browseButton.click();
            await cancelEdit(sharedPage, component);

            const span = component.locator('span');
            await expect(span).toHaveText('admin');
            await expect(component.locator('input')).toHaveCount(0);
        });
    });
});

test.describe('User Attribute (ReadOnly)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Non-edit mode', () => {
        test('displays initial friendly name in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-user', 'UserReadOnly');

            const span = component.locator('span');
            await expect(span).toHaveText('admin');
        });
    });

    test.describe('Edit mode', () => {
        test('displays readonly input when readonly', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-user', 'UserReadOnly');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await expect(input).toBeVisible();
            await expect(input).toHaveAttribute('readonly');
        });

        test('does not display browse button when readonly', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-user', 'UserReadOnly');

            await beginEdit(sharedPage, component);

            const browseButton = component.locator('vi-button vi-icon[source="Ellipsis"]');
            await expect(browseButton).toHaveCount(0);
        });

        test('does not display clear button when readonly', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-user', 'UserReadOnly');

            await beginEdit(sharedPage, component);

            const clearButton = component.locator('vi-button vi-icon[source="Remove"]');
            await expect(clearButton).toHaveCount(0);
        });
    });
});

test.describe('User Attribute (Nullable)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Non-edit mode', () => {
        test('displays em-dash when value is null', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-user', 'NullableUser');

            const span = component.locator('span');
            await expect(span).toHaveText('—');
        });
    });

    test.describe('Edit mode', () => {
        test('displays browse button for nullable user', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-user', 'NullableUser');

            await beginEdit(sharedPage, component);

            const browseButton = component.locator('vi-button vi-icon[source="Ellipsis"]');
            await expect(browseButton).toHaveCount(1);
        });

        test('does not display clear button when value is null', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-user', 'NullableUser');

            await beginEdit(sharedPage, component);

            // Clear button should not show when value is null/empty
            const clearButton = component.locator('vi-button vi-icon[source="Remove"]');
            await expect(clearButton).toHaveCount(0);
        });
    });

    test.describe('Clear functionality', () => {
        test('displays clear button when nullable user has value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-user', 'NullableUser');

            await beginEdit(sharedPage, component);

            // Use browse to select a user from the backend
            await mockBrowseReference(sharedPage, 'selectFirst');
            const browseButton = component.locator('vi-button:has(vi-icon[source="Ellipsis"])');
            await browseButton.click();
            // Now clear button should be visible
            const clearButton = component.locator('vi-button vi-icon[source="Remove"]');
            await expect(clearButton).toHaveCount(1);
        });

        test('clicking clear button removes value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-user', 'NullableUser');

            await beginEdit(sharedPage, component);

            // Use browse to select a user from the backend
            await mockBrowseReference(sharedPage, 'selectFirst');
            const browseButton = component.locator('vi-button:has(vi-icon[source="Ellipsis"])');
            await browseButton.click();
            const clearButton = component.locator('vi-button:has(vi-icon[source="Remove"])');
            await clearButton.click();

            // Input should show em-dash (empty/null state)
            const input = component.locator('input');
            await expect(input).toHaveValue('—');

            // Clear button should disappear
            await expect(component.locator('vi-button vi-icon[source="Remove"]')).toHaveCount(0);
        });
    });

    test.describe('Save with value', () => {
        test('saves selected user value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-user', 'NullableUser');

            await beginEdit(sharedPage, component);

            // Use browse to select a user from the backend
            await mockBrowseReference(sharedPage, 'selectFirst');
            const browseButton = component.locator('vi-button:has(vi-icon[source="Ellipsis"])');
            await browseButton.click();
            // Get the selected value before saving
            const input = component.locator('input');
            const selectedValue = await input.inputValue();

            await save(sharedPage, component);

            const span = component.locator('span');
            await expect(span).toHaveText(selectedValue);
        });
    });
});

test.describe('User Attribute (Frozen)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Edit mode', () => {
        test('browse button becomes disabled when parent is frozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-user', 'User');

            await beginEdit(sharedPage, component);

            const browseButton = component.locator('vi-button:has(vi-icon[source="Ellipsis"])');
            await expect(browseButton).toBeVisible();

            let disabled = await browseButton.getAttribute('disabled');
            expect(disabled).toBeNull();

            await freeze(sharedPage, component);

            disabled = await browseButton.getAttribute('disabled');
            expect(disabled).not.toBeNull();
        });

        test('browse button becomes enabled when parent is unfrozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-user', 'User');

            await beginEdit(sharedPage, component);
            await freeze(sharedPage, component);

            const browseButton = component.locator('vi-button:has(vi-icon[source="Ellipsis"])');
            let disabled = await browseButton.getAttribute('disabled');
            expect(disabled).not.toBeNull();

            await unfreeze(sharedPage, component);

            disabled = await browseButton.getAttribute('disabled');
            expect(disabled).toBeNull();
        });

        test('clear button becomes disabled when parent is frozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-user', 'NullableUser');

            await beginEdit(sharedPage, component);

            // Use browse to select a user so clear button appears
            await mockBrowseReference(sharedPage, 'selectFirst');
            const browseButton = component.locator('vi-button:has(vi-icon[source="Ellipsis"])');
            await browseButton.click();

            const clearButton = component.locator('vi-button:has(vi-icon[source="Remove"])');
            await expect(clearButton).toBeVisible();

            let disabled = await clearButton.getAttribute('disabled');
            expect(disabled).toBeNull();

            await freeze(sharedPage, component);

            disabled = await clearButton.getAttribute('disabled');
            expect(disabled).not.toBeNull();
        });
    });
});

}); // End of User Attribute Tests wrapper
