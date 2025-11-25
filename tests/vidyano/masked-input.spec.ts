import { test, expect, Page, Locator } from '@playwright/test';

const maskedInputHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          :not(:defined) { display: none; }
        </style>
      </head>
      <body>
        <vi-masked-input></vi-masked-input>
      </body>
    </html>
`;

async function setupMaskedInputTest(page: Page, format?: string) {
    await page.setContent(maskedInputHtml);
    await page.addScriptTag({ path: "dev/wwwroot/index.js", type: 'module' });

    await page.waitForFunction(() => !!customElements.get('vi-masked-input'), { timeout: 10000 });

    const component = page.locator('vi-masked-input');

    if (format) {
        await component.evaluate((node, fmt) => {
            (node as any).format = fmt;
        }, format);
        await page.waitForTimeout(50);
    }

    return component;
}

async function getMaskedInputState(component: Locator) {
    return component.evaluate(node => {
        const inst = node as any;
        return {
            format: inst.format,
            separator: inst.separator,
            allowed: inst.allowed,
            open: inst.open,
            value: inst.value,
            insertMode: inst.insertMode
        };
    });
}

async function getInputElement(component: Locator) {
    return component.locator('input');
}

async function setSelection(input: Locator, start: number, end: number) {
    await input.evaluate((el, { s, e }) => {
        const inp = el as HTMLInputElement;
        inp.setSelectionRange(s, e);
    }, { s: start, e: end });
}

test('MaskedInput: renders with default properties', async ({ page }) => {
    const component = await setupMaskedInputTest(page);
    await expect(component).toBeVisible();

    const state = await getMaskedInputState(component);
    expect(state.format).toBe('');
    expect(state.separator).toBe('/:- ()');
    expect(state.allowed).toBe('0123456789');
    expect(state.open).toBe('_YMDhms#');
    expect(state.insertMode).toBe(false);
});

test('MaskedInput: sets format and initializes value', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '##/##/####');

    const state = await getMaskedInputState(component);
    expect(state.format).toBe('##/##/####');
    expect(state.value).toBe('##/##/####');
});

test('MaskedInput: handles single character input', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '##/##/####');
    const input = await getInputElement(component);

    await input.click();
    await page.keyboard.type('1');
    await page.waitForTimeout(50);

    const state = await getMaskedInputState(component);
    expect(state.value).toBe('1#/##/####');
});

test('MaskedInput: allows only specified characters', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '##-##');
    const input = await getInputElement(component);

    await input.click();
    await page.keyboard.type('1');
    await page.waitForTimeout(50);

    let state = await getMaskedInputState(component);
    expect(state.value).toBe('1#-##');

    // Try to type a letter (should be blocked)
    await page.keyboard.type('a');
    await page.waitForTimeout(50);

    state = await getMaskedInputState(component);
    expect(state.value).toBe('1#-##'); // Should not change
});

test('MaskedInput: auto-skips separators during input', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '##/##');
    const input = await getInputElement(component);

    await input.click();
    await page.keyboard.type('1');
    await page.keyboard.press('2');
    await page.waitForTimeout(50);

    const state = await getMaskedInputState(component);
    expect(state.value).toBe('12/##');

    // Cursor should be at position 3 (after the separator)
    const cursorPos = await input.evaluate(el => (el as HTMLInputElement).selectionStart);
    expect(cursorPos).toBe(3);
});

test('MaskedInput: handles backspace on single character', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '##/##');
    const input = await getInputElement(component);

    await input.click();
    await page.keyboard.type('1');
    await page.waitForTimeout(50);

    let state = await getMaskedInputState(component);
    expect(state.value).toBe('1#/##');

    await page.keyboard.press('Backspace');
    await page.waitForTimeout(50);

    state = await getMaskedInputState(component);
    expect(state.value).toBe('##/##');
});

test('MaskedInput: backspace jumps over separators', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '##/##');
    const input = await getInputElement(component);

    await input.click();
    await page.keyboard.type('1');
    await page.keyboard.press('2');
    await page.keyboard.press('3');
    await page.waitForTimeout(50);

    let state = await getMaskedInputState(component);
    expect(state.value).toBe('12/3#');

    // Cursor is after '3', backspace should delete '3'
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(50);

    state = await getMaskedInputState(component);
    expect(state.value).toBe('12/##');

    // Cursor is after '/', backspace should jump over separator and delete '2'
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(50);

    state = await getMaskedInputState(component);
    expect(state.value).toBe('1#/##');
});

test('MaskedInput: handles delete key forward', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '##/##');
    const input = await getInputElement(component);

    await input.click();
    await page.keyboard.type('1');
    await page.keyboard.press('2');
    await page.keyboard.press('3');
    await page.keyboard.press('4');
    await page.waitForTimeout(50);

    let state = await getMaskedInputState(component);
    expect(state.value).toBe('12/34');

    // Move cursor to beginning
    await page.keyboard.press('Home');
    await page.waitForTimeout(50);

    // Delete forward should remove '1'
    await page.keyboard.press('Delete');
    await page.waitForTimeout(50);

    state = await getMaskedInputState(component);
    expect(state.value).toBe('#2/34');
});

test('MaskedInput: delete jumps over separators', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '##/##');
    const input = await getInputElement(component);

    await input.click();
    await page.keyboard.type('1');
    await page.keyboard.press('2');
    await page.keyboard.press('3');
    await page.keyboard.press('4');
    await page.waitForTimeout(50);

    // Move cursor after '2' (before separator)
    await input.evaluate(el => (el as HTMLInputElement).setSelectionRange(2, 2));
    await page.waitForTimeout(50);

    // Delete should jump over separator and delete '3'
    await page.keyboard.press('Delete');
    await page.waitForTimeout(50);

    const state = await getMaskedInputState(component);
    expect(state.value).toBe('12/#4');
});

test('MaskedInput: handles selection deletion', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '##/##/####');
    const input = await getInputElement(component);

    await input.click();
    await page.keyboard.type('12345678', { delay: 10 });
    await page.waitForTimeout(50);

    let state = await getMaskedInputState(component);
    expect(state.value).toBe('12/34/5678');

    // Select characters at positions 3-7 ("34/5")
    await input.evaluate(el => (el as HTMLInputElement).setSelectionRange(3, 7));
    await page.waitForTimeout(50);

    // Type a character to replace selection
    await page.keyboard.type('9');
    await page.waitForTimeout(50);

    state = await getMaskedInputState(component);
    expect(state.value).toBe('12/9#/#678');
});

test('MaskedInput: backspace deletes entire selection', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '##/##');
    const input = await getInputElement(component);

    await input.click();
    await page.keyboard.type('1234', { delay: 10 });
    await page.waitForTimeout(50);

    // Select all
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(50);

    // Backspace should clear selection
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(50);

    const state = await getMaskedInputState(component);
    expect(state.value).toBe('##/##');
});

test('MaskedInput: handles paste with allowed character filtering', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '##/##/####');
    const input = await getInputElement(component);

    await input.click();

    // Simulate paste by using clipboard API
    await page.evaluate(async () => {
        const element = document.querySelector('vi-masked-input')?.shadowRoot?.querySelector('input') as HTMLInputElement;
        element?.focus();

        const pasteEvent = new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertFromPaste',
            data: '12abc34xyz5678'
        });
        element?.dispatchEvent(pasteEvent);
    });
    await page.waitForTimeout(50);

    // Should filter to only allowed characters
    const state = await getMaskedInputState(component);
    expect(state.value).toBe('12/34/5678');
});

test('MaskedInput: paste respects format length', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '##/##');
    const input = await getInputElement(component);

    await input.click();

    await page.evaluate(async () => {
        const element = document.querySelector('vi-masked-input')?.shadowRoot?.querySelector('input') as HTMLInputElement;
        element?.focus();

        const pasteEvent = new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertFromPaste',
            data: '123456789'
        });
        element?.dispatchEvent(pasteEvent);
    });
    await page.waitForTimeout(50);

    // Should only use first 4 digits
    const state = await getMaskedInputState(component);
    expect(state.value).toBe('12/34');
});

test('MaskedInput: insertMode shifts characters right on input', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '####');

    await component.evaluate(node => {
        (node as any).insertMode = true;
    });
    await page.waitForTimeout(50);

    const input = await getInputElement(component);
    await input.click();
    await page.keyboard.type('123', { delay: 10 });
    await page.waitForTimeout(50);

    let state = await getMaskedInputState(component);
    expect(state.value).toBe('123#');

    // Move cursor to position 1 (after '1')
    await input.evaluate(el => (el as HTMLInputElement).setSelectionRange(1, 1));
    await page.waitForTimeout(50);

    // Insert '9' - should shift '2' and '3' right
    await page.keyboard.press('9');
    await page.waitForTimeout(50);

    state = await getMaskedInputState(component);
    expect(state.value).toBe('1923');
});

test('MaskedInput: insertMode prevents overflow', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '####');

    await component.evaluate(node => {
        (node as any).insertMode = true;
    });
    await page.waitForTimeout(50);

    const input = await getInputElement(component);
    await input.click();
    await page.keyboard.type('1234', { delay: 10 });
    await page.waitForTimeout(50);

    let state = await getMaskedInputState(component);
    expect(state.value).toBe('1234');

    // Try to insert at position 1 - should fail (would overflow)
    await input.evaluate(el => (el as HTMLInputElement).setSelectionRange(1, 1));
    await page.waitForTimeout(50);

    await page.keyboard.press('9');
    await page.waitForTimeout(50);

    // Value should not change
    state = await getMaskedInputState(component);
    expect(state.value).toBe('1234');
});

test('MaskedInput: insertMode shifts left on backspace', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '####');

    await component.evaluate(node => {
        (node as any).insertMode = true;
    });
    await page.waitForTimeout(50);

    const input = await getInputElement(component);
    await input.click();
    await page.keyboard.type('1234', { delay: 10 });
    await page.waitForTimeout(50);

    let state = await getMaskedInputState(component);
    expect(state.value).toBe('1234');

    // Move cursor to position 2 (after '2')
    await input.evaluate(el => (el as HTMLInputElement).setSelectionRange(2, 2));
    await page.waitForTimeout(50);

    // Backspace should delete '2' and shift '3' and '4' left
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(50);

    state = await getMaskedInputState(component);
    expect(state.value).toBe('134#');
});

test('MaskedInput: insertMode shifts left on delete forward', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '####');

    await component.evaluate(node => {
        (node as any).insertMode = true;
    });
    await page.waitForTimeout(50);

    const input = await getInputElement(component);
    await input.click();
    await page.keyboard.type('1234', { delay: 10 });
    await page.waitForTimeout(50);

    // Move cursor to position 1 (after '1')
    await input.evaluate(el => (el as HTMLInputElement).setSelectionRange(1, 1));
    await page.waitForTimeout(50);

    // Delete should remove '2' and shift '3' and '4' left
    await page.keyboard.press('Delete');
    await page.waitForTimeout(50);

    const state = await getMaskedInputState(component);
    expect(state.value).toBe('134#');
});

test('MaskedInput: overwrite mode replaces characters (default)', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '####');
    const input = await getInputElement(component);

    await input.click();
    await page.keyboard.type('123', { delay: 10 });
    await page.waitForTimeout(50);

    let state = await getMaskedInputState(component);
    expect(state.value).toBe('123#');

    // Move cursor to position 1
    await input.evaluate(el => (el as HTMLInputElement).setSelectionRange(1, 1));
    await page.waitForTimeout(50);

    // Type '9' - should replace '2', not shift
    await page.keyboard.press('9');
    await page.waitForTimeout(50);

    state = await getMaskedInputState(component);
    expect(state.value).toBe('193#');
});

test('MaskedInput: overwrite mode backspace clears character without shifting', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '####');
    const input = await getInputElement(component);

    await input.click();
    await page.keyboard.type('1234', { delay: 10 });
    await page.waitForTimeout(50);

    let state = await getMaskedInputState(component);
    expect(state.value).toBe('1234');

    // Move cursor to position 2
    await input.evaluate(el => (el as HTMLInputElement).setSelectionRange(2, 2));
    await page.waitForTimeout(50);

    // Backspace should clear '2' but not shift '3' and '4'
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(50);

    state = await getMaskedInputState(component);
    expect(state.value).toBe('1#34');
});

test('MaskedInput: fires value-changed event with detail', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '##/##');

    const eventPromise = component.evaluate(node => {
        return new Promise<any>(resolve => {
            node.addEventListener('value-changed', (e: any) => {
                resolve({
                    value: e.detail.value,
                    hasOriginalEvent: !!e.detail.originalEvent
                });
            }, { once: true });
        });
    });

    const input = await getInputElement(component);
    await input.click();
    await page.keyboard.type('1');

    const eventDetail = await eventPromise;
    expect(eventDetail.value).toBe('1#/##');
    expect(eventDetail.hasOriginalEvent).toBe(true);
});

test('MaskedInput: fires filled event when all slots filled', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '##/##');

    const filledEventPromise = component.evaluate(node => {
        return new Promise<any>(resolve => {
            node.addEventListener('filled', (e: any) => {
                resolve({
                    value: e.detail.value,
                    fired: true
                });
            });
            setTimeout(() => resolve({ fired: false }), 2000);
        });
    });

    const input = await getInputElement(component);
    await input.click();
    await page.keyboard.type('1234', { delay: 10 });
    await page.waitForTimeout(50);

    const result = await filledEventPromise;
    expect(result.fired).toBe(true);
    expect(result.value).toBe('12/34');
});

test('MaskedInput: does not fire filled event when partially filled', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '##/##');

    const filledEventPromise = component.evaluate(node => {
        return new Promise<boolean>(resolve => {
            node.addEventListener('filled', () => resolve(true));
            setTimeout(() => resolve(false), 500);
        });
    });

    const input = await getInputElement(component);
    await input.click();
    await page.keyboard.type('1');
    await page.waitForTimeout(50);

    const fired = await filledEventPromise;
    expect(fired).toBe(false);
});

test('MaskedInput: signals invalid input with CSS class', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '##/##');
    const input = await getInputElement(component);

    await input.click();
    await page.keyboard.type('1');
    await page.waitForTimeout(50);

    // Try to type invalid character
    await page.keyboard.press('a');
    await page.waitForTimeout(100);

    // Check if invalid class was added
    const hasInvalidClass = await input.evaluate(el => el.classList.contains('invalid'));
    expect(hasInvalidClass).toBe(true);
});

test('MaskedInput: resets value when format changes', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '##/##');
    const input = await getInputElement(component);

    await input.click();
    await page.keyboard.type('1');
    await page.keyboard.press('2');
    await page.waitForTimeout(50);

    let state = await getMaskedInputState(component);
    expect(state.value).toBe('12/##');

    // Change format
    await component.evaluate(node => {
        (node as any).format = '####-####';
    });
    await page.waitForTimeout(50);

    state = await getMaskedInputState(component);
    expect(state.format).toBe('####-####');
    expect(state.value).toBe('####-####');
});

test('MaskedInput: initializes value with format on first render', async ({ page }) => {
    const component = await setupMaskedInputTest(page);

    await component.evaluate(node => {
        (node as any).format = '##/##/####';
    });
    await page.waitForTimeout(50);

    const state = await getMaskedInputState(component);
    expect(state.value).toBe('##/##/####');
});

test('MaskedInput: cursor jumps to first open slot on click when empty', async ({ page }) => {
    const component = await setupMaskedInputTest(page, 'ABC-##/##');
    const input = await getInputElement(component);

    await input.click();
    await page.waitForTimeout(50);

    // Cursor should be at position 4 (first # after ABC-)
    const cursorPos = await input.evaluate(el => (el as HTMLInputElement).selectionStart);
    expect(cursorPos).toBe(4);
});

test('MaskedInput: allows arrow keys navigation', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '##/##');
    const input = await getInputElement(component);

    await input.click();
    await page.keyboard.type('1');
    await page.waitForTimeout(50);

    // Arrow keys should not modify value
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(50);

    const state = await getMaskedInputState(component);
    expect(state.value).toBe('1#/##');
});

test('MaskedInput: allows Tab and Enter keys', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '##/##');
    const input = await getInputElement(component);

    await input.click();
    await page.keyboard.type('1');
    await page.waitForTimeout(50);

    // Tab and Enter should not affect value
    await page.keyboard.press('Enter');
    await page.waitForTimeout(50);

    const state = await getMaskedInputState(component);
    expect(state.value).toBe('1#/##');
});

test('MaskedInput: custom allowed characters work', async ({ page }) => {
    const component = await setupMaskedInputTest(page);

    await component.evaluate(node => {
        (node as any).format = 'XXX-###';
        (node as any).allowed = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        (node as any).open = 'X#';
    });
    await page.waitForTimeout(50);

    const input = await getInputElement(component);
    await input.click();
    await page.keyboard.press('A');
    await page.keyboard.press('B');
    await page.keyboard.press('C');
    await page.keyboard.press('1');
    await page.waitForTimeout(50);

    const state = await getMaskedInputState(component);
    expect(state.value).toBe('ABC-1##');
});

test('MaskedInput: handles empty format', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '');

    const state = await getMaskedInputState(component);
    expect(state.format).toBe('');
    expect(state.value).toBe('');
});

test('MaskedInput: select all and type replaces selection progressively', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '__/__/____');

    await component.evaluate(node => {
        (node as any).value = '24/11/2025';
    });
    await page.waitForTimeout(50);

    const input = await getInputElement(component);
    await input.click();
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(50);

    // Type characters - selection should be cleared first, then characters inserted
    await page.keyboard.press('3');
    await page.waitForTimeout(50);

    let state = await getMaskedInputState(component);
    expect(state.value).toBe('3_/__/____');

    await page.keyboard.press('1');
    await page.waitForTimeout(50);

    state = await getMaskedInputState(component);
    expect(state.value).toBe('31/__/____');
});

test('MaskedInput: preserves value on reconnect', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '##/##');

    await component.evaluate(node => {
        (node as any).value = '12/34';
    });
    await page.waitForTimeout(50);

    let state = await getMaskedInputState(component);
    expect(state.value).toBe('12/34');

    // Remove and re-add element
    await component.evaluate(node => {
        const parent = node.parentElement;
        const el = parent?.removeChild(node);
        parent?.appendChild(el!);
    });
    await page.waitForTimeout(50);

    // Value should be preserved
    state = await getMaskedInputState(component);
    expect(state.value).toBe('12/34');
});

test('MaskedInput: handles multiple separator characters', async ({ page }) => {
    const component = await setupMaskedInputTest(page);

    await component.evaluate(node => {
        (node as any).format = '__/__/____';
    });
    await page.waitForTimeout(50);

    const input = await getInputElement(component);
    await input.click();
    await page.keyboard.type('24112025', { delay: 10 });
    await page.waitForTimeout(50);

    const state = await getMaskedInputState(component);
    expect(state.value).toBe('24/11/2025');
});

test('MaskedInput: handles format with leading separators', async ({ page }) => {
    const component = await setupMaskedInputTest(page, 'ABC##');
    const input = await getInputElement(component);

    await input.click();
    await page.keyboard.type('1');
    await page.keyboard.press('2');
    await page.waitForTimeout(50);

    const state = await getMaskedInputState(component);
    expect(state.value).toBe('ABC12');
});

test('MaskedInput: handles format with trailing separators', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '##ABC');
    const input = await getInputElement(component);

    await input.click();
    await page.keyboard.type('1');
    await page.keyboard.press('2');
    await page.waitForTimeout(50);

    const state = await getMaskedInputState(component);
    expect(state.value).toBe('12ABC');
});

test('MaskedInput: backspace at start does nothing', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '##/##');
    const input = await getInputElement(component);

    await input.click();
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(50);

    const state = await getMaskedInputState(component);
    expect(state.value).toBe('##/##');
});

test('MaskedInput: delete at end does nothing', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '##/##');
    const input = await getInputElement(component);

    await input.click();
    await page.keyboard.type('1234', { delay: 10 });
    await page.waitForTimeout(50);

    // Move to end
    await page.keyboard.press('End');
    await page.waitForTimeout(50);

    await page.keyboard.press('Delete');
    await page.waitForTimeout(50);

    const state = await getMaskedInputState(component);
    expect(state.value).toBe('12/34');
});

test('MaskedInput: works with different open character', async ({ page }) => {
    const component = await setupMaskedInputTest(page);

    await component.evaluate(node => {
        (node as any).format = 'XXXX';
        (node as any).open = 'X';
    });
    await page.waitForTimeout(50);

    const input = await getInputElement(component);
    await input.click();
    await page.keyboard.type('1234', { delay: 10 });
    await page.waitForTimeout(50);

    const state = await getMaskedInputState(component);
    expect(state.value).toBe('1234');
});

test('MaskedInput: typing at cursor position in middle of text', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '##/##');
    const input = await getInputElement(component);

    // Fill with initial value
    await input.click();
    await page.keyboard.type('1234');
    await page.waitForTimeout(50);

    let state = await getMaskedInputState(component);
    expect(state.value).toBe('12/34');

    // Position cursor at position 1 (between '1' and '2')
    await setSelection(input, 1, 1);
    await page.waitForTimeout(50);

    // Type '9' - should replace '2' in overwrite mode
    await page.keyboard.type('9');
    await page.waitForTimeout(50);

    state = await getMaskedInputState(component);
    expect(state.value).toBe('19/34');
});

test('MaskedInput: backspace from middle position', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '##/##/####');
    const input = await getInputElement(component);

    // Fill with initial value
    await input.click();
    await page.keyboard.type('12345678');
    await page.waitForTimeout(50);

    let state = await getMaskedInputState(component);
    expect(state.value).toBe('12/34/5678');

    // Position cursor at position 4 (after '3', before '4')
    await setSelection(input, 4, 4);
    await page.waitForTimeout(50);

    // Backspace should delete '3'
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(50);

    state = await getMaskedInputState(component);
    expect(state.value).toBe('12/#4/5678');
});

test('MaskedInput: delete from middle position', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '##/##/####');
    const input = await getInputElement(component);

    // Fill with initial value
    await input.click();
    await page.keyboard.type('12345678');
    await page.waitForTimeout(50);

    let state = await getMaskedInputState(component);
    expect(state.value).toBe('12/34/5678');

    // Position cursor at position 6 (first '#' of last group)
    await setSelection(input, 6, 6);
    await page.waitForTimeout(50);

    // Delete should remove '5'
    await page.keyboard.press('Delete');
    await page.waitForTimeout(50);

    state = await getMaskedInputState(component);
    expect(state.value).toBe('12/34/#678');
});

test('MaskedInput: typing at cursor position before separator', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '##/##');
    const input = await getInputElement(component);

    // Fill first two positions
    await input.click();
    await page.keyboard.type('12');
    await page.waitForTimeout(50);

    let state = await getMaskedInputState(component);
    expect(state.value).toBe('12/##');

    // Position cursor at position 2 (before separator)
    await setSelection(input, 2, 2);
    await page.waitForTimeout(50);

    // Type '3' - should skip separator and insert at position 3
    await page.keyboard.type('3');
    await page.waitForTimeout(50);

    state = await getMaskedInputState(component);
    expect(state.value).toBe('12/3#');
});

test('MaskedInput: backspace at position right after separator', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '##/##');
    const input = await getInputElement(component);

    // Fill all positions
    await input.click();
    await page.keyboard.type('1234');
    await page.waitForTimeout(50);

    let state = await getMaskedInputState(component);
    expect(state.value).toBe('12/34');

    // Position cursor at position 3 (right after separator, before '3')
    await setSelection(input, 3, 3);
    await page.waitForTimeout(50);

    // Backspace should jump over separator and delete '2'
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(50);

    state = await getMaskedInputState(component);
    expect(state.value).toBe('1#/34');
});

test('MaskedInput: disabled property disables inner input', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '##/##');
    const input = await getInputElement(component);

    await expect(input).toBeEnabled();

    await component.evaluate(node => {
        (node as any).disabled = true;
    });
    await page.waitForTimeout(50);

    await expect(input).toBeDisabled();

    await component.evaluate(node => {
        (node as any).disabled = false;
    });
    await page.waitForTimeout(50);

    await expect(input).toBeEnabled();
});

test('MaskedInput: disabled attribute reflects to component', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '##/##');

    await component.evaluate(node => {
        (node as any).disabled = true;
    });
    await page.waitForTimeout(50);

    const hasDisabledAttr = await component.evaluate(node => node.hasAttribute('disabled'));
    expect(hasDisabledAttr).toBe(true);
});

test('MaskedInput: disabled input prevents typing', async ({ page }) => {
    const component = await setupMaskedInputTest(page, '##/##');
    const input = await getInputElement(component);

    await component.evaluate(node => {
        (node as any).disabled = true;
    });
    await page.waitForTimeout(50);

    await input.click({ force: true });
    await page.keyboard.type('1234');
    await page.waitForTimeout(50);

    const state = await getMaskedInputState(component);
    expect(state.value).toBe('##/##');
});
