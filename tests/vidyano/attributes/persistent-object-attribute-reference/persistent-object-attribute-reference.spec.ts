import { test, expect, Page } from '@playwright/test';
import { setupPage } from '../helpers/page';
import { setupAttribute, beginEdit, cancelEdit, save, freeze, unfreeze, mockBrowseReference } from '../helpers/persistent-object';
import { startBackend, stopBackend, BackendProcess } from '../helpers/backend';

test.describe.serial('Reference Attribute Tests', () => {
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

test.describe('Reference Attribute (Standard)', () => {
    test.describe('Non-edit mode', () => {
        test('displays initial display value in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'Reference');

            const span = component.locator('span');
            await expect(span).toHaveText('Electronics');
        });

        test('does not render input element', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'Reference');

            const input = component.locator('input');
            await expect(input).toHaveCount(0);
        });

        test('does not render browse button', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'Reference');

            const browseButton = component.locator('vi-button vi-icon[source="Ellipsis"]');
            await expect(browseButton).toHaveCount(0);
        });

        test('displays link when href is available', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'Reference');

            const anchor = component.locator('a');
            await expect(anchor).toBeVisible();
        });
    });

    test.describe('Edit mode', () => {
        test('displays input with filter value after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'Reference');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await expect(input).toBeVisible();
            await expect(input).toHaveValue('Electronics');
        });

        test('displays browse button in edit mode', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'Reference');

            await beginEdit(sharedPage, component);

            const browseButton = component.locator('vi-button vi-icon[source="Ellipsis"]');
            await expect(browseButton).toHaveCount(1);
        });

        test('does not display clear button when reference is required', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'Reference');

            await beginEdit(sharedPage, component);

            // Reference (non-nullable) has isRequired = true, canClear should be false
            const clearButton = component.locator('vi-button vi-icon[source="Remove"]');
            await expect(clearButton).toHaveCount(0);
        });

        test('displays external link button', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'Reference');

            await beginEdit(sharedPage, component);

            const linkButton = component.locator('a vi-icon[source="ArrowUpRight"]');
            await expect(linkButton).toHaveCount(1);
        });
    });

    test.describe('Browse functionality', () => {
        test('clicking browse button opens dialog and updates value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'Reference');
            const componentId = await component.getAttribute('id') as string;

            await beginEdit(sharedPage, component);

            // Get current value to ensure we select a different reference
            const currentValue = await sharedPage.evaluate((id) => {
                return (window as any).attributeMap[id].objectId;
            }, componentId);

            // Mock app.showDialog to search and select a different reference from the query
            await mockBrowseReference(sharedPage, 'selectFirst', async (items: any, ctx: any) => {
                return await items.findAsync((item: any) => item.id !== ctx.currentValue);
            }, { currentValue });

            // Click the browse button
            const browseButton = component.locator('vi-button:has(vi-icon[source="Ellipsis"])');
            await browseButton.click();

            // Verify the value was updated (should be a different reference from the query)
            const input = component.locator('input');
            await expect(input).not.toHaveValue('Electronics');
        });

        test('canceling browse dialog does not change value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'Reference');

            await beginEdit(sharedPage, component);

            // Mock app.showDialog to return null (canceled)
            await mockBrowseReference(sharedPage, 'cancel');

            // Click the browse button
            const browseButton = component.locator('vi-button:has(vi-icon[source="Ellipsis"])');
            await browseButton.click();

            // Verify the value was not changed
            const input = component.locator('input');
            await expect(input).toHaveValue('Electronics');
        });
    });

    test.describe('Save and Cancel', () => {
        test('returns to non-edit mode with new value after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'Reference');
            const componentId = await component.getAttribute('id') as string;

            await beginEdit(sharedPage, component);

            // Get current value to ensure we select a different reference
            const currentValue = await sharedPage.evaluate((id) => {
                return (window as any).attributeMap[id].objectId;
            }, componentId);

            // Use browse to select a different reference from the backend
            await mockBrowseReference(sharedPage, 'selectFirst', async (items: any, ctx: any) => {
                return await items.findAsync((item: any) => item.id !== ctx.currentValue);
            }, { currentValue });
            const browseButton = component.locator('vi-button:has(vi-icon[source="Ellipsis"])');
            await browseButton.click();

            // Wait for the input value to change from the original
            const input = component.locator('input');
            await expect(input).not.toHaveValue('Electronics');
            const newValue = await input.inputValue();

            await save(sharedPage, component);

            const span = component.locator('span');
            await expect(span).toHaveText(newValue);
            await expect(component.locator('input')).toHaveCount(0);
        });

        test('returns to non-edit mode with original value after cancel', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'Reference');
            const componentId = await component.getAttribute('id') as string;

            await beginEdit(sharedPage, component);

            // Get current value to ensure we select a different reference
            const currentValue = await sharedPage.evaluate((id) => {
                return (window as any).attributeMap[id].objectId;
            }, componentId);

            // Use browse to select a different reference from the backend
            await mockBrowseReference(sharedPage, 'selectFirst', async (items: any, ctx: any) => {
                return await items.findAsync((item: any) => item.id !== ctx.currentValue);
            }, { currentValue });
            const browseButton = component.locator('vi-button:has(vi-icon[source="Ellipsis"])');
            await browseButton.click();

            // Wait for the input value to change before canceling
            const input = component.locator('input');
            await expect(input).not.toHaveValue('Electronics');

            await cancelEdit(sharedPage, component);

            const span = component.locator('span');
            await expect(span).toHaveText('Electronics');
            await expect(component.locator('input')).toHaveCount(0);
        });
    });
});

test.describe('Reference Attribute (ReadOnly)', () => {



    test.describe('Non-edit mode', () => {
        test('displays initial display value in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'ReferenceReadOnly');

            const span = component.locator('span');
            await expect(span).toHaveText('Electronics');
        });
    });

    test.describe('Edit mode', () => {
        test('displays readonly input when readonly', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'ReferenceReadOnly');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await expect(input).toBeVisible();
            await expect(input).toHaveAttribute('readonly');
        });

        test('does not display browse button when readonly', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'ReferenceReadOnly');

            await beginEdit(sharedPage, component);

            const browseButton = component.locator('vi-button vi-icon[source="Ellipsis"]');
            await expect(browseButton).toHaveCount(0);
        });

        test('does not display clear button when readonly', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'ReferenceReadOnly');

            await beginEdit(sharedPage, component);

            const clearButton = component.locator('vi-button vi-icon[source="Remove"]');
            await expect(clearButton).toHaveCount(0);
        });
    });
});

test.describe('Reference Attribute (Nullable)', () => {



    test.describe('Non-edit mode', () => {
        test('displays em-dash when value is null', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'NullableReference');

            const span = component.locator('span');
            await expect(span).toHaveText('—');
        });

        test('link is disabled when value is null', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'NullableReference');

            const anchor = component.locator('a');
            await expect(anchor).toHaveAttribute('disabled');
            await expect(anchor).not.toHaveAttribute('href');
        });
    });

    test.describe('Edit mode', () => {
        test('displays browse button for nullable reference', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'NullableReference');

            await beginEdit(sharedPage, component);

            const browseButton = component.locator('vi-button vi-icon[source="Ellipsis"]');
            await expect(browseButton).toHaveCount(1);
        });

        test('does not display clear button when value is null', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'NullableReference');

            await beginEdit(sharedPage, component);

            // Clear button should not show when value is null/empty
            const clearButton = component.locator('vi-button vi-icon[source="Remove"]');
            await expect(clearButton).toHaveCount(0);
        });
    });

    test.describe('Clear functionality', () => {
        test('displays clear button when nullable reference has value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'NullableReference');

            await beginEdit(sharedPage, component);

            // Use browse to select a reference from the backend
            await mockBrowseReference(sharedPage, 'selectFirst');
            const browseButton = component.locator('vi-button:has(vi-icon[source="Ellipsis"])');
            await browseButton.click();

            // Now clear button should be visible
            const clearButton = component.locator('vi-button vi-icon[source="Remove"]');
            await expect(clearButton).toHaveCount(1);
        });

        test('clicking clear button removes value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'NullableReference');

            await beginEdit(sharedPage, component);

            // Use browse to select a reference from the backend
            await mockBrowseReference(sharedPage, 'selectFirst');
            const browseButton = component.locator('vi-button:has(vi-icon[source="Ellipsis"])');
            await browseButton.click();

            const clearButton = component.locator('vi-button:has(vi-icon[source="Remove"])');
            await clearButton.click();

            // Input should be empty (null state)
            const input = component.locator('input');
            await expect(input).toHaveValue('');

            // Clear button should disappear
            await expect(component.locator('vi-button vi-icon[source="Remove"]')).toHaveCount(0);
        });
    });

    test.describe('Save with value', () => {
        test('saves selected reference value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'NullableReference');

            await beginEdit(sharedPage, component);

            // Use browse to select a reference from the backend
            await mockBrowseReference(sharedPage, 'selectFirst');
            const browseButton = component.locator('vi-button:has(vi-icon[source="Ellipsis"])');
            await browseButton.click();

            // Wait for the input to have a value (not empty)
            const input = component.locator('input');
            await expect(input).not.toHaveValue('');
            const selectedValue = await input.inputValue();

            await save(sharedPage, component);

            const span = component.locator('span');
            await expect(span).toHaveText(selectedValue);
        });
    });
});

test.describe('Reference Attribute (Frozen)', () => {



    test.describe('Edit mode', () => {
        test('input becomes disabled when parent is frozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'Reference');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await expect(input).toBeVisible();

            let disabled = await input.getAttribute('disabled');
            expect(disabled).toBeNull();

            await freeze(sharedPage, component);

            disabled = await input.getAttribute('disabled');
            expect(disabled).not.toBeNull();
        });

        test('input becomes enabled when parent is unfrozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'Reference');

            await beginEdit(sharedPage, component);
            await freeze(sharedPage, component);

            const input = component.locator('input');
            let disabled = await input.getAttribute('disabled');
            expect(disabled).not.toBeNull();

            await unfreeze(sharedPage, component);

            disabled = await input.getAttribute('disabled');
            expect(disabled).toBeNull();
        });

        test('browse button becomes disabled when parent is frozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'Reference');

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
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'Reference');

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
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'NullableReference');

            await beginEdit(sharedPage, component);

            // Use browse to select a reference so clear button appears
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

test.describe('Reference Attribute (SelectInPlace)', () => {



    test.describe('Non-edit mode', () => {
        test('displays initial display value in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'ReferenceSelectInPlace');

            const span = component.locator('span');
            await expect(span).toHaveText('Electronics');
        });
    });

    test.describe('Edit mode', () => {
        test('does not trigger SelectReference action when entering edit mode', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'ReferenceSelectInPlace');
            const componentId = await component.getAttribute('id') as string;

            // Spy on changeReference to detect if it's called
            const changeReferenceCalled = await sharedPage.evaluate((id) => {
                const attribute = (window as any).attributeMap[id];
                let called = false;
                const originalChangeReference = attribute.changeReference.bind(attribute);
                attribute.changeReference = async (...args: any[]) => {
                    called = true;
                    (window as any).__changeReferenceCalled = true;
                    return originalChangeReference(...args);
                };
                (window as any).__changeReferenceCalled = false;
                return false;
            }, componentId);

            // Enter edit mode - this should NOT trigger changeReference/SelectReference
            await beginEdit(sharedPage, component);

            // Wait for any async operations to complete
            await sharedPage.waitForTimeout(500);

            // Check if changeReference was called
            const wasChangeReferenceCalled = await sharedPage.evaluate(() => {
                return (window as any).__changeReferenceCalled;
            });

            expect(wasChangeReferenceCalled).toBe(false);
        });

        test('displays vi-select component in edit mode', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'ReferenceSelectInPlace');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            await expect(select).toBeVisible();
        });

        test('displays dropdown button in edit mode', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'ReferenceSelectInPlace');

            await beginEdit(sharedPage, component);

            const dropdownButton = component.locator('vi-button vi-icon[source="CaretDown"]');
            await expect(dropdownButton).toHaveCount(1);
        });

        test('does not display browse (ellipsis) button in selectInPlace mode', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'ReferenceSelectInPlace');

            await beginEdit(sharedPage, component);

            const browseButton = component.locator('vi-button vi-icon[source="Ellipsis"]');
            await expect(browseButton).toHaveCount(0);
        });

        test('displays external link button', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'ReferenceSelectInPlace');

            await beginEdit(sharedPage, component);

            const linkButton = component.locator('a vi-icon[source="ArrowUpRight"]');
            await expect(linkButton).toHaveCount(1);
        });
    });

    test.describe('Save and Cancel', () => {
        test('returns to non-edit mode after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'ReferenceSelectInPlace');

            await beginEdit(sharedPage, component);

            await save(sharedPage, component);

            const span = component.locator('span');
            await expect(span).toBeVisible();
            await expect(component.locator('vi-select')).toHaveCount(0);
        });

        test('returns to non-edit mode with original value after cancel', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'ReferenceSelectInPlace');

            await beginEdit(sharedPage, component);

            await cancelEdit(sharedPage, component);

            const span = component.locator('span');
            await expect(span).toHaveText('Electronics');
            await expect(component.locator('vi-select')).toHaveCount(0);
        });
    });

    test.describe('Frozen state', () => {
        test('select becomes disabled when parent is frozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'ReferenceSelectInPlace');

            await beginEdit(sharedPage, component);

            const select = component.locator('vi-select');
            await expect(select).toBeVisible();

            // Check that select is not disabled initially
            await expect(select).not.toHaveAttribute('disabled', 'true');

            await freeze(sharedPage, component);

            // After freeze, select should have disabled attribute
            await expect(select).toHaveAttribute('disabled');
        });

        test('dropdown button becomes disabled when parent is frozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-reference', 'ReferenceSelectInPlace');

            await beginEdit(sharedPage, component);

            const dropdownButton = component.locator('vi-button:has(vi-icon[source="CaretDown"])');
            await expect(dropdownButton).toBeVisible();

            // Check that button is not disabled initially
            await expect(dropdownButton).not.toHaveAttribute('disabled', 'true');

            await freeze(sharedPage, component);

            // After freeze, button should have disabled attribute
            await expect(dropdownButton).toHaveAttribute('disabled');
        });
    });
});

}); // End of Reference Attribute Tests wrapper
