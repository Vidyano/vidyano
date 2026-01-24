import { test, expect, Page, Locator } from '@playwright/test';
import { setupPage } from '../_helpers/page';
import { startBackend, stopBackend, BackendProcess } from '../_helpers/backend';

let backend: BackendProcess | undefined;

test.describe.serial('PersistentObjectAttributeLabel', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }, testInfo) => {
        backend = await startBackend(testInfo);
        sharedPage = await browser.newPage();
        await setupPage(sharedPage, '', backend.port);
    });

    test.afterAll(async () => {
        await sharedPage.close();
        await stopBackend(backend);
    });

    async function setupLabel(
        attributeName: string,
        options?: {
            startInEditMode?: boolean;
            disabled?: boolean;
        }
    ): Promise<Locator> {
        const componentId = `label-${Math.random().toString(36).substring(2, 15)}`;

        await sharedPage.waitForFunction(
            (tag) => !!customElements.get(tag),
            'vi-persistent-object-attribute-label',
            { timeout: 10000 }
        );

        await sharedPage.evaluate(async ({ componentId, attributeName, options }) => {
            const objectId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
            const po = await (window as any).service.getPersistentObject(null, 'Mock_Item', objectId);
            const attribute = po.getAttribute(attributeName);

            if (po.isEditing)
                po.cancelEdit();

            if (options?.startInEditMode)
                po.beginEdit();

            const container = document.getElementById('test-container');
            if (!container)
                throw new Error('Test container not found');

            const label = document.createElement('vi-persistent-object-attribute-label');
            label.id = componentId;
            (label as any).attribute = attribute;

            if (options?.disabled)
                (label as any).disabled = true;

            container.appendChild(label);

            if (typeof (label as any).updateComplete !== 'undefined')
                await (label as any).updateComplete;

            if (!(window as any).labelMap)
                (window as any).labelMap = {};
            (window as any).labelMap[componentId] = { label, attribute, po };
        }, { componentId, attributeName, options });

        return sharedPage.locator(`#${componentId}`);
    }

    async function setValidationError(label: Locator, error: string | null) {
        const componentId = await label.getAttribute('id') as string;
        await sharedPage.evaluate(({ id, error }) => {
            const { attribute } = (window as any).labelMap[id];
            attribute.validationError = error;
        }, { id: componentId, error });
    }

    async function setValue(label: Locator, value: any) {
        const componentId = await label.getAttribute('id') as string;
        await sharedPage.evaluate(({ id, value }) => {
            const { attribute } = (window as any).labelMap[id];
            attribute.setValue(value);
        }, { id: componentId, value });
    }

    async function beginEdit(label: Locator) {
        const componentId = await label.getAttribute('id') as string;
        await sharedPage.evaluate((id) => {
            const { po } = (window as any).labelMap[id];
            po.beginEdit();
        }, componentId);
    }

    async function cancelEdit(label: Locator) {
        const componentId = await label.getAttribute('id') as string;
        await sharedPage.evaluate((id) => {
            const { po } = (window as any).labelMap[id];
            po.cancelEdit();
        }, componentId);
    }

    test.describe('Label Rendering', () => {
        test('renders label text from attribute', async () => {
            const label = await setupLabel('String');

            const labelElement = label.locator('label');
            await expect(labelElement).toContainText('String');
        });

        test('renders required span element', async () => {
            const label = await setupLabel('String');

            const requiredSpan = label.locator('.required');
            await expect(requiredSpan).toHaveCount(1);
        });

        test('renders locked icon container', async () => {
            const label = await setupLabel('String');

            const locked = label.locator('.locked');
            await expect(locked).toHaveCount(1);
        });
    });

    test.describe('Editing State', () => {
        test('does not have [editing] attribute by default', async () => {
            const label = await setupLabel('String');

            await expect(label).not.toHaveAttribute('editing');
        });

        test('has [editing] attribute when parent is in edit mode', async () => {
            const label = await setupLabel('String', { startInEditMode: true });

            await expect(label).toHaveAttribute('editing');
        });

        test('removes [editing] attribute after cancelEdit', async () => {
            const label = await setupLabel('String', { startInEditMode: true });
            await expect(label).toHaveAttribute('editing');

            await cancelEdit(label);
            await expect(label).not.toHaveAttribute('editing');
        });
    });

    test.describe('Required State', () => {
        test('has [required] attribute when attribute is required and value is null', async () => {
            const label = await setupLabel('RequiredString', { startInEditMode: true });

            await expect(label).toHaveAttribute('required');
        });

        test('does not have [required] for non-required attributes', async () => {
            const label = await setupLabel('String');

            await expect(label).not.toHaveAttribute('required');
        });

        test('does not have [required] when required attribute has value', async () => {
            const label = await setupLabel('RequiredString', { startInEditMode: true });

            await setValue(label, 'some value');

            await expect(label).not.toHaveAttribute('required');
        });
    });

    test.describe('Read-Only State', () => {
        test('has [read-only] attribute when attribute is read-only', async () => {
            const label = await setupLabel('ReadOnlyString');

            await expect(label).toHaveAttribute('read-only');
        });

        test('has [read-only] attribute when disabled', async () => {
            const label = await setupLabel('String', { disabled: true });

            await expect(label).toHaveAttribute('read-only');
        });

        test('does not have [read-only] for editable attributes', async () => {
            const label = await setupLabel('String');

            await expect(label).not.toHaveAttribute('read-only');
        });
    });

    test.describe('Has Error State', () => {
        test('does not have [has-error] by default', async () => {
            const label = await setupLabel('String');

            await expect(label).not.toHaveAttribute('has-error');
        });

        test('has [has-error] when validation error is set', async () => {
            const label = await setupLabel('String');

            await setValidationError(label, 'This field has an error');

            await expect(label).toHaveAttribute('has-error');
        });

        test('removes [has-error] when validation error is cleared', async () => {
            const label = await setupLabel('String');

            await setValidationError(label, 'Error');
            await expect(label).toHaveAttribute('has-error');

            await setValidationError(label, null);
            await expect(label).not.toHaveAttribute('has-error');
        });
    });

    test.describe('Has Tooltip', () => {
        test('does not render info button when no tooltip', async () => {
            const label = await setupLabel('String');

            const infoButton = label.locator('vi-button.info');
            await expect(infoButton).toHaveCount(0);
        });

        test('does not have [has-tool-tip] attribute when no tooltip', async () => {
            const label = await setupLabel('String');

            await expect(label).not.toHaveAttribute('has-tool-tip');
        });

        test('has [has-tool-tip] attribute when attribute has tooltip', async () => {
            const label = await setupLabel('StringWithToolTip');

            await expect(label).toHaveAttribute('has-tool-tip');
        });

        test('renders info button when attribute has tooltip', async () => {
            const label = await setupLabel('StringWithToolTip');

            const infoButton = label.locator('vi-button.info');
            await expect(infoButton).toHaveCount(1);
        });
    });

    test.describe('Disabled State', () => {
        test('does not have [disabled] by default', async () => {
            const label = await setupLabel('String');

            await expect(label).not.toHaveAttribute('disabled');
        });

        test('has [disabled] attribute when disabled is true', async () => {
            const label = await setupLabel('String', { disabled: true });

            await expect(label).toHaveAttribute('disabled');
        });
    });

    test.describe('Bulk Edit State', () => {
        test('does not have [bulk-edit] for non-bulk-edit objects', async () => {
            const label = await setupLabel('String');

            await expect(label).not.toHaveAttribute('bulk-edit');
        });
    });
});
