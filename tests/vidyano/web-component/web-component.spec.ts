import { test, expect, Page, Locator } from '@playwright/test';

async function setupComponentTest(page: Page, componentTag: string) {
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

test('TestObserveFunction: @observe with function reference', async ({ page}) => {
    const component = await setupComponentTest(page, 'test-observe-function');
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

test('TestObserveInline: @observe with inline functions', async ({ page }) => {
    const component = await setupComponentTest(page, 'test-observe-inline');
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