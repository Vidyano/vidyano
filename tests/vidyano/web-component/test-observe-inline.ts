import { html } from "lit";
import { property } from "lit/decorators.js";
import { WebComponent, observe } from "../../../src/vidyano/web-components/web-component/web-component.js";

class TestObserveInline extends WebComponent {
    @property({ type: Number })
    @observe(function(this: TestObserveInline, newValue?: number, oldValue?: number) {
        this.counterChangeCallCount++;
        this.counterChangeLastArgs = { newValue, oldValue };
        // Store the context to verify `this` refers to the component instance
        this.counterChangeThisContext = this;
    })
    declare counter: number;

    @property({ type: String })
    @observe(function(this: TestObserveInline, newValue?: string, oldValue?: string) {
        this.nameChangeCallCount++;
        this.nameChangeLastArgs = { newValue, oldValue };
    })
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
            <p>Tests @observe decorator with inline functions</p>
            <div>Counter: <span id="counter">${this.counter}</span></div>
            <div>Name: <span id="name">${this.name}</span></div>
            <div>Counter Changes: <span id="counter-changes">${this.counterChangeCallCount}</span></div>
            <div>Name Changes: <span id="name-changes">${this.nameChangeCallCount}</span></div>
        `;
    }
}

export { TestObserveInline };

customElements.define("test-observe-inline", TestObserveInline);
