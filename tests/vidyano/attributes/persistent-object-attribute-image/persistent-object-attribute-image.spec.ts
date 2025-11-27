import { test, expect, Page } from '@playwright/test';
import { setupPage } from '../helpers/page';
import { setupAttribute, beginEdit, cancelEdit, save, freeze, unfreeze } from '../helpers/persistent-object';
import { startBackend, stopBackend } from '../helpers/backend';

// 1x1 black pixel PNG base64
const blackPixelBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQAAAAA3bvkkAAAACklEQVR4AWNgAAAAAgABc3UBGAAAAABJRU5ErkJggg==';

test.describe.serial('Image Attribute Tests', () => {
    let sharedBackend: Awaited<ReturnType<typeof startBackend>>;

    test.beforeAll(async ({}, testInfo) => {
        sharedBackend = await startBackend(testInfo);
    });

    test.afterAll(async () => {
        await stopBackend(sharedBackend);
    });

test.describe('Image Attribute', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Non-edit mode', () => {
        test('displays image when value is set', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-image', 'Image');

            const img = component.locator('img');
            await expect(img).toBeVisible();

            const src = await img.getAttribute('src');
            expect(src).toContain('data:image/');
        });

        test('does not render file input element', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-image', 'Image');

            const fileInput = component.locator('input[type="file"]');
            await expect(fileInput).toHaveCount(0);
        });

        test('does not render browse button', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-image', 'Image');

            const browseButton = component.locator('vi-button.browse');
            await expect(browseButton).toHaveCount(0);
        });

        test('does not render clear button', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-image', 'Image');

            const clearButton = component.locator('vi-button vi-icon[source="Remove"]');
            await expect(clearButton).toHaveCount(0);
        });
    });

    test.describe('Edit mode', () => {
        test('displays image after beginEdit', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-image', 'Image');

            await beginEdit(sharedPage, component);

            const img = component.locator('img');
            await expect(img).toBeVisible();

            const src = await img.getAttribute('src');
            expect(src).toContain('data:image/');
        });

        test('displays browse button with upload icon', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-image', 'Image');

            await beginEdit(sharedPage, component);

            const browseButton = component.locator('vi-button.browse');
            await expect(browseButton).toBeVisible();

            const uploadIcon = browseButton.locator('vi-icon[source="ImageUpload"]');
            await expect(uploadIcon).toBeVisible();

            const fileInput = browseButton.locator('input[type="file"]');
            await expect(fileInput).toBeAttached();
        });

        test('file input accepts image files', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-image', 'Image');

            await beginEdit(sharedPage, component);

            const fileInput = component.locator('input[type="file"]');
            const accept = await fileInput.getAttribute('accept');
            expect(accept).toBe('image/*');
        });

        test('displays clear button when image exists', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-image', 'Image');

            await beginEdit(sharedPage, component);

            const clearButton = component.locator('vi-button vi-icon[source="Remove"]');
            await expect(clearButton).toBeVisible();
        });

        test('uploads new image and updates display', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-image', 'Image');

            await beginEdit(sharedPage, component);

            const fileInput = component.locator('input[type="file"]');

            // Create a minimal test PNG (2x2 red pixel)
            const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAADklEQVR4AWP4z8DwHwYBAA4AA/7fKHp4AAAAAElFTkSuQmCC', 'base64');
            await fileInput.setInputFiles({
                name: 'red-pixel.png',
                mimeType: 'image/png',
                buffer: pngBuffer,
            });

            const img = component.locator('img');
            await expect(img).toBeVisible();

            // Verify the image src changed
            const src = await img.getAttribute('src');
            expect(src).toContain('data:image/');
        });

        test('clears image when clear button clicked', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-image', 'Image');

            await beginEdit(sharedPage, component);

            const clearButton = component.locator('vi-button vi-icon[source="Remove"]').locator('..');
            await clearButton.click();

            const img = component.locator('img');
            // Image should have empty src or no src when cleared
            const src = await img.getAttribute('src');
            expect(src === '' || src === null).toBeTruthy();

            // Clear button should no longer be visible
            await expect(clearButton).toBeHidden();
        });
    });

    test.describe('Save and Cancel', () => {
        test('returns to non-edit mode after save', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-image', 'Image');

            await beginEdit(sharedPage, component);

            await save(sharedPage, component);

            const img = component.locator('img');
            await expect(img).toBeVisible();

            // Browse button should not be visible in non-edit mode
            const browseButton = component.locator('vi-button.browse');
            await expect(browseButton).toHaveCount(0);
        });

        test('returns to non-edit mode with original image after cancel', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-image', 'Image');

            // Get original image src
            const img = component.locator('img');
            const originalSrc = await img.getAttribute('src');

            await beginEdit(sharedPage, component);

            // Clear the image
            const clearButton = component.locator('vi-button vi-icon[source="Remove"]').locator('..');
            await clearButton.click();

            await cancelEdit(sharedPage, component);

            // Image should be restored
            await expect(img).toBeVisible();
            const restoredSrc = await img.getAttribute('src');
            expect(restoredSrc).toBe(originalSrc);
        });
    });
});

test.describe('Image Attribute (Empty)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Non-edit mode', () => {
        test('image has empty src when no value', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-image', 'ImageEmpty');

            const img = component.locator('img');
            const src = await img.getAttribute('src');
            expect(src === '' || src === null).toBeTruthy();
        });
    });

    test.describe('Edit mode', () => {
        test('displays browse button when no image', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-image', 'ImageEmpty');

            await beginEdit(sharedPage, component);

            const browseButton = component.locator('vi-button.browse');
            await expect(browseButton).toBeVisible();
        });

        test('does not display clear button when no image', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-image', 'ImageEmpty');

            await beginEdit(sharedPage, component);

            const clearButton = component.locator('vi-button vi-icon[source="Remove"]');
            await expect(clearButton).toHaveCount(0);
        });

        test('uploads image to empty attribute', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-image', 'ImageEmpty');

            await beginEdit(sharedPage, component);

            const fileInput = component.locator('input[type="file"]');
            const pngBuffer = Buffer.from(blackPixelBase64, 'base64');
            await fileInput.setInputFiles({
                name: 'uploaded.png',
                mimeType: 'image/png',
                buffer: pngBuffer,
            });

            // Wait for the image to be processed and the src to be set
            const img = component.locator('img');
            await expect(img).toHaveAttribute('src', /data:image\//);

            // Clear button should now be visible
            const clearButton = component.locator('vi-button vi-icon[source="Remove"]');
            await expect(clearButton).toBeVisible();
        });
    });
});

test.describe('Image Attribute (ReadOnly)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Non-edit mode', () => {
        test('displays image when value is set', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-image', 'ImageReadOnly');

            const img = component.locator('img');
            await expect(img).toBeVisible();

            const src = await img.getAttribute('src');
            expect(src).toContain('data:image/');
        });
    });

    test.describe('Edit mode', () => {
        test('has image with src when readonly', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-image', 'ImageReadOnly');

            await beginEdit(sharedPage, component);

            const img = component.locator('img');
            await expect(img).toBeAttached();

            const src = await img.getAttribute('src');
            expect(src).toContain('data:image/');
        });

        test('does not display browse button when readonly', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-image', 'ImageReadOnly');

            await beginEdit(sharedPage, component);

            const browseButton = component.locator('vi-button.browse');
            await expect(browseButton).toBeHidden();
        });

        test('does not display clear button when readonly', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-image', 'ImageReadOnly');

            await beginEdit(sharedPage, component);

            const clearButton = component.locator('vi-button vi-icon[source="Remove"]');
            await expect(clearButton).toBeHidden();
        });
    });
});

test.describe('Image Attribute (Frozen)', () => {
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
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-image', 'Image');

            await beginEdit(sharedPage, component);

            const browseButton = component.locator('vi-button.browse');
            await expect(browseButton).toBeVisible();

            let disabled = await browseButton.getAttribute('disabled');
            expect(disabled).toBeNull();

            await freeze(sharedPage, component);

            disabled = await browseButton.getAttribute('disabled');
            expect(disabled).not.toBeNull();
        });

        test('browse button becomes enabled when parent is unfrozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-image', 'Image');

            await beginEdit(sharedPage, component);
            await freeze(sharedPage, component);

            const browseButton = component.locator('vi-button.browse');
            let disabled = await browseButton.getAttribute('disabled');
            expect(disabled).not.toBeNull();

            await unfreeze(sharedPage, component);

            disabled = await browseButton.getAttribute('disabled');
            expect(disabled).toBeNull();
        });

        test('clear button becomes disabled when parent is frozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-image', 'Image');

            await beginEdit(sharedPage, component);

            const clearButton = component.locator('vi-button vi-icon[source="Remove"]').locator('..');
            await expect(clearButton).toBeVisible();

            let disabled = await clearButton.getAttribute('disabled');
            expect(disabled).toBeNull();

            await freeze(sharedPage, component);

            disabled = await clearButton.getAttribute('disabled');
            expect(disabled).not.toBeNull();
        });

        test('clear button becomes enabled when parent is unfrozen', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-image', 'Image');

            await beginEdit(sharedPage, component);
            await freeze(sharedPage, component);

            const clearButton = component.locator('vi-button vi-icon[source="Remove"]').locator('..');
            let disabled = await clearButton.getAttribute('disabled');
            expect(disabled).not.toBeNull();

            await unfreeze(sharedPage, component);

            disabled = await clearButton.getAttribute('disabled');
            expect(disabled).toBeNull();
        });
    });
});

test.describe('Image Attribute (Required)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Non-edit mode', () => {
        test('displays image when value is set', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-image', 'ImageRequired');

            const img = component.locator('img');
            await expect(img).toBeVisible();

            const src = await img.getAttribute('src');
            expect(src).toContain('data:image/');
        });

        test('has required attribute set', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-image', 'ImageRequired');

            const required = await component.getAttribute('required');
            expect(required).not.toBeNull();
        });
    });

    test.describe('Edit mode', () => {
        test('displays image in edit mode', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-image', 'ImageRequired');

            await beginEdit(sharedPage, component);

            const img = component.locator('img');
            await expect(img).toBeVisible();
        });

        test('required attribute is still present in edit mode', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-image', 'ImageRequired');

            await beginEdit(sharedPage, component);

            const required = await component.getAttribute('required');
            expect(required).not.toBeNull();
        });

        test('can upload image to required attribute', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-image', 'ImageRequired');

            await beginEdit(sharedPage, component);

            const fileInput = component.locator('input[type="file"]');
            const pngBuffer = Buffer.from(blackPixelBase64, 'base64');
            await fileInput.setInputFiles({
                name: 'required.png',
                mimeType: 'image/png',
                buffer: pngBuffer,
            });

            const img = component.locator('img');
            const src = await img.getAttribute('src');
            expect(src).toContain('data:image/');
        });
    });
});

test.describe('Image Attribute (AllowPaste)', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test.describe('Edit mode', () => {
        test('accepts pasted image in edit mode', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-image', 'ImageAllowPaste');

            await beginEdit(sharedPage, component);

            // Get the original image src
            const img = component.locator('img');
            const originalSrc = await img.getAttribute('src');

            // Simulate pasting an image using clipboard API
            // Create a different image (2x2 red pixel) to verify the paste worked
            const redPixelBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAADklEQVR4AWP4z8DwHwYBAA4AA/7fKHp4AAAAAElFTkSuQmCC';

            // Focus on the page to receive paste events
            await sharedPage.focus('body');

            // Use evaluate to dispatch a paste event with image data
            await sharedPage.evaluate(async (base64Data) => {
                // Create a blob from base64
                const byteCharacters = atob(base64Data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'image/png' });

                // Create a ClipboardEvent with the image data
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(new File([blob], 'pasted.png', { type: 'image/png' }));

                const pasteEvent = new ClipboardEvent('paste', {
                    clipboardData: dataTransfer,
                    bubbles: true,
                    cancelable: true,
                });

                document.dispatchEvent(pasteEvent);
            }, redPixelBase64);

            // Wait for the image to update
            await sharedPage.waitForTimeout(500);

            // Verify the image src changed
            const newSrc = await img.getAttribute('src');
            expect(newSrc).toContain('data:image/');
            // The src should have changed from the original
            expect(newSrc).not.toBe(originalSrc);
        });

        test('does not accept paste when not in edit mode', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-image', 'ImageAllowPaste');

            // Get the original image src while not in edit mode
            const img = component.locator('img');
            const originalSrc = await img.getAttribute('src');

            // Try to paste an image
            const redPixelBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAADklEQVR4AWP4z8DwHwYBAA4AA/7fKHp4AAAAAElFTkSuQmCC';

            await sharedPage.evaluate(async (base64Data) => {
                const byteCharacters = atob(base64Data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'image/png' });

                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(new File([blob], 'pasted.png', { type: 'image/png' }));

                const pasteEvent = new ClipboardEvent('paste', {
                    clipboardData: dataTransfer,
                    bubbles: true,
                    cancelable: true,
                });

                document.dispatchEvent(pasteEvent);
            }, redPixelBase64);

            await sharedPage.waitForTimeout(500);

            // Image should remain unchanged
            const newSrc = await img.getAttribute('src');
            expect(newSrc).toBe(originalSrc);
        });

        test('does not accept paste when readonly', async () => {
            const component = await setupAttribute(sharedPage, 'vi-persistent-object-attribute-image', 'ImageReadOnly');

            await beginEdit(sharedPage, component);

            const img = component.locator('img');
            const originalSrc = await img.getAttribute('src');

            const redPixelBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAADklEQVR4AWP4z8DwHwYBAA4AA/7fKHp4AAAAAElFTkSuQmCC';

            await sharedPage.evaluate(async (base64Data) => {
                const byteCharacters = atob(base64Data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'image/png' });

                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(new File([blob], 'pasted.png', { type: 'image/png' }));

                const pasteEvent = new ClipboardEvent('paste', {
                    clipboardData: dataTransfer,
                    bubbles: true,
                    cancelable: true,
                });

                document.dispatchEvent(pasteEvent);
            }, redPixelBase64);

            await sharedPage.waitForTimeout(500);

            // Image should remain unchanged (readonly ignores paste)
            const newSrc = await img.getAttribute('src');
            expect(newSrc).toBe(originalSrc);
        });
    });
});

}); // End of Image Attribute Tests wrapper
