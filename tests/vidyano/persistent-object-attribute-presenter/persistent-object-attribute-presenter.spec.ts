import { test, expect, Page, Locator } from '@playwright/test';
import { setupPage } from '../_helpers/page';
import { startBackend, stopBackend, BackendProcess } from '../_helpers/backend';

let backend: BackendProcess | undefined;

test.describe.serial('PersistentObjectAttributePresenter', () => {
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

    async function setupPresenter(
        attributeName: string,
        options?: {
            noLabel?: boolean;
            disabled?: boolean;
            startInEditMode?: boolean;
        }
    ): Promise<Locator> {
        const componentId = `presenter-${Math.random().toString(36).substring(2, 15)}`;

        // Wait for custom element to be defined
        await sharedPage.waitForFunction(
            (tag) => !!customElements.get(tag),
            'vi-persistent-object-attribute-presenter',
            { timeout: 10000 }
        );

        await sharedPage.evaluate(async ({ componentId, attributeName, options }) => {
            const objectId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
            const po = await (window as any).service.getPersistentObject(null, 'Mock_Item', objectId);
            const attribute = po.getAttribute(attributeName);

            // Cancel backend's default editing mode
            if (po.isEditing)
                po.cancelEdit();

            // Optionally start in edit mode
            if (options?.startInEditMode)
                po.beginEdit();

            const container = document.getElementById('test-container');
            if (!container)
                throw new Error('Test container not found');

            const presenter = document.createElement('vi-persistent-object-attribute-presenter');
            presenter.id = componentId;
            (presenter as any).attribute = attribute;

            if (options?.noLabel)
                (presenter as any).noLabel = true;

            if (options?.disabled)
                (presenter as any).disabled = true;

            container.appendChild(presenter);

            // Wait for Lit update cycle
            if (typeof (presenter as any).updateComplete !== 'undefined')
                await (presenter as any).updateComplete;

            // Store references for later operations
            if (!(window as any).presenterMap)
                (window as any).presenterMap = {};
            (window as any).presenterMap[componentId] = { presenter, attribute, po };
        }, { componentId, attributeName, options });

        return sharedPage.locator(`#${componentId}`);
    }

    async function beginEdit(presenter: Locator) {
        const componentId = await presenter.getAttribute('id') as string;
        await sharedPage.evaluate((id) => {
            const { po } = (window as any).presenterMap[id];
            po.beginEdit();
        }, componentId);
    }

    async function cancelEdit(presenter: Locator) {
        const componentId = await presenter.getAttribute('id') as string;
        await sharedPage.evaluate((id) => {
            const { po } = (window as any).presenterMap[id];
            po.cancelEdit();
        }, componentId);
    }

    async function freeze(presenter: Locator) {
        const componentId = await presenter.getAttribute('id') as string;
        await sharedPage.evaluate((id) => {
            const { po } = (window as any).presenterMap[id];
            po.freeze();
        }, componentId);
    }

    async function unfreeze(presenter: Locator) {
        const componentId = await presenter.getAttribute('id') as string;
        await sharedPage.evaluate((id) => {
            const { po } = (window as any).presenterMap[id];
            po.unfreeze();
        }, componentId);
    }

    async function setValidationError(presenter: Locator, error: string | null) {
        const componentId = await presenter.getAttribute('id') as string;
        await sharedPage.evaluate(({ id, error }) => {
            const { attribute } = (window as any).presenterMap[id];
            attribute.validationError = error;
        }, { id: componentId, error });
    }

    async function setValue(presenter: Locator, value: any) {
        const componentId = await presenter.getAttribute('id') as string;
        await sharedPage.evaluate(({ id, value }) => {
            const { attribute } = (window as any).presenterMap[id];
            attribute.setValue(value);
        }, { id: componentId, value });
    }

    // ===========================================
    // TYPE MAPPING TESTS
    // ===========================================
    test.describe('Type Mapping', () => {
        test('String type renders vi-persistent-object-attribute-string', async () => {
            const presenter = await setupPresenter('String');

            const child = presenter.locator('vi-persistent-object-attribute-string');
            await expect(child).toHaveCount(1);
        });

        test('Int32 type renders vi-persistent-object-attribute-numeric', async () => {
            const presenter = await setupPresenter('Integer');

            const child = presenter.locator('vi-persistent-object-attribute-numeric');
            await expect(child).toHaveCount(1);
        });

        test('Decimal type renders vi-persistent-object-attribute-numeric', async () => {
            const presenter = await setupPresenter('Decimal');

            const child = presenter.locator('vi-persistent-object-attribute-numeric');
            await expect(child).toHaveCount(1);
        });

        test('DateTime type renders vi-persistent-object-attribute-date-time', async () => {
            const presenter = await setupPresenter('DateTime');

            const child = presenter.locator('vi-persistent-object-attribute-date-time');
            await expect(child).toHaveCount(1);
        });

        test('YesNo type renders vi-persistent-object-attribute-boolean', async () => {
            const presenter = await setupPresenter('Boolean');

            const child = presenter.locator('vi-persistent-object-attribute-boolean');
            await expect(child).toHaveCount(1);
        });

        test('NullableBoolean type renders vi-persistent-object-attribute-nullable-boolean', async () => {
            const presenter = await setupPresenter('NullableBoolean');

            const child = presenter.locator('vi-persistent-object-attribute-nullable-boolean');
            await expect(child).toHaveCount(1);
        });

        test('Guid type renders vi-persistent-object-attribute-string', async () => {
            const presenter = await setupPresenter('Guid');

            const child = presenter.locator('vi-persistent-object-attribute-string');
            await expect(child).toHaveCount(1);
        });
    });

    // ===========================================
    // ATTRIBUTE REFLECTION TESTS
    // ===========================================
    test.describe('Attribute Reflection', () => {
        test('reflects attribute name to [name] attribute', async () => {
            const presenter = await setupPresenter('String');

            await expect(presenter).toHaveAttribute('name', 'String');
        });

        test('reflects attribute type to [type] attribute', async () => {
            const presenter = await setupPresenter('String');

            await expect(presenter).toHaveAttribute('type', 'String');
        });

        test('reflects Int32 type correctly', async () => {
            const presenter = await setupPresenter('Integer');

            await expect(presenter).toHaveAttribute('type', 'Int32');
        });
    });

    // ===========================================
    // EDITING STATE TESTS
    // ===========================================
    test.describe('Editing State', () => {
        test('does not have [editing] attribute in non-edit mode', async () => {
            const presenter = await setupPresenter('String');

            await expect(presenter).not.toHaveAttribute('editing');
        });

        test('has [editing] attribute after beginEdit', async () => {
            const presenter = await setupPresenter('String');

            await beginEdit(presenter);

            await expect(presenter).toHaveAttribute('editing');
        });

        test('removes [editing] attribute after cancelEdit', async () => {
            const presenter = await setupPresenter('String');

            await beginEdit(presenter);
            await expect(presenter).toHaveAttribute('editing');

            await cancelEdit(presenter);
            await expect(presenter).not.toHaveAttribute('editing');
        });

        test('nonEdit type hint prevents [editing] even when parent is editing', async () => {
            const presenter = await setupPresenter('NonEditString');

            await beginEdit(presenter);

            await expect(presenter).toHaveAttribute('non-edit');
            await expect(presenter).not.toHaveAttribute('editing');
        });
    });

    // ===========================================
    // READ-ONLY STATE TESTS
    // ===========================================
    test.describe('Read-Only State', () => {
        test('has [read-only] attribute when attribute is read-only', async () => {
            const presenter = await setupPresenter('ReadOnlyString');

            await expect(presenter).toHaveAttribute('read-only');
        });

        test('has [read-only] attribute when disabled', async () => {
            const presenter = await setupPresenter('String', { disabled: true });

            await expect(presenter).toHaveAttribute('read-only');
        });

        test('has [read-only] attribute when parent is frozen', async () => {
            const presenter = await setupPresenter('String', { startInEditMode: true });

            await freeze(presenter);

            await expect(presenter).toHaveAttribute('read-only');
        });

        test('removes [read-only] when parent is unfrozen', async () => {
            const presenter = await setupPresenter('String', { startInEditMode: true });

            await freeze(presenter);
            await expect(presenter).toHaveAttribute('read-only');

            await unfreeze(presenter);
            await expect(presenter).not.toHaveAttribute('read-only');
        });
    });

    // ===========================================
    // REQUIRED STATE TESTS
    // ===========================================
    test.describe('Required State', () => {
        test('has [required] attribute when attribute is required and value is null', async () => {
            const presenter = await setupPresenter('RequiredString');

            await expect(presenter).toHaveAttribute('required');
        });

        test('does not have [required] for non-required attributes', async () => {
            const presenter = await setupPresenter('String');

            await expect(presenter).not.toHaveAttribute('required');
        });
    });

    // ===========================================
    // HIDDEN STATE TESTS
    // ===========================================
    test.describe('Hidden State', () => {
        test('has [hidden] attribute when attribute visibility is Never', async () => {
            const presenter = await setupPresenter('HiddenString');

            await expect(presenter).toHaveAttribute('hidden');
        });

        test('does not have [hidden] for visible attributes', async () => {
            const presenter = await setupPresenter('String');

            await expect(presenter).not.toHaveAttribute('hidden');
        });
    });

    // ===========================================
    // HAS-ERROR STATE TESTS
    // ===========================================
    test.describe('Has Error State', () => {
        test('does not have [has-error] by default', async () => {
            const presenter = await setupPresenter('String');

            await expect(presenter).not.toHaveAttribute('has-error');
        });

        test('has [has-error] when validation error is set', async () => {
            const presenter = await setupPresenter('String');

            await setValidationError(presenter, 'This field has an error');

            await expect(presenter).toHaveAttribute('has-error');
        });

        test('removes [has-error] when validation error is cleared', async () => {
            const presenter = await setupPresenter('String');

            await setValidationError(presenter, 'Error');
            await expect(presenter).toHaveAttribute('has-error');

            await setValidationError(presenter, null);
            await expect(presenter).not.toHaveAttribute('has-error');
        });
    });

    // ===========================================
    // HAS-VALUE STATE TESTS
    // ===========================================
    test.describe('Has Value State', () => {
        test('has [has-value] when attribute has a value', async () => {
            const presenter = await setupPresenter('String');

            await expect(presenter).toHaveAttribute('has-value');
        });

        test('does not have [has-value] when value is null', async () => {
            const presenter = await setupPresenter('RequiredString');

            await expect(presenter).not.toHaveAttribute('has-value');
        });

        test('does not have [has-value] when value is empty string', async () => {
            const presenter = await setupPresenter('String', { startInEditMode: true });

            await setValue(presenter, '');

            await expect(presenter).not.toHaveAttribute('has-value');
        });
    });

    // ===========================================
    // LABEL TESTS
    // ===========================================
    test.describe('Label Rendering', () => {
        test('renders label by default', async () => {
            const presenter = await setupPresenter('String');

            const label = presenter.locator('vi-persistent-object-attribute-label');
            await expect(label).toHaveCount(1);
        });

        test('does not render label when noLabel property is true', async () => {
            const presenter = await setupPresenter('String', { noLabel: true });

            const label = presenter.locator('vi-persistent-object-attribute-label');
            await expect(label).toHaveCount(0);
        });

        test('does not render label when nolabel type hint is set', async () => {
            const presenter = await setupPresenter('NoLabelString');

            const label = presenter.locator('vi-persistent-object-attribute-label');
            await expect(label).toHaveCount(0);
        });
    });

    // ===========================================
    // DISABLED STATE TESTS
    // ===========================================
    test.describe('Disabled State', () => {
        test('propagates disabled to rendered attribute', async () => {
            const presenter = await setupPresenter('String', { disabled: true });

            const renderedAttribute = await presenter.evaluate((el) => {
                const child = el.querySelector('vi-persistent-object-attribute-string');
                return child ? (child as any).disabled : null;
            });

            expect(renderedAttribute).toBe(true);
        });
    });

    // ===========================================
    // EVENT TESTS
    // ===========================================
    test.describe('Events', () => {
        test('fires attribute-loaded event after attribute is rendered', async () => {
            const componentId = `presenter-${Math.random().toString(36).substring(2, 15)}`;

            const eventFired = await sharedPage.evaluate(async (componentId) => {
                return new Promise<boolean>((resolve) => {
                    const objectId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

                    (async () => {
                        const po = await (window as any).service.getPersistentObject(null, 'Mock_Item', objectId);
                        const attribute = po.getAttribute('String');

                        if (po.isEditing)
                            po.cancelEdit();

                        const container = document.getElementById('test-container');
                        if (!container)
                            throw new Error('Test container not found');

                        const presenter = document.createElement('vi-persistent-object-attribute-presenter');
                        presenter.id = componentId;

                        let loadedFired = false;
                        presenter.addEventListener('attribute-loaded', () => {
                            loadedFired = true;
                            resolve(true);
                        });

                        // Set timeout to resolve false if event doesn't fire
                        setTimeout(() => {
                            if (!loadedFired)
                                resolve(false);
                        }, 5000);

                        container.appendChild(presenter);
                        (presenter as any).attribute = attribute;
                    })();
                });
            }, componentId);

            expect(eventFired).toBe(true);
        });
    });

    // ===========================================
    // LOADING STATE TESTS
    // ===========================================
    test.describe('Loading State', () => {
        test('has [loading] attribute initially then removes it', async () => {
            // This tests the loading state transition
            const componentId = `presenter-${Math.random().toString(36).substring(2, 15)}`;

            const result = await sharedPage.evaluate(async (componentId) => {
                const objectId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
                const po = await (window as any).service.getPersistentObject(null, 'Mock_Item', objectId);
                const attribute = po.getAttribute('String');

                if (po.isEditing)
                    po.cancelEdit();

                const container = document.getElementById('test-container');
                if (!container)
                    throw new Error('Test container not found');

                const presenter = document.createElement('vi-persistent-object-attribute-presenter');
                presenter.id = componentId;

                container.appendChild(presenter);

                // Check initial loading state before setting attribute
                const initialLoading = (presenter as any).loading;

                (presenter as any).attribute = attribute;

                // Wait for update
                await (presenter as any).updateComplete;

                const finalLoading = (presenter as any).loading;

                return { initialLoading, finalLoading };
            }, componentId);

            expect(result.initialLoading).toBe(true);
            expect(result.finalLoading).toBe(false);
        });
    });

    // ===========================================
    // CONTENT SLOT TESTS
    // ===========================================
    test.describe('Content Slot', () => {
        test('rendered attribute is slotted into content area', async () => {
            const presenter = await setupPresenter('String');

            // The attribute should be a direct child (slotted)
            const child = presenter.locator('> vi-persistent-object-attribute-string');
            await expect(child).toHaveCount(1);
        });

        test('rendered attribute has "attribute" class', async () => {
            const presenter = await setupPresenter('String');

            const child = presenter.locator('vi-persistent-object-attribute-string');
            await expect(child).toHaveClass(/attribute/);
        });
    });

    // ===========================================
    // NON-EDIT MODE TESTS
    // ===========================================
    test.describe('Non-Edit Mode', () => {
        test('has [non-edit] attribute when nonedit type hint is set', async () => {
            const presenter = await setupPresenter('NonEditString');

            await expect(presenter).toHaveAttribute('non-edit');
        });

        test('propagates nonEdit to rendered attribute', async () => {
            const presenter = await setupPresenter('NonEditString');

            const renderedAttribute = await presenter.evaluate((el) => {
                const child = el.querySelector('vi-persistent-object-attribute-string');
                return child ? (child as any).nonEdit : null;
            });

            expect(renderedAttribute).toBe(true);
        });
    });
});
