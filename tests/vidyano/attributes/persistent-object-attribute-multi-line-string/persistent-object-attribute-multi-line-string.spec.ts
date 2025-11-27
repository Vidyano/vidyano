import { test, expect, Page } from '@playwright/test';
import { setupPage } from '../helpers/page';
import { setupAttribute, beginEdit, cancelEdit, save, freeze, unfreeze } from '../helpers/persistent-object';
import { startBackend, stopBackend } from '../helpers/backend';

test.describe.serial('MultiLineString Attribute Tests', () => {
    let sharedBackend: Awaited<ReturnType<typeof startBackend>>;

    test.beforeAll(async ({}, testInfo) => {
        sharedBackend = await startBackend(testInfo);
    });

    test.afterAll(async () => {
        await stopBackend(sharedBackend);
    });

test.describe('MultiLineString Attribute', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Non-edit mode', () => {
        test('displays initial multi-line value in pre element', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-line-string', 'MultiLineString');

            const pre = component.locator('pre');
            await expect(pre).toHaveText('Line 1\nLine 2\nLine 3');
        });

        test('does not render textarea element', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-line-string', 'MultiLineString');

            const textarea = component.locator('textarea');
            await expect(textarea).toHaveCount(0);
        });

        test('renders content inside vi-scroller', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-line-string', 'MultiLineString');

            const scroller = component.locator('vi-scroller');
            await expect(scroller).toBeVisible();
        });
    });

    test.describe('Edit mode', () => {
        test('displays textarea with initial value after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-line-string', 'MultiLineString');

            await beginEdit(sharedPage, component);

            const textarea = component.locator('textarea');
            await expect(textarea).toHaveValue('Line 1\nLine 2\nLine 3');
        });

        test('updates value when typing', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-line-string', 'MultiLineString');

            await beginEdit(sharedPage, component);

            const textarea = component.locator('textarea');
            await textarea.clear();
            await textarea.fill('New Line 1\nNew Line 2');

            await expect(textarea).toHaveValue('New Line 1\nNew Line 2');
        });

        test('preserves newlines in value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-line-string', 'MultiLineString');

            await beginEdit(sharedPage, component);

            const textarea = component.locator('textarea');
            await textarea.clear();
            await textarea.fill('First\nSecond\nThird\nFourth');

            await expect(textarea).toHaveValue('First\nSecond\nThird\nFourth');
        });

        test('hides pre element when in edit mode', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-line-string', 'MultiLineString');

            await beginEdit(sharedPage, component);

            const pre = component.locator('pre');
            await expect(pre).toBeHidden();
        });
    });

    test.describe('Save and Cancel', () => {
        test('returns to non-edit mode with new value after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-line-string', 'MultiLineString');

            await beginEdit(sharedPage, component);

            const textarea = component.locator('textarea');
            await textarea.clear();
            await textarea.fill('Updated Line 1\nUpdated Line 2');

            const savedValue = await save(sharedPage, component);

            expect(savedValue).toBe('Updated Line 1\nUpdated Line 2');
            const pre = component.locator('pre');
            await expect(pre).toHaveText('Updated Line 1\nUpdated Line 2');
            await expect(component.locator('textarea')).toHaveCount(0);
        });

        test('returns to non-edit mode with original value after cancel', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-line-string', 'MultiLineString');

            await beginEdit(sharedPage, component);

            const textarea = component.locator('textarea');
            await textarea.clear();
            await textarea.fill('Changed Value');

            await cancelEdit(sharedPage, component);

            const pre = component.locator('pre');
            await expect(pre).toHaveText('Line 1\nLine 2\nLine 3');
            await expect(component.locator('textarea')).toHaveCount(0);
        });
    });
});

test.describe('MultiLineString Attribute (Frozen)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Edit mode', () => {
        test('textarea becomes disabled when parent is frozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-line-string', 'MultiLineString');

            await beginEdit(sharedPage, component);

            const textarea = component.locator('textarea');
            await expect(textarea).toBeVisible();

            let disabled = await textarea.getAttribute('disabled');
            expect(disabled).toBeNull();

            await freeze(sharedPage, component);

            disabled = await textarea.getAttribute('disabled');
            expect(disabled).not.toBeNull();
        });

        test('textarea becomes enabled when parent is unfrozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-line-string', 'MultiLineString');

            await beginEdit(sharedPage, component);
            await freeze(sharedPage, component);

            const textarea = component.locator('textarea');
            let disabled = await textarea.getAttribute('disabled');
            expect(disabled).not.toBeNull();

            await unfreeze(sharedPage, component);

            disabled = await textarea.getAttribute('disabled');
            expect(disabled).toBeNull();
        });
    });
});

test.describe('MultiLineString Attribute (ReadOnly)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Edit mode', () => {
        test('displays readonly textarea when attribute is readonly', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-line-string', 'MultiLineStringReadOnly');

            await beginEdit(sharedPage, component);

            const textarea = component.locator('textarea');
            await expect(textarea).toBeVisible();
            await expect(textarea).toHaveAttribute('readonly');
        });

        test('readonly textarea displays value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-line-string', 'MultiLineStringReadOnly');

            await beginEdit(sharedPage, component);

            const textarea = component.locator('textarea');
            await expect(textarea).toHaveValue('Read Only Line 1\nRead Only Line 2');
        });
    });
});

test.describe('MultiLineString Attribute (MaxLength)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Edit mode', () => {
        test('textarea has maxlength attribute when MaxLength type hint is set', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-multi-line-string', 'MultiLineStringMaxLength');

            await beginEdit(sharedPage, component);

            const textarea = component.locator('textarea');
            await expect(textarea).toHaveAttribute('maxlength', '100');
        });
    });
});

}); // End of MultiLineString Attribute Tests wrapper
