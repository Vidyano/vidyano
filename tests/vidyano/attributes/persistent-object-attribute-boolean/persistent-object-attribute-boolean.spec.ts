import { test, expect, Page } from '@playwright/test';
import { setupPage } from '../helpers/page';
import { setupAttribute, beginEdit, cancelEdit, save, freeze, unfreeze } from '../helpers/persistent-object';
import { startBackend, stopBackend } from '../helpers/backend';

test.describe.serial('Boolean Attribute Tests', () => {
    let sharedBackend: Awaited<ReturnType<typeof startBackend>>;

    test.beforeAll(async ({}, testInfo) => {
        sharedBackend = await startBackend(testInfo);
    });

    test.afterAll(async () => {
        await stopBackend(sharedBackend);
    });

test.describe('Boolean Attribute (Toggle mode - default)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Non-edit mode', () => {
        test('displays initial value "Yes" in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'Boolean');

            const span = component.locator('span');
            await expect(span).toHaveText('Yes');
        });

        test('does not render toggle element', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'Boolean');

            const toggle = component.locator('vi-toggle');
            await expect(toggle).toHaveCount(0);
        });
    });

    test.describe('Edit mode', () => {
        test('displays toggle with initial value after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'Boolean');

            await beginEdit(sharedPage, component);

            const toggle = component.locator('vi-toggle');
            await expect(toggle).toBeVisible();

            const toggled = await toggle.evaluate((el: any) => el.toggled);
            expect(toggled).toBe(true);
        });

        test('toggle has correct label', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'Boolean');

            await beginEdit(sharedPage, component);

            const toggle = component.locator('vi-toggle');
            const label = await toggle.getAttribute('label');

            expect(label).toBe('Yes');
        });

        test('clicking toggle changes value from true to false', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'Boolean');

            await beginEdit(sharedPage, component);

            const toggle = component.locator('vi-toggle');
            await toggle.click();

            const toggled = await toggle.evaluate((el: any) => el.toggled);
            expect(toggled).toBe(false);
        });

        test('clicking toggle twice returns to original value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'Boolean');

            await beginEdit(sharedPage, component);

            const toggle = component.locator('vi-toggle');
            await toggle.click();
            await toggle.click();

            const toggled = await toggle.evaluate((el: any) => el.toggled);
            expect(toggled).toBe(true);
        });
    });

    test.describe('Save and Cancel', () => {
        test('returns to non-edit mode with new value after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'Boolean');

            await beginEdit(sharedPage, component);

            const toggle = component.locator('vi-toggle');
            await toggle.click();

            const savedValue = await save(sharedPage, component);

            expect(savedValue).toBe(false);
            const span = component.locator('span');
            await expect(span).toHaveText('No');
            await expect(component.locator('vi-toggle')).toHaveCount(0);
        });

        test('returns to non-edit mode with original value after cancel', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'Boolean');

            await beginEdit(sharedPage, component);

            const toggle = component.locator('vi-toggle');
            await toggle.click();

            await cancelEdit(sharedPage, component);

            const span = component.locator('span');
            await expect(span).toHaveText('Yes');
            await expect(component.locator('vi-toggle')).toHaveCount(0);
        });
    });
});

test.describe('Boolean Attribute (Checkbox mode)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Non-edit mode', () => {
        test('displays initial value "No" in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'BooleanCheckbox');

            const span = component.locator('span');
            await expect(span).toHaveText('No');
        });

        test('does not render checkbox element', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'BooleanCheckbox');

            const checkbox = component.locator('vi-checkbox');
            await expect(checkbox).toHaveCount(0);
        });
    });

    test.describe('Edit mode', () => {
        test('displays checkbox with initial value after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'BooleanCheckbox');

            await beginEdit(sharedPage, component);

            const checkbox = component.locator('vi-checkbox');
            await expect(checkbox).toBeVisible();

            const checked = await checkbox.evaluate((el: any) => el.checked);
            expect(checked).toBe(false);
        });

        test('checkbox has correct label', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'BooleanCheckbox');

            await beginEdit(sharedPage, component);

            const checkbox = component.locator('vi-checkbox');
            const label = await checkbox.getAttribute('label');

            expect(label).toBe('No');
        });

        test('clicking checkbox changes value from false to true', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'BooleanCheckbox');

            await beginEdit(sharedPage, component);

            const checkbox = component.locator('vi-checkbox');
            await checkbox.click();

            const checked = await checkbox.evaluate((el: any) => el.checked);
            expect(checked).toBe(true);
        });

        test('clicking checkbox twice returns to original value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'BooleanCheckbox');

            await beginEdit(sharedPage, component);

            const checkbox = component.locator('vi-checkbox');
            await checkbox.click();
            await checkbox.click();

            const checked = await checkbox.evaluate((el: any) => el.checked);
            expect(checked).toBe(false);
        });
    });

    test.describe('Save and Cancel', () => {
        test('returns to non-edit mode with new value after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'BooleanCheckbox');

            await beginEdit(sharedPage, component);

            const checkbox = component.locator('vi-checkbox');
            await checkbox.click();

            const savedValue = await save(sharedPage, component);

            expect(savedValue).toBe(true);
            const span = component.locator('span');
            await expect(span).toHaveText('Yes');
            await expect(component.locator('vi-checkbox')).toHaveCount(0);
        });

        test('returns to non-edit mode with original value after cancel', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'BooleanCheckbox');

            await beginEdit(sharedPage, component);

            const checkbox = component.locator('vi-checkbox');
            await checkbox.click();

            await cancelEdit(sharedPage, component);

            const span = component.locator('span');
            await expect(span).toHaveText('No');
            await expect(component.locator('vi-checkbox')).toHaveCount(0);
        });
    });
});

test.describe('Boolean Attribute (ReadOnly - Toggle mode)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Non-edit mode', () => {
        test('displays initial value "Yes" in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'BooleanReadOnly');

            const span = component.locator('span');
            await expect(span).toHaveText('Yes');
        });

        test('does not render toggle element', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'BooleanReadOnly');

            const toggle = component.locator('vi-toggle');
            await expect(toggle).toHaveCount(0);
        });
    });

    test.describe('Edit mode', () => {
        test('displays disabled toggle when readonly', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'BooleanReadOnly');

            await beginEdit(sharedPage, component);

            const toggle = component.locator('vi-toggle');
            await expect(toggle).toBeVisible();

            const disabled = await toggle.getAttribute('disabled');
            expect(disabled).not.toBeNull();
        });

        test('toggle shows correct value when readonly', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'BooleanReadOnly');

            await beginEdit(sharedPage, component);

            const toggle = component.locator('vi-toggle');
            const toggled = await toggle.evaluate((el: any) => el.toggled);
            expect(toggled).toBe(true);
        });
    });
});

test.describe('Boolean Attribute (ReadOnly - Checkbox mode)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Non-edit mode', () => {
        test('displays initial value "No" in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'BooleanCheckboxReadOnly');

            const span = component.locator('span');
            await expect(span).toHaveText('No');
        });

        test('does not render checkbox element', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'BooleanCheckboxReadOnly');

            const checkbox = component.locator('vi-checkbox');
            await expect(checkbox).toHaveCount(0);
        });
    });

    test.describe('Edit mode', () => {
        test('displays disabled checkbox when readonly', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'BooleanCheckboxReadOnly');

            await beginEdit(sharedPage, component);

            const checkbox = component.locator('vi-checkbox');
            await expect(checkbox).toBeVisible();

            const disabled = await checkbox.getAttribute('disabled');
            expect(disabled).not.toBeNull();
        });

        test('checkbox shows correct value when readonly', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'BooleanCheckboxReadOnly');

            await beginEdit(sharedPage, component);

            const checkbox = component.locator('vi-checkbox');
            const checked = await checkbox.evaluate((el: any) => el.checked);
            expect(checked).toBe(false);
        });
    });
});

test.describe('Boolean Attribute (Required)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Non-edit mode', () => {
        test('displays initial value "No" in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'BooleanRequired');

            const span = component.locator('span');
            await expect(span).toHaveText('No');
        });

        test('has required attribute set', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'BooleanRequired');

            const required = await component.getAttribute('required');
            expect(required).not.toBeNull();
        });
    });

    test.describe('Edit mode', () => {
        test('displays toggle with initial value after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'BooleanRequired');

            await beginEdit(sharedPage, component);

            const toggle = component.locator('vi-toggle');
            await expect(toggle).toBeVisible();

            const toggled = await toggle.evaluate((el: any) => el.toggled);
            expect(toggled).toBe(false);
        });

        test('required attribute is still present in edit mode', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'BooleanRequired');

            await beginEdit(sharedPage, component);

            const required = await component.getAttribute('required');
            expect(required).not.toBeNull();
        });
    });

    test.describe('Validation', () => {
        test('allows saving when value is true', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'BooleanRequired');

            await beginEdit(sharedPage, component);

            const toggle = component.locator('vi-toggle');
            await toggle.click();

            const savedValue = await save(sharedPage, component);
            expect(savedValue).toBe(true);
        });

        test('can be toggled on and off', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'BooleanRequired');

            await beginEdit(sharedPage, component);

            const toggle = component.locator('vi-toggle');
            await toggle.click();

            let toggled = await toggle.evaluate((el: any) => el.toggled);
            expect(toggled).toBe(true);

            await toggle.click();

            toggled = await toggle.evaluate((el: any) => el.toggled);
            expect(toggled).toBe(false);
        });
    });
});

test.describe('Boolean Attribute (Frozen - Toggle mode)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Edit mode', () => {
        test('toggle becomes disabled when parent is frozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'Boolean');

            await beginEdit(sharedPage, component);

            const toggle = component.locator('vi-toggle');
            await expect(toggle).toBeVisible();

            let disabled = await toggle.getAttribute('disabled');
            expect(disabled).toBeNull();

            await freeze(sharedPage, component);

            disabled = await toggle.getAttribute('disabled');
            expect(disabled).not.toBeNull();
        });

        test('toggle becomes enabled when parent is unfrozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'Boolean');

            await beginEdit(sharedPage, component);
            await freeze(sharedPage, component);

            const toggle = component.locator('vi-toggle');
            let disabled = await toggle.getAttribute('disabled');
            expect(disabled).not.toBeNull();

            await unfreeze(sharedPage, component);

            disabled = await toggle.getAttribute('disabled');
            expect(disabled).toBeNull();
        });

        test('frozen toggle cannot be clicked', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'Boolean');

            await beginEdit(sharedPage, component);
            await freeze(sharedPage, component);

            const toggle = component.locator('vi-toggle');
            const initialValue = await toggle.evaluate((el: any) => el.toggled);

            await toggle.click();

            const valueAfterClick = await toggle.evaluate((el: any) => el.toggled);
            expect(valueAfterClick).toBe(initialValue);
        });
    });
});

test.describe('Boolean Attribute (Frozen - Checkbox mode)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Edit mode', () => {
        test('checkbox becomes disabled when parent is frozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'BooleanCheckbox');

            await beginEdit(sharedPage, component);

            const checkbox = component.locator('vi-checkbox');
            await expect(checkbox).toBeVisible();

            let disabled = await checkbox.getAttribute('disabled');
            expect(disabled).toBeNull();

            await freeze(sharedPage, component);

            disabled = await checkbox.getAttribute('disabled');
            expect(disabled).not.toBeNull();
        });

        test('checkbox becomes enabled when parent is unfrozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'BooleanCheckbox');

            await beginEdit(sharedPage, component);
            await freeze(sharedPage, component);

            const checkbox = component.locator('vi-checkbox');
            let disabled = await checkbox.getAttribute('disabled');
            expect(disabled).not.toBeNull();

            await unfreeze(sharedPage, component);

            disabled = await checkbox.getAttribute('disabled');
            expect(disabled).toBeNull();
        });

        test('frozen checkbox cannot be clicked', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-boolean', 'BooleanCheckbox');

            await beginEdit(sharedPage, component);
            await freeze(sharedPage, component);

            const checkbox = component.locator('vi-checkbox');
            const initialValue = await checkbox.evaluate((el: any) => el.checked);

            await checkbox.click();

            const valueAfterClick = await checkbox.evaluate((el: any) => el.checked);
            expect(valueAfterClick).toBe(initialValue);
        });
    });
});

}); // End of Boolean Attribute Tests wrapper
