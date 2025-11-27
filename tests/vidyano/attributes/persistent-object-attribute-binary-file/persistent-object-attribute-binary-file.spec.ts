import { test, expect, Page } from '@playwright/test';
import { setupPage } from '../helpers/page';
import { setupAttribute, beginEdit, cancelEdit, save, freeze, unfreeze } from '../helpers/persistent-object';
import { startBackend, stopBackend } from '../helpers/backend';

test.describe.serial('BinaryFile Attribute Tests', () => {
    let sharedBackend: Awaited<ReturnType<typeof startBackend>>;

    test.beforeAll(async ({}, testInfo) => {
        sharedBackend = await startBackend(testInfo);
    });

    test.afterAll(async () => {
        await stopBackend(sharedBackend);
    });

test.describe('BinaryFile Attribute', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Non-edit mode', () => {
        test('displays initial filename "black-pixel.png" in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-binary-file', 'BinaryFile');

            const span = component.locator('span');
            await expect(span).toHaveText('black-pixel.png');
        });

        test('does not render file input element', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-binary-file', 'BinaryFile');

            const fileInput = component.locator('input[type="file"]');
            await expect(fileInput).toHaveCount(0);
        });

        test('does not render clear button', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-binary-file', 'BinaryFile');

            const clearButton = component.locator('#clear');
            await expect(clearButton).toHaveCount(0);
        });
    });

    test.describe('Edit mode', () => {
        test('displays readonly text input with filename after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-binary-file', 'BinaryFile');

            await beginEdit(sharedPage, component);

            const textInput = component.locator('input[type="text"]');
            await expect(textInput).toHaveValue('black-pixel.png');
            await expect(textInput).toHaveAttribute('readonly');
        });

        test('displays file upload button', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-binary-file', 'BinaryFile');

            await beginEdit(sharedPage, component);

            const browseButton = component.locator('#browse');
            await expect(browseButton).toBeVisible();

            const uploadIcon = browseButton.locator('vi-icon[source="FileUpload"]');
            await expect(uploadIcon).toBeVisible();

            const fileInput = browseButton.locator('input[type="file"]');
            await expect(fileInput).toBeAttached();
        });

        test('displays clear button when file exists', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-binary-file', 'BinaryFile');

            await beginEdit(sharedPage, component);

            const clearButton = component.locator('#clear');
            await expect(clearButton).toBeVisible();
        });

        test('uploads new file and updates filename', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-binary-file', 'BinaryFile');

            await beginEdit(sharedPage, component);

            const fileInput = component.locator('input[type="file"]');

            // Create a test file and upload it
            const testFileContent = Buffer.from('test file content');
            await fileInput.setInputFiles({
                name: 'test.txt',
                mimeType: 'text/plain',
                buffer: testFileContent,
            });

            const textInput = component.locator('input[type="text"]');
            await expect(textInput).toHaveValue('test.txt');
        });

        test('clears file when clear button clicked', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-binary-file', 'BinaryFile');

            await beginEdit(sharedPage, component);

            const clearButton = component.locator('#clear');
            await clearButton.click();

            const textInput = component.locator('input[type="text"]');
            await expect(textInput).toHaveValue('');

            // Clear button should no longer be visible after clearing
            await expect(clearButton).toHaveCount(0);
        });
    });

    test.describe('Save and Cancel', () => {
        test('returns to non-edit mode after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-binary-file', 'BinaryFile');

            await beginEdit(sharedPage, component);

            // Just verify save works and returns to non-edit mode
            await save(sharedPage, component);

            const span = component.locator('span');
            await expect(span).toBeVisible();
            await expect(component.locator('input[type="file"]')).toHaveCount(0);
        });

        test('returns to non-edit mode with original filename after cancel', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-binary-file', 'BinaryFile');

            await beginEdit(sharedPage, component);

            const fileInput = component.locator('input[type="file"]');
            const testFileContent = Buffer.from('changed file');
            await fileInput.setInputFiles({
                name: 'changed.txt',
                mimeType: 'text/plain',
                buffer: testFileContent,
            });

            await cancelEdit(sharedPage, component);

            const span = component.locator('span');
            await expect(span).toHaveText('black-pixel.png');
            await expect(component.locator('input[type="file"]')).toHaveCount(0);
        });
    });
});

test.describe('BinaryFile Attribute (Empty)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Non-edit mode', () => {
        test('displays em dash "—" when no file', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-binary-file', 'BinaryFileEmpty');

            const span = component.locator('span');
            await expect(span).toHaveText('—');
        });
    });

    test.describe('Edit mode', () => {
        test('displays empty readonly text input when no file', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-binary-file', 'BinaryFileEmpty');

            await beginEdit(sharedPage, component);

            const textInput = component.locator('input[type="text"]');
            await expect(textInput).toHaveValue('');
        });

        test('does not display clear button when no file', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-binary-file', 'BinaryFileEmpty');

            await beginEdit(sharedPage, component);

            const clearButton = component.locator('#clear');
            await expect(clearButton).toHaveCount(0);
        });

        test('uploads file to empty attribute', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-binary-file', 'BinaryFileEmpty');

            await beginEdit(sharedPage, component);

            const fileInput = component.locator('input[type="file"]');
            const testFileContent = Buffer.from('uploaded file content');
            await fileInput.setInputFiles({
                name: 'uploaded.txt',
                mimeType: 'text/plain',
                buffer: testFileContent,
            });

            const textInput = component.locator('input[type="text"]');
            await expect(textInput).toHaveValue('uploaded.txt');

            // Clear button should now be visible
            const clearButton = component.locator('#clear');
            await expect(clearButton).toBeVisible();
        });
    });
});

test.describe('BinaryFile Attribute (ReadOnly)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Non-edit mode', () => {
        test('displays initial filename "black-pixel.png" in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-binary-file', 'BinaryFileReadOnly');

            const span = component.locator('span');
            await expect(span).toHaveText('black-pixel.png');
        });
    });

    test.describe('Edit mode', () => {
        test('displays readonly text input when readonly', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-binary-file', 'BinaryFileReadOnly');

            await beginEdit(sharedPage, component);

            const textInput = component.locator('input[type="text"]');
            await expect(textInput).toHaveValue('black-pixel.png');
            await expect(textInput).toHaveAttribute('readonly');
        });

        test('does not display file upload button when readonly', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-binary-file', 'BinaryFileReadOnly');

            await beginEdit(sharedPage, component);

            const browseButton = component.locator('#browse');
            await expect(browseButton).toHaveCount(0);
        });

        test('does not display clear button when readonly', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-binary-file', 'BinaryFileReadOnly');

            await beginEdit(sharedPage, component);

            const clearButton = component.locator('#clear');
            await expect(clearButton).toHaveCount(0);
        });
    });
});

test.describe('BinaryFile Attribute (Frozen)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Edit mode', () => {
        test('browse button becomes disabled when parent is frozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-binary-file', 'BinaryFile');

            await beginEdit(sharedPage, component);

            const browseButton = component.locator('#browse');
            await expect(browseButton).toBeVisible();

            let disabled = await browseButton.getAttribute('disabled');
            expect(disabled).toBeNull();

            await freeze(sharedPage, component);

            disabled = await browseButton.getAttribute('disabled');
            expect(disabled).not.toBeNull();
        });

        test('browse button becomes enabled when parent is unfrozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-binary-file', 'BinaryFile');

            await beginEdit(sharedPage, component);
            await freeze(sharedPage, component);

            const browseButton = component.locator('#browse');
            let disabled = await browseButton.getAttribute('disabled');
            expect(disabled).not.toBeNull();

            await unfreeze(sharedPage, component);

            disabled = await browseButton.getAttribute('disabled');
            expect(disabled).toBeNull();
        });

        test('clear button becomes disabled when parent is frozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-binary-file', 'BinaryFile');

            await beginEdit(sharedPage, component);

            const clearButton = component.locator('#clear');
            await expect(clearButton).toBeVisible();

            let disabled = await clearButton.getAttribute('disabled');
            expect(disabled).toBeNull();

            await freeze(sharedPage, component);

            disabled = await clearButton.getAttribute('disabled');
            expect(disabled).not.toBeNull();
        });

        test('clear button becomes enabled when parent is unfrozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-binary-file', 'BinaryFile');

            await beginEdit(sharedPage, component);
            await freeze(sharedPage, component);

            const clearButton = component.locator('#clear');
            let disabled = await clearButton.getAttribute('disabled');
            expect(disabled).not.toBeNull();

            await unfreeze(sharedPage, component);

            disabled = await clearButton.getAttribute('disabled');
            expect(disabled).toBeNull();
        });
    });
});

test.describe('BinaryFile Attribute (Required)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Non-edit mode', () => {
        test('displays initial filename "default.txt" in span', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-binary-file', 'BinaryFileRequired');

            const span = component.locator('span');
            await expect(span).toHaveText('default.txt');
        });

        test('has required attribute set', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-binary-file', 'BinaryFileRequired');

            const required = await component.getAttribute('required');
            expect(required).not.toBeNull();
        });
    });

    test.describe('Edit mode', () => {
        test('displays readonly text input with initial filename', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-binary-file', 'BinaryFileRequired');

            await beginEdit(sharedPage, component);

            const textInput = component.locator('input[type="text"]');
            await expect(textInput).toHaveValue('default.txt');
        });

        test('required attribute is still present in edit mode', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-binary-file', 'BinaryFileRequired');

            await beginEdit(sharedPage, component);

            const required = await component.getAttribute('required');
            expect(required).not.toBeNull();
        });

        test('can upload file to required attribute', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-binary-file', 'BinaryFileRequired');

            await beginEdit(sharedPage, component);

            const fileInput = component.locator('input[type="file"]');
            const testFileContent = Buffer.from('required file content');
            await fileInput.setInputFiles({
                name: 'required.txt',
                mimeType: 'text/plain',
                buffer: testFileContent,
            });

            const textInput = component.locator('input[type="text"]');
            await expect(textInput).toHaveValue('required.txt');
        });
    });
});

test.describe('BinaryFile Attribute (Accept)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Edit mode', () => {
        test('file input has accept attribute for images', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-binary-file', 'BinaryFileAcceptImages');

            await beginEdit(sharedPage, component);

            const browseButton = component.locator('#browse');
            const fileInput = browseButton.locator('input[type="file"]');

            const accept = await fileInput.getAttribute('accept');
            expect(accept).toBe('image/*');
        });

        test('can upload image file when accept is set to images', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-binary-file', 'BinaryFileAcceptImages');

            await beginEdit(sharedPage, component);

            const fileInput = component.locator('input[type="file"]');
            // Create a minimal 1x1 PNG
            const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
            await fileInput.setInputFiles({
                name: 'test.png',
                mimeType: 'image/png',
                buffer: pngBuffer,
            });

            const textInput = component.locator('input[type="text"]');
            await expect(textInput).toHaveValue('test.png');
        });
    });
});

}); // End of BinaryFile Attribute Tests wrapper
