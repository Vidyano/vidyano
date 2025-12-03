import { test, expect, Page, Locator } from '@playwright/test';
import { setupPage } from '../attributes/helpers/page';
import { setupAttribute, beginEdit, cancelEdit, freeze, unfreeze } from '../attributes/helpers/persistent-object.js';
import { startBackend, stopBackend, BackendProcess } from '../attributes/helpers/backend';

let backend: BackendProcess | undefined;

test.describe.serial('PersistentObjectAttributeEdit', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }, testInfo) => {
        backend = await startBackend(testInfo, 'persistent-object-attribute-edit.cs');
        sharedPage = await browser.newPage();
        await setupPage(sharedPage, '', backend.port);
    });

    test.afterAll(async () => {
        await sharedPage.close();
        await stopBackend(backend);
    });

    async function setupEdit(attributeName: string = 'Name') {
        return await setupAttribute(
            sharedPage,
            'vi-persistent-object-attribute-edit',
            attributeName,
            { startInEditMode: true }
        );
    }

    async function getComponentState(component: Locator) {
        return component.evaluate(node => {
            const inst = node as any;
            return {
                hasFocus: inst.hasFocus,
                hasError: inst.hasError,
                reverse: inst.reverse,
                sensitive: inst.sensitive,
                readOnly: inst.readOnly,
                hasValidationError: inst.hasValidationError,
                attributeName: inst.attribute?.name,
                attributeValue: inst.attribute?.value,
                isFrozen: inst.attribute?.parent?.isFrozen
            };
        });
    }

    async function getSlotContent(component: Locator, slotName: string) {
        return component.evaluate((node, name) => {
            const inst = node as any;
            const slot = inst.shadowRoot.querySelector(`slot[name="${name}"]`);
            return slot ? slot.assignedElements().length : 0;
        }, slotName);
    }

    async function getActionButtons(component: Locator) {
        return component.evaluate(node => {
            const inst = node as any;
            const buttons = inst.shadowRoot.querySelectorAll('.action');
            return buttons.length;
        });
    }

    async function clickActionButton(component: Locator, index: number = 0) {
        await component.evaluate((node, idx) => {
            const inst = node as any;
            const buttons = inst.shadowRoot.querySelectorAll('.action');
            if (buttons[idx])
                (buttons[idx] as HTMLElement).click();
        }, index);
    }

    async function hasValidationErrorElement(component: Locator) {
        return component.evaluate(node => {
            const inst = node as any;
            return !!inst.shadowRoot.querySelector('vi-persistent-object-attribute-validation-error');
        });
    }

    test('renders with attribute', async () => {
        const component = await setupEdit();
        await expect(component).toBeVisible();

        const state = await getComponentState(component);
        expect(state.attributeName).toBe('Name');
    });

    test('hasFocus updates on focusin/focusout', async () => {
        const component = await setupEdit();

        // Initially not focused
        let state = await getComponentState(component);
        expect(state.hasFocus).toBe(false);

        // Dispatch focusin event
        await component.evaluate(node => {
            node.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        });

        await sharedPage.waitForTimeout(50);

        state = await getComponentState(component);
        expect(state.hasFocus).toBe(true);

        // Dispatch focusout event
        await component.evaluate(node => {
            node.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        });

        await sharedPage.waitForTimeout(50);

        state = await getComponentState(component);
        expect(state.hasFocus).toBe(false);
    });

    test('hasFocus attribute reflects in DOM', async () => {
        const component = await setupEdit();

        // Initially no has-focus attribute
        await expect(component).not.toHaveAttribute('has-focus');

        // Trigger focus
        await component.evaluate(node => {
            node.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        });

        await sharedPage.waitForTimeout(50);

        // Should have has-focus attribute
        await expect(component).toHaveAttribute('has-focus');
    });

    test('hasError computed from validationError', async () => {
        // Test without error
        let component = await setupEdit();
        let state = await getComponentState(component);
        expect(state.hasError).toBeFalsy();

        // Test with error
        component = await setupEdit('NameWithError');
        await sharedPage.waitForTimeout(100);

        state = await getComponentState(component);
        expect(state.hasError).toBeTruthy();
    });

    test('hasError attribute reflects in DOM', async () => {
        // Test without error - should not have has-error attribute
        let component = await setupEdit();
        await expect(component).not.toHaveAttribute('has-error');

        // Test with error - should have has-error attribute
        component = await setupEdit('NameWithError');
        await sharedPage.waitForTimeout(100);
        await expect(component).toHaveAttribute('has-error');
    });

    test('readOnly computed from attribute.isReadOnly', async () => {
        const component = await setupEdit('ReadOnlyName');

        await sharedPage.waitForTimeout(100);

        const state = await getComponentState(component);
        expect(state.readOnly).toBe(true);
    });

    test('readOnly attribute reflects in DOM', async () => {
        const component = await setupEdit('ReadOnlyName');

        await sharedPage.waitForTimeout(100);

        await expect(component).toHaveAttribute('read-only');
    });

    test('hasValidationError only when error and not readOnly', async () => {
        // Test without error
        let component = await setupEdit();
        let state = await getComponentState(component);
        expect(state.hasValidationError).toBe(false);

        // Test with error on editable attribute
        component = await setupEdit('NameWithError');
        await sharedPage.waitForTimeout(100);

        state = await getComponentState(component);
        expect(state.hasValidationError).toBe(true);
    });

    test('hasValidationError false when readOnly', async () => {
        // Test read-only attribute with error - should not show validation error
        const component = await setupEdit('ReadOnlyNameWithError');
        await sharedPage.waitForTimeout(100);

        const state = await getComponentState(component);
        expect(state.hasValidationError).toBe(false);
    });

    test('shows validation error element when hasValidationError', async () => {
        // Test without error - no validation error element
        let component = await setupEdit();
        let hasError = await hasValidationErrorElement(component);
        expect(hasError).toBe(false);

        // Test with error - should show validation error element
        component = await setupEdit('NameWithError');
        await sharedPage.waitForTimeout(100);

        hasError = await hasValidationErrorElement(component);
        expect(hasError).toBe(true);
    });

    test('supports slots for left and right extras', async () => {
        const component = await setupEdit();

        // Add elements to slots
        await sharedPage.evaluate((componentId) => {
            const comp = document.getElementById(componentId);
            if (!comp) return;

            const leftButton = document.createElement('button');
            leftButton.slot = 'left';
            leftButton.textContent = 'Left';
            comp.appendChild(leftButton);

            const rightButton = document.createElement('button');
            rightButton.slot = 'right';
            rightButton.textContent = 'Right';
            comp.appendChild(rightButton);
        }, (await component.getAttribute('id'))!);

        await sharedPage.waitForTimeout(50);

        const leftSlots = await getSlotContent(component, 'left');
        const rightSlots = await getSlotContent(component, 'right');

        expect(leftSlots).toBe(1);
        expect(rightSlots).toBe(1);
    });

    test('renders action buttons when attribute has actions', async () => {
        const component = await setupEdit('NameWithActions');

        await sharedPage.waitForTimeout(100);

        const actionCount = await getActionButtons(component);
        expect(actionCount).toBeGreaterThan(0);
    });

    test('action button click executes action', async () => {
        const component = await setupEdit('NameWithActions');

        await sharedPage.waitForTimeout(100);

        // Set up subscription to track action execution
        await component.evaluate((node) => {
            const inst = node as any;
            const action = inst.attribute.actions[0];
            (window as any).__actionExecutionResult = { executed: false, attributeName: null };

            // Subscribe to action execution
            action.subscribe((_action: any, _worker: any, args: any) => {
                (window as any).__actionExecutionResult = {
                    executed: true,
                    attributeName: args.parameters?.AttributeName || null
                };
            });
        });

        // Click the action button
        await clickActionButton(component, 0);
        await sharedPage.waitForTimeout(100);

        // Get the execution result
        const executionResult = await sharedPage.evaluate(() => (window as any).__actionExecutionResult);

        // Verify action was executed with correct parameters
        expect(executionResult.executed).toBe(true);
        expect(executionResult.attributeName).toBe('NameWithActions');
    });

    test('disabled when parent is frozen', async () => {
        const component = await setupEdit();

        // Freeze the parent
        await freeze(sharedPage, component);

        await sharedPage.waitForTimeout(100);

        const state = await getComponentState(component);
        expect(state.isFrozen).toBe(true);

        // Check if box has disabled attribute
        const isDisabled = await component.evaluate(node => {
            const inst = node as any;
            const box = inst.shadowRoot.querySelector('.box');
            return box?.hasAttribute('disabled');
        });

        expect(isDisabled).toBe(true);
    });

    test('enabled when parent is unfrozen', async () => {
        const component = await setupEdit();

        // Freeze then unfreeze
        await freeze(sharedPage, component);
        await sharedPage.waitForTimeout(50);
        await unfreeze(sharedPage, component);

        await sharedPage.waitForTimeout(100);

        const state = await getComponentState(component);
        expect(state.isFrozen).toBe(false);

        const isDisabled = await component.evaluate(node => {
            const inst = node as any;
            const box = inst.shadowRoot.querySelector('.box');
            return box?.hasAttribute('disabled');
        });

        expect(isDisabled).toBe(false);
    });

    test('reverse property reflects to attribute', async () => {
        const component = await setupEdit();

        // Set reverse property
        await component.evaluate(node => {
            (node as any).reverse = true;
        });

        await sharedPage.waitForTimeout(50);

        await expect(component).toHaveAttribute('reverse');
    });

    test('supports default slot for input content', async () => {
        const component = await setupEdit();

        // Add element to default slot
        await sharedPage.evaluate((componentId) => {
            const comp = document.getElementById(componentId);
            if (!comp) return;

            const input = document.createElement('input');
            input.value = 'Test content';
            comp.appendChild(input);
        }, (await component.getAttribute('id'))!);

        await sharedPage.waitForTimeout(50);

        const defaultSlotContent = await component.evaluate(node => {
            const inst = node as any;
            const slot = inst.shadowRoot.querySelector('slot:not([name])');
            return slot ? slot.assignedElements().length : 0;
        });

        expect(defaultSlotContent).toBe(1);
    });
});
