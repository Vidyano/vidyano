import { test, expect, Page, Locator } from '@playwright/test';

async function setupComponentTest(page: Page, componentTag: string) {
    await page.addScriptTag({ path: "/workspaces/VidyanoWeb3/dev/wwwroot/index.js", type: 'module' });

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

async function getComponentState(component: Locator) {
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
    let state = await getComponentState(component);

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
    state = await getComponentState(component);

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
    state = await getComponentState(component);

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