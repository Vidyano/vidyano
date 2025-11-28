import { test, expect, Page } from '@playwright/test';
import { setupPage } from '../helpers/page';
import { setupAttribute, beginEdit, cancelEdit, save, freeze, unfreeze, trackRefresh } from '../helpers/persistent-object';
import { startBackend, stopBackend, BackendProcess } from '../helpers/backend';

test.describe.serial('MultiString Attribute', () => {
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

test.describe('Default', () => {
    test.describe('Non-edit mode', () => {
        test('displays initial multi-string value in pre element', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-string', 'MultiString');

            const pre = component.locator('pre');
            await expect(pre).toHaveText('Item1\nItem2\nItem3');
        });

        test('does not render input elements', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-string', 'MultiString');

            const input = component.locator('input');
            await expect(input).toHaveCount(0);
        });

        test('renders content inside vi-scroller', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-string', 'MultiString');

            const scroller = component.locator('vi-scroller');
            await expect(scroller).toBeVisible();
        });
    });

    test.describe('Edit mode', () => {
        test('displays string items as inputs after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-string', 'MultiString');

            await beginEdit(sharedPage, component);

            const items = component.locator('.string-item');
            // 3 existing items + 1 new item placeholder
            await expect(items).toHaveCount(4);
        });

        test('existing items have correct values', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-string', 'MultiString');

            await beginEdit(sharedPage, component);

            const items = component.locator('.string-item:not(.new-item)');
            await expect(items).toHaveCount(3);

            const inputs = items.locator('input');
            await expect(inputs.nth(0)).toHaveValue('Item1');
            await expect(inputs.nth(1)).toHaveValue('Item2');
            await expect(inputs.nth(2)).toHaveValue('Item3');
        });

        test('new item placeholder is visible', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-string', 'MultiString');

            await beginEdit(sharedPage, component);

            const newItem = component.locator('.string-item.new-item');
            await expect(newItem).toBeVisible();
        });

        test('adding value to new item creates new entry', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-string', 'MultiString');

            await beginEdit(sharedPage, component);

            const newItem = component.locator('.string-item.new-item');
            const newInput = newItem.locator('input');
            await newInput.fill('Item4');

            // Wait for new item to be added
            const items = component.locator('.string-item:not(.new-item)');
            await expect(items).toHaveCount(4);
        });

        test('typing in new item input should not affect first item', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-string', 'MultiString');

            await beginEdit(sharedPage, component);

            const existingItems = component.locator('.string-item:not(.new-item)');
            const firstInput = existingItems.first().locator('input');
            const newItem = component.locator('.string-item.new-item');
            const newInput = newItem.locator('input');

            // Verify first item's initial value
            await expect(firstInput).toHaveValue('Item1');

            // Click the new item input to focus it
            await newInput.click();
            await expect(newInput).toBeFocused();

            // Type a character using keyboard (simulates real user typing)
            await sharedPage.keyboard.type('X');

            // The first item should NOT have changed - character should not go there
            await expect(firstInput).toHaveValue('Item1');

            // A new item should have been created with the typed character
            await expect(existingItems).toHaveCount(4);
            const lastExistingInput = existingItems.last().locator('input');
            await expect(lastExistingInput).toHaveValue('X');
        });

        test('clicking second item input should retain focus on that item', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-string', 'MultiString');

            await beginEdit(sharedPage, component);

            const existingItems = component.locator('.string-item:not(.new-item)');
            const secondInput = existingItems.nth(1).locator('input');

            // Verify second item's initial value
            await expect(secondInput).toHaveValue('Item2');

            // Click the second item input to focus it
            await secondInput.click();

            // Focus should remain on the second item, not jump to first
            await expect(secondInput).toBeFocused();
        });

        test('editing existing item updates value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-string', 'MultiString');

            await beginEdit(sharedPage, component);

            const items = component.locator('.string-item:not(.new-item)');
            const firstInput = items.first().locator('input');
            await firstInput.clear();
            await firstInput.fill('UpdatedItem1');

            await expect(firstInput).toHaveValue('UpdatedItem1');
        });

        test('dragging item to reorder updates order immediately', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-string', 'MultiString');

            await beginEdit(sharedPage, component);

            const items = component.locator('.string-item:not(.new-item)');
            await expect(items).toHaveCount(3);

            // Verify initial order
            const inputs = items.locator('input');
            await expect(inputs.nth(0)).toHaveValue('Item1');
            await expect(inputs.nth(1)).toHaveValue('Item2');
            await expect(inputs.nth(2)).toHaveValue('Item3');

            // Use Playwright's dragTo API for reliable pointer event handling
            const secondItemHandle = items.nth(1).locator('vi-icon.sort-handle');
            const firstItem = items.nth(0);

            await secondItemHandle.dragTo(firstItem, { targetPosition: { x: 10, y: 10 }, force: true });

            // Verify the order changed - Item2 should now be first
            await expect(inputs.nth(0)).toHaveValue('Item2');
            await expect(inputs.nth(1)).toHaveValue('Item1');
            await expect(inputs.nth(2)).toHaveValue('Item3');
        });
    });

    test.describe('Save and Cancel', () => {
        test('returns to non-edit mode with updated value after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-string', 'MultiString');

            await beginEdit(sharedPage, component);

            // Add a new item
            const newItem = component.locator('.string-item.new-item');
            const newInput = newItem.locator('input');
            await newInput.fill('NewItem');

            const savedValue = await save(sharedPage, component);

            expect(savedValue).toBe('Item1\nItem2\nItem3\nNewItem');
            const pre = component.locator('pre');
            await expect(pre).toHaveText('Item1\nItem2\nItem3\nNewItem');
        });

        test('returns to non-edit mode with original value after cancel', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-string', 'MultiString');

            await beginEdit(sharedPage, component);

            // Add a new item
            const newItem = component.locator('.string-item.new-item');
            const newInput = newItem.locator('input');
            await newInput.fill('CancelledItem');

            await cancelEdit(sharedPage, component);

            const pre = component.locator('pre');
            await expect(pre).toHaveText('Item1\nItem2\nItem3');
        });
    });
});

test.describe('ReadOnly', () => {

    test.describe('Edit mode', () => {
        test('displays readonly inputs when attribute is readonly', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-string', 'MultiStringReadOnly');

            await beginEdit(sharedPage, component);

            const items = component.locator('.string-item:not(.new-item)');
            await expect(items).toHaveCount(2);

            const inputs = items.locator('input');
            await expect(inputs.nth(0)).toHaveAttribute('readonly');
            await expect(inputs.nth(1)).toHaveAttribute('readonly');
        });

        test('does not show new item placeholder when readonly', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-string', 'MultiStringReadOnly');

            await beginEdit(sharedPage, component);

            const newItem = component.locator('.string-item.new-item');
            await expect(newItem).toHaveCount(0);
        });
    });
});

test.describe('Frozen', () => {

    test.describe('Edit mode', () => {
        test('inputs become disabled when parent is frozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-string', 'MultiString');

            await beginEdit(sharedPage, component);

            const items = component.locator('.string-item:not(.new-item)');
            const firstInput = items.first().locator('input');
            await expect(firstInput).toBeVisible();

            let disabled = await firstInput.getAttribute('disabled');
            expect(disabled).toBeNull();

            await freeze(sharedPage, component);

            disabled = await firstInput.getAttribute('disabled');
            expect(disabled).not.toBeNull();
        });

        test('inputs become enabled when parent is unfrozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-string', 'MultiString');

            await beginEdit(sharedPage, component);
            await freeze(sharedPage, component);

            const items = component.locator('.string-item:not(.new-item)');
            const firstInput = items.first().locator('input');
            let disabled = await firstInput.getAttribute('disabled');
            expect(disabled).not.toBeNull();

            await unfreeze(sharedPage, component);

            disabled = await firstInput.getAttribute('disabled');
            expect(disabled).toBeNull();
        });
    });
});

test.describe('Tags Mode', () => {

    test.describe('Non-edit mode', () => {
        test('displays tags component in tags mode', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-string', 'MultiStringTags');

            const tags = component.locator('vi-tags');
            await expect(tags).toBeVisible();
        });

        test('does not render multi-string items', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-string', 'MultiStringTags');

            const items = component.locator('.string-item');
            await expect(items).toHaveCount(0);
        });
    });

    test.describe('Edit mode', () => {
        test('displays editable tags component after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-string', 'MultiStringTags');

            await beginEdit(sharedPage, component);

            const tags = component.locator('vi-tags');
            await expect(tags).toBeVisible();
        });
    });
});

test.describe('Tags Mode with Options', () => {

    test.describe('Edit mode', () => {
        test('displays suggestions popup when options are available', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-string', 'MultiStringTagsWithOptions');

            await beginEdit(sharedPage, component);

            const popup = component.locator('vi-popup');
            await expect(popup).toBeVisible();
        });

        test('suggestions list contains filtered options', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-string', 'MultiStringTagsWithOptions');

            await beginEdit(sharedPage, component);

            // Suggestions should be filtered (Option1 is already selected, so only Option2 and Option3 should show)
            const popup = component.locator('vi-popup');
            const suggestions = popup.locator('li');
            await expect(suggestions).toHaveCount(2);
        });
    });
});

test.describe('Tags Mode ReadOnly', () => {

    test.describe('Edit mode', () => {
        test('tags are disabled when attribute is readonly', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-string', 'MultiStringTagsReadOnly');

            await beginEdit(sharedPage, component);

            const tags = component.locator('vi-tags');
            await expect(tags).toHaveAttribute('disabled');
        });
    });
});

test.describe('TriggersRefresh', () => {

    test.describe('Edit mode', () => {
        test('editing updates value immediately, blur triggers refresh only when value changed', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-string', 'MultiStringTriggersRefresh');

            await beginEdit(sharedPage, component);

            const items = component.locator('.string-item:not(.new-item)');
            await expect(items).toHaveCount(2);

            const firstInput = items.nth(0).locator('input');
            const secondInput = items.nth(1).locator('input');

            // Verify initial values
            await expect(firstInput).toHaveValue('Test line 1');
            await expect(secondInput).toHaveValue('Test line 2');

            const refreshTracker = trackRefresh(sharedPage);

            // Focus first input and type to change "1" to "A" (using keyboard to avoid blur)
            await firstInput.click();
            await firstInput.press('End');
            await firstInput.press('Backspace');
            await firstInput.type('A');

            // Value should be updated immediately in the attribute
            const componentId = await component.getAttribute('id') as string;
            const valueAfterInput = await sharedPage.evaluate((id) => {
                const attr = (window as any).attributeMap[id];
                return attr?.value;
            }, componentId);
            expect(valueAfterInput).toBe('Test line A\nTest line 2');

            // No refresh should have been called yet (just input, no blur)
            expect(refreshTracker.called).toBe(false);

            // Now blur by clicking on second input - this should trigger refresh since value changed
            await secondInput.click();

            // Wait for potential network request
            await sharedPage.waitForTimeout(500);

            // Refresh should have been called because value changed since focus
            expect(refreshTracker.called).toBe(true);

            refreshTracker.dispose();
        });

        test('blur does not trigger refresh when value has not changed', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-string', 'MultiStringTriggersRefresh');

            await beginEdit(sharedPage, component);

            const items = component.locator('.string-item:not(.new-item)');
            const firstInput = items.nth(0).locator('input');
            const secondInput = items.nth(1).locator('input');

            // Focus first input but don't change the value
            await firstInput.click();

            const refreshTracker = trackRefresh(sharedPage);

            // Blur by clicking second input - no refresh should occur since value didn't change
            await secondInput.click();

            // Wait for potential network request
            await sharedPage.waitForTimeout(500);

            // Refresh should NOT have been called because value didn't change
            expect(refreshTracker.called).toBe(false);

            refreshTracker.dispose();
        });

        test('dragging to reorder triggers refresh immediately', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-string', 'MultiStringTriggersRefresh');

            await beginEdit(sharedPage, component);

            const items = component.locator('.string-item:not(.new-item)');
            await expect(items).toHaveCount(2);

            // Verify initial values
            const inputs = items.locator('input');
            await expect(inputs.nth(0)).toHaveValue('Test line 1');
            await expect(inputs.nth(1)).toHaveValue('Test line 2');

            const refreshTracker = trackRefresh(sharedPage);

            // Drag second item to first position
            const secondItemHandle = items.nth(1).locator('vi-icon.sort-handle');
            const firstItem = items.nth(0);

            await secondItemHandle.dragTo(firstItem, { targetPosition: { x: 10, y: 10 }, force: true });

            // Wait for potential network request
            await sharedPage.waitForTimeout(500);

            // Refresh should have been called immediately after drag reorder
            expect(refreshTracker.called).toBe(true);

            // Verify the order changed
            await expect(inputs.nth(0)).toHaveValue('Test line 2');
            await expect(inputs.nth(1)).toHaveValue('Test line 1');

            refreshTracker.dispose();
        });
    });
});

}); // End of MultiString Attribute wrapper
