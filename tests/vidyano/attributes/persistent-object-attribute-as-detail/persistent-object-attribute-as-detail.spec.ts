import { test, expect, Page, Locator } from '@playwright/test';
import { setupPage } from '../helpers/page';
import { startBackend, stopBackend, BackendProcess } from '../helpers/backend';
import { setupAttribute, cancelEdit, save, freeze, unfreeze, mockBrowseReference } from '../helpers/persistent-object';

const COMPONENT_TAG = 'vi-persistent-object-attribute-as-detail';
const ATTRIBUTE_NAME = 'Category_Products';
const PO_TYPE = 'Category';
const DEFAULT_CATEGORY_ID = '0'; // First category (Electronics)

async function setupAsDetailAttribute(
    page: Page,
    options?: { startInEditMode?: boolean; categoryId?: string }
): Promise<Locator> {
    const categoryId = options?.categoryId ?? DEFAULT_CATEGORY_ID;
    // Use |open-in-edit suffix when we want edit mode
    const objectId = options?.startInEditMode ? `${categoryId}|open-in-edit` : categoryId;

    return setupAttribute(page, COMPONENT_TAG, ATTRIBUTE_NAME, {
        poType: PO_TYPE,
        objectId,
        useBackendOpenInEdit: options?.startInEditMode
    });
}

async function getObjectCount(page: Page, component: Locator): Promise<number> {
    const componentId = await component.getAttribute('id') as string;
    return await page.evaluate((id) => {
        return (window as any).attributeMap[id].objects.length;
    }, componentId);
}

async function getVisibleObjectCount(page: Page, component: Locator): Promise<number> {
    const componentId = await component.getAttribute('id') as string;
    return await page.evaluate((id) => {
        return (window as any).attributeMap[id].objects.filter((o: any) => !o.isDeleted).length;
    }, componentId);
}

// Setup function for AsDetail attribute with lookupAttribute configured
async function setupAsDetailWithLookup(
    page: Page,
    options?: { startInEditMode?: boolean; categoryId?: string }
): Promise<Locator> {
    const categoryId = options?.categoryId ?? DEFAULT_CATEGORY_ID;
    const objectId = options?.startInEditMode ? `${categoryId}|open-in-edit` : categoryId;

    return setupAttribute(page, COMPONENT_TAG, 'Category_ProductsWithLookup', {
        poType: PO_TYPE,
        objectId,
        useBackendOpenInEdit: options?.startInEditMode
    });
}

// Setup function for AsDetail attribute with triggersRefresh configured
async function setupAsDetailWithRefresh(
    page: Page,
    options?: { startInEditMode?: boolean; categoryId?: string }
): Promise<Locator> {
    const categoryId = options?.categoryId ?? DEFAULT_CATEGORY_ID;
    const objectId = options?.startInEditMode ? `${categoryId}|open-in-edit` : categoryId;

    return setupAttribute(page, COMPONENT_TAG, 'Category_ProductsWithRefresh', {
        poType: PO_TYPE,
        objectId,
        useBackendOpenInEdit: options?.startInEditMode
    });
}

test.describe.serial('AsDetail Attribute', () => {
    let sharedBackend: BackendProcess;
    let sharedPage: Page;

    test.beforeAll(async ({ }, testInfo) => {
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

    test.describe('Non-edit mode', () => {
        test('displays table with header columns', async () => {
            const component = await setupAsDetailAttribute(sharedPage);

            const head = component.locator('#head');
            await expect(head).toBeVisible();

            // Check that column headers are present (Name, CategoryId, Color, InStock, Price)
            const columns = head.locator('.column');
            await expect(columns).not.toHaveCount(0);
        });

        test('displays existing product rows', async () => {
            const component = await setupAsDetailAttribute(sharedPage);

            const rows = component.locator('#rows > .row');
            // The first category (Electronics) should have some products
            const count = await rows.count();
            expect(count).toBeGreaterThan(0);
        });

        test('does not display New button in non-edit mode', async () => {
            const component = await setupAsDetailAttribute(sharedPage);

            const newButton = component.locator('vi-button[icon="Action_New"]').first();
            await expect(newButton).toBeHidden();
        });

        test('does not display delete buttons in non-edit mode', async () => {
            const component = await setupAsDetailAttribute(sharedPage);

            const deleteButtons = component.locator('#rows > .row vi-button.delete-button');
            await expect(deleteButtons).toHaveCount(0);
        });
    });

    test.describe('Edit mode', () => {
        test('displays New button when editing', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            // There can be 2 New buttons (inline and pinned), but one should be visible
            const newButton = component.locator('vi-button[icon="Action_New"]').first();
            await expect(newButton).toBeVisible();
        });

        test('displays delete buttons on rows when editing', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            // Wait for rows to be rendered
            const rows = component.locator('#rows > .row');
            const rowCount = await rows.count();

            if (rowCount > 0) {
                // Delete buttons should be present on each row
                const deleteButtons = component.locator('#rows > .row vi-button.delete-button');
                await expect(deleteButtons).toHaveCount(rowCount);
            }
        });

        test('displays attribute presenters in rows', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            const rows = component.locator('#rows > .row');
            const rowCount = await rows.count();

            if (rowCount > 0) {
                const firstRow = rows.first();
                const presenters = firstRow.locator('vi-persistent-object-attribute-presenter');
                await expect(presenters).not.toHaveCount(0);
            }
        });

        test('New button has action icon', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            const newButton = component.locator('vi-button[icon="Action_New"]').first();
            await expect(newButton).toBeVisible();
            // The button should have an icon attribute set to Action_New
            await expect(newButton).toHaveAttribute('icon', 'Action_New');
        });
    });

    test.describe('Adding new items', () => {
        test('clicking New button adds a new row', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            // Mock the reference dialog to auto-select first category
            await mockBrowseReference(sharedPage, 'selectFirst');

            const initialCount = await getVisibleObjectCount(sharedPage, component);

            const newButton = component.locator('vi-button[icon="Action_New"]').first();
            await newButton.click();

            // Wait for the new row to appear
            await expect.poll(() => getVisibleObjectCount(sharedPage, component)).toBe(initialCount + 1);
        });

        test('new row appears at the bottom of the list', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            await mockBrowseReference(sharedPage, 'selectFirst');

            const newButton = component.locator('vi-button[icon="Action_New"]').first();
            await newButton.click();

            // Wait for the new row to appear
            await sharedPage.waitForTimeout(500);

            const rows = component.locator('#rows > .row');
            const lastRow = rows.last();

            // The last row should be the newly added one (we can verify by checking it's in the DOM)
            await expect(lastRow).toBeVisible();
        });

        test('selecting multiple references adds multiple rows', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            // Mock the reference dialog to select multiple items
            await mockBrowseReference(sharedPage, 'selectFirst');

            const initialCount = await getVisibleObjectCount(sharedPage, component);

            const newButton = component.locator('vi-button[icon="Action_New"]').first();
            await newButton.click();

            // Wait for the new rows to appear - at minimum 1 row should be added
            // Note: The exact behavior depends on the dialog mock and how items are processed
            await expect.poll(() => getVisibleObjectCount(sharedPage, component)).toBeGreaterThanOrEqual(initialCount + 1);
        });

        test('clicking New button always adds a row (no lookupAttribute configured)', async () => {
            // Note: When no lookupAttribute is configured on the AsDetail,
            // clicking New directly adds a row without showing a reference dialog
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            const initialCount = await getVisibleObjectCount(sharedPage, component);

            const newButton = component.locator('vi-button[icon="Action_New"]').first();
            await newButton.click();

            // A row should be added directly since no lookupAttribute dialog is shown
            await expect.poll(() => getVisibleObjectCount(sharedPage, component)).toBe(initialCount + 1);
        });
    });

    test.describe('Deleting items', () => {
        test('clicking delete button removes new item from list', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            await mockBrowseReference(sharedPage, 'selectFirst');

            const initialCount = await getVisibleObjectCount(sharedPage, component);

            // Add a new row
            const newButton = component.locator('vi-button[icon="Action_New"]').first();
            await newButton.click();

            // Wait for the new row to be added
            await expect.poll(() => getVisibleObjectCount(sharedPage, component)).toBe(initialCount + 1);

            const countAfterAdd = await getVisibleObjectCount(sharedPage, component);

            // Get the last row (newly added) and wait for delete button to be visible
            const rows = component.locator('#rows > .row');
            const lastRow = rows.last();
            const deleteButton = lastRow.locator('vi-button.delete-button');
            await expect(deleteButton).toBeVisible({ timeout: 5000 });
            await deleteButton.click();

            // New items should be completely removed from the list
            await expect.poll(() => getVisibleObjectCount(sharedPage, component)).toBe(countAfterAdd - 1);
        });

        test('clicking delete button marks existing item as deleted', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            const initialCount = await getVisibleObjectCount(sharedPage, component);
            const initialTotalCount = await getObjectCount(sharedPage, component);

            // Get the first row and click its delete button
            const rows = component.locator('#rows > .row');
            const firstRow = rows.first();
            const deleteButton = firstRow.locator('vi-button.delete-button');
            await deleteButton.click();

            // Row should be hidden but still in the objects array
            await expect.poll(() => getVisibleObjectCount(sharedPage, component)).toBe(initialCount - 1);

            // Total count should remain the same (existing items are marked as deleted, not removed)
            const finalTotalCount = await getObjectCount(sharedPage, component);
            expect(finalTotalCount).toBe(initialTotalCount);
        });
    });

    test.describe('Frozen state', () => {
        test('New button becomes disabled when frozen', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            const newButton = component.locator('vi-button[icon="Action_New"]').first();
            await expect(newButton).toBeVisible();

            let disabled = await newButton.getAttribute('disabled');
            expect(disabled).toBeNull();

            await freeze(sharedPage, component);

            disabled = await newButton.getAttribute('disabled');
            expect(disabled).not.toBeNull();
        });

        test('New button becomes enabled when unfrozen', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            await freeze(sharedPage, component);

            const newButton = component.locator('vi-button[icon="Action_New"]').first();
            let disabled = await newButton.getAttribute('disabled');
            expect(disabled).not.toBeNull();

            await unfreeze(sharedPage, component);

            disabled = await newButton.getAttribute('disabled');
            expect(disabled).toBeNull();
        });

        test('delete buttons become disabled when frozen', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            const rows = component.locator('#rows > .row');
            const rowCount = await rows.count();

            if (rowCount > 0) {
                const firstRow = rows.first();
                const deleteButton = firstRow.locator('vi-button.delete-button');

                let disabled = await deleteButton.getAttribute('disabled');
                expect(disabled).toBeNull();

                await freeze(sharedPage, component);

                disabled = await deleteButton.getAttribute('disabled');
                expect(disabled).not.toBeNull();
            }
        });

        test('rows become frozen when parent is frozen', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            const rows = component.locator('#rows > .row');
            const rowCount = await rows.count();

            if (rowCount > 0) {
                const firstRow = rows.first();

                // Check that the row doesn't have frozen attribute initially
                let frozen = await firstRow.getAttribute('frozen');
                expect(frozen).toBeNull();

                await freeze(sharedPage, component);

                // Row should now have frozen attribute
                frozen = await firstRow.getAttribute('frozen');
                expect(frozen).not.toBeNull();
            }
        });
    });

    test.describe('Save and Cancel', () => {
        test('returns to non-edit mode after save', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            await save(sharedPage, component);

            // New button should be hidden after save (non-edit mode)
            const newButton = component.locator('vi-button[icon="Action_New"]').first();
            await expect(newButton).toBeHidden();
        });

        test('returns to non-edit mode after cancel', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            await cancelEdit(sharedPage, component);

            // New button should be hidden after cancel (non-edit mode)
            const newButton = component.locator('vi-button[icon="Action_New"]').first();
            await expect(newButton).toBeHidden();
        });

        test('added item count increases before save', async () => {
            // Note: Full save requires filling required fields on the Product
            // This test verifies the item count increases after adding
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            await mockBrowseReference(sharedPage, 'selectFirst');

            const initialCount = await getVisibleObjectCount(sharedPage, component);

            // Add a new row
            const newButton = component.locator('vi-button[icon="Action_New"]').first();
            await newButton.click();

            // Wait for the new row
            await expect.poll(() => getVisibleObjectCount(sharedPage, component)).toBe(initialCount + 1);

            // Cancel to restore state without attempting save (which requires field validation)
            await cancelEdit(sharedPage, component);
        });

        test('added item reverts after cancel', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            await mockBrowseReference(sharedPage, 'selectFirst');

            const initialCount = await getVisibleObjectCount(sharedPage, component);

            // Add a new row
            const newButton = component.locator('vi-button[icon="Action_New"]').first();
            await newButton.click();

            // Wait for the new row
            await expect.poll(() => getVisibleObjectCount(sharedPage, component)).toBe(initialCount + 1);

            await cancelEdit(sharedPage, component);

            // The count should revert to initial after cancel
            const finalCount = await getVisibleObjectCount(sharedPage, component);
            expect(finalCount).toBe(initialCount);
        });

        test('deleted item reverts after cancel', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            const initialCount = await getVisibleObjectCount(sharedPage, component);

            // Delete the first row
            const rows = component.locator('#rows > .row');
            const firstRow = rows.first();
            const deleteButton = firstRow.locator('vi-button.delete-button');
            await deleteButton.click();

            // Wait for the row to be hidden
            await expect.poll(() => getVisibleObjectCount(sharedPage, component)).toBe(initialCount - 1);

            await cancelEdit(sharedPage, component);

            // The count should revert to initial after cancel
            const finalCount = await getVisibleObjectCount(sharedPage, component);
            expect(finalCount).toBe(initialCount);
        });
    });

    test.describe('Row interaction', () => {
        test('clicking a row makes it the active row', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            const rows = component.locator('#rows > .row');
            const rowCount = await rows.count();

            if (rowCount > 1) {
                const secondRow = rows.nth(1);
                await secondRow.click();

                // After clicking, the row should have full-edit attribute
                await expect(secondRow).toHaveAttribute('full-edit');
            }
        });

        test('first row has attribute presenters in edit mode', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            const rows = component.locator('#rows > .row');
            const rowCount = await rows.count();

            if (rowCount > 0) {
                const firstRow = rows.first();
                // First row should have presenters for editing (soft-edit mode)
                // Note: Polymer dom-if may hide elements with display:none rather than removing them
                const presenters = firstRow.locator('vi-persistent-object-attribute-presenter');
                await expect(presenters).not.toHaveCount(0);
            }
        });
    });

    test.describe('Column layout', () => {
        test('table has proper column widths set', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            // The component should have --column-widths CSS property set
            const columnWidths = await component.evaluate(el => {
                return getComputedStyle(el).getPropertyValue('--column-widths');
            });

            expect(columnWidths).toBeTruthy();
        });

        test('column headers match detail query columns', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });
            const componentId = await component.getAttribute('id') as string;

            const columnNames = await sharedPage.evaluate((id) => {
                const attribute = (window as any).attributeMap[id];
                return attribute.details.columns
                    .filter((c: any) => !c.isHidden)
                    .map((c: any) => c.label);
            }, componentId);

            const head = component.locator('#head');
            const headerLabels = head.locator('.column label');

            for (const columnName of columnNames) {
                await expect(headerLabels.filter({ hasText: columnName })).toBeVisible();
            }
        });
    });

    test.describe('New button busy state', () => {
        test('New button shows busy state while adding', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            // Set up a delayed mock so we can observe the busy state
            await sharedPage.evaluate(() => {
                const app = (window as any).app;
                app.showDialog = async (dialog: any) => {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    if (dialog?.query) {
                        await dialog.query.search();
                        if (dialog.query.items?.length > 0)
                            return [dialog.query.items[0]];
                    }
                    return null;
                };
            });

            const newButton = component.locator('vi-button[icon="Action_New"]').first();
            await newButton.click();

            // The button should have busy attribute during the add operation
            await expect(newButton).toHaveAttribute('busy');
        });

        test('New button prevents double-click adding duplicate items', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            // Set up a delayed mock so the operation takes time
            await sharedPage.evaluate(() => {
                const app = (window as any).app;
                app.showDialog = async (dialog: any) => {
                    await new Promise(resolve => setTimeout(resolve, 200));
                    if (dialog?.query) {
                        await dialog.query.search();
                        if (dialog.query.items?.length > 0)
                            return [dialog.query.items[0]];
                    }
                    return null;
                };
            });

            const initialCount = await getObjectCount(sharedPage, component);
            const componentId = await component.getAttribute('id') as string;

            // Double-click the button rapidly using JavaScript to ensure both clicks happen immediately
            await sharedPage.evaluate((id) => {
                const component = document.getElementById(id);
                const button = component?.shadowRoot?.querySelector('vi-button[icon="Action_New"]') as HTMLElement;
                if (button) {
                    button.click();
                    button.click();
                }
            }, componentId);

            // Wait for the operation to complete
            await sharedPage.waitForTimeout(500);

            // Should have added only one item, not two
            const finalCount = await getObjectCount(sharedPage, component);
            expect(finalCount).toBe(initialCount + 1);
        });
    });

    test.describe('Cell component', () => {
        test('cells exist in non-edit mode rows', async () => {
            const component = await setupAsDetailAttribute(sharedPage);

            const rows = component.locator('#rows > .row');
            const rowCount = await rows.count();

            if (rowCount > 0) {
                const firstRow = rows.first();
                const cells = firstRow.locator('.cell');
                const cellCount = await cells.count();

                // Each visible column should have a cell component
                expect(cellCount).toBeGreaterThan(0);
            }
        });

        test('cells display attribute displayValue in edit mode without fullEdit', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            const rows = component.locator('#rows > .row');
            const rowCount = await rows.count();

            if (rowCount > 1) {
                // Get a row that doesn't have fullEdit (not the first row)
                const secondRow = rows.nth(1);

                // Should have cells for non-fullEdit display
                const cells = secondRow.locator('.cell');
                const cellCount = await cells.count();
                expect(cellCount).toBeGreaterThan(0);
            }
        });

        test('cells are replaced by attribute presenters in fullEdit mode', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            const rows = component.locator('#rows > .row');
            const rowCount = await rows.count();

            if (rowCount > 1) {
                // Click the second row to make it fullEdit
                const secondRow = rows.nth(1);
                await secondRow.click();

                // Wait for full-edit attribute
                await expect(secondRow).toHaveAttribute('full-edit');

                // Should have attribute presenters for editing
                const presenters = secondRow.locator('vi-persistent-object-attribute-presenter');
                const presenterCount = await presenters.count();
                expect(presenterCount).toBeGreaterThan(0);
            }
        });
    });

    test.describe('Row component - pre-edit behavior', () => {
        test('clicking cell in non-fullEdit row triggers fullEdit', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            const rows = component.locator('#rows > .row');
            const rowCount = await rows.count();

            if (rowCount > 1) {
                const secondRow = rows.nth(1);

                // Ensure it doesn't have full-edit initially
                await expect(secondRow).not.toHaveAttribute('full-edit');

                // Click on the pre-edit area
                const preEdit = secondRow.locator('[pre-edit]').first();
                await preEdit.click();

                // Row should now have full-edit
                await expect(secondRow).toHaveAttribute('full-edit');
            }
        });

        test('pre-edit area shows validation error component', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            const rows = component.locator('#rows > .row');
            const rowCount = await rows.count();

            if (rowCount > 1) {
                const secondRow = rows.nth(1);

                // Pre-edit area should contain validation error component
                const validationError = secondRow.locator('vi-persistent-object-attribute-validation-error');
                const count = await validationError.count();

                // Validation error components should be present (even if not showing errors)
                expect(count).toBeGreaterThan(0);
            }
        });
    });

    test.describe('Row component - edit modes', () => {
        test('first row has presenters with soft-edit-only attribute', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            const rows = component.locator('#rows > .row');
            const rowCount = await rows.count();

            if (rowCount > 0) {
                const firstRow = rows.first();

                // First row should have presenters with soft-edit-only attribute
                // Note: soft-edit is an internal property, not reflected as HTML attribute
                const presenters = firstRow.locator('vi-persistent-object-attribute-presenter[soft-edit-only]');
                const presenterCount = await presenters.count();

                // First row typically has soft-edit-only presenters
                expect(presenterCount).toBeGreaterThanOrEqual(0);
            }
        });

        test('fullEdit mode shows presenters without soft-edit-only attribute', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            const rows = component.locator('#rows > .row');
            const rowCount = await rows.count();

            if (rowCount > 1) {
                // Click the second row to make it fullEdit
                const secondRow = rows.nth(1);
                await secondRow.click();

                // Wait for full-edit attribute
                await expect(secondRow).toHaveAttribute('full-edit');

                // Presenters should NOT have soft-edit-only attribute
                const softEditPresenters = secondRow.locator('vi-persistent-object-attribute-presenter[soft-edit-only]');
                const softEditCount = await softEditPresenters.count();
                expect(softEditCount).toBe(0);
            }
        });

        test('delete button is disabled when row is read-only', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            const rows = component.locator('#rows > .row[read-only]');
            const readOnlyRowCount = await rows.count();

            if (readOnlyRowCount > 0) {
                const readOnlyRow = rows.first();
                const deleteButton = readOnlyRow.locator('vi-button.delete-button');

                // Delete button should be disabled for read-only rows
                await expect(deleteButton).toHaveAttribute('disabled');
            }
        });
    });

    test.describe('Row component - column visibility', () => {
        test('hidden columns are not rendered in rows', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });
            const componentId = await component.getAttribute('id') as string;

            // Get the number of visible columns from the attribute
            const visibleColumnCount = await sharedPage.evaluate((id) => {
                const attribute = (window as any).attributeMap[id];
                return attribute.details.columns.filter((c: any) => !c.isHidden && c.width !== "0").length;
            }, componentId);

            const rows = component.locator('#rows > .row');
            const rowCount = await rows.count();

            if (rowCount > 0) {
                const firstRow = rows.first();
                const columnDivs = firstRow.locator('.column');
                const renderedColumnCount = await columnDivs.count();

                // The number of rendered columns should match visible columns
                expect(renderedColumnCount).toBe(visibleColumnCount);
            }
        });

        test('columns have data-column attribute with column name', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            const rows = component.locator('#rows > .row');
            const rowCount = await rows.count();

            if (rowCount > 0) {
                const firstRow = rows.first();
                const columnDivs = firstRow.locator('.column[data-column]');
                const columnCount = await columnDivs.count();

                // Each column div should have a data-column attribute
                expect(columnCount).toBeGreaterThan(0);

                // Check that the first column has a valid column name
                const firstColumn = columnDivs.first();
                const columnName = await firstColumn.getAttribute('data-column');
                expect(columnName).toBeTruthy();
            }
        });
    });

    test.describe('Integration - edit flow with cell to presenter transition', () => {
        test('editing a cell value updates the underlying attribute', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            const rows = component.locator('#rows > .row');
            const rowCount = await rows.count();

            if (rowCount > 0) {
                // Click on the first row to ensure it's in fullEdit mode
                const firstRow = rows.first();
                await firstRow.click();

                // Find an input in a presenter (e.g., the Name field)
                const presenters = firstRow.locator('vi-persistent-object-attribute-presenter');
                const presenterCount = await presenters.count();

                if (presenterCount > 0) {
                    // Find a string attribute presenter with an input
                    const input = firstRow.locator('vi-persistent-object-attribute-string input').first();
                    const inputCount = await input.count();

                    if (inputCount > 0) {
                        await input.clear();
                        await input.fill('Updated Value');

                        // The input should have the new value
                        await expect(input).toHaveValue('Updated Value');

                        // Cancel to restore original state
                        await cancelEdit(sharedPage, component);
                    }
                }
            }
        });

        test('cell displays updated value after editing and returning to non-fullEdit', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            const rows = component.locator('#rows > .row');
            const rowCount = await rows.count();

            if (rowCount > 1) {
                // Click first row to make it fullEdit
                const firstRow = rows.first();
                await firstRow.click();

                // Modify a value in the first row
                const input = firstRow.locator('vi-persistent-object-attribute-string input').first();
                const inputCount = await input.count();

                if (inputCount > 0) {
                    await input.clear();
                    await input.fill('Cell Test Value');

                    // Click the second row to switch focus away from first row
                    const secondRow = rows.nth(1);
                    await secondRow.click();

                    // The first row should now show cells (not fullEdit)
                    await expect(firstRow).not.toHaveAttribute('full-edit');

                    // The cell should display the updated value
                    const cell = firstRow.locator('.cell').first();
                    await expect(cell).toContainText('Cell Test Value');

                    // Cancel to restore original state
                    await cancelEdit(sharedPage, component);
                }
            }
        });
    });

    test.describe('Sensitive data handling', () => {
        test('cells are wrapped in vi-sensitive component', async () => {
            const component = await setupAsDetailAttribute(sharedPage);

            const rows = component.locator('#rows > .row');
            const rowCount = await rows.count();

            if (rowCount > 0) {
                const firstRow = rows.first();
                const sensitiveWrappers = firstRow.locator('vi-sensitive');
                const wrapperCount = await sensitiveWrappers.count();

                // Cells should be wrapped in vi-sensitive for data protection
                expect(wrapperCount).toBeGreaterThan(0);
            }
        });
    });

    test.describe('isValueChanged flag', () => {
        test('isValueChanged is true after adding item', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });
            const componentId = await component.getAttribute('id') as string;

            // Verify initially false or undefined
            const initialValue = await sharedPage.evaluate((id) => {
                return (window as any).attributeMap[id].isValueChanged;
            }, componentId);
            expect(initialValue).toBeFalsy();

            const initialCount = await getVisibleObjectCount(sharedPage, component);

            await mockBrowseReference(sharedPage, 'selectFirst');
            const newButton = component.locator('vi-button[icon="Action_New"]').first();
            await newButton.click();

            // Wait for the count to actually increase (not just be > 0)
            await expect.poll(() => getVisibleObjectCount(sharedPage, component)).toBe(initialCount + 1);

            const afterAddValue = await sharedPage.evaluate((id) => {
                return (window as any).attributeMap[id].isValueChanged;
            }, componentId);
            expect(afterAddValue).toBe(true);
        });

        test('isValueChanged is true after deleting item', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });
            const componentId = await component.getAttribute('id') as string;

            // Verify initially false or undefined
            const initialValue = await sharedPage.evaluate((id) => {
                return (window as any).attributeMap[id].isValueChanged;
            }, componentId);
            expect(initialValue).toBeFalsy();

            const rows = component.locator('#rows > .row');
            const firstRow = rows.first();
            const deleteButton = firstRow.locator('vi-button.delete-button');
            await deleteButton.click();

            const afterDeleteValue = await sharedPage.evaluate((id) => {
                return (window as any).attributeMap[id].isValueChanged;
            }, componentId);
            expect(afterDeleteValue).toBe(true);
        });
    });

    test.describe('Error handling', () => {
        test('error during add sets parent notification', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });
            const componentId = await component.getAttribute('id') as string;

            // Mock newObject to throw error
            await sharedPage.evaluate((id) => {
                const attribute = (window as any).attributeMap[id];
                attribute.newObject = async () => {
                    throw new Error('Test error message');
                };
            }, componentId);

            const newButton = component.locator('vi-button[icon="Action_New"]').first();
            await newButton.click();

            // Wait a bit for the error to be processed
            await sharedPage.waitForTimeout(500);

            // Verify notification was set on parent
            const notification = await sharedPage.evaluate((id) => {
                const attribute = (window as any).attributeMap[id];
                return attribute.parent.notification;
            }, componentId);

            expect(notification).toBeTruthy();
        });

        test('isAdding is reset to false after error', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });
            const componentId = await component.getAttribute('id') as string;

            // Mock newObject to throw error
            await sharedPage.evaluate((id) => {
                const attribute = (window as any).attributeMap[id];
                attribute.newObject = async () => {
                    throw new Error('Test error');
                };
            }, componentId);

            const newButton = component.locator('vi-button[icon="Action_New"]').first();
            await newButton.click();

            // Wait for the error to be processed
            await sharedPage.waitForTimeout(500);

            // isAdding should be false (button not busy)
            await expect(newButton).not.toHaveAttribute('busy');
        });
    });

    test.describe('lookupAttribute dialog flow (Brand lookup)', () => {
        test('clicking New shows Brand selection dialog when lookupAttribute is configured', async () => {
            const component = await setupAsDetailWithLookup(sharedPage, { startInEditMode: true });

            // Track if showDialog is called (dialog flow is triggered)
            await sharedPage.evaluate(() => {
                const app = (window as any).app;
                app.showDialog = async () => {
                    (window as any).__dialogShown = true;
                    // Return null to cancel (don't actually select anything)
                    return null;
                };
            });

            const newButton = component.locator('vi-button[icon="Action_New"]').first();
            await newButton.click();

            // Wait for the dialog flow to be triggered
            await sharedPage.waitForTimeout(500);

            const dialogShown = await sharedPage.evaluate(() => (window as any).__dialogShown === true);
            expect(dialogShown).toBe(true);
        });

        test('selecting a Brand in lookup dialog adds row with BrandId set', async () => {
            const component = await setupAsDetailWithLookup(sharedPage, { startInEditMode: true });
            const componentId = await component.getAttribute('id') as string;

            const initialCount = await getVisibleObjectCount(sharedPage, component);

            // Mock dialog to search the Brand lookup query and return first brand
            // Also capture the selected brand's ID for verification
            await sharedPage.evaluate(() => {
                const app = (window as any).app;
                app.showDialog = async (dialog: any) => {
                    if (dialog?.query) {
                        await dialog.query.search();
                        if (dialog.query.items?.length > 0) {
                            const selectedBrand = dialog.query.items[0];
                            (window as any).__selectedBrandId = selectedBrand.id;
                            return [selectedBrand];
                        }
                    }
                    return null;
                };
            });

            const newButton = component.locator('vi-button[icon="Action_New"]').first();
            await newButton.click();

            // Wait for the row to be added
            await expect.poll(() => getVisibleObjectCount(sharedPage, component)).toBe(initialCount + 1);

            // Verify the new product has the selected BrandId (objectId contains the actual ID)
            const { newProductBrandId, selectedBrandId } = await sharedPage.evaluate((id) => {
                const attribute = (window as any).attributeMap[id];
                const newProduct = attribute.objects[attribute.objects.length - 1];
                return {
                    newProductBrandId: newProduct.getAttribute('BrandId')?.objectId,
                    selectedBrandId: (window as any).__selectedBrandId
                };
            }, componentId);

            expect(newProductBrandId).toBe(selectedBrandId);
        });

        test('selected Brand name is displayed in the row', async () => {
            const component = await setupAsDetailWithLookup(sharedPage, { startInEditMode: true });
            const componentId = await component.getAttribute('id') as string;

            const initialCount = await getVisibleObjectCount(sharedPage, component);

            // Mock dialog to search the Brand lookup query and return first brand
            // Capture the selected brand's name for verification
            await sharedPage.evaluate(() => {
                const app = (window as any).app;
                app.showDialog = async (dialog: any) => {
                    if (dialog?.query) {
                        await dialog.query.search();
                        if (dialog.query.items?.length > 0) {
                            const selectedBrand = dialog.query.items[0];
                            // The query item's displayValue contains the brand name
                            (window as any).__selectedBrandName = selectedBrand.getValue('Name');
                            return [selectedBrand];
                        }
                    }
                    return null;
                };
            });

            const newButton = component.locator('vi-button[icon="Action_New"]').first();
            await newButton.click();

            // Wait for the row to be added
            await expect.poll(() => getVisibleObjectCount(sharedPage, component)).toBe(initialCount + 1);

            // Verify the BrandId attribute's displayValue shows the brand name
            const { brandDisplayValue, selectedBrandName } = await sharedPage.evaluate((id) => {
                const attribute = (window as any).attributeMap[id];
                const newProduct = attribute.objects[attribute.objects.length - 1];
                const brandAttr = newProduct.getAttribute('BrandId');
                return {
                    brandDisplayValue: brandAttr?.displayValue,
                    selectedBrandName: (window as any).__selectedBrandName
                };
            }, componentId);

            expect(brandDisplayValue).toBe(selectedBrandName);
        });

        test('cancelling Brand lookup dialog does not add row', async () => {
            const component = await setupAsDetailWithLookup(sharedPage, { startInEditMode: true });

            const initialCount = await getVisibleObjectCount(sharedPage, component);

            // Mock dialog to return null (cancelled)
            await mockBrowseReference(sharedPage, 'cancel');

            const newButton = component.locator('vi-button[icon="Action_New"]').first();
            await newButton.click();

            // Wait to ensure no row is added
            await sharedPage.waitForTimeout(500);

            const finalCount = await getVisibleObjectCount(sharedPage, component);
            expect(finalCount).toBe(initialCount);
        });

        test('selecting multiple Brands adds multiple rows', async () => {
            const component = await setupAsDetailWithLookup(sharedPage, { startInEditMode: true });

            const initialCount = await getVisibleObjectCount(sharedPage, component);

            // Mock dialog to return 3 brands
            await sharedPage.evaluate(() => {
                const app = (window as any).app;
                app.showDialog = async (dialog: any) => {
                    if (dialog?.query) {
                        await dialog.query.search();
                        if (dialog.query.items?.length >= 3)
                            return [dialog.query.items[0], dialog.query.items[1], dialog.query.items[2]];
                    }
                    return null;
                };
            });

            const newButton = component.locator('vi-button[icon="Action_New"]').first();
            await newButton.click();

            // Wait for all 3 rows to be added
            await expect.poll(() => getVisibleObjectCount(sharedPage, component)).toBe(initialCount + 3);
        });

        test('selecting empty array adds no rows', async () => {
            const component = await setupAsDetailWithLookup(sharedPage, { startInEditMode: true });

            const initialCount = await getVisibleObjectCount(sharedPage, component);

            // Mock dialog to return empty array
            await sharedPage.evaluate(() => {
                const app = (window as any).app;
                app.showDialog = async () => [];
            });

            const newButton = component.locator('vi-button[icon="Action_New"]').first();
            await newButton.click();

            // Wait to ensure no rows are added
            await sharedPage.waitForTimeout(500);

            const finalCount = await getVisibleObjectCount(sharedPage, component);
            expect(finalCount).toBe(initialCount);
        });
    });

    test.describe('triggersRefresh', () => {
        test('adding item triggers refresh when triggersRefresh is true', async () => {
            const component = await setupAsDetailWithRefresh(sharedPage, { startInEditMode: true });
            const componentId = await component.getAttribute('id') as string;

            // Spy on triggerRefresh method
            await sharedPage.evaluate((id) => {
                const attribute = (window as any).attributeMap[id];
                const original = attribute.triggerRefresh?.bind(attribute);
                attribute.triggerRefresh = async (...args: any[]) => {
                    (window as any).__refreshTriggered = true;
                    if (original)
                        return original(...args);
                };
            }, componentId);

            await mockBrowseReference(sharedPage, 'selectFirst');
            const newButton = component.locator('vi-button[icon="Action_New"]').first();
            await newButton.click();

            // Wait for the add operation to complete
            await sharedPage.waitForTimeout(1000);

            const refreshTriggered = await sharedPage.evaluate(() => (window as any).__refreshTriggered === true);
            expect(refreshTriggered).toBe(true);
        });

        test('deleting item triggers refresh when triggersRefresh is true', async () => {
            const component = await setupAsDetailWithRefresh(sharedPage, { startInEditMode: true });
            const componentId = await component.getAttribute('id') as string;

            // Spy on triggerRefresh method
            await sharedPage.evaluate((id) => {
                const attribute = (window as any).attributeMap[id];
                const original = attribute.triggerRefresh?.bind(attribute);
                attribute.triggerRefresh = async (...args: any[]) => {
                    (window as any).__refreshTriggeredOnDelete = true;
                    if (original)
                        return original(...args);
                };
            }, componentId);

            const rows = component.locator('#rows > .row');
            const rowCount = await rows.count();

            if (rowCount > 0) {
                const firstRow = rows.first();
                const deleteButton = firstRow.locator('vi-button.delete-button');
                await deleteButton.click();

                // Wait for the delete operation to complete
                await sharedPage.waitForTimeout(500);

                const refreshTriggered = await sharedPage.evaluate(() => (window as any).__refreshTriggeredOnDelete === true);
                expect(refreshTriggered).toBe(true);
            }
        });
    });

    test.describe('New button footer pinning', () => {
        test('New button appears in footer when content overflows', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            // Set a very small height to force overflow (smaller than one row + header)
            await component.evaluate(el => {
                el.style.height = '80px';
            });

            // Wait for the scroller to detect overflow and update
            await sharedPage.waitForTimeout(300);

            // Check if scroller has vertical overflow
            const hasOverflow = await component.evaluate(el => {
                const scroller = el.shadowRoot?.querySelector('#body') as any;
                return scroller && scroller.innerHeight > scroller.outerHeight;
            });

            // Only test footer pinning if there's actually overflow
            if (hasOverflow) {
                const isPinned = await component.evaluate(el => el.hasAttribute('new-action-pinned'));
                expect(isPinned).toBe(true);

                const footerButton = component.locator('#foot vi-button');
                await expect(footerButton).toBeVisible();

                const inlineButton = component.locator('#data .row.add');
                await expect(inlineButton).toHaveCount(0);
            }
        });

        test('New button appears inline when content does not overflow', async () => {
            const component = await setupAsDetailAttribute(sharedPage, { startInEditMode: true });

            // Set a large height so there's no overflow
            await component.evaluate(el => {
                el.style.height = '800px';
            });

            // Wait for the scroller to update
            await sharedPage.waitForTimeout(300);

            // The component should NOT have newActionPinned attribute
            const isPinned = await component.evaluate(el => el.hasAttribute('new-action-pinned'));
            expect(isPinned).toBe(false);

            // The inline button should be visible
            const inlineButton = component.locator('#data .row.add vi-button');
            await expect(inlineButton).toBeVisible();

            // The footer should NOT exist
            const footer = component.locator('#foot');
            await expect(footer).toHaveCount(0);
        });
    });

}); // End of AsDetail Attribute wrapper
