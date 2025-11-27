import { test, expect, Page } from '@playwright/test';
import { setupPage } from '../helpers/page';
import { setupAttribute, beginEdit, cancelEdit, save, freeze, unfreeze } from '../helpers/persistent-object';
import { startBackend, stopBackend } from '../helpers/backend';

test.describe.serial('Icon Attribute Tests', () => {
    let sharedBackend: Awaited<ReturnType<typeof startBackend>>;

    test.beforeAll(async ({}, testInfo) => {
        sharedBackend = await startBackend(testInfo);
    });

    test.afterAll(async () => {
        await stopBackend(sharedBackend);
    });

test.describe('Icon Attribute (Standard)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Non-edit mode', () => {
        test('displays initial value "Action_Edit" in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-icon', 'Icon');

            const span = component.locator('span');
            await expect(span).toHaveText('Action_Edit');
        });

        test('displays vi-icon with correct source', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-icon', 'Icon');

            const icon = component.locator('vi-icon');
            await expect(icon).toBeVisible();
            await expect(icon).toHaveAttribute('source', 'Action_Edit');
        });

        test('does not render input element', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-icon', 'Icon');

            const input = component.locator('input');
            await expect(input).toBeHidden();
        });
    });

    test.describe('Edit mode', () => {
        test('displays input with initial value after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-icon', 'Icon');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await expect(input).toHaveValue('Action_Edit');
        });

        test('displays vi-icon with current value in edit mode', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-icon', 'Icon');

            await beginEdit(sharedPage, component);

            const icon = component.locator('vi-popup div.value vi-icon');
            await expect(icon).toBeVisible();
            await expect(icon).toHaveAttribute('source', 'Action_Edit');
        });

        test('can type to filter icons', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-icon', 'Icon');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('Action_New');

            await expect(input).toHaveValue('Action_New');
        });
    });

    test.describe('Popup icon selection', () => {
        test('opens popup when clicking on header', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-icon', 'Icon');

            await beginEdit(sharedPage, component);

            const popup = component.locator('vi-popup');
            await popup.click();

            // Wait for popup to open (scroller becomes visible)
            const scroller = component.locator('vi-scroller');
            await expect(scroller).toBeVisible();
        });

        test('displays icon grid in popup', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-icon', 'Icon');

            await beginEdit(sharedPage, component);

            const popup = component.locator('vi-popup');
            await popup.click();

            const iconGrid = component.locator('.icon-grid');
            await expect(iconGrid).toBeVisible();
        });

        test('displays icons in the grid', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-icon', 'Icon');

            await beginEdit(sharedPage, component);

            const popup = component.locator('vi-popup');
            await popup.click();

            const icons = component.locator('.icon-grid .icon');
            const count = await icons.count();
            expect(count).toBeGreaterThan(0);
        });

        test('selects icon when clicking on it in grid', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-icon', 'Icon');

            await beginEdit(sharedPage, component);

            const popup = component.locator('vi-popup');
            await popup.click();

            // Find and click on Action_New icon in the grid
            const iconToSelect = component.locator('.icon-grid .icon').filter({
                has: sharedPage.locator('vi-icon[source="Action_New"]')
            });
            await iconToSelect.click();

            // Verify the value was updated
            const input = component.locator('input');
            await expect(input).toHaveValue('Action_New');
        });

        test('closes popup after selecting an icon', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-icon', 'Icon');

            await beginEdit(sharedPage, component);

            const popup = component.locator('vi-popup');
            await popup.click();

            // Verify popup is open (scroller is visible)
            const scroller = component.locator('vi-scroller');
            await expect(scroller).toBeVisible();

            // Select an icon
            const iconToSelect = component.locator('.icon-grid .icon').filter({
                has: sharedPage.locator('vi-icon[source="Action_New"]')
            });
            await iconToSelect.click();

            // Verify popup is closed (scroller is hidden)
            await expect(scroller).toBeHidden();
        });
    });

    test.describe('Save and Cancel', () => {
        test('returns to non-edit mode with new value after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-icon', 'Icon');

            await beginEdit(sharedPage, component);

            const popup = component.locator('vi-popup');
            await popup.click();

            // Select Action_New icon
            const iconToSelect = component.locator('.icon-grid .icon').filter({
                has: sharedPage.locator('vi-icon[source="Action_New"]')
            });
            await iconToSelect.click();

            const savedValue = await save(sharedPage, component);

            expect(savedValue).toBe('Action_New');
            const span = component.locator('span');
            await expect(span).toHaveText('Action_New');
            await expect(component.locator('input')).toBeHidden();
        });

        test('returns to non-edit mode with original value after cancel', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-icon', 'Icon');

            await beginEdit(sharedPage, component);

            const popup = component.locator('vi-popup');
            await popup.click();

            // Select a different icon
            const iconToSelect = component.locator('.icon-grid .icon').filter({
                has: sharedPage.locator('vi-icon[source="Action_Delete"]')
            });
            await iconToSelect.click();

            await cancelEdit(sharedPage, component);

            const span = component.locator('span');
            await expect(span).toHaveText('Action_Edit');
            await expect(component.locator('input')).toBeHidden();
        });

        test('can clear icon to null after saving a value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-icon', 'Icon');

            // First, select and save an icon
            await beginEdit(sharedPage, component);
            let popup = component.locator('vi-popup');
            await popup.click();

            const iconToSelect = component.locator('.icon-grid .icon').filter({
                has: sharedPage.locator('vi-icon[source="Action_New"]')
            });
            await iconToSelect.click();
            await save(sharedPage, component);

            // Now edit again and select null (first option for non-required field)
            await beginEdit(sharedPage, component);
            popup = component.locator('vi-popup');
            await popup.click();

            // Select the null/empty option (first in list for non-required)
            const nullIcon = component.locator('.icon-grid .icon').first();
            await nullIcon.click();

            // Verify input is empty
            const input = component.locator('input');
            await expect(input).toHaveValue('');

            // Verify vi-icon in edit mode header is cleared (no SVG content)
            const headerIcon = component.locator('vi-popup div.value vi-icon');
            const svgHost = headerIcon.locator('#svgHost');
            await expect(svgHost).toBeEmpty();
        });
    });
});

test.describe('Icon Attribute (ReadOnly)', () => {
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
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-icon', 'IconReadOnly');

            const span = component.locator('span');
            await expect(span).toHaveText('Action_New');
        });

        test('displays vi-icon with correct source', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-icon', 'IconReadOnly');

            const icon = component.locator('vi-icon');
            await expect(icon).toBeVisible();
            await expect(icon).toHaveAttribute('source', 'Action_New');
        });
    });

    test.describe('Edit mode', () => {
        test('displays readonly input', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-icon', 'IconReadOnly');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await expect(input).toHaveAttribute('readonly');
        });

        test('displays input with initial value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-icon', 'IconReadOnly');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await expect(input).toHaveValue('Action_New');
        });
    });
});

test.describe('Icon Attribute (Required)', () => {
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
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-icon', 'IconRequired');

            const span = component.locator('span');
            await expect(span).toHaveText('—');
        });
    });

    test.describe('Edit mode', () => {
        test('displays input with empty value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-icon', 'IconRequired');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await expect(input).toHaveValue('');
        });

        test('can select icon from popup', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-icon', 'IconRequired');

            await beginEdit(sharedPage, component);

            const popup = component.locator('vi-popup');
            await popup.click();

            // Select Action_Edit icon
            const iconToSelect = component.locator('.icon-grid .icon').filter({
                has: sharedPage.locator('vi-icon[source="Action_Edit"]')
            });
            await iconToSelect.click();

            const input = component.locator('input');
            await expect(input).toHaveValue('Action_Edit');
        });

        test('required field should not have null option in dropdown', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-icon', 'IconRequired');

            await beginEdit(sharedPage, component);

            const popup = component.locator('vi-popup');
            await popup.click();

            // For required fields, null should not be in the icons list
            // The first icon in grid should not be empty/null
            const firstIcon = component.locator('.icon-grid .icon').first();
            const firstIconSource = firstIcon.locator('vi-icon');
            const source = await firstIconSource.getAttribute('source');
            expect(source).not.toBeNull();
            expect(source).not.toBe('');
        });
    });
});

test.describe('Icon Attribute (Empty)', () => {
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
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-icon', 'IconEmpty');

            const span = component.locator('span');
            await expect(span).toHaveText('—');
        });
    });

    test.describe('Edit mode', () => {
        test('non-required field should have null option in dropdown', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-icon', 'IconEmpty');

            await beginEdit(sharedPage, component);

            const popup = component.locator('vi-popup');
            await popup.click();

            // For non-required fields, null should be the first option
            const firstIcon = component.locator('.icon-grid .icon').first();
            const firstIconSource = firstIcon.locator('vi-icon');
            const source = await firstIconSource.getAttribute('source');
            expect(source === null || source === '').toBeTruthy();
        });
    });
});

test.describe('Icon Attribute (Frozen)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Edit mode', () => {
        test('input becomes disabled when parent is frozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-icon', 'Icon');

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
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-icon', 'Icon');

            await beginEdit(sharedPage, component);
            await freeze(sharedPage, component);

            const input = component.locator('input');
            let disabled = await input.getAttribute('disabled');
            expect(disabled).not.toBeNull();

            await unfreeze(sharedPage, component);

            disabled = await input.getAttribute('disabled');
            expect(disabled).toBeNull();
        });
    });
});

}); // End of Icon Attribute Tests wrapper
