import { html } from "lit";
import { property } from "lit/decorators.js";
import { WebComponent, observer, computed } from "../../../src/vidyano/web-components/web-component/web-component.js";

// Base class with observers and computed properties
class BaseComponent extends WebComponent {
    @property({ type: String })
    firstName: string = "John";

    @property({ type: String })
    lastName: string = "Doe";

    @property({ type: String })
    @observer(function(this: BaseComponent, newValue: string, oldValue: string) {
        this.baseValueObserverCallCount++;
        this.baseValueObserverLastArgs = { newValue, oldValue };
    })
    value: string;

    @property({ type: String })
    @computed(function(this: BaseComponent, firstName: string, lastName: string): string {
        this.baseComputedCallCount++;
        this.baseComputedLastArgs = { firstName, lastName };
        return `Base: ${firstName} ${lastName}`;
    }, "firstName", "lastName")
    declare readonly displayName: string;

    // Tracking properties
    baseValueObserverCallCount: number = 0;
    baseValueObserverLastArgs: { newValue?: string, oldValue?: string } | null = null;
    baseComputedCallCount: number = 0;
    baseComputedLastArgs: { firstName?: string, lastName?: string } | null = null;

    constructor() {
        super();
        this.value = "initial";
    }

    render() {
        return html`
            <p>Base Component</p>
            <div id="display-name">${this.displayName}</div>
            <div id="value">${this.value}</div>
            <div id="base-observer-count">${this.baseValueObserverCallCount}</div>
            <div id="base-computed-count">${this.baseComputedCallCount}</div>
        `;
    }
}

// Derived class that overrides the same properties with different decorators
class DerivedComponent extends BaseComponent {
    @property({ type: String })
    @observer(function(this: DerivedComponent, newValue: string, oldValue: string) {
        this.derivedValueObserverCallCount++;
        this.derivedValueObserverLastArgs = { newValue, oldValue };
    })
    declare value: string;

    @property({ type: String })
    @computed(function(this: DerivedComponent, firstName: string, lastName: string): string {
        this.derivedComputedCallCount++;
        this.derivedComputedLastArgs = { firstName, lastName };
        return `Derived: ${firstName} ${lastName}`;
    }, "firstName", "lastName")
    declare readonly displayName: string;

    // Tracking properties for derived class
    derivedValueObserverCallCount: number = 0;
    derivedValueObserverLastArgs: { newValue?: string, oldValue?: string } | null = null;
    derivedComputedCallCount: number = 0;
    derivedComputedLastArgs: { firstName?: string, lastName?: string } | null = null;

    // Store console errors
    consoleErrors: string[] = [];
    private originalConsoleError: any;

    constructor() {
        super();

        // Spy on console.error
        this.originalConsoleError = console.error;
        console.error = (...args: any[]) => {
            const message = args.join(' ');
            if (message.includes('test-decorator-inheritance')) {
                this.consoleErrors.push(message);
            }
            this.originalConsoleError.apply(console, args);
        };
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        // Restore console.error
        if (this.originalConsoleError) {
            console.error = this.originalConsoleError;
        }
    }

    render() {
        return html`
            <p>Derived Component (should show warnings)</p>
            <div id="display-name">${this.displayName}</div>
            <div id="value">${this.value}</div>
            <div id="base-observer-count">${this.baseValueObserverCallCount}</div>
            <div id="base-computed-count">${this.baseComputedCallCount}</div>
            <div id="derived-observer-count">${this.derivedValueObserverCallCount}</div>
            <div id="derived-computed-count">${this.derivedComputedCallCount}</div>
            <div id="console-errors-count">${this.consoleErrors.length}</div>
        `;
    }
}

// Export classes and a registration function
export { BaseComponent, DerivedComponent };

// Export registration function instead of auto-registering
// This prevents console errors from appearing in all test runs
export function registerDecoratorInheritanceComponents() {
    if (!customElements.get("test-decorator-inheritance-base"))
        customElements.define("test-decorator-inheritance-base", BaseComponent);

    if (!customElements.get("test-decorator-inheritance"))
        customElements.define("test-decorator-inheritance", DerivedComponent);
}

// Make registration function globally available for tests
(window as any).registerDecoratorInheritanceComponents = registerDecoratorInheritanceComponents;
