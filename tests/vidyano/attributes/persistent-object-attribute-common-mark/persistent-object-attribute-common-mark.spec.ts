import { test, expect, Page } from '@playwright/test';
import { setupPage } from '../helpers/page';
import { setupAttribute, beginEdit, cancelEdit, save, freeze, unfreeze } from '../helpers/persistent-object';
import { startBackend, stopBackend, BackendProcess } from '../helpers/backend';

test.describe.serial('CommonMark Attribute Tests', () => {
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

test.describe('CommonMark Attribute', () => {
    test.describe('Non-edit mode', () => {
        test('displays rendered markdown via vi-marked component', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-common-mark', 'CommonMark');

            const marked = component.locator('vi-marked');
            await expect(marked).toBeVisible();

            // The markdown "**Hello world!**" should be rendered as bold text
            const strong = marked.locator('strong');
            await expect(strong).toHaveText('Hello world!');
        });

        test('does not render textarea element', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-common-mark', 'CommonMark');

            const textarea = component.locator('textarea');
            await expect(textarea).toBeHidden();
        });
    });

    test.describe('Edit mode', () => {
        test('displays textarea with initial value after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-common-mark', 'CommonMark');

            await beginEdit(sharedPage, component);

            const textarea = component.locator('textarea');
            await expect(textarea).toHaveValue('**Hello world!**');
        });

        test('updates value when typing', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-common-mark', 'CommonMark');

            await beginEdit(sharedPage, component);

            const textarea = component.locator('textarea');
            await textarea.clear();
            await textarea.fill('# New Heading');

            await expect(textarea).toHaveValue('# New Heading');
        });

        test('supports multiline content', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-common-mark', 'CommonMark');

            await beginEdit(sharedPage, component);

            const textarea = component.locator('textarea');
            await textarea.clear();
            await textarea.fill('Line 1\nLine 2\nLine 3');

            await expect(textarea).toHaveValue('Line 1\nLine 2\nLine 3');
        });

        test('supports markdown syntax input', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-common-mark', 'CommonMark');

            await beginEdit(sharedPage, component);

            const textarea = component.locator('textarea');
            await textarea.clear();
            await textarea.fill('- Item 1\n- Item 2\n- Item 3');

            await expect(textarea).toHaveValue('- Item 1\n- Item 2\n- Item 3');
        });
    });

    test.describe('Save and Cancel', () => {
        test('returns to non-edit mode with new value after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-common-mark', 'CommonMark');

            await beginEdit(sharedPage, component);

            const textarea = component.locator('textarea');
            await textarea.clear();
            await textarea.fill('*Italic text*');

            const savedValue = await save(sharedPage, component);

            expect(savedValue).toBe('*Italic text*');

            // Check vi-marked renders the updated content
            const marked = component.locator('vi-marked');
            const em = marked.locator('em');
            await expect(em).toHaveText('Italic text');
            await expect(component.locator('textarea')).toBeHidden();
        });

        test('returns to non-edit mode with original value after cancel', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-common-mark', 'CommonMark');

            await beginEdit(sharedPage, component);

            const textarea = component.locator('textarea');
            await textarea.clear();
            await textarea.fill('Changed content');

            await cancelEdit(sharedPage, component);

            const marked = component.locator('vi-marked');
            const strong = marked.locator('strong');
            await expect(strong).toHaveText('Hello world!');
            await expect(component.locator('textarea')).toBeHidden();
        });
    });
});

test.describe('CommonMark Attribute (ReadOnly)', () => {



    test.describe('Edit mode', () => {
        test('displays readonly textarea when attribute is readonly', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-common-mark', 'CommonMarkReadOnly');

            await beginEdit(sharedPage, component);

            const textarea = component.locator('textarea');
            await expect(textarea).toBeVisible();

            const readonly = await textarea.getAttribute('readonly');
            expect(readonly).not.toBeNull();
        });
    });
});

test.describe('CommonMark Attribute (Frozen)', () => {



    test.describe('Edit mode', () => {
        test('textarea becomes disabled when parent is frozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-common-mark', 'CommonMark');

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
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-common-mark', 'CommonMark');

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

test.describe('CommonMark Attribute (Markdown Rendering)', () => {



    test('renders heading markdown correctly', async () => {
        const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-common-mark', 'CommonMarkHeading');

        const marked = component.locator('vi-marked');
        const h1 = marked.locator('h1');
        await expect(h1).toHaveText('Test Heading');
    });

    test('renders list markdown correctly', async () => {
        const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-common-mark', 'CommonMarkList');

        const marked = component.locator('vi-marked');
        const listItems = marked.locator('li');
        await expect(listItems).toHaveCount(3);
    });

    test('renders link markdown correctly', async () => {
        const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-common-mark', 'CommonMarkLink');

        const marked = component.locator('vi-marked');
        const link = marked.locator('a');
        await expect(link).toHaveText('Example');
        await expect(link).toHaveAttribute('href', 'https://example.com');
    });
});

}); // End of CommonMark Attribute Tests wrapper
