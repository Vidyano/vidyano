import { test, expect, Page } from '@playwright/test';
import { setupPage } from '../../_helpers/page';
import { setupAttribute, beginEdit, cancelEdit, save, freeze, unfreeze } from '../_helpers/attribute';
import { startBackend, stopBackend, BackendProcess } from '../../_helpers/backend';

test.describe.serial('Password Attribute', () => {
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
        test('displays masked value "●●●●●●" instead of actual password', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-password', 'Password');

            await expect(component).toHaveText('●●●●●●');
        });

        test('does not render input element', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-password', 'Password');

            const input = component.locator('input');
            await expect(input).toHaveCount(0);
        });

        test('does not render vi-sensitive wrapper', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-password', 'Password');

            const sensitive = component.locator('vi-sensitive');
            await expect(sensitive).toHaveCount(0);
        });
    });

    test.describe('Edit mode', () => {
        test('displays password input with initial value after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-password', 'Password');

            await beginEdit(sharedPage, component);

            const input = component.locator('input[type="password"]');
            await expect(input).toBeVisible();
            await expect(input).toHaveValue('S3cr3T');
        });

        test('renders input inside vi-sensitive wrapper', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-password', 'Password');

            await beginEdit(sharedPage, component);

            const sensitive = component.locator('vi-sensitive');
            await expect(sensitive).toBeVisible();

            const input = sensitive.locator('input[type="password"]');
            await expect(input).toBeVisible();
        });

        test('input has type="password" for masked entry', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-password', 'Password');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            const type = await input.getAttribute('type');
            expect(type).toBe('password');
        });

        test('updates value when typing', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-password', 'Password');

            await beginEdit(sharedPage, component);

            const input = component.locator('input[type="password"]');
            await input.clear();
            await input.fill('NewP@ssw0rd');

            await expect(input).toHaveValue('NewP@ssw0rd');
        });

        test('handles special characters in password', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-password', 'Password');

            await beginEdit(sharedPage, component);

            const input = component.locator('input[type="password"]');
            await input.clear();
            await input.fill('P@ss!#$%&*()_+-=[]{}|;:,.<>?');

            await expect(input).toHaveValue('P@ss!#$%&*()_+-=[]{}|;:,.<>?');
        });
    });

    test.describe('Save and Cancel', () => {
        test('returns to non-edit mode with new value after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-password', 'Password');

            await beginEdit(sharedPage, component);

            const input = component.locator('input[type="password"]');
            await input.clear();
            await input.fill('UpdatedP@ss');

            const savedValue = await save(sharedPage, component);

            expect(savedValue).toBe('UpdatedP@ss');
            await expect(component).toHaveText('●●●●●●');
            await expect(component.locator('input')).toHaveCount(0);
        });

        test('returns to non-edit mode with original value after cancel', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-password', 'Password');

            await beginEdit(sharedPage, component);

            const input = component.locator('input[type="password"]');
            await input.clear();
            await input.fill('ChangedP@ss');

            await cancelEdit(sharedPage, component);

            await expect(component).toHaveText('●●●●●●');
            await expect(component.locator('input')).toHaveCount(0);
        });

        test('original value is restored after cancel', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-password', 'Password');

            await beginEdit(sharedPage, component);

            const input = component.locator('input[type="password"]');
            await input.clear();
            await input.fill('TempP@ss');

            await cancelEdit(sharedPage, component);

            await beginEdit(sharedPage, component);

            const inputAfterCancel = component.locator('input[type="password"]');
            await expect(inputAfterCancel).toHaveValue('S3cr3T');
        });
    });
});

test.describe('ReadOnly', () => {

    test.describe('Non-edit mode', () => {
        test('displays masked value "●●●●●●"', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-password', 'PasswordReadOnly');

            await expect(component).toHaveText('●●●●●●');
        });

        test('does not render input element', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-password', 'PasswordReadOnly');

            const input = component.locator('input');
            await expect(input).toHaveCount(0);
        });
    });

    test.describe('Edit mode', () => {
        test('displays input with readonly attribute when readonly', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-password', 'PasswordReadOnly');

            await beginEdit(sharedPage, component);

            const input = component.locator('input[type="password"]');
            await expect(input).toBeVisible();

            const readonly = await input.getAttribute('readonly');
            expect(readonly).not.toBeNull();
        });

        test('input shows correct value when readonly', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-password', 'PasswordReadOnly');

            await beginEdit(sharedPage, component);

            const input = component.locator('input[type="password"]');
            await expect(input).toHaveValue('S3cr3T');
        });

        test('readonly input preserves initial value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-password', 'PasswordReadOnly');

            await beginEdit(sharedPage, component);

            const input = component.locator('input[type="password"]');
            const readonly = await input.getAttribute('readonly');
            expect(readonly).not.toBeNull();

            const value = await input.inputValue();
            expect(value).toBe('S3cr3T');
        });

        test('readonly input rejects keyboard input', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-password', 'PasswordReadOnly');

            await beginEdit(sharedPage, component);

            const input = component.locator('input[type="password"]');
            const initialValue = await input.inputValue();

            await input.click();
            await input.pressSequentially('NewPassword123');

            const valueAfterTyping = await input.inputValue();
            expect(valueAfterTyping).toBe(initialValue);
        });
    });
});

test.describe('Required', () => {

    test.describe('Non-edit mode', () => {
        test('displays masked value "●●●●●●"', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-password', 'PasswordRequired');

            await expect(component).toHaveText('●●●●●●');
        });

        test('has required attribute set', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-password', 'PasswordRequired');

            const required = await component.getAttribute('required');
            expect(required).not.toBeNull();
        });
    });

    test.describe('Edit mode', () => {
        test('displays password input with initial value after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-password', 'PasswordRequired');

            await beginEdit(sharedPage, component);

            const input = component.locator('input[type="password"]');
            await expect(input).toBeVisible();
            await expect(input).toHaveValue('S3cr3T');
        });

        test('required attribute is still present in edit mode', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-password', 'PasswordRequired');

            await beginEdit(sharedPage, component);

            const required = await component.getAttribute('required');
            expect(required).not.toBeNull();
        });
    });

    test.describe('Validation', () => {
        test('allows saving when value is not empty', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-password', 'PasswordRequired');

            await beginEdit(sharedPage, component);

            const input = component.locator('input[type="password"]');
            await input.clear();
            await input.fill('ValidP@ss');

            const savedValue = await save(sharedPage, component);
            expect(savedValue).toBe('ValidP@ss');
        });
    });
});

test.describe('Frozen', () => {

    test.describe('Edit mode', () => {
        test('input becomes disabled when parent is frozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-password', 'Password');

            await beginEdit(sharedPage, component);

            const input = component.locator('input[type="password"]');
            await expect(input).toBeVisible();

            let disabled = await input.getAttribute('disabled');
            expect(disabled).toBeNull();

            await freeze(sharedPage, component);

            disabled = await input.getAttribute('disabled');
            expect(disabled).not.toBeNull();
        });

        test('input becomes enabled when parent is unfrozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-password', 'Password');

            await beginEdit(sharedPage, component);
            await freeze(sharedPage, component);

            const input = component.locator('input[type="password"]');
            let disabled = await input.getAttribute('disabled');
            expect(disabled).not.toBeNull();

            await unfreeze(sharedPage, component);

            disabled = await input.getAttribute('disabled');
            expect(disabled).toBeNull();
        });

        test('frozen input remains disabled and preserves value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-password', 'Password');

            await beginEdit(sharedPage, component);
            await freeze(sharedPage, component);

            const input = component.locator('input[type="password"]');
            const disabled = await input.getAttribute('disabled');
            expect(disabled).not.toBeNull();

            const value = await input.inputValue();
            expect(value).toBe('S3cr3T');
        });
    });
});

}); // End of Password Attribute wrapper
