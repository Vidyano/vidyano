import { test, expect, Page, Locator } from '@playwright/test';

const tagsHtml = `
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
    await page.setContent(tagsHtml);
    await page.addScriptTag({ path: "dev/wwwroot/index.js", type: 'module' });
    await page.waitForFunction(() => !!customElements.get('vi-tags'), { timeout: 10000 });
}

async function createTags(page: Page, initialTags?: string[], config?: { readonly?: boolean; sensitive?: boolean }) {
    const componentId = `component-${Math.random().toString(36).substring(2, 15)}`;

    await page.evaluate(({ componentId, initialTags, config }) => {
        const container = document.getElementById('test-container');
        if (!container)
            throw new Error('Test container not found');

        const component = document.createElement('vi-tags') as any;
        component.id = componentId;

        if (initialTags !== undefined)
            component.tags = initialTags;

        if (config?.readonly !== undefined)
            component.readonly = config.readonly;

        if (config?.sensitive !== undefined)
            component.sensitive = config.sensitive;

        container.appendChild(component);
    }, { componentId, initialTags, config });

    return page.locator(`#${componentId}`);
}

async function getTagsState(component: Locator) {
    return component.evaluate(node => {
        const inst = node as any;
        return {
            tags: inst.tags,
            input: inst.input,
            readonly: inst.readonly,
            sensitive: inst.sensitive
        };
    });
}

async function getInputElement(component: Locator) {
    return component.locator('#tagsInput');
}

test.describe.serial('Tags Tests', () => {
    let sharedPage: Page;

    test.beforeAll(async ({ browser }) => {
        sharedPage = await browser.newPage();
        await setupPage(sharedPage);
    });

    test.afterAll(async () => {
        await sharedPage.close();
    });

    test('renders with empty tags', async () => {
        const component = await createTags(sharedPage);
        await expect(component).toBeVisible();

        const state = await getTagsState(component);
        expect(state.tags).toEqual([]);
        expect(state.readonly).toBe(false);
        expect(state.sensitive).toBe(true);
    });

    test('renders with initial tags', async () => {
        const component = await createTags(sharedPage, ['tag1', 'tag2', 'tag3']);

        const state = await getTagsState(component);
        expect(state.tags).toEqual(['tag1', 'tag2', 'tag3']);

        const tagElements = await component.locator('.tag').count();
        expect(tagElements).toBe(3);
    });

    test('adds tag on Enter key', async () => {
        const component = await createTags(sharedPage);
        const input = await getInputElement(component);

        await input.click();
        await input.fill('newtag');
        await input.press('Enter');

        const state = await getTagsState(component);
        expect(state.tags).toEqual(['newtag']);
        expect(state.input).toBe('');
    });

    test('adds tag on blur', async () => {
        const component = await createTags(sharedPage);
        const input = await getInputElement(component);

        await input.click();
        await input.fill('blurtag');
        await sharedPage.click('body', { position: { x: 10, y: 10 } });

        await sharedPage.waitForTimeout(50);

        const state = await getTagsState(component);
        expect(state.tags).toEqual(['blurtag']);
    });

    test('does not add empty tag', async () => {
        const component = await createTags(sharedPage);
        const input = await getInputElement(component);

        await input.click();
        await input.fill('   ');
        await input.press('Enter');

        const state = await getTagsState(component);
        expect(state.tags).toEqual([]);
        expect(state.input).toBe('');
    });

    test('adds multiple tags sequentially', async () => {
        const component = await createTags(sharedPage);
        const input = await getInputElement(component);

        await input.click();
        await input.fill('first');
        await input.press('Enter');

        await input.fill('second');
        await input.press('Enter');

        await input.fill('third');
        await input.press('Enter');

        const state = await getTagsState(component);
        expect(state.tags).toEqual(['first', 'second', 'third']);
    });

    test('removes tag on delete button click', async () => {
        const component = await createTags(sharedPage, ['tag1', 'tag2', 'tag3']);

        await sharedPage.waitForTimeout(100);

        await component.evaluate(() => {
            const inst = document.querySelector('vi-tags:last-child') as any;
            const deleteButton = inst.shadowRoot.querySelector('.delete') as HTMLElement;
            deleteButton?.click();
        });

        await sharedPage.waitForTimeout(50);

        const state = await getTagsState(component);
        expect(state.tags).toEqual(['tag2', 'tag3']);
    });

    test('removes specific tag', async () => {
        const component = await createTags(sharedPage, ['apple', 'banana', 'cherry']);

        await sharedPage.waitForTimeout(100);

        await component.evaluate(() => {
            const inst = document.querySelector('vi-tags:last-child') as any;
            const deleteButtons = inst.shadowRoot.querySelectorAll('.delete');
            (deleteButtons[1] as HTMLElement)?.click();
        });

        await sharedPage.waitForTimeout(50);

        const state = await getTagsState(component);
        expect(state.tags).toEqual(['apple', 'cherry']);
    });

    test('fires tags-changed event when tag is added', async () => {
        const component = await createTags(sharedPage);

        const eventPromise = component.evaluate(node => {
            return new Promise<any>(resolve => {
                node.addEventListener('tags-changed', (e: any) => {
                    resolve(e.detail.value);
                }, { once: true });
            });
        });

        const input = await getInputElement(component);
        await input.click();
        await input.fill('eventtest');
        await input.press('Enter');

        const eventValue = await eventPromise;
        expect(eventValue).toEqual(['eventtest']);
    });

    test('fires tags-changed event when tag is removed', async () => {
        const component = await createTags(sharedPage, ['tag1', 'tag2']);

        await sharedPage.waitForTimeout(100);

        const eventPromise = component.evaluate(node => {
            return new Promise<any>(resolve => {
                node.addEventListener('tags-changed', (e: any) => {
                    resolve(e.detail.value);
                }, { once: true });
            });
        });

        await component.evaluate(() => {
            const inst = document.querySelector('vi-tags:last-child') as any;
            const deleteButton = inst.shadowRoot.querySelector('.delete') as HTMLElement;
            deleteButton?.click();
        });

        const eventValue = await eventPromise;
        expect(eventValue).toEqual(['tag2']);
    });

    test('supports drag-and-drop reordering', async () => {
        const component = await createTags(sharedPage, ['first', 'second', 'third']);

        await sharedPage.waitForTimeout(50);

        const initialState = await getTagsState(component);
        expect(initialState.tags).toEqual(['first', 'second', 'third']);

        await component.evaluate(() => {
            const inst = document.querySelector('vi-tags:last-child') as any;
            const sortable = inst.shadowRoot.querySelector('#sortable-tags');

            const dragEndEvent = new CustomEvent('drag-end', {
                detail: {
                    oldIndex: 0,
                    newIndex: 2
                },
                bubbles: true,
                composed: true
            });
            sortable.dispatchEvent(dragEndEvent);
        });

        await sharedPage.waitForTimeout(50);

        const finalState = await getTagsState(component);
        expect(finalState.tags).toEqual(['second', 'third', 'first']);
    });

    test('readonly mode hides input', async () => {
        const component = await createTags(sharedPage, ['tag1', 'tag2'], { readonly: true });

        await sharedPage.waitForTimeout(50);

        const input = component.locator('#tagsInput');
        await expect(input).toHaveCount(0);
    });

    test('readonly mode hides delete buttons', async () => {
        const component = await createTags(sharedPage, ['tag1', 'tag2'], { readonly: true });

        await sharedPage.waitForTimeout(50);

        const deleteButtons = component.locator('.delete');
        await expect(deleteButtons).toHaveCount(0);
    });

    test('readonly mode sets readonly property', async () => {
        const component = await createTags(sharedPage, ['tag1', 'tag2'], { readonly: true });

        await sharedPage.waitForTimeout(50);

        const state = await component.evaluate(() => {
            const inst = document.querySelector('vi-tags:last-child') as any;
            return {
                readonly: inst.readonly,
                hasReadonlyAttr: inst.hasAttribute('readonly')
            };
        });

        expect(state.readonly).toBe(true);
        expect(state.hasReadonlyAttr).toBe(true);
    });

    test('readonly mode prevents drag-and-drop reordering', async () => {
        const component = await createTags(sharedPage, ['first', 'second', 'third'], { readonly: true });

        await sharedPage.waitForTimeout(50);

        const initialState = await getTagsState(component);
        expect(initialState.tags).toEqual(['first', 'second', 'third']);

        await component.evaluate(() => {
            const inst = document.querySelector('vi-tags:last-child') as any;
            const sortable = inst.shadowRoot.querySelector('#sortable-tags');

            const dragEndEvent = new CustomEvent('drag-end', {
                detail: {
                    oldIndex: 0,
                    newIndex: 2
                },
                bubbles: true,
                composed: true
            });
            sortable.dispatchEvent(dragEndEvent);
        });

        await sharedPage.waitForTimeout(50);

        const finalState = await getTagsState(component);
        expect(finalState.tags).toEqual(['first', 'second', 'third']);
    });

    test('focus() method focuses input', async () => {
        const component = await createTags(sharedPage);

        await component.evaluate(node => {
            (node as any).focus();
        });

        await sharedPage.waitForTimeout(50);

        const isFocused = await component.evaluate(() => {
            const inst = document.querySelector('vi-tags:last-child') as any;
            const input = inst.shadowRoot.querySelector('#tagsInput');
            return inst.shadowRoot.activeElement === input;
        });

        expect(isFocused).toBe(true);
    });

    test('clicking component focuses input', async () => {
        const component = await createTags(sharedPage);

        await component.evaluate(() => {
            const inst = document.querySelector('vi-tags:last-child') as any;
            const scroller = inst.shadowRoot.querySelector('#scroller') as HTMLElement;
            scroller.click();
        });

        await sharedPage.waitForTimeout(50);

        const isFocused = await component.evaluate(() => {
            const inst = document.querySelector('vi-tags:last-child') as any;
            const input = inst.shadowRoot.querySelector('#tagsInput');
            return inst.shadowRoot.activeElement === input;
        });

        expect(isFocused).toBe(true);
    });

    test('sensitive property controls vi-sensitive', async () => {
        const component = await createTags(sharedPage, ['secret'], { sensitive: false });

        await sharedPage.waitForTimeout(50);

        const sensitiveDisabled = await component.evaluate(() => {
            const inst = document.querySelector('vi-tags:last-child') as any;
            const sensitive = inst.shadowRoot.querySelector('vi-sensitive');
            return sensitive?.hasAttribute('disabled');
        });

        expect(sensitiveDisabled).toBe(true);
    });

    test('reordering preserves tag identity', async () => {
        const component = await createTags(sharedPage, ['alpha', 'beta', 'gamma']);

        await sharedPage.waitForTimeout(50);

        await component.evaluate(() => {
            const inst = document.querySelector('vi-tags:last-child') as any;
            const sortable = inst.shadowRoot.querySelector('#sortable-tags');

            const dragEndEvent = new CustomEvent('drag-end', {
                detail: {
                    oldIndex: 1,
                    newIndex: 0
                },
                bubbles: true,
                composed: true
            });
            sortable.dispatchEvent(dragEndEvent);
        });

        await sharedPage.waitForTimeout(50);

        const state = await getTagsState(component);
        expect(state.tags).toEqual(['beta', 'alpha', 'gamma']);
    });

    test('drag-end with same index does not modify tags', async () => {
        const component = await createTags(sharedPage, ['one', 'two', 'three']);

        await sharedPage.waitForTimeout(50);

        await component.evaluate(() => {
            const inst = document.querySelector('vi-tags:last-child') as any;
            const sortable = inst.shadowRoot.querySelector('#sortable-tags');

            const dragEndEvent = new CustomEvent('drag-end', {
                detail: {
                    oldIndex: 1,
                    newIndex: 1
                },
                bubbles: true,
                composed: true
            });
            sortable.dispatchEvent(dragEndEvent);
        });

        await sharedPage.waitForTimeout(50);

        const state = await getTagsState(component);
        expect(state.tags).toEqual(['one', 'two', 'three']);
    });

    test('drag-end with negative index does not modify tags', async () => {
        const component = await createTags(sharedPage, ['one', 'two', 'three']);

        await sharedPage.waitForTimeout(50);

        await component.evaluate(() => {
            const inst = document.querySelector('vi-tags:last-child') as any;
            const sortable = inst.shadowRoot.querySelector('#sortable-tags');

            const dragEndEvent = new CustomEvent('drag-end', {
                detail: {
                    oldIndex: 1,
                    newIndex: -1
                },
                bubbles: true,
                composed: true
            });
            sortable.dispatchEvent(dragEndEvent);
        });

        await sharedPage.waitForTimeout(50);

        const state = await getTagsState(component);
        expect(state.tags).toEqual(['one', 'two', 'three']);
    });

    test('updates tags property programmatically', async () => {
        const component = await createTags(sharedPage);

        await component.evaluate(node => {
            (node as any).tags = ['prog1', 'prog2'];
        });

        await sharedPage.waitForTimeout(50);

        const state = await getTagsState(component);
        expect(state.tags).toEqual(['prog1', 'prog2']);

        const tagElements = await component.locator('.tag').count();
        expect(tagElements).toBe(2);
    });

    test('input value persists during typing', async () => {
        const component = await createTags(sharedPage);
        const input = await getInputElement(component);

        await input.click();
        await input.fill('partial');

        await sharedPage.waitForTimeout(50);

        const state = await getTagsState(component);
        expect(state.input).toBe('partial');
    });

    test('clears input after adding tag', async () => {
        const component = await createTags(sharedPage);
        const input = await getInputElement(component);

        await input.click();
        await input.fill('test');
        await input.press('Enter');

        await sharedPage.waitForTimeout(50);

        const inputValue = await input.inputValue();
        expect(inputValue).toBe('');
    });

    test('readonly clears input on blur', async () => {
        const component = await createTags(sharedPage);

        await component.evaluate(node => {
            (node as any).readonly = false;
        });

        const input = await getInputElement(component);
        await input.click();
        await input.fill('test');

        await component.evaluate(node => {
            (node as any).readonly = true;
        });

        await sharedPage.click('body', { position: { x: 10, y: 10 } });
        await sharedPage.waitForTimeout(50);

        const state = await getTagsState(component);
        expect(state.input).toBe('');
    });
});
