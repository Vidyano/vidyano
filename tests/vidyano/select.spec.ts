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
        <vi-select></vi-select>
      </body>
    </html>
`;

async function setupSelectTest(page: Page, options: string[] = ['Option 1', 'Option 2', 'Option 3']) {
    await page.setContent(selectHtml);
    await page.addScriptTag({ path: "dev/wwwroot/index.js", type: 'module' });

    await page.waitForFunction(() => !!customElements.get('vi-select'), { timeout: 10000 });

    const component = page.locator('vi-select');
    await component.evaluate((node, opts) => {
        (node as any).options = opts;
    }, options);

    return component;
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

test('Select: renders with options', async ({ page }) => {
    const component = await setupSelectTest(page);
    await expect(component).toBeVisible();

    const state = await getSelectState(component);
    expect(state.hasOptions).toBe(true);
    expect(state.items).toBe(3);
});

test('Select: displays selected option', async ({ page }) => {
    const component = await setupSelectTest(page);

    await component.evaluate(node => {
        (node as any).selectedOption = 'Option 2';
    });

    const state = await getSelectState(component);
    expect(state.selectedOption).toBe('Option 2');
    expect(state.inputValue).toBe('Option 2');
});

test('Select: opens popup on arrow down', async ({ page }) => {
    const component = await setupSelectTest(page);

    const input = component.locator('#input');
    await input.press('ArrowDown');

    const popup = component.locator('vi-popup#popup');
    await expect(popup).toHaveAttribute('open', '');
});

test('Select: navigates options with arrow keys', async ({ page }) => {
    const component = await setupSelectTest(page);

    const input = component.locator('#input');
    await input.press('ArrowDown');
    await input.press('ArrowDown');
    await input.press('Enter');

    const state = await getSelectState(component);
    expect(state.selectedOption).toBe('Option 2');
});

test('Select: confirms selection with Enter', async ({ page }) => {
    const component = await setupSelectTest(page);

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

test('Select: cancels selection with Escape', async ({ page }) => {
    const component = await setupSelectTest(page);

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

test('Select: filters options when typing', async ({ page }) => {
    const component = await setupSelectTest(page, ['Apple', 'Banana', 'Cherry', 'Apricot']);

    const input = component.locator('#input');
    await input.focus();
    await input.pressSequentially('Ap');

    await page.waitForTimeout(100);

    const state = await getSelectState(component);
    expect(state.filtering).toBe(true);
    expect(state.filteredItems).toBe(2); // Apple and Apricot
});

test('Select: selects filtered option', async ({ page }) => {
    const component = await setupSelectTest(page, ['Apple', 'Banana', 'Cherry']);

    const input = component.locator('#input');
    await input.focus();
    await input.pressSequentially('Ban');
    await page.waitForTimeout(100);
    await input.press('Enter');

    const state = await getSelectState(component);
    expect(state.selectedOption).toBe('Banana');
});

test('Select: works with object options', async ({ page }) => {
    await page.setContent(selectHtml);
    await page.addScriptTag({ path: "dev/wwwroot/index.js", type: 'module' });

    await page.waitForFunction(() => !!customElements.get('vi-select'), { timeout: 10000 });

    const component = page.locator('vi-select');
    await component.evaluate(node => {
        (node as any).options = [
            { key: 1, value: 'First' },
            { key: 2, value: 'Second' },
            { key: 3, value: 'Third' }
        ];
    });

    await component.evaluate(node => {
        (node as any).selectedOption = 2;
    });

    const state = await getSelectState(component);
    expect(state.selectedOption).toBe(2);
    expect(state.inputValue).toBe('Second');
});

test('Select: respects readonly property', async ({ page }) => {
    const component = await setupSelectTest(page);

    await component.evaluate(node => {
        (node as any).readonly = true;
    });

    const state = await component.evaluate(node => ({
        readonly: (node as any).readonly,
        isReadonlyInput: (node as any).isReadonlyInput
    }));

    expect(state.readonly).toBe(true);
    expect(state.isReadonlyInput).toBe(true);
});

test('Select: respects disabled property', async ({ page }) => {
    const component = await setupSelectTest(page);

    await component.evaluate(node => {
        (node as any).disabled = true;
    });

    const state = await component.evaluate(node => ({
        disabled: (node as any).disabled
    }));

    expect(state.disabled).toBe(true);
});

test('Select: handles group separator', async ({ page }) => {
    const component = await setupSelectTest(page, ['Fruits|Apple', 'Fruits|Banana', 'Vegetables|Carrot']);

    await component.evaluate(node => {
        (node as any).groupSeparator = '|';
    });

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

test('Select: fires selected-option-changed event', async ({ page }) => {
    const component = await setupSelectTest(page);

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

test('Select: Tab confirms selection', async ({ page }) => {
    const component = await setupSelectTest(page);

    const input = component.locator('#input');
    await input.press('ArrowDown');
    await input.press('ArrowDown');
    await input.press('Tab');

    const state = await getSelectState(component);
    expect(state.selectedOption).toBe('Option 2');
});

test('Select: opens popup on click', async ({ page }) => {
    const component = await setupSelectTest(page);

    await component.click();

    const popup = component.locator('vi-popup#popup');
    await expect(popup).toHaveAttribute('open', '');
});

test('Select: closes popup on click outside', async ({ page }) => {
    const component = await setupSelectTest(page);

    const input = component.locator('#input');
    await input.press('ArrowDown');

    const popup = component.locator('vi-popup#popup');
    await expect(popup).toHaveAttribute('open', '');

    await page.click('body', { position: { x: 10, y: 10 } });

    await expect(popup).not.toHaveAttribute('open', '');
});

test('Select: selects option on mouse click', async ({ page }) => {
    const component = await setupSelectTest(page);

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

test('Select: shows placeholder text', async ({ page }) => {
    const component = await setupSelectTest(page);

    await component.evaluate(node => {
        (node as any).placeholder = 'Select an option...';
    });

    const input = component.locator('#input');
    await expect(input).toHaveAttribute('placeholder', 'Select an option...');
});

test('Select: keep-unmatched allows custom values', async ({ page }) => {
    const component = await setupSelectTest(page);

    await component.evaluate(node => {
        (node as any).keepUnmatched = true;
    });

    const input = component.locator('#input');
    await input.focus();
    await input.fill('Custom Value');

    // Click outside to blur - keepUnmatched preserves value on blur
    await page.click('body', { position: { x: 10, y: 10 } });

    const state = await component.evaluate(node => ({
        inputValue: (node as any).inputValue
    }));

    expect(state.inputValue).toBe('Custom Value');
});

test('Select: disable-filtering prevents filtering on keypress', async ({ page }) => {
    const component = await setupSelectTest(page, ['Apple', 'Banana', 'Cherry']);

    await component.evaluate(node => {
        (node as any).disableFiltering = true;
    });

    // Verify input is readonly
    const readonlyState = await component.evaluate(node => ({
        isReadonlyInput: (node as any).isReadonlyInput
    }));
    expect(readonlyState.isReadonlyInput).toBe(true);

    // Open popup and try to type
    const input = component.locator('#input');
    await input.press('ArrowDown');
    await input.press('a');
    await page.waitForTimeout(100);

    // Verify filtering didn't trigger
    const state = await getSelectState(component);
    expect(state.filtering).toBe(false);
    expect(state.filteredItems).toBe(3);
});

test('Select: fires input-value-changed event', async ({ page }) => {
    const component = await setupSelectTest(page);

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
