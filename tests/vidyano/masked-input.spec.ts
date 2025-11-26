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
        <div id="test-container"></div>
      </body>
    </html>
`;

async function setupPage(page: Page) {
    await page.setContent(maskedInputHtml);
    await page.addScriptTag({ path: "dev/wwwroot/index.js", type: 'module' });
    await page.waitForFunction(() => !!customElements.get('vi-masked-input'), { timeout: 10000 });
}

async function createMaskedInput(page: Page, format?: string, options?: { insertMode?: boolean; allowed?: string; open?: string }) {
    const componentId = `component-${Math.random().toString(36).substring(2, 15)}`;

    await page.evaluate(({ componentId, format, options }) => {
        const container = document.getElementById('test-container');
        if (!container)
            throw new Error('Test container not found');

        const component = document.createElement('vi-masked-input') as any;
        component.id = componentId;

        if (format !== undefined)
            component.format = format;

        if (options?.insertMode !== undefined)
            component.insertMode = options.insertMode;

        if (options?.allowed !== undefined)
            component.allowed = options.allowed;

        if (options?.open !== undefined)
            component.open = options.open;

        container.appendChild(component);
    }, { componentId, format, options });

    return page.locator(`#${componentId}`);
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

test.describe.serial('MaskedInput Tests', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test('renders with default properties', async () => {
        const component = await createMaskedInput(sharedPage);
        await expect(component).toBeVisible();

        const state = await getMaskedInputState(component);
        expect(state.format).toBe('');
        expect(state.separator).toBe('/:- ()');
        expect(state.allowed).toBe('0123456789');
        expect(state.open).toBe('_YMDhms#');
        expect(state.insertMode).toBe(false);
    });

    test('sets format and initializes value', async () => {
        const component = await createMaskedInput(sharedPage, '##/##/####');

        const state = await getMaskedInputState(component);
        expect(state.format).toBe('##/##/####');
        expect(state.value).toBe('##/##/####');
    });

    test('handles single character input', async () => {
        const component = await createMaskedInput(sharedPage, '##/##/####');
        const input = await getInputElement(component);

        await input.click();
        await sharedPage.keyboard.type('1');
        await sharedPage.waitForTimeout(50);

        const state = await getMaskedInputState(component);
        expect(state.value).toBe('1#/##/####');
    });

    test('allows only specified characters', async () => {
        const component = await createMaskedInput(sharedPage, '##-##');
        const input = await getInputElement(component);

        await input.click();
        await sharedPage.keyboard.type('1');
        await sharedPage.waitForTimeout(50);

        let state = await getMaskedInputState(component);
        expect(state.value).toBe('1#-##');

        // Try to type a letter (should be blocked)
        await sharedPage.keyboard.type('a');
        await sharedPage.waitForTimeout(50);

        state = await getMaskedInputState(component);
        expect(state.value).toBe('1#-##'); // Should not change
    });

    test('auto-skips separators during input', async () => {
        const component = await createMaskedInput(sharedPage, '##/##');
        const input = await getInputElement(component);

        await input.click();
        await sharedPage.keyboard.type('1');
        await sharedPage.keyboard.press('2');
        await sharedPage.waitForTimeout(50);

        const state = await getMaskedInputState(component);
        expect(state.value).toBe('12/##');

        // Cursor should be at position 3 (after the separator)
        const cursorPos = await input.evaluate(el => (el as HTMLInputElement).selectionStart);
        expect(cursorPos).toBe(3);
    });

    test('handles backspace on single character', async () => {
        const component = await createMaskedInput(sharedPage, '##/##');
        const input = await getInputElement(component);

        await input.click();
        await sharedPage.keyboard.type('1');
        await sharedPage.waitForTimeout(50);

        let state = await getMaskedInputState(component);
        expect(state.value).toBe('1#/##');

        await sharedPage.keyboard.press('Backspace');
        await sharedPage.waitForTimeout(50);

        state = await getMaskedInputState(component);
        expect(state.value).toBe('##/##');
    });

    test('backspace jumps over separators', async () => {
        const component = await createMaskedInput(sharedPage, '##/##');
        const input = await getInputElement(component);

        await input.click();
        await sharedPage.keyboard.type('1');
        await sharedPage.keyboard.press('2');
        await sharedPage.keyboard.press('3');
        await sharedPage.waitForTimeout(50);

        let state = await getMaskedInputState(component);
        expect(state.value).toBe('12/3#');

        // Cursor is after '3', backspace should delete '3'
        await sharedPage.keyboard.press('Backspace');
        await sharedPage.waitForTimeout(50);

        state = await getMaskedInputState(component);
        expect(state.value).toBe('12/##');

        // Cursor is after '/', backspace should jump over separator and delete '2'
        await sharedPage.keyboard.press('Backspace');
        await sharedPage.waitForTimeout(50);

        state = await getMaskedInputState(component);
        expect(state.value).toBe('1#/##');
    });

    test('handles delete key forward', async () => {
        const component = await createMaskedInput(sharedPage, '##/##');
        const input = await getInputElement(component);

        await input.click();
        await sharedPage.keyboard.type('1');
        await sharedPage.keyboard.press('2');
        await sharedPage.keyboard.press('3');
        await sharedPage.keyboard.press('4');
        await sharedPage.waitForTimeout(50);

        let state = await getMaskedInputState(component);
        expect(state.value).toBe('12/34');

        // Move cursor to beginning
        await sharedPage.keyboard.press('Home');
        await sharedPage.waitForTimeout(50);

        // Delete forward should remove '1'
        await sharedPage.keyboard.press('Delete');
        await sharedPage.waitForTimeout(50);

        state = await getMaskedInputState(component);
        expect(state.value).toBe('#2/34');
    });

    test('delete jumps over separators', async () => {
        const component = await createMaskedInput(sharedPage, '##/##');
        const input = await getInputElement(component);

        await input.click();
        await sharedPage.keyboard.type('1');
        await sharedPage.keyboard.press('2');
        await sharedPage.keyboard.press('3');
        await sharedPage.keyboard.press('4');
        await sharedPage.waitForTimeout(50);

        // Move cursor after '2' (before separator)
        await input.evaluate(el => (el as HTMLInputElement).setSelectionRange(2, 2));
        await sharedPage.waitForTimeout(50);

        // Delete should jump over separator and delete '3'
        await sharedPage.keyboard.press('Delete');
        await sharedPage.waitForTimeout(50);

        const state = await getMaskedInputState(component);
        expect(state.value).toBe('12/#4');
    });

    test('handles selection deletion', async () => {
        const component = await createMaskedInput(sharedPage, '##/##/####');
        const input = await getInputElement(component);

        await input.click();
        await sharedPage.keyboard.type('12345678', { delay: 10 });
        await sharedPage.waitForTimeout(50);

        let state = await getMaskedInputState(component);
        expect(state.value).toBe('12/34/5678');

        // Select characters at positions 3-7 ("34/5")
        await input.evaluate(el => (el as HTMLInputElement).setSelectionRange(3, 7));
        await sharedPage.waitForTimeout(50);

        // Type a character to replace selection
        await sharedPage.keyboard.type('9');
        await sharedPage.waitForTimeout(50);

        state = await getMaskedInputState(component);
        expect(state.value).toBe('12/9#/#678');
    });

    test('backspace deletes entire selection', async () => {
        const component = await createMaskedInput(sharedPage, '##/##');
        const input = await getInputElement(component);

        await input.click();
        await sharedPage.keyboard.type('1234', { delay: 10 });
        await sharedPage.waitForTimeout(50);

        // Select all
        await sharedPage.keyboard.press('Control+a');
        await sharedPage.waitForTimeout(50);

        // Backspace should clear selection
        await sharedPage.keyboard.press('Backspace');
        await sharedPage.waitForTimeout(50);

        const state = await getMaskedInputState(component);
        expect(state.value).toBe('##/##');
    });

    test('handles paste with allowed character filtering', async () => {
        const component = await createMaskedInput(sharedPage, '##/##/####');
        const input = await getInputElement(component);

        await input.click();

        // Simulate paste by using clipboard API
        await sharedPage.evaluate(async () => {
            const element = document.querySelector('vi-masked-input:last-child')?.shadowRoot?.querySelector('input') as HTMLInputElement;
            element?.focus();

            const pasteEvent = new InputEvent('input', {
                bubbles: true,
                cancelable: true,
                inputType: 'insertFromPaste',
                data: '12abc34xyz5678'
            });
            element?.dispatchEvent(pasteEvent);
        });
        await sharedPage.waitForTimeout(50);

        // Should filter to only allowed characters
        const state = await getMaskedInputState(component);
        expect(state.value).toBe('12/34/5678');
    });

    test('paste respects format length', async () => {
        const component = await createMaskedInput(sharedPage, '##/##');
        const input = await getInputElement(component);

        await input.click();

        await sharedPage.evaluate(async () => {
            const element = document.querySelector('vi-masked-input:last-child')?.shadowRoot?.querySelector('input') as HTMLInputElement;
            element?.focus();

            const pasteEvent = new InputEvent('input', {
                bubbles: true,
                cancelable: true,
                inputType: 'insertFromPaste',
                data: '123456789'
            });
            element?.dispatchEvent(pasteEvent);
        });
        await sharedPage.waitForTimeout(50);

        // Should only use first 4 digits
        const state = await getMaskedInputState(component);
        expect(state.value).toBe('12/34');
    });

    test('insertMode shifts characters right on input', async () => {
        const component = await createMaskedInput(sharedPage, '####', { insertMode: true });

        const input = await getInputElement(component);
        await input.click();
        await sharedPage.keyboard.type('123', { delay: 10 });
        await sharedPage.waitForTimeout(50);

        let state = await getMaskedInputState(component);
        expect(state.value).toBe('123#');

        // Move cursor to position 1 (after '1')
        await input.evaluate(el => (el as HTMLInputElement).setSelectionRange(1, 1));
        await sharedPage.waitForTimeout(50);

        // Insert '9' - should shift '2' and '3' right
        await sharedPage.keyboard.press('9');
        await sharedPage.waitForTimeout(50);

        state = await getMaskedInputState(component);
        expect(state.value).toBe('1923');
    });

    test('insertMode prevents overflow', async () => {
        const component = await createMaskedInput(sharedPage, '####', { insertMode: true });

        const input = await getInputElement(component);
        await input.click();
        await sharedPage.keyboard.type('1234', { delay: 10 });
        await sharedPage.waitForTimeout(50);

        let state = await getMaskedInputState(component);
        expect(state.value).toBe('1234');

        // Try to insert at position 1 - should fail (would overflow)
        await input.evaluate(el => (el as HTMLInputElement).setSelectionRange(1, 1));
        await sharedPage.waitForTimeout(50);

        await sharedPage.keyboard.press('9');
        await sharedPage.waitForTimeout(50);

        // Value should not change
        state = await getMaskedInputState(component);
        expect(state.value).toBe('1234');
    });

    test('insertMode shifts left on backspace', async () => {
        const component = await createMaskedInput(sharedPage, '####', { insertMode: true });

        const input = await getInputElement(component);
        await input.click();
        await sharedPage.keyboard.type('1234', { delay: 10 });
        await sharedPage.waitForTimeout(50);

        let state = await getMaskedInputState(component);
        expect(state.value).toBe('1234');

        // Move cursor to position 2 (after '2')
        await input.evaluate(el => (el as HTMLInputElement).setSelectionRange(2, 2));
        await sharedPage.waitForTimeout(50);

        // Backspace should delete '2' and shift '3' and '4' left
        await sharedPage.keyboard.press('Backspace');
        await sharedPage.waitForTimeout(50);

        state = await getMaskedInputState(component);
        expect(state.value).toBe('134#');
    });

    test('insertMode shifts left on delete forward', async () => {
        const component = await createMaskedInput(sharedPage, '####', { insertMode: true });

        const input = await getInputElement(component);
        await input.click();
        await sharedPage.keyboard.type('1234', { delay: 10 });
        await sharedPage.waitForTimeout(50);

        // Move cursor to position 1 (after '1')
        await input.evaluate(el => (el as HTMLInputElement).setSelectionRange(1, 1));
        await sharedPage.waitForTimeout(50);

        // Delete should remove '2' and shift '3' and '4' left
        await sharedPage.keyboard.press('Delete');
        await sharedPage.waitForTimeout(50);

        const state = await getMaskedInputState(component);
        expect(state.value).toBe('134#');
    });

    test('overwrite mode replaces characters (default)', async () => {
        const component = await createMaskedInput(sharedPage, '####');
        const input = await getInputElement(component);

        await input.click();
        await sharedPage.keyboard.type('123', { delay: 10 });
        await sharedPage.waitForTimeout(50);

        let state = await getMaskedInputState(component);
        expect(state.value).toBe('123#');

        // Move cursor to position 1
        await input.evaluate(el => (el as HTMLInputElement).setSelectionRange(1, 1));
        await sharedPage.waitForTimeout(50);

        // Type '9' - should replace '2', not shift
        await sharedPage.keyboard.press('9');
        await sharedPage.waitForTimeout(50);

        state = await getMaskedInputState(component);
        expect(state.value).toBe('193#');
    });

    test('overwrite mode backspace clears character without shifting', async () => {
        const component = await createMaskedInput(sharedPage, '####');
        const input = await getInputElement(component);

        await input.click();
        await sharedPage.keyboard.type('1234', { delay: 10 });
        await sharedPage.waitForTimeout(50);

        let state = await getMaskedInputState(component);
        expect(state.value).toBe('1234');

        // Move cursor to position 2
        await input.evaluate(el => (el as HTMLInputElement).setSelectionRange(2, 2));
        await sharedPage.waitForTimeout(50);

        // Backspace should clear '2' but not shift '3' and '4'
        await sharedPage.keyboard.press('Backspace');
        await sharedPage.waitForTimeout(50);

        state = await getMaskedInputState(component);
        expect(state.value).toBe('1#34');
    });

    test('fires value-changed event with detail', async () => {
        const component = await createMaskedInput(sharedPage, '##/##');

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
        await sharedPage.keyboard.type('1');

        const eventDetail = await eventPromise;
        expect(eventDetail.value).toBe('1#/##');
        expect(eventDetail.hasOriginalEvent).toBe(true);
    });

    test('fires filled event when all slots filled', async () => {
        const component = await createMaskedInput(sharedPage, '##/##');

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
        await sharedPage.keyboard.type('1234', { delay: 10 });
        await sharedPage.waitForTimeout(50);

        const result = await filledEventPromise;
        expect(result.fired).toBe(true);
        expect(result.value).toBe('12/34');
    });

    test('does not fire filled event when partially filled', async () => {
        const component = await createMaskedInput(sharedPage, '##/##');

        const filledEventPromise = component.evaluate(node => {
            return new Promise<boolean>(resolve => {
                node.addEventListener('filled', () => resolve(true));
                setTimeout(() => resolve(false), 500);
            });
        });

        const input = await getInputElement(component);
        await input.click();
        await sharedPage.keyboard.type('1');
        await sharedPage.waitForTimeout(50);

        const fired = await filledEventPromise;
        expect(fired).toBe(false);
    });

    test('signals invalid input with CSS class', async () => {
        const component = await createMaskedInput(sharedPage, '##/##');
        const input = await getInputElement(component);

        await input.click();
        await sharedPage.keyboard.type('1');
        await sharedPage.waitForTimeout(50);

        // Try to type invalid character
        await sharedPage.keyboard.press('a');
        await sharedPage.waitForTimeout(100);

        // Check if invalid class was added
        const hasInvalidClass = await input.evaluate(el => el.classList.contains('invalid'));
        expect(hasInvalidClass).toBe(true);
    });

    test('resets value when format changes', async () => {
        const component = await createMaskedInput(sharedPage, '##/##');
        const input = await getInputElement(component);

        await input.click();
        await sharedPage.keyboard.type('1');
        await sharedPage.keyboard.press('2');
        await sharedPage.waitForTimeout(50);

        let state = await getMaskedInputState(component);
        expect(state.value).toBe('12/##');

        // Change format
        await component.evaluate(node => {
            (node as any).format = '####-####';
        });
        await sharedPage.waitForTimeout(50);

        state = await getMaskedInputState(component);
        expect(state.format).toBe('####-####');
        expect(state.value).toBe('####-####');
    });

    test('initializes value with format on first render', async () => {
        const component = await createMaskedInput(sharedPage);

        await component.evaluate(node => {
            (node as any).format = '##/##/####';
        });
        await sharedPage.waitForTimeout(50);

        const state = await getMaskedInputState(component);
        expect(state.value).toBe('##/##/####');
    });

    test('cursor jumps to first open slot on click when empty', async () => {
        const component = await createMaskedInput(sharedPage, 'ABC-##/##');
        const input = await getInputElement(component);

        await input.click();
        await sharedPage.waitForTimeout(50);

        // Cursor should be at position 4 (first # after ABC-)
        const cursorPos = await input.evaluate(el => (el as HTMLInputElement).selectionStart);
        expect(cursorPos).toBe(4);
    });

    test('allows arrow keys navigation', async () => {
        const component = await createMaskedInput(sharedPage, '##/##');
        const input = await getInputElement(component);

        await input.click();
        await sharedPage.keyboard.type('1');
        await sharedPage.waitForTimeout(50);

        // Arrow keys should not modify value
        await sharedPage.keyboard.press('ArrowLeft');
        await sharedPage.keyboard.press('ArrowRight');
        await sharedPage.keyboard.press('ArrowUp');
        await sharedPage.keyboard.press('ArrowDown');
        await sharedPage.waitForTimeout(50);

        const state = await getMaskedInputState(component);
        expect(state.value).toBe('1#/##');
    });

    test('allows Tab and Enter keys', async () => {
        const component = await createMaskedInput(sharedPage, '##/##');
        const input = await getInputElement(component);

        await input.click();
        await sharedPage.keyboard.type('1');
        await sharedPage.waitForTimeout(50);

        // Tab and Enter should not affect value
        await sharedPage.keyboard.press('Enter');
        await sharedPage.waitForTimeout(50);

        const state = await getMaskedInputState(component);
        expect(state.value).toBe('1#/##');
    });

    test('custom allowed characters work', async () => {
        const component = await createMaskedInput(sharedPage, 'XXX-###', {
            allowed: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
            open: 'X#'
        });

        const input = await getInputElement(component);
        await input.click();
        await sharedPage.keyboard.press('A');
        await sharedPage.keyboard.press('B');
        await sharedPage.keyboard.press('C');
        await sharedPage.keyboard.press('1');
        await sharedPage.waitForTimeout(50);

        const state = await getMaskedInputState(component);
        expect(state.value).toBe('ABC-1##');
    });

    test('handles empty format', async () => {
        const component = await createMaskedInput(sharedPage, '');

        const state = await getMaskedInputState(component);
        expect(state.format).toBe('');
        expect(state.value).toBe('');
    });

    test('select all and type replaces selection progressively', async () => {
        const component = await createMaskedInput(sharedPage, '__/__/____');

        await component.evaluate(node => {
            (node as any).value = '24/11/2025';
        });
        await sharedPage.waitForTimeout(50);

        const input = await getInputElement(component);
        await input.click();
        await sharedPage.keyboard.press('Control+a');
        await sharedPage.waitForTimeout(50);

        // Type characters - selection should be cleared first, then characters inserted
        await sharedPage.keyboard.press('3');
        await sharedPage.waitForTimeout(50);

        let state = await getMaskedInputState(component);
        expect(state.value).toBe('3_/__/____');

        await sharedPage.keyboard.press('1');
        await sharedPage.waitForTimeout(50);

        state = await getMaskedInputState(component);
        expect(state.value).toBe('31/__/____');
    });

    test('preserves value on reconnect', async () => {
        const component = await createMaskedInput(sharedPage, '##/##');

        await component.evaluate(node => {
            (node as any).value = '12/34';
        });
        await sharedPage.waitForTimeout(50);

        let state = await getMaskedInputState(component);
        expect(state.value).toBe('12/34');

        // Remove and re-add element
        await component.evaluate(node => {
            const parent = node.parentElement;
            const el = parent?.removeChild(node);
            parent?.appendChild(el!);
        });
        await sharedPage.waitForTimeout(50);

        // Value should be preserved
        state = await getMaskedInputState(component);
        expect(state.value).toBe('12/34');
    });

    test('handles multiple separator characters', async () => {
        const component = await createMaskedInput(sharedPage, '__/__/____');

        const input = await getInputElement(component);
        await input.click();
        await sharedPage.keyboard.type('24112025', { delay: 10 });
        await sharedPage.waitForTimeout(50);

        const state = await getMaskedInputState(component);
        expect(state.value).toBe('24/11/2025');
    });

    test('handles format with leading separators', async () => {
        const component = await createMaskedInput(sharedPage, 'ABC##');
        const input = await getInputElement(component);

        await input.click();
        await sharedPage.keyboard.type('1');
        await sharedPage.keyboard.press('2');
        await sharedPage.waitForTimeout(50);

        const state = await getMaskedInputState(component);
        expect(state.value).toBe('ABC12');
    });

    test('handles format with trailing separators', async () => {
        const component = await createMaskedInput(sharedPage, '##ABC');
        const input = await getInputElement(component);

        await input.click();
        await sharedPage.keyboard.type('1');
        await sharedPage.keyboard.press('2');
        await sharedPage.waitForTimeout(50);

        const state = await getMaskedInputState(component);
        expect(state.value).toBe('12ABC');
    });

    test('backspace at start does nothing', async () => {
        const component = await createMaskedInput(sharedPage, '##/##');
        const input = await getInputElement(component);

        await input.click();
        await sharedPage.keyboard.press('Backspace');
        await sharedPage.waitForTimeout(50);

        const state = await getMaskedInputState(component);
        expect(state.value).toBe('##/##');
    });

    test('delete at end does nothing', async () => {
        const component = await createMaskedInput(sharedPage, '##/##');
        const input = await getInputElement(component);

        await input.click();
        await sharedPage.keyboard.type('1234', { delay: 10 });
        await sharedPage.waitForTimeout(50);

        // Move to end
        await sharedPage.keyboard.press('End');
        await sharedPage.waitForTimeout(50);

        await sharedPage.keyboard.press('Delete');
        await sharedPage.waitForTimeout(50);

        const state = await getMaskedInputState(component);
        expect(state.value).toBe('12/34');
    });

    test('works with different open character', async () => {
        const component = await createMaskedInput(sharedPage, 'XXXX', { open: 'X' });

        const input = await getInputElement(component);
        await input.click();
        await sharedPage.keyboard.type('1234', { delay: 10 });
        await sharedPage.waitForTimeout(50);

        const state = await getMaskedInputState(component);
        expect(state.value).toBe('1234');
    });

    test('typing at cursor position in middle of text', async () => {
        const component = await createMaskedInput(sharedPage, '##/##');
        const input = await getInputElement(component);

        // Fill with initial value
        await input.click();
        await sharedPage.keyboard.type('1234');
        await sharedPage.waitForTimeout(50);

        let state = await getMaskedInputState(component);
        expect(state.value).toBe('12/34');

        // Position cursor at position 1 (between '1' and '2')
        await setSelection(input, 1, 1);
        await sharedPage.waitForTimeout(50);

        // Type '9' - should replace '2' in overwrite mode
        await sharedPage.keyboard.type('9');
        await sharedPage.waitForTimeout(50);

        state = await getMaskedInputState(component);
        expect(state.value).toBe('19/34');
    });

    test('backspace from middle position', async () => {
        const component = await createMaskedInput(sharedPage, '##/##/####');
        const input = await getInputElement(component);

        // Fill with initial value
        await input.click();
        await sharedPage.keyboard.type('12345678');
        await sharedPage.waitForTimeout(50);

        let state = await getMaskedInputState(component);
        expect(state.value).toBe('12/34/5678');

        // Position cursor at position 4 (after '3', before '4')
        await setSelection(input, 4, 4);
        await sharedPage.waitForTimeout(50);

        // Backspace should delete '3'
        await sharedPage.keyboard.press('Backspace');
        await sharedPage.waitForTimeout(50);

        state = await getMaskedInputState(component);
        expect(state.value).toBe('12/#4/5678');
    });

    test('delete from middle position', async () => {
        const component = await createMaskedInput(sharedPage, '##/##/####');
        const input = await getInputElement(component);

        // Fill with initial value
        await input.click();
        await sharedPage.keyboard.type('12345678');
        await sharedPage.waitForTimeout(50);

        let state = await getMaskedInputState(component);
        expect(state.value).toBe('12/34/5678');

        // Position cursor at position 6 (first '#' of last group)
        await setSelection(input, 6, 6);
        await sharedPage.waitForTimeout(50);

        // Delete should remove '5'
        await sharedPage.keyboard.press('Delete');
        await sharedPage.waitForTimeout(50);

        state = await getMaskedInputState(component);
        expect(state.value).toBe('12/34/#678');
    });

    test('typing at cursor position before separator', async () => {
        const component = await createMaskedInput(sharedPage, '##/##');
        const input = await getInputElement(component);

        // Fill first two positions
        await input.click();
        await sharedPage.keyboard.type('12');
        await sharedPage.waitForTimeout(50);

        let state = await getMaskedInputState(component);
        expect(state.value).toBe('12/##');

        // Position cursor at position 2 (before separator)
        await setSelection(input, 2, 2);
        await sharedPage.waitForTimeout(50);

        // Type '3' - should skip separator and insert at position 3
        await sharedPage.keyboard.type('3');
        await sharedPage.waitForTimeout(50);

        state = await getMaskedInputState(component);
        expect(state.value).toBe('12/3#');
    });

    test('backspace at position right after separator', async () => {
        const component = await createMaskedInput(sharedPage, '##/##');
        const input = await getInputElement(component);

        // Fill all positions
        await input.click();
        await sharedPage.keyboard.type('1234');
        await sharedPage.waitForTimeout(50);

        let state = await getMaskedInputState(component);
        expect(state.value).toBe('12/34');

        // Position cursor at position 3 (right after separator, before '3')
        await setSelection(input, 3, 3);
        await sharedPage.waitForTimeout(50);

        // Backspace should jump over separator and delete '2'
        await sharedPage.keyboard.press('Backspace');
        await sharedPage.waitForTimeout(50);

        state = await getMaskedInputState(component);
        expect(state.value).toBe('1#/34');
    });

    test('disabled property disables inner input', async () => {
        const component = await createMaskedInput(sharedPage, '##/##');
        const input = await getInputElement(component);

        await expect(input).toBeEnabled();

        await component.evaluate(node => {
            (node as any).disabled = true;
        });
        await sharedPage.waitForTimeout(50);

        await expect(input).toBeDisabled();

        await component.evaluate(node => {
            (node as any).disabled = false;
        });
        await sharedPage.waitForTimeout(50);

        await expect(input).toBeEnabled();
    });

    test('disabled attribute reflects to component', async () => {
        const component = await createMaskedInput(sharedPage, '##/##');

        await component.evaluate(node => {
            (node as any).disabled = true;
        });
        await sharedPage.waitForTimeout(50);

        const hasDisabledAttr = await component.evaluate(node => node.hasAttribute('disabled'));
        expect(hasDisabledAttr).toBe(true);
    });

    test('disabled input prevents typing', async () => {
        const component = await createMaskedInput(sharedPage, '##/##');
        const input = await getInputElement(component);

        await component.evaluate(node => {
            (node as any).disabled = true;
        });
        await sharedPage.waitForTimeout(50);

        await input.click({ force: true });
        await sharedPage.keyboard.type('1234');
        await sharedPage.waitForTimeout(50);

        const state = await getMaskedInputState(component);
        expect(state.value).toBe('##/##');
    });
});
