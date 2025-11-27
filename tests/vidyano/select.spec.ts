import { test, expect, Page, Locator } from '@playwright/test';

const selectHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          :not(:defined) { display: none; }
          * { display: block; padding: 1px; }
          vi-select { width: 200px; }
        </style>
      </head>
      <body>
        <div id="test-container"></div>
      </body>
    </html>
`;

async function setupPage(page: Page) {
    await page.setContent(selectHtml);
    await page.addScriptTag({ path: "dev/wwwroot/index.js", type: 'module' });
    await page.waitForFunction(() => !!customElements.get('vi-select'), { timeout: 10000 });
}

async function createSelect(page: Page, options: string[] | object[] = ['Option 1', 'Option 2', 'Option 3'], config?: { groupSeparator?: string; allowFreeText?: boolean; disableFiltering?: boolean; placeholder?: string; readonly?: boolean; disabled?: boolean }) {
    const componentId = `component-${Math.random().toString(36).substring(2, 15)}`;

    await page.evaluate(({ componentId, options, config }) => {
        const container = document.getElementById('test-container');
        if (!container)
            throw new Error('Test container not found');

        const component = document.createElement('vi-select') as any;
        component.id = componentId;
        component.options = options;

        if (config?.groupSeparator !== undefined)
            component.groupSeparator = config.groupSeparator;

        if (config?.allowFreeText !== undefined)
            component.allowFreeText = config.allowFreeText;

        if (config?.disableFiltering !== undefined)
            component.disableFiltering = config.disableFiltering;

        if (config?.placeholder !== undefined)
            component.placeholder = config.placeholder;

        if (config?.readonly !== undefined)
            component.readonly = config.readonly;

        if (config?.disabled !== undefined)
            component.disabled = config.disabled;

        container.appendChild(component);
    }, { componentId, options, config });

    return page.locator(`#${componentId}`);
}

async function getSelectState(component: Locator) {
    return component.evaluate(node => {
        const inst = node as any;
        return {
            selectedOption: inst.selectedOption,
            inputValue: inst.inputValue,
            filtering: inst.filtering,
            hasOptions: inst.hasOptions,
            items: inst.items?.length ?? 0,
            filteredItems: inst.filteredItems?.length ?? 0
        };
    });
}

test.describe.serial('Select Tests', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test('renders with options', async () => {
        const component = await createSelect(sharedPage);
        await expect(component).toBeVisible();

        const state = await getSelectState(component);
        expect(state.hasOptions).toBe(true);
        expect(state.items).toBe(3);
    });

    test('displays selected option', async () => {
        const component = await createSelect(sharedPage);

        await component.evaluate(node => {
            (node as any).selectedOption = 'Option 2';
        });

        const state = await getSelectState(component);
        expect(state.selectedOption).toBe('Option 2');
        expect(state.inputValue).toBe('Option 2');
    });

    test('opens popup on arrow down', async () => {
        const component = await createSelect(sharedPage);

        const input = component.locator('#input');
        await input.press('ArrowDown');

        const popup = component.locator('vi-popup#popup');
        await expect(popup).toHaveAttribute('open', '');
    });

    test('navigates options with arrow keys', async () => {
        const component = await createSelect(sharedPage);

        const input = component.locator('#input');
        await input.press('ArrowDown');
        await input.press('ArrowDown');
        await input.press('Enter');

        const state = await getSelectState(component);
        expect(state.selectedOption).toBe('Option 2');
    });

    test('confirms selection with Enter', async () => {
        const component = await createSelect(sharedPage);

        await component.evaluate(node => {
            (node as any).selectedOption = 'Option 1';
        });

        const input = component.locator('#input');
        await input.press('ArrowDown');
        await input.press('ArrowDown');
        await input.press('Enter');

        const state = await getSelectState(component);
        expect(state.selectedOption).toBe('Option 3');
    });

    test('cancels selection with Escape', async () => {
        const component = await createSelect(sharedPage);

        await component.evaluate(node => {
            (node as any).selectedOption = 'Option 1';
        });

        const input = component.locator('#input');
        await input.press('ArrowDown');
        await input.press('ArrowDown');
        await input.press('Escape');

        const state = await getSelectState(component);
        expect(state.selectedOption).toBe('Option 1');
    });

    test('filters options when typing', async () => {
        const component = await createSelect(sharedPage, ['Apple', 'Banana', 'Cherry', 'Apricot']);

        const input = component.locator('#input');
        await input.focus();
        await input.pressSequentially('Ap');

        await sharedPage.waitForTimeout(100);

        const state = await getSelectState(component);
        expect(state.filtering).toBe(true);
        expect(state.filteredItems).toBe(2); // Apple and Apricot
    });

    test('selects filtered option', async () => {
        const component = await createSelect(sharedPage, ['Apple', 'Banana', 'Cherry']);

        const input = component.locator('#input');
        await input.focus();
        await input.pressSequentially('Ban');
        await sharedPage.waitForTimeout(100);
        await input.press('Enter');

        const state = await getSelectState(component);
        expect(state.selectedOption).toBe('Banana');
    });

    test('works with object options', async () => {
        const component = await createSelect(sharedPage, [
            { key: 1, value: 'First' },
            { key: 2, value: 'Second' },
            { key: 3, value: 'Third' }
        ]);

        await component.evaluate(node => {
            (node as any).selectedOption = 2;
        });

        const state = await getSelectState(component);
        expect(state.selectedOption).toBe(2);
        expect(state.inputValue).toBe('Second');
    });

    test('respects readonly property', async () => {
        const component = await createSelect(sharedPage, ['Option 1', 'Option 2', 'Option 3'], { readonly: true });

        const state = await component.evaluate(node => ({
            readonly: (node as any).readonly,
            isReadonlyInput: (node as any).isReadonlyInput
        }));

        expect(state.readonly).toBe(true);
        expect(state.isReadonlyInput).toBe(true);
    });

    test('respects disabled property', async () => {
        const component = await createSelect(sharedPage, ['Option 1', 'Option 2', 'Option 3'], { disabled: true });

        const state = await component.evaluate(node => ({
            disabled: (node as any).disabled
        }));

        expect(state.disabled).toBe(true);
    });

    test('handles group separator', async () => {
        const component = await createSelect(sharedPage, ['Fruits|Apple', 'Fruits|Banana', 'Vegetables|Carrot'], { groupSeparator: '|' });

        const state = await component.evaluate(node => {
            const inst = node as any;
            return {
                items: inst.items.map((i: any) => ({
                    displayValue: i.displayValue,
                    group: i.group,
                    isGroupHeader: i.isGroupHeader
                }))
            };
        });

        expect(state.items[0].group).toBe('Fruits');
        expect(state.items[0].isGroupHeader).toBe(true);
        expect(state.items[0].displayValue).toBe('Apple');
        expect(state.items[1].isGroupHeader).toBe(false);
        expect(state.items[2].group).toBe('Vegetables');
        expect(state.items[2].isGroupHeader).toBe(true);
    });

    test('fires selected-option-changed event', async () => {
        const component = await createSelect(sharedPage);

        const eventPromise = component.evaluate(node => {
            return new Promise<any>(resolve => {
                node.addEventListener('selected-option-changed', (e: any) => {
                    resolve(e.detail.value);
                });
            });
        });

        await component.evaluate(node => {
            (node as any).selectedOption = 'Option 2';
        });

        const eventValue = await eventPromise;
        expect(eventValue).toBe('Option 2');
    });

    test('Tab confirms selection', async () => {
        const component = await createSelect(sharedPage);

        const input = component.locator('#input');
        await input.press('ArrowDown');
        await input.press('ArrowDown');
        await input.press('Tab');

        const state = await getSelectState(component);
        expect(state.selectedOption).toBe('Option 2');
    });

    test('opens popup on click', async () => {
        const component = await createSelect(sharedPage);

        await component.click();

        const popup = component.locator('vi-popup#popup');
        await expect(popup).toHaveAttribute('open', '');
    });

    test('closes popup on click outside', async () => {
        const component = await createSelect(sharedPage);

        const input = component.locator('#input');
        await input.press('ArrowDown');

        const popup = component.locator('vi-popup#popup');
        await expect(popup).toHaveAttribute('open', '');

        await sharedPage.click('body', { position: { x: 10, y: 10 } });

        await expect(popup).not.toHaveAttribute('open', '');
    });

    test('selects option on mouse click', async () => {
        const component = await createSelect(sharedPage);

        const input = component.locator('#input');
        await input.press('ArrowDown');

        const popup = component.locator('vi-popup#popup');
        await expect(popup).toHaveAttribute('open', '');

        const option = component.locator('vi-select-option-item').nth(1);
        await option.click();

        const state = await getSelectState(component);
        expect(state.selectedOption).toBe('Option 2');

        await expect(popup).not.toHaveAttribute('open', '');
    });

    test('shows placeholder text', async () => {
        const component = await createSelect(sharedPage, ['Option 1', 'Option 2', 'Option 3'], { placeholder: 'Select an option...' });

        const input = component.locator('#input');
        await expect(input).toHaveAttribute('placeholder', 'Select an option...');
    });

    test('allowFreeText commits custom value on blur', async () => {
        const component = await createSelect(sharedPage, ['Option 1', 'Option 2', 'Option 3'], { allowFreeText: true });

        const input = component.locator('#input');
        await input.focus();
        await input.fill('Custom Value');

        // Click outside to blur - allowFreeText should commit the value
        await sharedPage.click('body', { position: { x: 10, y: 10 } });

        const state = await component.evaluate(node => ({
            selectedOption: (node as any).selectedOption,
            inputValue: (node as any).inputValue
        }));

        expect(state.selectedOption).toBe('Custom Value');
        expect(state.inputValue).toBe('Custom Value');
    });

    test('allowFreeText: Enter accepts exact input, Tab accepts suggestion', async () => {
        const component = await createSelect(sharedPage, ['Option 1', 'Option 2'], { allowFreeText: true });

        const input = component.locator('#input');

        // Type partial match (use pressSequentially to trigger filtering)
        await input.focus();
        await input.pressSequentially('Option');
        await sharedPage.waitForTimeout(100);

        // Press Enter - should accept "Option" (exact input)
        await input.press('Enter');

        const state = await component.evaluate(node => ({
            selectedOption: (node as any).selectedOption,
            inputValue: (node as any).inputValue
        }));

        expect(state.selectedOption).toBe('Option');
        expect(state.inputValue).toBe('Option');
    });

    test('allowFreeText: Tab accepts suggestion instead of exact input', async () => {
        const component = await createSelect(sharedPage, ['Option 1', 'Option 2'], { allowFreeText: true });

        const input = component.locator('#input');

        // Type partial match (use pressSequentially to trigger filtering)
        await input.focus();
        await input.pressSequentially('Option');
        await sharedPage.waitForTimeout(100);

        // Press Tab - should accept suggestion "Option 1"
        await input.press('Tab');

        const state = await component.evaluate(node => ({
            selectedOption: (node as any).selectedOption,
            inputValue: (node as any).inputValue
        }));

        expect(state.selectedOption).toBe('Option 1');
        expect(state.inputValue).toBe('Option 1');
    });

    test('allowFreeText: editing existing value and pressing Enter keeps edited value', async () => {
        const component = await createSelect(sharedPage, ['Bla', 'Other'], { allowFreeText: true });

        // First select "Bla"
        await component.evaluate(node => {
            (node as any).selectedOption = 'Bla';
        });

        const input = component.locator('#input');
        await expect(input).toHaveValue('Bla');

        // Edit the value by removing the "a"
        await input.focus();
        await input.press('End');
        await input.press('Backspace');
        await sharedPage.waitForTimeout(100);

        // Press Enter - should accept "Bl" (the edited value)
        await input.press('Enter');

        const state = await component.evaluate(node => ({
            selectedOption: (node as any).selectedOption,
            inputValue: (node as any).inputValue
        }));

        expect(state.selectedOption).toBe('Bl');
        expect(state.inputValue).toBe('Bl');
    });

    test('disable-filtering prevents filtering on keypress', async () => {
        const component = await createSelect(sharedPage, ['Apple', 'Banana', 'Cherry'], { disableFiltering: true });

        // Verify input is readonly
        const readonlyState = await component.evaluate(node => ({
            isReadonlyInput: (node as any).isReadonlyInput
        }));
        expect(readonlyState.isReadonlyInput).toBe(true);

        // Open popup and try to type
        const input = component.locator('#input');
        await input.press('ArrowDown');
        await input.press('a');
        await sharedPage.waitForTimeout(100);

        // Verify filtering didn't trigger
        const state = await getSelectState(component);
        expect(state.filtering).toBe(false);
        expect(state.filteredItems).toBe(3);
    });

    test('fires input-value-changed event', async () => {
        const component = await createSelect(sharedPage);

        const eventPromise = component.evaluate(node => {
            return new Promise<string>(resolve => {
                node.addEventListener('input-value-changed', (e: any) => {
                    resolve(e.detail.value);
                });
            });
        });

        await component.evaluate(node => {
            (node as any).selectedOption = 'Option 3';
        });

        const eventValue = await eventPromise;
        expect(eventValue).toBe('Option 3');
    });

    test('matches selectedOption by displayValue when groupSeparator is used', async () => {
        const component = await createSelect(sharedPage, ['Custom.TestPinned', 'Custom.OtherOption', 'Vidyano.Delete'], { groupSeparator: '.' });

        // Set selectedOption to display value (without group prefix)
        await component.evaluate(node => {
            (node as any).selectedOption = 'TestPinned';
        });

        const state = await component.evaluate(node => {
            const inst = node as any;
            return {
                selectedOption: inst.selectedOption,
                selectedItem: inst.selectedItem ? {
                    displayValue: inst.selectedItem.displayValue,
                    key: inst.selectedItem.key,
                    group: inst.selectedItem.group
                } : null,
                inputValue: inst.inputValue
            };
        });

        expect(state.selectedItem).not.toBeNull();
        expect(state.selectedItem?.displayValue).toBe('TestPinned');
        expect(state.selectedItem?.group).toBe('Custom');
        expect(state.inputValue).toBe('TestPinned');
    });

    test('propagates ungrouped value when selecting with groupSeparator', async () => {
        const component = await createSelect(sharedPage, ['Custom.TestPinned', 'Custom.OtherOption', 'Vidyano.Delete'], { groupSeparator: '.' });

        // Open popup and select second option
        const input = component.locator('#input');
        await input.press('ArrowDown');
        await input.press('ArrowDown');
        await input.press('Enter');

        const state = await component.evaluate(node => {
            const inst = node as any;
            return {
                selectedOption: inst.selectedOption,
                inputValue: inst.inputValue
            };
        });

        // selectedOption should be ungrouped value, not full key
        expect(state.selectedOption).toBe('OtherOption');
        expect(state.inputValue).toBe('OtherOption');
    });

    test('allowFreeText: navigating to different option with arrow keys and Enter selects that option', async () => {
        const component = await createSelect(sharedPage, ['Option 1', 'Option 2', 'Option 3'], { allowFreeText: true });

        // Set a free text value that's not in the options
        await component.evaluate(node => {
            (node as any).selectedOption = 'Custom Value';
        });

        const input = component.locator('#input');
        await expect(input).toHaveValue('Custom Value');

        // Navigate down to select a different option (not filtering, just navigating)
        await input.press('ArrowDown');
        await input.press('ArrowDown');
        await input.press('Enter');

        const state = await component.evaluate(node => ({
            selectedOption: (node as any).selectedOption,
            inputValue: (node as any).inputValue
        }));

        // Should select the navigated option, not keep the free text value
        expect(state.selectedOption).toBe('Option 2');
        expect(state.inputValue).toBe('Option 2');
    });
});
