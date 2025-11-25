import { test, expect, Page } from '@playwright/test';
import { setupPage } from '../helpers/page';
import { setupAttribute, beginEdit, cancelEdit, save, freeze, unfreeze } from '../helpers/persistent-object';
import { startBackend, stopBackend } from '../helpers/backend';

test.describe.serial('String Attribute Tests', () => {
    let sharedBackend: Awaited<ReturnType<typeof startBackend>>;

    test.beforeAll(async ({}, testInfo) => {
        sharedBackend = await startBackend(testInfo);
    });

    test.afterAll(async () => {
        await stopBackend(sharedBackend);
    });

test.describe('String Attribute', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Non-edit mode', () => {
        test('displays initial value "Test" in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-string', 'String');

            const span = component.locator('span');
            await expect(span).toHaveText('Test');
        });

        test('does not render input element', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-string', 'String');

            const input = component.locator('input');
            await expect(input).toHaveCount(0);
        });
    });

    test.describe('Edit mode', () => {
        test('displays input with initial value after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-string', 'String');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await expect(input).toHaveValue('Test');
        });

        test('updates value when typing', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-string', 'String');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('Hello World');

            await expect(input).toHaveValue('Hello World');
        });

        test('preserves mixed case (Normal casing)', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-string', 'String');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('MixedCaseText123');

            await expect(input).toHaveValue('MixedCaseText123');
        });

        test('does not apply text-transform style', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-string', 'String');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            const style = await input.getAttribute('style');

            expect(style === null || !style.includes('text-transform')).toBe(true);
        });
    });

    test.describe('Save and Cancel', () => {
        test('returns to non-edit mode with new value after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-string', 'String');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('Updated Value');

            const savedValue = await save(sharedPage, component);

            expect(savedValue).toBe('Updated Value');
            const span = component.locator('span');
            await expect(span).toHaveText('Updated Value');
            await expect(component.locator('input')).toHaveCount(0);
        });

        test('returns to non-edit mode with original value after cancel', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-string', 'String');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('Changed Value');

            await cancelEdit(sharedPage, component);

            const span = component.locator('span');
            await expect(span).toHaveText('Test');
            await expect(component.locator('input')).toHaveCount(0);
        });
    });
});

test.describe('StringLower Attribute', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Non-edit mode', () => {
        test('displays initial value "test" in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-string', 'StringLower');

            const span = component.locator('span');
            await expect(span).toHaveText('test');
        });

        test('does not render input element', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-string', 'StringLower');

            const input = component.locator('input');
            await expect(input).toHaveCount(0);
        });
    });

    test.describe('Edit mode', () => {
        test('displays input with initial value after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-string', 'StringLower');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await expect(input).toHaveValue('test');
        });

        test('converts uppercase input to lowercase', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-string', 'StringLower');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.pressSequentially('HELLO WORLD');

            await expect(input).toHaveValue('hello world');
        });

        test('converts mixed case input to lowercase', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-string', 'StringLower');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.pressSequentially('MixedCaseText123');

            await expect(input).toHaveValue('mixedcasetext123');
        });

        test('applies lowercase text-transform style', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-string', 'StringLower');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            const style = await input.getAttribute('style');

            expect(style).toContain('text-transform: lowercase');
        });

        test('preserves lowercase input unchanged', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-string', 'StringLower');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.pressSequentially('already lowercase');

            await expect(input).toHaveValue('already lowercase');
        });
    });

    test.describe('Save and Cancel', () => {
        test('returns to non-edit mode with new lowercase value after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-string', 'StringLower');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.pressSequentially('UPPERCASE INPUT');

            const savedValue = await save(sharedPage, component);

            expect(savedValue).toBe('uppercase input');
            const span = component.locator('span');
            await expect(span).toHaveText('uppercase input');
            await expect(component.locator('input')).toHaveCount(0);
        });

        test('returns to non-edit mode with original value after cancel', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-string', 'StringLower');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.pressSequentially('CHANGED VALUE');

            await cancelEdit(sharedPage, component);

            const span = component.locator('span');
            await expect(span).toHaveText('test');
            await expect(component.locator('input')).toHaveCount(0);
        });
    });
});

test.describe('StringUpper Attribute', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Non-edit mode', () => {
        test('displays initial value "TEST" in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-string', 'StringUpper');

            const span = component.locator('span');
            await expect(span).toHaveText('TEST');
        });

        test('does not render input element', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-string', 'StringUpper');

            const input = component.locator('input');
            await expect(input).toHaveCount(0);
        });
    });

    test.describe('Edit mode', () => {
        test('displays input with initial value after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-string', 'StringUpper');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await expect(input).toHaveValue('TEST');
        });

        test('converts lowercase input to uppercase', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-string', 'StringUpper');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.pressSequentially('hello world');

            await expect(input).toHaveValue('HELLO WORLD');
        });

        test('converts mixed case input to uppercase', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-string', 'StringUpper');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.pressSequentially('MixedCaseText123');

            await expect(input).toHaveValue('MIXEDCASETEXT123');
        });

        test('applies uppercase text-transform style', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-string', 'StringUpper');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            const style = await input.getAttribute('style');

            expect(style).toContain('text-transform: uppercase');
        });

        test('preserves uppercase input unchanged', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-string', 'StringUpper');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.pressSequentially('ALREADY UPPERCASE');

            await expect(input).toHaveValue('ALREADY UPPERCASE');
        });
    });

    test.describe('Save and Cancel', () => {
        test('returns to non-edit mode with new uppercase value after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-string', 'StringUpper');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.pressSequentially('lowercase input');

            const savedValue = await save(sharedPage, component);

            expect(savedValue).toBe('LOWERCASE INPUT');
            const span = component.locator('span');
            await expect(span).toHaveText('LOWERCASE INPUT');
            await expect(component.locator('input')).toHaveCount(0);
        });

        test('returns to non-edit mode with original value after cancel', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-string', 'StringUpper');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.pressSequentially('changed value');

            await cancelEdit(sharedPage, component);

            const span = component.locator('span');
            await expect(span).toHaveText('TEST');
            await expect(component.locator('input')).toHaveCount(0);
        });
    });
});

test.describe('String Attribute (Frozen)', () => {
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
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-string', 'String');

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
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-string', 'String');

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

}); // End of String Attribute Tests wrapper
