import { test, expect, Page, Locator } from '@playwright/test';

async function setupComponentTest(page: Page, componentTag: string) {
    await page.addScriptTag({ path: "dev/wwwroot/index.js", type: 'module' });

    await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
      </head>
      <body>
        <${componentTag}></${componentTag}>
      </body>
    </html>
  `);

    await page.waitForFunction((tag) => !!customElements.get(tag), componentTag, { timeout: 10000 });
    return page.locator(componentTag);
}

async function getSimpleComputedComponentState(component: Locator) {
    return component.evaluate(node => {
        const inst = node as any;
        return {
            firstName: inst.firstName,
            lastName: inst.lastName,
            fullName: inst.fullName,
            firstNameChangedCallCount: inst.firstNameChangedCallCount,
            firstNameChangedLastArgs: inst.firstNameChangedLastArgs,
            computeFullNameCallCount: inst.computeFullNameCallCount,
            computeFullNameLastArgs: inst.computeFullNameLastArgs,
            computeFullNameLastResult: inst.computeFullNameLastResult
        };
    });
}

test('TestOneSimpleComputed: lifecycle and computed/observer flow', async ({ page }) => {
    const component = await setupComponentTest(page, 'test-one-simple-computed');
    await expect(component).toBeVisible();

    // --- Initial state verification ---
    await expect(component.locator('strong')).toContainText('Computed Full Name: Jane Doe');
    let state = await getSimpleComputedComponentState(component);

    expect(state.firstName).toBe("Jane");
    expect(state.lastName).toBe("Doe");
    expect(state.fullName).toBe("Jane Doe");
    expect(state.computeFullNameCallCount).toBe(2); // Initial + connected
    expect(state.computeFullNameLastArgs).toEqual({ firstName: "Jane", lastName: "Doe" });
    expect(state.computeFullNameLastResult).toBe("Jane Doe");
    expect(state.firstNameChangedCallCount).toBe(1);
    expect(state.firstNameChangedLastArgs).toEqual({ newValue: "Jane", oldValue: undefined });

    // --- Act: Change firstName property ---
    await component.evaluate(node => { (node as any).firstName = 'John'; });
    await expect(component.locator('strong')).toContainText('Computed Full Name: John Doe'); // Wait for re-render
    state = await getSimpleComputedComponentState(component);

    expect(state.firstName).toBe("John");
    expect(state.lastName).toBe("Doe");
    expect(state.fullName).toBe("John Doe");
    expect(state.computeFullNameCallCount).toBe(3); // Previous 2 + 1 for this change
    expect(state.computeFullNameLastArgs).toEqual({ firstName: "John", lastName: "Doe" });
    expect(state.computeFullNameLastResult).toBe("John Doe");
    expect(state.firstNameChangedCallCount).toBe(2); // Previous 1 + 1 for this change
    expect(state.firstNameChangedLastArgs).toEqual({ newValue: "John", oldValue: "Jane" });

    // --- Act: Change lastName property ---
    await component.evaluate(node => { (node as any).lastName = 'Smith'; });
    await expect(component.locator('strong')).toContainText('Computed Full Name: John Smith'); // Wait for re-render
    state = await getSimpleComputedComponentState(component);

    expect(state.firstName).toBe("John");
    expect(state.lastName).toBe("Smith");
    expect(state.fullName).toBe("John Smith");
    expect(state.computeFullNameCallCount).toBe(4); // Previous 3 + 1 for this change
    expect(state.computeFullNameLastArgs).toEqual({ firstName: "John", lastName: "Smith" });
    expect(state.computeFullNameLastResult).toBe("John Smith");
    expect(state.firstNameChangedCallCount).toBe(2); // No change to firstName, so count remains 2
    
    // No lastName observer, so firstNameChangedLastArgs remains from previous change
    expect(state.firstNameChangedLastArgs).toEqual({ newValue: "John", oldValue: "Jane" });

    // Final check on rendered output
    await expect(component.locator('strong')).toContainText('Computed Full Name: John Smith'); // Wait for re-render
});

test('TestComputedPath: computed property with path string', async ({ page }) => {
    const component = await setupComponentTest(page, 'test-computed-path');
    await expect(component).toBeVisible();

    // --- Initial state verification ---
    await expect(component.locator('#derived')).toContainText('initial');
    let state = await component.evaluate(node => ({
        sourceData: (node as any).sourceObject.data,
        derivedValue: (node as any).derivedValue
    }));
    expect(state.sourceData).toBe("initial");
    expect(state.derivedValue).toBe("initial");

    // --- Act: Change sourceObject.data ---
    await component.evaluate(node => { (node as any).sourceObject = { data: "updated" }; });
    await expect(component.locator('#derived')).toContainText('updated'); // Wait for re-render

    state = await component.evaluate(node => ({
        sourceData: (node as any).sourceObject.data,
        derivedValue: (node as any).derivedValue
    }));
    expect(state.sourceData).toBe("updated");
    expect(state.derivedValue).toBe("updated");

    // --- Act: Change sourceObject to a new object ---
    await component.evaluate(node => { (node as any).sourceObject = { data: "new object" }; });
    await expect(component.locator('#derived')).toContainText('new object'); // Wait for re-render

    state = await component.evaluate(node => ({
        sourceData: (node as any).sourceObject.data,
        derivedValue: (node as any).derivedValue
    }));
    expect(state.sourceData).toBe("new object");
    expect(state.derivedValue).toBe("new object");
});

test('TestMultiObserver: multi-property observer and computed property', async ({ page }) => {
    const component = await setupComponentTest(page, 'test-multi-observer');
    await expect(component).toBeVisible();

    // --- Initial state verification ---
    await expect(component.locator('#counter')).toContainText('1');
    await expect(component.locator('#doubled')).toContainText('2');

    let state = await component.evaluate(node => {
        const inst = node as any;
        return {
            counter: inst.counter,
            doubled: inst.doubled,
            doubleCounterCallCount: inst.doubleCounterCallCount,
            counterOrDoubledChangedCallCount: inst.counterOrDoubledChangedCallCount,
            counterOrDoubledChangedLastArgs: inst.counterOrDoubledChangedLastArgs
        };
    });

    expect(state.counter).toBe(1);
    expect(state.doubled).toBe(2); // 1 * 2
    // Initial + connected for computed; Initial + connected for observer (as computed changes)
    // Depending on exact timing, computed might run once or twice initially.
    // Observer runs after initial properties are set and computed properties are calculated.
    expect(state.doubleCounterCallCount).toBeGreaterThanOrEqual(1); // connected + initial set
    const initialDoubleCount = state.doubleCounterCallCount;
    expect(state.counterOrDoubledChangedCallCount).toBeGreaterThanOrEqual(1); // connected + initial set
    const initialObserverCount = state.counterOrDoubledChangedCallCount;
    expect(state.counterOrDoubledChangedLastArgs).toEqual({ counter: 1, doubled: 2 });


    // --- Act: Change counter property ---
    await component.evaluate(node => { (node as any).counter = 5; });
    await expect(component.locator('#counter')).toContainText('5');
    await expect(component.locator('#doubled')).toContainText('10'); // Wait for re-render and computed update

    state = await component.evaluate(node => {
        const inst = node as any;
        return {
            counter: inst.counter,
            doubled: inst.doubled,
            doubleCounterCallCount: inst.doubleCounterCallCount,
            counterOrDoubledChangedCallCount: inst.counterOrDoubledChangedCallCount,
            counterOrDoubledChangedLastArgs: inst.counterOrDoubledChangedLastArgs
        };
    });

    expect(state.counter).toBe(5);
    expect(state.doubled).toBe(10); // 5 * 2
    expect(state.doubleCounterCallCount).toBe(initialDoubleCount + 1); // One more call for this change
    expect(state.counterOrDoubledChangedCallCount).toBe(initialObserverCount + 1); // One more call
    expect(state.counterOrDoubledChangedLastArgs).toEqual({ counter: 5, doubled: 10 });
});

test('TestEventListeners: host and child element event listeners', async ({ page }) => {
    const component = await setupComponentTest(page, 'test-event-listeners');
    await expect(component).toBeVisible();

    const hostElement = component.locator('#hostElement');
    const childButton = component.locator('#myButton');

    // --- Initial state verification ---
    let state = await component.evaluate(node => {
        const inst = node as any;
        return {
            hostClickCount: inst.hostClickCount,
            buttonClickCount: inst.buttonClickCount,
            lastMessageFromEvent: inst.lastMessageFromEvent
        };
    });
    expect(state.hostClickCount).toBe(0);
    expect(state.buttonClickCount).toBe(0);
    expect(state.lastMessageFromEvent).toBeUndefined();

    // --- Act: Click host element ---
    await hostElement.click();
    state = await component.evaluate(node => {
        const inst = node as any;
        return {
            hostClickCount: inst.hostClickCount,
            buttonClickCount: inst.buttonClickCount,
            lastMessageFromEvent: inst.lastMessageFromEvent
        };
    });
    expect(state.hostClickCount).toBe(1);
    expect(state.buttonClickCount).toBe(0);
    expect(state.lastMessageFromEvent).toBe('Host click handler invoked');

    // --- Act: Click child button ---
    await childButton.click();
    state = await component.evaluate(node => {
        const inst = node as any;
        return {
            hostClickCount: inst.hostClickCount,
            buttonClickCount: inst.buttonClickCount,
            lastMessageFromEvent: inst.lastMessageFromEvent
        };
    });
    // Host click count should NOT increment if the click originated from the button due to the check in _handleHostClick
    expect(state.hostClickCount).toBe(1);
    expect(state.buttonClickCount).toBe(1);
    expect(state.lastMessageFromEvent).toBe('Button clicked: myButton');

    // --- Act: Click host element again ---
    await hostElement.click();
    state = await component.evaluate(node => {
        const inst = node as any;
        return {
            hostClickCount: inst.hostClickCount,
            buttonClickCount: inst.buttonClickCount,
            lastMessageFromEvent: inst.lastMessageFromEvent
        };
    });
    expect(state.hostClickCount).toBe(2);
    expect(state.buttonClickCount).toBe(1);
    expect(state.lastMessageFromEvent).toBe('Host click handler invoked');
});