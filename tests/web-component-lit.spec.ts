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

test('TestAsyncComputed: basic async computed property', async ({ page }) => {
    const component = await setupComponentTest(page, 'test-async-computed');
    await expect(component).toBeVisible();

    // --- Initial state verification ---
    await expect(component.locator('#input')).toContainText('initial');
    await expect(component.locator('#computed')).toContainText('Loading...'); // Initial render before promise resolves

    // Wait for the async computation to complete
    await expect(component.locator('#computed')).toContainText('Computed: initial', { timeout: 2000 });

    let state = await component.evaluate(node => ({
        inputValue: (node as any).inputValue,
        computedAsyncValue: (node as any).computedAsyncValue
    }));
    expect(state.inputValue).toBe("initial");
    expect(state.computedAsyncValue).toBe("Computed: initial");

    // --- Act: Change inputValue property ---
    await component.evaluate((node: any) => { node.inputValue = "updated"; });
    await expect(component.locator('#input')).toContainText('updated');
    // The computed value should revert to 'Loading...' or the old value briefly,
    // then update after the new promise resolves.
    // Depending on timing, it might briefly show the old resolved value or "Loading..."
    // We will wait for the final state.
    await expect(component.locator('#computed')).toContainText('Computed: updated', { timeout: 2000 });

    state = await component.evaluate(node => ({
        inputValue: (node as any).inputValue,
        computedAsyncValue: (node as any).computedAsyncValue
    }));
    expect(state.inputValue).toBe("updated");
    expect(state.computedAsyncValue).toBe("Computed: updated");
});

test('TestAsyncComputed: ignore stale async result', async ({ page }) => {
    const component = await setupComponentTest(page, 'test-async-computed');
    await expect(component).toBeVisible();

    // --- Initial state verification ---
    await expect(component.locator('#input')).toContainText('initial');
    // Wait for the initial computation
    await expect(component.locator('#computed')).toContainText('Computed: initial', { timeout: 2000 });

    // --- Act: Trigger two changes in quick succession ---
    // Change 1: inputValue = "first" (will take 1s)
    await component.evaluate((node: any) => { node.inputValue = "first"; });
    await expect(component.locator('#input')).toContainText('first');
    // The computed value might show "Loading..." or "Computed: initial"

    // Change 2: inputValue = "second" (will take 1s, started shortly after "first")
    // We introduce a very small delay to ensure the first evaluation starts
    await page.waitForTimeout(50); // 50ms delay
    await component.evaluate((node: any) => { node.inputValue = "second"; });
    await expect(component.locator('#input')).toContainText('second');
    // The computed value might show "Loading..." or "Computed: first" or "Computed: initial"

    // --- Verification ---
    // We expect the component to eventually settle on the result of the "second" computation,
    // ignoring the result from the "first" computation.
    // The "first" promise (resolving to "Computed: first") should be ignored.
    // The "second" promise (resolving to "Computed: second") should be the final state.
    await expect(component.locator('#computed')).toContainText('Computed: second', { timeout: 2500 }); // Allow enough time for both to "try" to resolve

    const finalState = await component.evaluate(node => ({
        inputValue: (node as any).inputValue,
        computedAsyncValue: (node as any).computedAsyncValue
    }));
    expect(finalState.inputValue).toBe("second");
    expect(finalState.computedAsyncValue).toBe("Computed: second");

    // To be absolutely sure the "first" value didn't sneak in later, wait a bit more
    await page.waitForTimeout(1000); // Wait for the first promise's timeout duration
    const stateAfterWaiting = await component.evaluate(node => ({
        computedAsyncValue: (node as any).computedAsyncValue
    }));
    expect(stateAfterWaiting.computedAsyncValue).toBe("Computed: second");
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
