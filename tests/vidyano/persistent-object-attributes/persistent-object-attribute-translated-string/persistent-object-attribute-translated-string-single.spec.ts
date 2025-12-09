import { test, expect, Page } from '@playwright/test';
import { setupPage } from '../../_helpers/page';
import { setupAttribute, beginEdit, cancelEdit, save, freeze, unfreeze } from '../_helpers/attribute';
import { startBackend, stopBackend, BackendProcess } from '../../_helpers/backend';

test.describe.serial('TranslatedString Attribute (Single Language)', () => {
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
        test('displays initial value in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-translated-string', 'TranslatedString');

            const span = component.locator('span');
            await expect(span).toHaveText('Hello');
        });

        test('does not render input element', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-translated-string', 'TranslatedString');

            const input = component.locator('input');
            await expect(input).toHaveCount(0);
        });
    });

    test.describe('Edit mode', () => {
        test('displays input with initial value after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-translated-string', 'TranslatedString');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await expect(input).toHaveValue('Hello');
        });

        test('updates value when typing', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-translated-string', 'TranslatedString');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('Hi there');

            await expect(input).toHaveValue('Hi there');
        });

        test('does not show translate button when only one language exists', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-translated-string', 'TranslatedString');

            await beginEdit(sharedPage, component);

            const translateButton = component.locator('vi-button:has(vi-icon[source="TranslatedString"])');
            await expect(translateButton).toHaveCount(0);
        });
    });

    test.describe('Save and Cancel', () => {
        test('returns to non-edit mode with new value after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-translated-string', 'TranslatedString');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('Updated Value');

            await save(sharedPage, component);

            const span = component.locator('span');
            await expect(span).toHaveText('Updated Value');
            await expect(component.locator('input')).not.toBeVisible();
        });

        test('returns to non-edit mode with original value after cancel', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-translated-string', 'TranslatedString');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await input.clear();
            await input.fill('Changed Value');

            await cancelEdit(sharedPage, component);

            const span = component.locator('span');
            await expect(span).toHaveText('Hello');
            await expect(component.locator('input')).not.toBeVisible();
        });
    });
});

test.describe('Multiline', () => {
    test.describe('Non-edit mode', () => {
        test('displays initial value in pre element', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-translated-string', 'TranslatedStringMultiline');

            const pre = component.locator('pre');
            await expect(pre).toHaveText('Line 1\nLine 2');
        });

        test('renders content inside vi-scroller', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-translated-string', 'TranslatedStringMultiline');

            const scroller = component.locator('vi-scroller');
            await expect(scroller).toBeVisible();
        });

        test('does not render input element', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-translated-string', 'TranslatedStringMultiline');

            const input = component.locator('input');
            await expect(input).toHaveCount(0);
        });
    });

    test.describe('Edit mode', () => {
        test('displays pre element with value after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-translated-string', 'TranslatedStringMultiline');

            await beginEdit(sharedPage, component);

            const pre = component.locator('pre#multiline');
            await expect(pre).toHaveText('Line 1\nLine 2');
        });

        test('shows translate button for multiline even with single language', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-translated-string', 'TranslatedStringMultiline');

            await beginEdit(sharedPage, component);

            const translateButton = component.locator('vi-button:has(vi-icon[source="TranslatedString"])');
            await expect(translateButton).toBeVisible();
        });
    });
});

test.describe('ReadOnly', () => {
    test.describe('Edit mode', () => {
        test('displays readonly input when attribute is readonly', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-translated-string', 'TranslatedStringReadOnly');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await expect(input).toHaveAttribute('readonly');
        });

        test('input has correct value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-translated-string', 'TranslatedStringReadOnly');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await expect(input).toHaveValue('Read Only');
        });
    });
});

test.describe('Frozen', () => {
    test.describe('Edit mode', () => {
        test('input becomes disabled when parent is frozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-translated-string', 'TranslatedString');

            await beginEdit(sharedPage, component);

            const input = component.locator('input');
            await expect(input).toBeVisible();
            await expect(input).not.toBeDisabled();

            await freeze(sharedPage, component);

            await expect(input).toBeDisabled();
        });

        test('input becomes enabled when parent is unfrozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-translated-string', 'TranslatedString');

            await beginEdit(sharedPage, component);
            await freeze(sharedPage, component);

            const input = component.locator('input');
            await expect(input).toBeDisabled();

            await unfreeze(sharedPage, component);

            await expect(input).not.toBeDisabled();
        });
    });
});

}); // End of TranslatedString Attribute (Single Language) wrapper
