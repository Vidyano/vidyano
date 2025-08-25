import { Page, Locator } from '@playwright/test';

export async function navigateToPage(
    page: Page,
    url: string
): Promise<void> {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    
    // Wait for the page to stabilize
    await page.waitForTimeout(1000);
}

export async function getActionButtons(page: Page): Promise<Record<string, Locator>> {
    // Find all action buttons on the page
    const actionButtons = await page.evaluateHandle(() => {
        const buttons: Record<string, HTMLElement> = {};
        
        // Function to recursively search for action buttons in shadow DOM
        const findActionButtons = (root: Document | ShadowRoot) => {
            const found = root.querySelectorAll('vi-action-button[name]');
            found.forEach((button: Element) => {
                const name = button.getAttribute('name');
                if (name) {
                    buttons[name] = button as HTMLElement;
                }
            });
            
            // Search in shadow roots
            const elementsWithShadow = root.querySelectorAll('*');
            elementsWithShadow.forEach(el => {
                if (el.shadowRoot) {
                    findActionButtons(el.shadowRoot);
                }
            });
        };
        
        findActionButtons(document);
        return buttons;
    });
    
    const buttonNames = await actionButtons.evaluate(btns => Object.keys(btns));
    await actionButtons.dispose();
    
    // Create locators for each action button
    const actions: Record<string, Locator> = {};
    for (const name of buttonNames) {
        // Mark each button with a data attribute for easy selection
        await page.evaluate((actionName) => {
            const findButton = (root: Document | ShadowRoot): Element | null => {
                const button = root.querySelector(`vi-action-button[name="${actionName}"]`);
                if (button) return button;
                
                const elementsWithShadow = root.querySelectorAll('*');
                for (const el of elementsWithShadow) {
                    if (el.shadowRoot) {
                        const found = findButton(el.shadowRoot);
                        if (found) return found;
                    }
                }
                return null;
            };
            
            const button = findButton(document);
            if (button) {
                button.setAttribute('data-test-action', actionName);
            }
        }, name);
        
        actions[name] = page.locator(`[data-test-action="${name}"]`);
    }
    
    return actions;
}

export async function getAttribute(
    page: Page,
    attributeName: string
): Promise<Locator> {
    // 1) Find the presenter by attribute. (CSS pierces shadow roots.)
    const presenter = page.locator(
        `vi-persistent-object-attribute-presenter[name="${attributeName}"]`
    ).first();

    // 2) Make sure it exists and is scrolled into view (helps with virtual scrollers).
    await presenter.waitFor({ state: 'attached' });
    await presenter.scrollIntoViewIfNeeded();

    // 3) Grab its first direct child (tweak if you need something more specific).
    const attributeElement = presenter.locator(':scope > *').first();
    await attributeElement.waitFor({ state: 'visible' });

    return attributeElement;
}