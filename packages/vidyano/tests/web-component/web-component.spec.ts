import { test, expect, Page, Locator } from '@playwright/test';

async function setupComponentTest(page: Page, componentTag: string, options?: { beforeWait?: () => Promise<void> }) {
    await page.addScriptTag({ path: "dev/wwwroot/index.js", type: 'module' });

    await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          /* Ensure all custom elements are visible for Playwright tests */
          :not(:defined) { display: none; }
          * { display: block; padding: 1px; }
        </style>
      </head>
      <body>
        <${componentTag}></${componentTag}>
      </body>
    </html>
  `);

    if (options?.beforeWait)
        await options.beforeWait();

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

test('TestComputedInline: @computed with inline function', async ({ page }) => {
    const component = await setupComponentTest(page, 'test-computed-inline');
    await expect(component).toBeVisible();

    // --- Initial state verification ---
    await expect(component.locator('strong')).toContainText('Computed Full Name: Jane Doe');
    let state = await getSimpleComputedComponentState(component);

    expect(state.firstName).toBe("Jane");
    expect(state.lastName).toBe("Doe");
    expect(state.fullName).toBe("Jane Doe");
    expect(state.computeFullNameCallCount).toBe(1);
    expect(state.computeFullNameLastArgs).toEqual({ firstName: "Jane", lastName: "Doe" });
    expect(state.computeFullNameLastResult).toBe("Jane Doe");
    expect(state.firstNameChangedCallCount).toBe(1);
    expect(state.firstNameChangedLastArgs).toEqual({ newValue: "Jane", oldValue: undefined });

    // --- Act: Change firstName property ---
    await component.evaluate(node => { (node as any).firstName = 'John'; });
    await expect(component.locator('strong')).toContainText('Computed Full Name: John Doe');
    state = await getSimpleComputedComponentState(component);

    expect(state.firstName).toBe("John");
    expect(state.lastName).toBe("Doe");
    expect(state.fullName).toBe("John Doe");
    expect(state.computeFullNameCallCount).toBe(2);
    expect(state.computeFullNameLastArgs).toEqual({ firstName: "John", lastName: "Doe" });
    expect(state.computeFullNameLastResult).toBe("John Doe");
    expect(state.firstNameChangedCallCount).toBe(2);
    expect(state.firstNameChangedLastArgs).toEqual({ newValue: "John", oldValue: "Jane" });

    // --- Act: Change lastName property ---
    await component.evaluate(node => { (node as any).lastName = 'Smith'; });
    await expect(component.locator('strong')).toContainText('Computed Full Name: John Smith');
    state = await getSimpleComputedComponentState(component);

    expect(state.firstName).toBe("John");
    expect(state.lastName).toBe("Smith");
    expect(state.fullName).toBe("John Smith");
    expect(state.computeFullNameCallCount).toBe(3);
    expect(state.computeFullNameLastArgs).toEqual({ firstName: "John", lastName: "Smith" });
    expect(state.computeFullNameLastResult).toBe("John Smith");
    expect(state.firstNameChangedCallCount).toBe(2);
    expect(state.firstNameChangedLastArgs).toEqual({ newValue: "John", oldValue: "Jane" });

    // Final check on rendered output
    await expect(component.locator('strong')).toContainText('Computed Full Name: John Smith');
});

test('TestComputedPrototype: @computed with prototype function reference', async ({ page }) => {
    const component = await setupComponentTest(page, 'test-computed-prototype');
    await expect(component).toBeVisible();

    // --- Initial state verification ---
    await expect(component.locator('#full-name')).toContainText('Jane Doe');
    let state = await component.evaluate(node => {
        const inst = node as any;
        return {
            firstName: inst.firstName,
            lastName: inst.lastName,
            fullName: inst.fullName,
            computeFullNameCallCount: inst.computeFullNameCallCount,
            computeFullNameLastArgs: inst.computeFullNameLastArgs,
            computeFullNameLastResult: inst.computeFullNameLastResult
        };
    });

    expect(state.firstName).toBe("Jane");
    expect(state.lastName).toBe("Doe");
    expect(state.fullName).toBe("Jane Doe");
    expect(state.computeFullNameCallCount).toBe(1);
    expect(state.computeFullNameLastArgs).toEqual({ firstName: "Jane", lastName: "Doe" });
    expect(state.computeFullNameLastResult).toBe("Jane Doe");

    // --- Act: Change firstName property ---
    await component.evaluate(node => { (node as any).firstName = 'John'; });
    await expect(component.locator('#full-name')).toContainText('John Doe');
    state = await component.evaluate(node => {
        const inst = node as any;
        return {
            firstName: inst.firstName,
            lastName: inst.lastName,
            fullName: inst.fullName,
            computeFullNameCallCount: inst.computeFullNameCallCount,
            computeFullNameLastArgs: inst.computeFullNameLastArgs,
            computeFullNameLastResult: inst.computeFullNameLastResult
        };
    });

    expect(state.firstName).toBe("John");
    expect(state.lastName).toBe("Doe");
    expect(state.fullName).toBe("John Doe");
    expect(state.computeFullNameCallCount).toBe(2);
    expect(state.computeFullNameLastArgs).toEqual({ firstName: "John", lastName: "Doe" });
    expect(state.computeFullNameLastResult).toBe("John Doe");

    // --- Act: Change lastName property ---
    await component.evaluate(node => { (node as any).lastName = 'Smith'; });
    await expect(component.locator('#full-name')).toContainText('John Smith');
    state = await component.evaluate(node => {
        const inst = node as any;
        return {
            firstName: inst.firstName,
            lastName: inst.lastName,
            fullName: inst.fullName,
            computeFullNameCallCount: inst.computeFullNameCallCount,
            computeFullNameLastArgs: inst.computeFullNameLastArgs,
            computeFullNameLastResult: inst.computeFullNameLastResult
        };
    });

    expect(state.firstName).toBe("John");
    expect(state.lastName).toBe("Smith");
    expect(state.fullName).toBe("John Smith");
    expect(state.computeFullNameCallCount).toBe(3);
    expect(state.computeFullNameLastArgs).toEqual({ firstName: "John", lastName: "Smith" });
    expect(state.computeFullNameLastResult).toBe("John Smith");

    // Final check on rendered output
    await expect(component.locator('#full-name')).toContainText('John Smith');
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

test('TestAsyncComputed: all three async function patterns', async ({ page }) => {
    const component = await setupComponentTest(page, 'test-async-computed');
    await expect(component).toBeVisible();

    // --- Initial state verification ---
    await expect(component.locator('#input')).toContainText('initial');
    await expect(component.locator('#inline-async')).toContainText('Loading...'); // Initial render before promise resolves
    await expect(component.locator('#inline-unnamed')).toContainText('Loading...');
    await expect(component.locator('#named')).toContainText('Loading...');

    // Wait for all async computations to complete
    await expect(component.locator('#inline-async')).toContainText('Inline Async: initial', { timeout: 2000 });
    await expect(component.locator('#inline-unnamed')).toContainText('Inline Unnamed: initial', { timeout: 2000 });
    await expect(component.locator('#named')).toContainText('Named: initial', { timeout: 2000 });

    let state = await component.evaluate(node => ({
        inputValue: (node as any).inputValue,
        computedInlineAsync: (node as any).computedInlineAsync,
        computedInlineUnnamed: (node as any).computedInlineUnnamed,
        computedNamed: (node as any).computedNamed
    }));
    expect(state.inputValue).toBe("initial");
    expect(state.computedInlineAsync).toBe("Inline Async: initial");
    expect(state.computedInlineUnnamed).toBe("Inline Unnamed: initial");
    expect(state.computedNamed).toBe("Named: initial");

    // --- Act: Change inputValue property ---
    await component.evaluate((node: any) => { node.inputValue = "updated"; });
    await expect(component.locator('#input')).toContainText('updated');

    // Wait for all async computations to complete
    await expect(component.locator('#inline-async')).toContainText('Inline Async: updated', { timeout: 2000 });
    await expect(component.locator('#inline-unnamed')).toContainText('Inline Unnamed: updated', { timeout: 2000 });
    await expect(component.locator('#named')).toContainText('Named: updated', { timeout: 2000 });

    state = await component.evaluate(node => ({
        inputValue: (node as any).inputValue,
        computedInlineAsync: (node as any).computedInlineAsync,
        computedInlineUnnamed: (node as any).computedInlineUnnamed,
        computedNamed: (node as any).computedNamed
    }));
    expect(state.inputValue).toBe("updated");
    expect(state.computedInlineAsync).toBe("Inline Async: updated");
    expect(state.computedInlineUnnamed).toBe("Inline Unnamed: updated");
    expect(state.computedNamed).toBe("Named: updated");
});

test('TestAsyncComputed: ignore stale async result', async ({ page }) => {
    const component = await setupComponentTest(page, 'test-async-computed');
    await expect(component).toBeVisible();

    // --- Initial state verification ---
    await expect(component.locator('#input')).toContainText('initial');
    // Wait for the initial computation (testing inline-async pattern)
    await expect(component.locator('#inline-async')).toContainText('Inline Async: initial', { timeout: 2000 });

    // --- Act: Trigger two changes in quick succession ---
    // Change 1: inputValue = "first" (will take 1s)
    await component.evaluate((node: any) => { node.inputValue = "first"; });
    await expect(component.locator('#input')).toContainText('first');
    // The computed value might show "Loading..." or "Inline Async: initial"

    // Change 2: inputValue = "second" (will take 1s, started shortly after "first")
    // We introduce a very small delay to ensure the first evaluation starts
    await page.waitForTimeout(50); // 50ms delay
    await component.evaluate((node: any) => { node.inputValue = "second"; });
    await expect(component.locator('#input')).toContainText('second');
    // The computed value might show "Loading..." or "Inline Async: first" or "Inline Async: initial"

    // --- Verification ---
    // We expect the component to eventually settle on the result of the "second" computation,
    // ignoring the result from the "first" computation.
    // The "first" promise (resolving to "Inline Async: first") should be ignored.
    // The "second" promise (resolving to "Inline Async: second") should be the final state.
    await expect(component.locator('#inline-async')).toContainText('Inline Async: second', { timeout: 2500 }); // Allow enough time for both to "try" to resolve

    const finalState = await component.evaluate(node => ({
        inputValue: (node as any).inputValue,
        computedInlineAsync: (node as any).computedInlineAsync
    }));
    expect(finalState.inputValue).toBe("second");
    expect(finalState.computedInlineAsync).toBe("Inline Async: second");

    // To be absolutely sure the "first" value didn't sneak in later, wait a bit more
    await page.waitForTimeout(1000); // Wait for the first promise's timeout duration
    const stateAfterWaiting = await component.evaluate(node => ({
        computedInlineAsync: (node as any).computedInlineAsync
    }));
    expect(stateAfterWaiting.computedInlineAsync).toBe("Inline Async: second");
});

test('TestObserverMethod: @observer on methods for multi-property observation', async ({ page }) => {
    const component = await setupComponentTest(page, 'test-observer-method');
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

test('TestComputedSubPath: items computed from query.items sub-path', async ({ page }) => {
    const component = await setupComponentTest(page, 'test-computed-sub-path');
    await expect(component).toBeVisible();

    // --- Initial state verification ---
    await expect(component.locator('#component-items')).toContainText('initial1, initial2');
    let compItems = await component.evaluate(node => (node as any).items);
    expect(compItems).toEqual(["initial1", "initial2"]);

    let queryItems = await component.evaluate(node => (node as any).query.items);
    expect(queryItems).toEqual(["initial1", "initial2"]);

    // --- Act: Change query.items to a new array instance ---
    await component.evaluate(node => { (node as any).query.items = ["new1", "new2", "new3"]; });
    await expect(component.locator('#component-items')).toContainText('new1, new2, new3'); // Wait for re-render
    
    compItems = await component.evaluate(node => (node as any).items);
    expect(compItems).toEqual(["new1", "new2", "new3"]);
    queryItems = await component.evaluate(node => (node as any).query.items);
    expect(queryItems).toEqual(["new1", "new2", "new3"]);

    // --- Act: Mutate query.items by adding an item (push) ---
    // This requires the QuerySource to correctly notify about array changes for the computed property to pick it up.
    await component.evaluate(node => {
        const inst = node as any;
        inst.query.addItem("added4");
    });
    
    await expect(component.locator('#component-items')).toContainText('new1, new2, new3, added4');

    compItems = await component.evaluate(node => (node as any).items);
    expect(compItems).toEqual(["new1", "new2", "new3", "added4"]);
    queryItems = await component.evaluate(node => (node as any).query.items);
    expect(queryItems).toEqual(["new1", "new2", "new3", "added4"]);

    // --- Act: Change the entire query object instance ---
    await component.evaluate(node => {
        (node as any).resetQuerySource();
    });
    await expect(component.locator('#component-items')).toContainText('brandnew1, brandnew2');
    compItems = await component.evaluate(node => (node as any).items);
    expect(compItems).toEqual(["brandnew1", "brandnew2"]);
    queryItems = await component.evaluate(node => (node as any).query.items);
    expect(queryItems).toEqual(["brandnew1", "brandnew2"]);
});

async function getComputedObservablePathComponentState(component: Locator) {
    return component.evaluate(node => {
        const inst = node as any;
        return {
            serviceObjectIsBusy: inst.serviceObject?.isBusy,
            loading: inst.loading
        };
    });
}

test('TestComputedObservablePath: computed from observable sub-property', async ({ page }) => {
    const component = await setupComponentTest(page, 'test-computed-observable-path');
    await expect(component).toBeVisible();

    // --- Initial state verification (serviceObject is undefined) ---
    await expect(component.locator('#loading-state')).toContainText(''); // Default for boolean if path undefined
    let state = await getComputedObservablePathComponentState(component);
    expect(state.serviceObjectIsBusy).toBeUndefined();
    expect(state.loading).toBeUndefined();

    // --- Act: Initialize serviceObject with isBusy = true ---
    await component.evaluate((node: any) => node.initializeServiceObject(true));
    await expect(component.locator('#service-busy')).toContainText('true');
    await expect(component.locator('#loading-state')).toContainText('true');
    state = await getComputedObservablePathComponentState(component);
    expect(state.serviceObjectIsBusy).toBe(true);
    expect(state.loading).toBe(true);

    // --- Act: Change serviceObject.isBusy to false ---
    await component.evaluate((node: any) => node.updateServiceIsBusy(false));
    await expect(component.locator('#service-busy')).toContainText('false');
    await expect(component.locator('#loading-state')).toContainText('false');
    state = await getComputedObservablePathComponentState(component);
    expect(state.serviceObjectIsBusy).toBe(false);
    expect(state.loading).toBe(false);

    // --- Act: Change serviceObject.isBusy back to true ---
    await component.evaluate((node: any) => node.updateServiceIsBusy(true));
    await expect(component.locator('#service-busy')).toContainText('true');
    await expect(component.locator('#loading-state')).toContainText('true');
    state = await getComputedObservablePathComponentState(component);
    expect(state.serviceObjectIsBusy).toBe(true);
    expect(state.loading).toBe(true);

    // --- Act: Clear serviceObject (set to undefined) ---
    await component.evaluate((node: any) => node.clearServiceObject());
    await expect(component.locator('#service-busy')).toContainText('N/A');
    await expect(component.locator('#loading-state')).toContainText(''); // Should revert to default
    state = await getComputedObservablePathComponentState(component);
    expect(state.serviceObjectIsBusy).toBeUndefined();
    expect(state.loading).toBeUndefined();

    // --- Act: Initialize serviceObject again with isBusy = false ---
    await component.evaluate((node: any) => node.initializeServiceObject(false));
    await expect(component.locator('#service-busy')).toContainText('false');
    await expect(component.locator('#loading-state')).toContainText('false');
    state = await getComputedObservablePathComponentState(component);
    expect(state.serviceObjectIsBusy).toBe(false);
    expect(state.loading).toBe(false);
});

async function getComputedObservablePathWithInitialNullComponentState(component: Locator) {
    return component.evaluate(node => {
        const inst = node as any;
        return {
            serviceObjectIsBusy: inst.serviceObject?.isBusy,
            loading: inst.loading,
            serviceObject: inst.serviceObject
        };
    });
}

test('TestComputedObservablePathWithInitialNull: computed from initially null observable sub-property', async ({ page }) => {
    const component = await setupComponentTest(page, 'test-computed-observable-path');
    await expect(component).toBeVisible();

    // --- Initial state verification (serviceObject is undefined) ---
    await expect(component.locator('#loading-state')).toContainText(''); // Default for boolean if path undefined
    let state = await getComputedObservablePathWithInitialNullComponentState(component);
    expect(state.serviceObject).toBeUndefined();
    expect(state.serviceObjectIsBusy).toBeUndefined();
    expect(state.loading).toBeUndefined();

    // --- Act: Initialize serviceObject with isBusy = true ---
    await component.evaluate((node: any) => node.initializeServiceObject(true));
    await expect(component.locator('#service-busy')).toContainText('true');
    await expect(component.locator('#loading-state')).toContainText('true');
    state = await getComputedObservablePathWithInitialNullComponentState(component);
    expect(state.serviceObject).not.toBeUndefined();
    expect(state.serviceObjectIsBusy).toBe(true);
    expect(state.loading).toBe(true);

    // --- Act: Change serviceObject.isBusy to false ---
    await component.evaluate((node: any) => node.updateServiceIsBusy(false));
    await expect(component.locator('#service-busy')).toContainText('false');
    await expect(component.locator('#loading-state')).toContainText('false');
    state = await getComputedObservablePathWithInitialNullComponentState(component);
    expect(state.serviceObjectIsBusy).toBe(false);
    expect(state.loading).toBe(false);

    // --- Act: Clear serviceObject (set to undefined) ---
    await component.evaluate((node: any) => node.clearServiceObject());
    await expect(component.locator('#service-busy')).toContainText('N/A');
    await expect(component.locator('#loading-state')).toContainText(''); // Should revert to default
    state = await getComputedObservablePathWithInitialNullComponentState(component);
    expect(state.serviceObject).toBeUndefined();
    expect(state.serviceObjectIsBusy).toBeUndefined();
    expect(state.loading).toBeUndefined();

    // --- Act: Initialize serviceObject again with isBusy = false ---
    await component.evaluate((node: any) => node.initializeServiceObject(false));
    await expect(component.locator('#service-busy')).toContainText('false');
    await expect(component.locator('#loading-state')).toContainText('false');
    state = await getComputedObservablePathWithInitialNullComponentState(component);
    expect(state.serviceObjectIsBusy).toBe(false);
    expect(state.loading).toBe(false);
});

test('TestComputedDerivedObject: stability with new object instances', async ({ page }) => {
    const component = await setupComponentTest(page, 'test-computed-derived-object');
    await expect(component).toBeVisible();

    async function getState(component: Locator) {
        return component.evaluate(node => {
            const inst = node as any;
            return {
                sourceValue: inst.source.value,
                derivedValue: inst.derivedObject.value,
                computeCallCount: inst.computeCallCount
            };
        });
    }

    // --- Initial state verification ---
    await expect(component.locator('#derived-value')).toContainText('initial');
    let state = await getState(component);

    // Initial values should be set correctly
    expect(state.computeCallCount).toBe(1);
    expect(state.derivedValue).toBe('initial');
    const initialCallCount = state.computeCallCount;

    // --- Act: Trigger a change on the deep path ---
    await component.evaluate(node => (node as any).updateSourceValue("updated"));

    // Wait for the render to complete.
    await expect(component.locator('#derived-value')).toContainText('updated');

    // --- Verification ---
    state = await getState(component);

    expect(state.sourceValue).toBe("updated");
    expect(state.derivedValue).toBe("updated");

    // The MOST IMPORTANT check:
    // The computation should only be called ONCE more.
    expect(state.computeCallCount).toBe(initialCallCount + 1);
});

test('TestComputedChainedRoot: computed observing another computed as root', async ({ page }) => {
    const component = await setupComponentTest(page, 'test-computed-chained-root');
    await expect(component).toBeVisible();

    async function getState(component: Locator) {
        return component.evaluate(node => {
            const inst = node as any;
            return {
                derivedValue: inst.derivedReference?.value,
                isOther: inst.isOther,
                computeCount: inst.isOtherComputeCount
            };
        });
    }

    // --- Initial state: config points to refA which has value "normal" ---
    await expect(component.locator('#is-other')).toContainText('false');
    let state = await getState(component);
    expect(state.derivedValue).toBe('normal');
    expect(state.isOther).toBe(false);
    expect(state.computeCount).toBeGreaterThan(0);
    const initialCount = state.computeCount;

    // --- Act: Change refA's value to "other" ---
    await component.evaluate(node => { (node as any).refA.value = "other"; });
    await expect(component.locator('#is-other')).toContainText('true');
    state = await getState(component);
    expect(state.derivedValue).toBe('other');
    expect(state.isOther).toBe(true);
    expect(state.computeCount).toBeGreaterThan(initialCount);
    const afterFirstChange = state.computeCount;

    // --- Act: Change refA's value to "another" ---
    await component.evaluate(node => { (node as any).refA.value = "another"; });
    await expect(component.locator('#is-other')).toContainText('true');
    state = await getState(component);
    expect(state.derivedValue).toBe('another');
    expect(state.isOther).toBe(true);
    expect(state.computeCount).toBeGreaterThan(afterFirstChange);
    const afterSecondChange = state.computeCount;

    // --- Act: Change config to point to refB (which has value "other") ---
    await component.evaluate(node => { (node as any).config.options = ["refB"]; });
    await expect(component.locator('#is-other')).toContainText('true');
    state = await getState(component);
    expect(state.derivedValue).toBe('other');
    expect(state.isOther).toBe(true);
    expect(state.computeCount).toBeGreaterThan(afterSecondChange);
    const afterConfigChange = state.computeCount;

    // --- Act: Change refB's value to "normal" ---
    await component.evaluate(node => { (node as any).refB.value = "normal"; });
    await expect(component.locator('#is-other')).toContainText('false');
    state = await getState(component);
    expect(state.derivedValue).toBe('normal');
    expect(state.isOther).toBe(false);
    expect(state.computeCount).toBeGreaterThan(afterConfigChange);
});

test('TestObserverUndefinedBlocking: observer not called when properties are undefined by default', async ({ page }) => {
    const component = await setupComponentTest(page, 'test-observer-undefined-blocking');
    await expect(component).toBeVisible();

    // --- Initial state verification ---
    // Initially both firstName and lastName are undefined, so observer should NOT have been called
    let state = await component.evaluate(node => {
        const inst = node as any;
        return {
            firstName: inst.firstName,
            lastName: inst.lastName,
            observerCallCount: inst.observerCallCount,
            observerLastArgs: inst.observerLastArgs
        };
    });

    expect(state.firstName).toBeUndefined();
    expect(state.lastName).toBeUndefined();
    expect(state.observerCallCount).toBe(0); // Observer not called because both are undefined
    expect(state.observerLastArgs).toBeNull();

    // --- Act: Set only firstName (lastName still undefined) ---
    await component.evaluate(node => { (node as any).firstName = 'John'; });
    state = await component.evaluate(node => {
        const inst = node as any;
        return {
            firstName: inst.firstName,
            lastName: inst.lastName,
            observerCallCount: inst.observerCallCount,
            observerLastArgs: inst.observerLastArgs
        };
    });

    expect(state.firstName).toBe('John');
    expect(state.lastName).toBeUndefined();
    expect(state.observerCallCount).toBe(0); // Observer still not called because lastName is undefined
    expect(state.observerLastArgs).toBeNull();

    // --- Act: Set lastName (now both are defined) ---
    await component.evaluate(node => { (node as any).lastName = 'Doe'; });
    state = await component.evaluate(node => {
        const inst = node as any;
        return {
            firstName: inst.firstName,
            lastName: inst.lastName,
            observerCallCount: inst.observerCallCount,
            observerLastArgs: inst.observerLastArgs
        };
    });

    expect(state.firstName).toBe('John');
    expect(state.lastName).toBe('Doe');
    expect(state.observerCallCount).toBe(1); // Observer called now that both are defined
    expect(state.observerLastArgs).toEqual({ firstName: 'John', lastName: 'Doe' });

    // --- Act: Change firstName (both still defined) ---
    await component.evaluate(node => { (node as any).firstName = 'Jane'; });
    state = await component.evaluate(node => {
        const inst = node as any;
        return {
            firstName: inst.firstName,
            lastName: inst.lastName,
            observerCallCount: inst.observerCallCount,
            observerLastArgs: inst.observerLastArgs
        };
    });

    expect(state.firstName).toBe('Jane');
    expect(state.lastName).toBe('Doe');
    expect(state.observerCallCount).toBe(2); // Observer called again
    expect(state.observerLastArgs).toEqual({ firstName: 'Jane', lastName: 'Doe' });

    // --- Act: Set firstName to null (null is allowed) ---
    await component.evaluate(node => { (node as any).firstName = null; });
    state = await component.evaluate(node => {
        const inst = node as any;
        return {
            firstName: inst.firstName,
            lastName: inst.lastName,
            observerCallCount: inst.observerCallCount,
            observerLastArgs: inst.observerLastArgs
        };
    });

    expect(state.firstName).toBeNull();
    expect(state.lastName).toBe('Doe');
    expect(state.observerCallCount).toBe(3); // Observer called because null is allowed
    expect(state.observerLastArgs).toEqual({ firstName: null, lastName: 'Doe' });
});

test('TestObserverAllowUndefined: observer called even when properties are undefined', async ({ page }) => {
    const component = await setupComponentTest(page, 'test-observer-allow-undefined');
    await expect(component).toBeVisible();

    // --- Initial state verification ---
    // With allowUndefined: true, observer should be called even if properties are undefined
    let state = await component.evaluate(node => {
        const inst = node as any;
        return {
            firstName: inst.firstName,
            lastName: inst.lastName,
            observerCallCount: inst.observerCallCount,
            observerLastArgs: inst.observerLastArgs
        };
    });

    expect(state.firstName).toBeUndefined();
    expect(state.lastName).toBeUndefined();
    expect(state.observerCallCount).toBe(0); // No initial call because properties haven't changed yet

    // --- Act: Set only firstName (lastName still undefined) ---
    await component.evaluate(node => { (node as any).firstName = 'John'; });
    state = await component.evaluate(node => {
        const inst = node as any;
        return {
            firstName: inst.firstName,
            lastName: inst.lastName,
            observerCallCount: inst.observerCallCount,
            observerLastArgs: inst.observerLastArgs
        };
    });

    expect(state.firstName).toBe('John');
    expect(state.lastName).toBeUndefined();
    expect(state.observerCallCount).toBe(1); // Observer called even though lastName is undefined
    expect(state.observerLastArgs).toEqual({ firstName: 'John', lastName: undefined });

    // --- Act: Set lastName ---
    await component.evaluate(node => { (node as any).lastName = 'Doe'; });
    state = await component.evaluate(node => {
        const inst = node as any;
        return {
            firstName: inst.firstName,
            lastName: inst.lastName,
            observerCallCount: inst.observerCallCount,
            observerLastArgs: inst.observerLastArgs
        };
    });

    expect(state.firstName).toBe('John');
    expect(state.lastName).toBe('Doe');
    expect(state.observerCallCount).toBe(2); // Observer called again
    expect(state.observerLastArgs).toEqual({ firstName: 'John', lastName: 'Doe' });

    // --- Act: Set firstName back to undefined ---
    await component.evaluate(node => { (node as any).firstName = undefined; });
    state = await component.evaluate(node => {
        const inst = node as any;
        return {
            firstName: inst.firstName,
            lastName: inst.lastName,
            observerCallCount: inst.observerCallCount,
            observerLastArgs: inst.observerLastArgs
        };
    });

    expect(state.firstName).toBeUndefined();
    expect(state.lastName).toBe('Doe');
    expect(state.observerCallCount).toBe(3); // Observer called even with undefined
    expect(state.observerLastArgs).toEqual({ firstName: undefined, lastName: 'Doe' });
});

test('TestComputedUndefinedBlocking: computed not calculated when properties are undefined by default', async ({ page }) => {
    const component = await setupComponentTest(page, 'test-computed-undefined-blocking');
    await expect(component).toBeVisible();

    // --- Initial state verification ---
    // Initially both firstName and lastName are undefined, so computed should NOT have been calculated
    let state = await component.evaluate(node => {
        const inst = node as any;
        return {
            firstName: inst.firstName,
            lastName: inst.lastName,
            fullName: inst.fullName,
            computeCallCount: inst.computeCallCount,
            computeLastArgs: inst.computeLastArgs
        };
    });

    expect(state.firstName).toBeUndefined();
    expect(state.lastName).toBeUndefined();
    expect(state.fullName).toBeUndefined(); // Computed property is undefined
    expect(state.computeCallCount).toBe(0); // Compute method not called because both deps are undefined
    expect(state.computeLastArgs).toBeNull();

    // --- Act: Set only firstName (lastName still undefined) ---
    await component.evaluate(node => { (node as any).firstName = 'John'; });
    state = await component.evaluate(node => {
        const inst = node as any;
        return {
            firstName: inst.firstName,
            lastName: inst.lastName,
            fullName: inst.fullName,
            computeCallCount: inst.computeCallCount,
            computeLastArgs: inst.computeLastArgs
        };
    });

    expect(state.firstName).toBe('John');
    expect(state.lastName).toBeUndefined();
    expect(state.fullName).toBeUndefined(); // Still undefined
    expect(state.computeCallCount).toBe(0); // Still not called because lastName is undefined
    expect(state.computeLastArgs).toBeNull();

    // --- Act: Set lastName (now both are defined) ---
    await component.evaluate(node => { (node as any).lastName = 'Doe'; });
    state = await component.evaluate(node => {
        const inst = node as any;
        return {
            firstName: inst.firstName,
            lastName: inst.lastName,
            fullName: inst.fullName,
            computeCallCount: inst.computeCallCount,
            computeLastArgs: inst.computeLastArgs
        };
    });

    expect(state.firstName).toBe('John');
    expect(state.lastName).toBe('Doe');
    expect(state.fullName).toBe('John Doe'); // Now calculated
    expect(state.computeCallCount).toBe(1); // Compute method called now that both are defined
    expect(state.computeLastArgs).toEqual({ firstName: 'John', lastName: 'Doe' });

    // --- Act: Change firstName (both still defined) ---
    await component.evaluate(node => { (node as any).firstName = 'Jane'; });
    state = await component.evaluate(node => {
        const inst = node as any;
        return {
            firstName: inst.firstName,
            lastName: inst.lastName,
            fullName: inst.fullName,
            computeCallCount: inst.computeCallCount,
            computeLastArgs: inst.computeLastArgs
        };
    });

    expect(state.firstName).toBe('Jane');
    expect(state.lastName).toBe('Doe');
    expect(state.fullName).toBe('Jane Doe');
    expect(state.computeCallCount).toBe(2); // Computed again
    expect(state.computeLastArgs).toEqual({ firstName: 'Jane', lastName: 'Doe' });
});

test('TestComputedAllowUndefined: computed calculated even when properties are undefined', async ({ page }) => {
    const component = await setupComponentTest(page, 'test-computed-allow-undefined');
    await expect(component).toBeVisible();

    // --- Initial state verification ---
    // With allowUndefined: true, but no properties have changed yet, so computed hasn't run
    let state = await component.evaluate(node => {
        const inst = node as any;
        return {
            firstName: inst.firstName,
            lastName: inst.lastName,
            fullName: inst.fullName,
            computeCallCount: inst.computeCallCount,
            computeLastArgs: inst.computeLastArgs
        };
    });

    expect(state.firstName).toBeUndefined();
    expect(state.lastName).toBeUndefined();
    expect(state.fullName).toBeUndefined(); // Not yet computed because no changes triggered it
    expect(state.computeCallCount).toBe(0); // Not yet called
    expect(state.computeLastArgs).toBeNull();

    // --- Act: Set only firstName (lastName still undefined) ---
    await component.evaluate(node => { (node as any).firstName = 'John'; });
    state = await component.evaluate(node => {
        const inst = node as any;
        return {
            firstName: inst.firstName,
            lastName: inst.lastName,
            fullName: inst.fullName,
            computeCallCount: inst.computeCallCount,
            computeLastArgs: inst.computeLastArgs
        };
    });

    expect(state.firstName).toBe('John');
    expect(state.lastName).toBeUndefined();
    expect(state.fullName).toBe('John'); // Computed with partial data
    expect(state.computeCallCount).toBe(1); // Computed for the first time
    expect(state.computeLastArgs).toEqual({ firstName: 'John', lastName: undefined });

    // --- Act: Set lastName ---
    await component.evaluate(node => { (node as any).lastName = 'Doe'; });
    state = await component.evaluate(node => {
        const inst = node as any;
        return {
            firstName: inst.firstName,
            lastName: inst.lastName,
            fullName: inst.fullName,
            computeCallCount: inst.computeCallCount,
            computeLastArgs: inst.computeLastArgs
        };
    });

    expect(state.firstName).toBe('John');
    expect(state.lastName).toBe('Doe');
    expect(state.fullName).toBe('John Doe');
    expect(state.computeCallCount).toBe(2); // Computed again
    expect(state.computeLastArgs).toEqual({ firstName: 'John', lastName: 'Doe' });

    // --- Act: Set firstName back to undefined ---
    await component.evaluate(node => { (node as any).firstName = undefined; });
    state = await component.evaluate(node => {
        const inst = node as any;
        return {
            firstName: inst.firstName,
            lastName: inst.lastName,
            fullName: inst.fullName,
            computeCallCount: inst.computeCallCount,
            computeLastArgs: inst.computeLastArgs
        };
    });

    expect(state.firstName).toBeUndefined();
    expect(state.lastName).toBe('Doe');
    expect(state.fullName).toBe('Doe'); // Computed even with undefined
    expect(state.computeCallCount).toBe(3); // Computed again
    expect(state.computeLastArgs).toEqual({ firstName: undefined, lastName: 'Doe' });
});

test('TestObserverPropertyPrototype: @observer on properties with prototype method reference', async ({ page}) => {
    const component = await setupComponentTest(page, 'test-observer-property-prototype');
    await expect(component).toBeVisible();

    // --- Initial state verification ---
    await expect(component.locator('#counter')).toContainText('1');
    await expect(component.locator('#name')).toContainText('initial');
    await expect(component.locator('#counter-changes')).toContainText('1'); // Called once on initialization
    await expect(component.locator('#name-changes')).toContainText('1'); // Called once on initialization

    let state = await component.evaluate(node => {
        const inst = node as any;
        return {
            counter: inst.counter,
            name: inst.name,
            counterChangeCallCount: inst.counterChangeCallCount,
            counterChangeLastArgs: inst.counterChangeLastArgs,
            counterChangeThisContext: inst.counterChangeThisContext,
            nameChangeCallCount: inst.nameChangeCallCount,
            nameChangeLastArgs: inst.nameChangeLastArgs
        };
    });

    expect(state.counter).toBe(1);
    expect(state.name).toBe('initial');
    expect(state.counterChangeCallCount).toBe(1);
    expect(state.counterChangeLastArgs).toEqual({ newValue: 1, oldValue: undefined });
    // Verify that `this` refers to the component instance
    expect(state.counterChangeThisContext).not.toBeNull();
    expect(state.nameChangeCallCount).toBe(1);
    expect(state.nameChangeLastArgs).toEqual({ newValue: 'initial', oldValue: undefined });

    // --- Act: Change counter property ---
    await component.evaluate(node => { (node as any).counter = 5; });
    await expect(component.locator('#counter')).toContainText('5');
    await expect(component.locator('#counter-changes')).toContainText('2');

    let counterState = await component.evaluate(node => {
        const inst = node as any;
        return {
            counter: inst.counter,
            counterChangeCallCount: inst.counterChangeCallCount,
            counterChangeLastArgs: inst.counterChangeLastArgs,
            counterChangeThisContext: inst.counterChangeThisContext
        };
    });

    expect(counterState.counter).toBe(5);
    expect(counterState.counterChangeCallCount).toBe(2);
    expect(counterState.counterChangeLastArgs).toEqual({ newValue: 5, oldValue: 1 });
    // Verify `this` context is still correct
    expect(counterState.counterChangeThisContext).not.toBeNull();

    // --- Act: Change name property ---
    await component.evaluate(node => { (node as any).name = 'updated'; });
    await expect(component.locator('#name')).toContainText('updated');
    await expect(component.locator('#name-changes')).toContainText('2');

    let nameState = await component.evaluate(node => {
        const inst = node as any;
        return {
            name: inst.name,
            nameChangeCallCount: inst.nameChangeCallCount,
            nameChangeLastArgs: inst.nameChangeLastArgs
        };
    });

    expect(nameState.name).toBe('updated');
    expect(nameState.nameChangeCallCount).toBe(2);
    expect(nameState.nameChangeLastArgs).toEqual({ newValue: 'updated', oldValue: 'initial' });
});

test('TestObserverPropertyInline: @observer on properties with inline functions', async ({ page }) => {
    const component = await setupComponentTest(page, 'test-observer-property-inline');
    await expect(component).toBeVisible();

    // --- Initial state verification ---
    await expect(component.locator('#counter')).toContainText('1');
    await expect(component.locator('#name')).toContainText('initial');
    await expect(component.locator('#counter-changes')).toContainText('1'); // Called once on initialization
    await expect(component.locator('#name-changes')).toContainText('1'); // Called once on initialization

    let state = await component.evaluate(node => {
        const inst = node as any;
        return {
            counter: inst.counter,
            name: inst.name,
            counterChangeCallCount: inst.counterChangeCallCount,
            counterChangeLastArgs: inst.counterChangeLastArgs,
            counterChangeThisContext: inst.counterChangeThisContext,
            nameChangeCallCount: inst.nameChangeCallCount,
            nameChangeLastArgs: inst.nameChangeLastArgs
        };
    });

    expect(state.counter).toBe(1);
    expect(state.name).toBe('initial');
    expect(state.counterChangeCallCount).toBe(1);
    expect(state.counterChangeLastArgs).toEqual({ newValue: 1, oldValue: undefined });
    // Verify that `this` refers to the component instance (inline function should preserve context)
    expect(state.counterChangeThisContext).not.toBeNull();
    expect(state.nameChangeCallCount).toBe(1);
    expect(state.nameChangeLastArgs).toEqual({ newValue: 'initial', oldValue: undefined });

    // --- Act: Change counter property ---
    await component.evaluate(node => { (node as any).counter = 5; });
    await expect(component.locator('#counter')).toContainText('5');
    await expect(component.locator('#counter-changes')).toContainText('2');

    let counterState = await component.evaluate(node => {
        const inst = node as any;
        return {
            counter: inst.counter,
            counterChangeCallCount: inst.counterChangeCallCount,
            counterChangeLastArgs: inst.counterChangeLastArgs,
            counterChangeThisContext: inst.counterChangeThisContext
        };
    });

    expect(counterState.counter).toBe(5);
    expect(counterState.counterChangeCallCount).toBe(2);
    expect(counterState.counterChangeLastArgs).toEqual({ newValue: 5, oldValue: 1 });
    // Verify `this` context is still correct with inline function
    expect(counterState.counterChangeThisContext).not.toBeNull();

    // --- Act: Change name property ---
    await component.evaluate(node => { (node as any).name = 'updated'; });
    await expect(component.locator('#name')).toContainText('updated');
    await expect(component.locator('#name-changes')).toContainText('2');

    let nameState = await component.evaluate(node => {
        const inst = node as any;
        return {
            name: inst.name,
            nameChangeCallCount: inst.nameChangeCallCount,
            nameChangeLastArgs: inst.nameChangeLastArgs
        };
    });

    expect(nameState.name).toBe('updated');
    expect(nameState.nameChangeCallCount).toBe(2);
    expect(nameState.nameChangeLastArgs).toEqual({ newValue: 'updated', oldValue: 'initial' });
});

test('TestKeybindingInput: delete/insert keys should not trigger keybinding when in input field', async ({ page }) => {
    const component = await setupComponentTest(page, 'test-keybinding-input');
    await expect(component).toBeVisible();

    const input = component.locator('input');

    // --- Initial state verification ---
    let state = await component.evaluate(node => {
        const inst = node as any;
        return {
            deleteCallCount: inst.deleteCallCount,
            insertCallCount: inst.insertCallCount
        };
    });
    expect(state.deleteCallCount).toBe(0);
    expect(state.insertCallCount).toBe(0);

    // --- Act: Press Delete outside of input (should trigger keybinding) ---
    await component.press('Delete');
    state = await component.evaluate(node => {
        const inst = node as any;
        return {
            deleteCallCount: inst.deleteCallCount,
            insertCallCount: inst.insertCallCount
        };
    });
    expect(state.deleteCallCount).toBe(1);

    // --- Act: Type in input and press Delete (should NOT trigger keybinding) ---
    await input.fill('123');
    await expect(input).toHaveValue('123');

    // Focus input and move caret to beginning
    await input.focus();
    await page.keyboard.press('Home');

    // Press Delete - should delete first character, not trigger keybinding
    await page.keyboard.press('Delete');

    // Verify character was deleted (value should be '23')
    await expect(input).toHaveValue('23');

    // Verify keybinding was NOT triggered again
    state = await component.evaluate(node => {
        const inst = node as any;
        return {
            deleteCallCount: inst.deleteCallCount,
            insertCallCount: inst.insertCallCount
        };
    });
    expect(state.deleteCallCount).toBe(1); // Still 1, not incremented

    // --- Act: Press Insert in input (should NOT trigger keybinding) ---
    await page.keyboard.press('Insert');
    state = await component.evaluate(node => {
        const inst = node as any;
        return {
            deleteCallCount: inst.deleteCallCount,
            insertCallCount: inst.insertCallCount
        };
    });
    expect(state.insertCallCount).toBe(0); // Should NOT have been triggered

    // --- Act: Press Insert outside of input (should trigger keybinding) ---
    await component.focus();
    await component.press('Insert');
    state = await component.evaluate(node => {
        const inst = node as any;
        return {
            deleteCallCount: inst.deleteCallCount,
            insertCallCount: inst.insertCallCount
        };
    });
    expect(state.insertCallCount).toBe(1); // Now should be triggered
});

test('TestKeybinding: @keybinding decorator with keyboard shortcuts', async ({ page }) => {
    const component = await setupComponentTest(page, 'test-keybinding');
    await expect(component).toBeVisible();

    // --- Initial state verification ---
    let state = await component.evaluate(node => {
        const inst = node as any;
        return {
            escapeCallCount: inst.escapeCallCount,
            ctrlSCallCount: inst.ctrlSCallCount,
            altKCallCount: inst.altKCallCount,
            shiftEnterCallCount: inst.shiftEnterCallCount,
            lastEvent: inst.lastEvent
        };
    });
    expect(state.escapeCallCount).toBe(0);
    expect(state.ctrlSCallCount).toBe(0);
    expect(state.altKCallCount).toBe(0);
    expect(state.shiftEnterCallCount).toBe(0);
    expect(state.lastEvent).toBeNull();

    // --- Act: Press Escape key ---
    await component.press('Escape');
    await expect(component.locator('#escape-count')).toContainText('1');
    state = await component.evaluate(node => {
        const inst = node as any;
        return {
            escapeCallCount: inst.escapeCallCount,
            ctrlSCallCount: inst.ctrlSCallCount,
            altKCallCount: inst.altKCallCount,
            shiftEnterCallCount: inst.shiftEnterCallCount,
            lastEvent: inst.lastEvent
        };
    });
    expect(state.escapeCallCount).toBe(1);
    expect(state.lastEvent).not.toBeNull();

    // --- Act: Press Ctrl+S ---
    await component.press('Control+s');
    await expect(component.locator('#ctrl-s-count')).toContainText('1');
    state = await component.evaluate(node => {
        const inst = node as any;
        return {
            escapeCallCount: inst.escapeCallCount,
            ctrlSCallCount: inst.ctrlSCallCount,
            altKCallCount: inst.altKCallCount,
            shiftEnterCallCount: inst.shiftEnterCallCount,
            lastEvent: inst.lastEvent
        };
    });
    expect(state.escapeCallCount).toBe(1);
    expect(state.ctrlSCallCount).toBe(1);

    // --- Act: Press Alt+K ---
    await component.press('Alt+k');
    await expect(component.locator('#alt-k-count')).toContainText('1');
    state = await component.evaluate(node => {
        const inst = node as any;
        return {
            escapeCallCount: inst.escapeCallCount,
            ctrlSCallCount: inst.ctrlSCallCount,
            altKCallCount: inst.altKCallCount,
            shiftEnterCallCount: inst.shiftEnterCallCount,
            lastEvent: inst.lastEvent
        };
    });
    expect(state.escapeCallCount).toBe(1);
    expect(state.ctrlSCallCount).toBe(1);
    expect(state.altKCallCount).toBe(1);

    // --- Act: Press Shift+Enter ---
    await component.press('Shift+Enter');
    await expect(component.locator('#shift-enter-count')).toContainText('1');
    state = await component.evaluate(node => {
        const inst = node as any;
        return {
            escapeCallCount: inst.escapeCallCount,
            ctrlSCallCount: inst.ctrlSCallCount,
            altKCallCount: inst.altKCallCount,
            shiftEnterCallCount: inst.shiftEnterCallCount,
            lastEvent: inst.lastEvent
        };
    });
    expect(state.escapeCallCount).toBe(1);
    expect(state.ctrlSCallCount).toBe(1);
    expect(state.altKCallCount).toBe(1);
    expect(state.shiftEnterCallCount).toBe(1);

    // --- Act: Press Escape again to verify it increments ---
    await component.press('Escape');
    await expect(component.locator('#escape-count')).toContainText('2');
    state = await component.evaluate(node => {
        const inst = node as any;
        return {
            escapeCallCount: inst.escapeCallCount,
            ctrlSCallCount: inst.ctrlSCallCount,
            altKCallCount: inst.altKCallCount,
            shiftEnterCallCount: inst.shiftEnterCallCount,
            lastEvent: inst.lastEvent
        };
    });
    expect(state.escapeCallCount).toBe(2);
});

test('TestTranslations: component-specific translations with fallback to global', async ({ page }) => {
    const component = await setupComponentTest(page, 'test-translations');
    await expect(component).toBeVisible();

    // Create mock service with Observable support
    await component.evaluate(node => {
        const inst = node as any;
        inst.setMockService('en', { 'OK': 'Global OK', 'Cancel': 'Global Cancel' });
    });

    // Wait for component to update with service
    await page.waitForTimeout(100);

    // --- Initial state verification (English culture) ---
    await expect(component.locator('#title')).toContainText('Custom Title in English');
    await expect(component.locator('#submit')).toContainText('Submit');
    await expect(component.locator('#cancel')).toContainText('Cancel');
    await expect(component.locator('#ok-button')).toContainText('Global OK'); // Fallback to global
    await expect(component.locator('#missing')).toContainText('[[NonExistentKey]]'); // Missing translation

    // --- Act: Change culture to Dutch ---
    await component.evaluate(node => {
        const inst = node as any;
        inst.service.language.culture = 'nl';
        inst.service.language.messages = { 'OK': 'OK (NL)', 'Cancel': 'Annuleer (NL)' };
        inst.requestUpdate();
    });

    await page.waitForTimeout(100);

    // --- Verification: Dutch translations should be used ---
    await expect(component.locator('#title')).toContainText('Aangepaste Titel in het Nederlands');
    await expect(component.locator('#submit')).toContainText('Verzenden');
    await expect(component.locator('#cancel')).toContainText('Annuleren');
    await expect(component.locator('#ok-button')).toContainText('OK (NL)'); // Fallback to global Dutch

    // --- Act: Change culture to French ---
    await component.evaluate(node => {
        const inst = node as any;
        inst.service.language.culture = 'fr';
        inst.service.language.messages = { 'OK': 'OK (FR)' };
        inst.requestUpdate();
    });

    await page.waitForTimeout(100);

    // --- Verification: French translations should be used ---
    await expect(component.locator('#title')).toContainText('Titre personnalisé en français');
    await expect(component.locator('#submit')).toContainText('Soumettre');
    await expect(component.locator('#cancel')).toContainText('Annuler');
    await expect(component.locator('#ok-button')).toContainText('OK (FR)');
});

test('TestTranslations: updates when service.language.messages or culture changes via Observable', async ({ page }) => {
    const component = await setupComponentTest(page, 'test-translations');
    await expect(component).toBeVisible();

    // Create mock service with Observable support using helper method
    await component.evaluate((node) => {
        const inst = node as any;
        inst.setMockService('en', { 'OK': 'Original OK' });
    });

    await page.waitForTimeout(100);

    // --- Initial state verification (English culture) ---
    await expect(component.locator('#title')).toContainText('Custom Title in English');
    await expect(component.locator('#submit')).toContainText('Submit');
    await expect(component.locator('#ok-button')).toContainText('Original OK');

    // --- Act: Change only service.language.messages (via Observable setter) ---
    await component.evaluate(node => {
        const inst = node as any;
        inst.service.language.messages = {
            'OK': 'Updated OK',
            'Cancel': 'Updated Cancel'
        };
    });

    await page.waitForTimeout(100);

    // --- Verification: Should update to new messages ---
    await expect(component.locator('#title')).toContainText('Custom Title in English'); // Component translation unchanged
    await expect(component.locator('#ok-button')).toContainText('Updated OK'); // Global translation updated

    // --- Act: Change culture to Dutch (via Observable setter) ---
    // When culture changes, messages should also change to trigger the observer
    await component.evaluate(node => {
        const inst = node as any;
        // Change culture first
        inst.service.language.culture = 'nl';
        // Then update messages to match the new culture (simulating real behavior)
        inst.service.language.messages = { 'OK': 'OK (NL)' };
    });

    await page.waitForTimeout(100);

    // --- Verification: Should update to Dutch translations ---
    await expect(component.locator('#title')).toContainText('Aangepaste Titel in het Nederlands');
    await expect(component.locator('#submit')).toContainText('Verzenden');
    await expect(component.locator('#cancel')).toContainText('Annuleren');
    await expect(component.locator('#ok-button')).toContainText('OK (NL)');

    // --- Act: Change culture to French ---
    await component.evaluate(node => {
        const inst = node as any;
        inst.service.language.culture = 'fr';
        inst.service.language.messages = { 'OK': 'OK (FR)' };
    });

    await page.waitForTimeout(100);

    // --- Verification: Should update to French translations ---
    await expect(component.locator('#title')).toContainText('Titre personnalisé en français');
    await expect(component.locator('#submit')).toContainText('Soumettre');
    await expect(component.locator('#cancel')).toContainText('Annuler');
    await expect(component.locator('#ok-button')).toContainText('OK (FR)');
});

test('TestDecoratorInheritance: derived class overrides base class @observer and @computed', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            const text = msg.text();
            if (text.includes('test-decorator-inheritance')) {
                consoleErrors.push(text);
            }
        }
    });

    const component = await setupComponentTest(page, 'test-decorator-inheritance', {
        beforeWait: async () => {
            await page.evaluate(() => {
                (window as any).registerDecoratorInheritanceComponents();
            });
        }
    });
    await expect(component).toBeVisible();

    // --- Verification: Console errors should be logged during registration ---
    // Wait a bit for registration to complete and errors to be logged
    await page.waitForTimeout(100);

    // Should have 2 console errors: one for property observer conflict, one for computed property conflict
    expect(consoleErrors.length).toBeGreaterThanOrEqual(2);

    // Verify error messages contain the expected text
    const hasPropertyObserverError = consoleErrors.some(err =>
        err.includes('Property observer conflict') && err.includes('value')
    );
    const hasComputedPropertyError = consoleErrors.some(err =>
        err.includes('Computed property conflict') && err.includes('displayName')
    );

    expect(hasPropertyObserverError).toBe(true);
    expect(hasComputedPropertyError).toBe(true);

    // --- Initial state verification ---
    await expect(component.locator('#display-name')).toContainText('Derived: John Doe');
    await expect(component.locator('#value')).toContainText('initial');

    let state = await component.evaluate(node => {
        const inst = node as any;
        return {
            firstName: inst.firstName,
            lastName: inst.lastName,
            value: inst.value,
            displayName: inst.displayName,
            baseValueObserverCallCount: inst.baseValueObserverCallCount,
            derivedValueObserverCallCount: inst.derivedValueObserverCallCount,
            baseComputedCallCount: inst.baseComputedCallCount,
            derivedComputedCallCount: inst.derivedComputedCallCount
        };
    });

    expect(state.firstName).toBe('John');
    expect(state.lastName).toBe('Doe');
    expect(state.value).toBe('initial');
    expect(state.displayName).toBe('Derived: John Doe');

    // CRITICAL: Only derived class observers/computed should run, NOT base class
    expect(state.baseValueObserverCallCount).toBe(0); // Base observer should NOT run
    expect(state.derivedValueObserverCallCount).toBe(1); // Derived observer should run
    expect(state.baseComputedCallCount).toBe(0); // Base computed should NOT run
    expect(state.derivedComputedCallCount).toBeGreaterThanOrEqual(1); // Derived computed should run

    // --- Act: Change value property ---
    await component.evaluate(node => { (node as any).value = 'updated'; });
    await expect(component.locator('#value')).toContainText('updated');

    const valueState = await component.evaluate(node => {
        const inst = node as any;
        return {
            value: inst.value,
            baseValueObserverCallCount: inst.baseValueObserverCallCount,
            derivedValueObserverCallCount: inst.derivedValueObserverCallCount
        };
    });

    expect(valueState.value).toBe('updated');
    expect(valueState.baseValueObserverCallCount).toBe(0); // Base observer should still NOT run
    expect(valueState.derivedValueObserverCallCount).toBe(2); // Derived observer should run again

    // --- Act: Change firstName to trigger computed property ---
    const initialDerivedComputedCount = await component.evaluate(node => (node as any).derivedComputedCallCount);
    await component.evaluate(node => { (node as any).firstName = 'Jane'; });
    await expect(component.locator('#display-name')).toContainText('Derived: Jane Doe');

    const computedState = await component.evaluate(node => {
        const inst = node as any;
        return {
            firstName: inst.firstName,
            displayName: inst.displayName,
            baseComputedCallCount: inst.baseComputedCallCount,
            derivedComputedCallCount: inst.derivedComputedCallCount
        };
    });

    expect(computedState.firstName).toBe('Jane');
    expect(computedState.displayName).toBe('Derived: Jane Doe');
    expect(computedState.baseComputedCallCount).toBe(0); // Base computed should still NOT run
    expect(computedState.derivedComputedCallCount).toBeGreaterThan(initialDerivedComputedCount); // Derived computed should run again
});

test('TestComputedDeepInheritance: child inherits computed properties from grandparent through unregistered parent', async ({ page }) => {
    const component = await setupComponentTest(page, 'test-computed-deep-inheritance');
    await expect(component).toBeVisible();

    // --- Initial state verification ---
    // The child component should inherit computed properties from grandparent
    // even though the parent class was never registered
    await expect(component.locator('#full-name')).toContainText('John Doe');
    await expect(component.locator('#active')).toContainText('active');

    let state = await component.evaluate(node => {
        const inst = node as any;
        return {
            firstName: inst.firstName,
            lastName: inst.lastName,
            fullName: inst.fullName,
            isActive: inst.isActive,
            active: inst.active,
            computeCallCount: inst.computeCallCount
        };
    });

    expect(state.firstName).toBe('John');
    expect(state.lastName).toBe('Doe');
    expect(state.fullName).toBe('John Doe');
    expect(state.isActive).toBe(true);
    expect(state.active).toBe(true);
    expect(state.computeCallCount).toBeGreaterThanOrEqual(1); // Computed function should have been called

    // --- Act: Change firstName ---
    const initialComputeCount = state.computeCallCount;
    await component.evaluate(node => { (node as any).firstName = 'Jane'; });
    await expect(component.locator('#full-name')).toContainText('Jane Doe');

    const nameState = await component.evaluate(node => {
        const inst = node as any;
        return {
            firstName: inst.firstName,
            lastName: inst.lastName,
            fullName: inst.fullName,
            computeCallCount: inst.computeCallCount
        };
    });

    expect(nameState.firstName).toBe('Jane');
    expect(nameState.lastName).toBe('Doe');
    expect(nameState.fullName).toBe('Jane Doe');
    expect(nameState.computeCallCount).toBeGreaterThan(initialComputeCount); // Should have recomputed

    // --- Act: Change isActive ---
    await component.evaluate(node => { (node as any).isActive = false; });
    await expect(component.locator('#active')).toContainText('inactive');

    const activeState = await component.evaluate(node => {
        const inst = node as any;
        return {
            isActive: inst.isActive,
            active: inst.active
        };
    });

    expect(activeState.isActive).toBe(false);
    expect(activeState.active).toBe(false);
});

test('TestObserverDeepInheritance: child inherits observers from grandparent through unregistered parent', async ({ page }) => {
    const component = await setupComponentTest(page, 'test-observer-deep-inheritance');
    await expect(component).toBeVisible();

    // --- Initial state verification ---
    // The child component should inherit observers from grandparent and parent
    await expect(component.locator('#first-name')).toContainText('John');
    await expect(component.locator('#age')).toContainText('30');
    await expect(component.locator('#email')).toContainText('john@example.com');

    let state = await component.evaluate(node => {
        const inst = node as any;
        return {
            firstName: inst.firstName,
            age: inst.age,
            email: inst.email,
            firstNameObserverCallCount: inst.firstNameObserverCallCount,
            ageObserverCallCount: inst.ageObserverCallCount,
            emailObserverCallCount: inst.emailObserverCallCount
        };
    });

    expect(state.firstName).toBe('John');
    expect(state.age).toBe(30);
    expect(state.email).toBe('john@example.com');
    // All observers should have been called at least once during initialization
    expect(state.firstNameObserverCallCount).toBeGreaterThanOrEqual(1);
    expect(state.ageObserverCallCount).toBeGreaterThanOrEqual(1);
    expect(state.emailObserverCallCount).toBeGreaterThanOrEqual(1);

    // --- Act: Change firstName (has observer from grandparent) ---
    const initialFirstNameCount = state.firstNameObserverCallCount;
    await component.evaluate(node => { (node as any).firstName = 'Jane'; });
    await expect(component.locator('#first-name')).toContainText('Jane');

    const firstNameState = await component.evaluate(node => {
        const inst = node as any;
        return {
            firstName: inst.firstName,
            firstNameObserverCallCount: inst.firstNameObserverCallCount
        };
    });

    expect(firstNameState.firstName).toBe('Jane');
    expect(firstNameState.firstNameObserverCallCount).toBeGreaterThan(initialFirstNameCount); // Observer should have fired

    // --- Act: Change age (has observer from parent) ---
    const initialAgeCount = state.ageObserverCallCount;
    await component.evaluate(node => { (node as any).age = 35; });
    await expect(component.locator('#age')).toContainText('35');

    const ageState = await component.evaluate(node => {
        const inst = node as any;
        return {
            age: inst.age,
            ageObserverCallCount: inst.ageObserverCallCount
        };
    });

    expect(ageState.age).toBe(35);
    expect(ageState.ageObserverCallCount).toBeGreaterThan(initialAgeCount); // Observer should have fired

    // --- Act: Change email (has observer from child) ---
    const initialEmailCount = state.emailObserverCallCount;
    await component.evaluate(node => { (node as any).email = 'jane@example.com'; });
    await expect(component.locator('#email')).toContainText('jane@example.com');

    const emailState = await component.evaluate(node => {
        const inst = node as any;
        return {
            email: inst.email,
            emailObserverCallCount: inst.emailObserverCallCount
        };
    });

    expect(emailState.email).toBe('jane@example.com');
    expect(emailState.emailObserverCallCount).toBeGreaterThan(initialEmailCount); // Observer should have fired
});

test('TestSiblingInheritance: two children from same parent both inherit correctly without pollution', async ({ page }) => {
    // Test Child1 first
    const child1 = await setupComponentTest(page, 'test-sibling-child1');
    await expect(child1).toBeVisible();

    await expect(child1.locator('#full-name')).toContainText('John Doe');
    await expect(child1.locator('#age-display')).toContainText('Age: 30');
    await expect(child1.locator('#child-prop')).toContainText('child1');

    let child1State = await child1.evaluate(node => {
        const inst = node as any;
        return {
            fullName: inst.fullName,
            ageDisplay: inst.ageDisplay,
            childProp: inst.child1Prop,
            firstNameChangedCount: inst.firstNameChangedCount
        };
    });

    expect(child1State.fullName).toBe('John Doe');
    expect(child1State.ageDisplay).toBe('Age: 30');
    expect(child1State.childProp).toBe('child1');
    expect(child1State.firstNameChangedCount).toBeGreaterThanOrEqual(1);

    // Change firstName on Child1 to trigger observer
    const initialChild1Count = child1State.firstNameChangedCount;
    await child1.evaluate(node => { (node as any).firstName = 'Jane'; });
    await expect(child1.locator('#full-name')).toContainText('Jane Doe');

    const child1AfterChange = await child1.evaluate(node => {
        const inst = node as any;
        return {
            fullName: inst.fullName,
            firstNameChangedCount: inst.firstNameChangedCount
        };
    });

    expect(child1AfterChange.fullName).toBe('Jane Doe');
    expect(child1AfterChange.firstNameChangedCount).toBeGreaterThan(initialChild1Count);

    // Now test Child2 - it should have the SAME inherited properties working correctly
    // This verifies that registering Child1 didn't pollute the parent configs
    const child2 = await setupComponentTest(page, 'test-sibling-child2');
    await expect(child2).toBeVisible();

    await expect(child2.locator('#full-name')).toContainText('John Doe');
    await expect(child2.locator('#age-display')).toContainText('Age: 30');
    await expect(child2.locator('#child-prop')).toContainText('child2');

    let child2State = await child2.evaluate(node => {
        const inst = node as any;
        return {
            fullName: inst.fullName,
            ageDisplay: inst.ageDisplay,
            childProp: inst.child2Prop,
            firstNameChangedCount: inst.firstNameChangedCount
        };
    });

    expect(child2State.fullName).toBe('John Doe');
    expect(child2State.ageDisplay).toBe('Age: 30');
    expect(child2State.childProp).toBe('child2');
    expect(child2State.firstNameChangedCount).toBeGreaterThanOrEqual(1);

    // Change firstName on Child2 to trigger observer
    const initialChild2Count = child2State.firstNameChangedCount;
    await child2.evaluate(node => { (node as any).firstName = 'Alice'; });
    await expect(child2.locator('#full-name')).toContainText('Alice Doe');

    const child2AfterChange = await child2.evaluate(node => {
        const inst = node as any;
        return {
            fullName: inst.fullName,
            firstNameChangedCount: inst.firstNameChangedCount
        };
    });

    expect(child2AfterChange.fullName).toBe('Alice Doe');
    expect(child2AfterChange.firstNameChangedCount).toBeGreaterThan(initialChild2Count);

    // Success! Both children inherited the same configs from their shared parent correctly
    // This confirms that registering Child1 didn't pollute or modify the parent's configs
    // and Child2 was able to independently collect the same configs
});