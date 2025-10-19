import { html } from "lit";
import { property } from "lit/decorators.js";
import { WebComponent, observe } from "../../../src/vidyano/web-components/web-component/web-component.js";

class TestObservePrototype extends WebComponent {
    @property({ type: Number })
    @observe(TestObservePrototype.prototype._handleCounterChange)
    declare counter: number;

    @property({ type: String })
    @observe(TestObservePrototype.prototype._handleNameChange)
    declare name: string;

    // Public properties for testing
    counterChangeCallCount: number = 0;
    counterChangeLastArgs: { newValue?: number, oldValue?: number } | null = null;
    counterChangeThisContext: any = null;

    nameChangeCallCount: number = 0;
    nameChangeLastArgs: { newValue?: string, oldValue?: string } | null = null;

    constructor() {
        super();
        this.counter = 1;
        this.name = "initial";
    }

    render() {
        return html`
            <p>Tests @observe decorator with prototype method references</p>
            <div>Counter: <span id="counter">${this.counter}</span></div>
            <div>Name: <span id="name">${this.name}</span></div>
            <div>Counter Changes: <span id="counter-changes">${this.counterChangeCallCount}</span></div>
            <div>Name Changes: <span id="name-changes">${this.nameChangeCallCount}</span></div>
        `;
    }

    private _handleCounterChange(newValue: number, oldValue: number): void {
        this.counterChangeCallCount++;
        this.counterChangeLastArgs = { newValue, oldValue };
        // Store the context to verify `this` refers to the component instance
        this.counterChangeThisContext = this;
    }

    private _handleNameChange(newValue: string, oldValue: string): void {
        this.nameChangeCallCount++;
        this.nameChangeLastArgs = { newValue, oldValue };
    }
}

export { TestObservePrototype };

customElements.define("test-observe-prototype", TestObservePrototype);
