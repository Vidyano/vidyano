import { html } from "lit";
import { property } from "lit/decorators.js";
import { WebComponent, observer } from "../../../src/vidyano/web-components/web-component/web-component.js";

class TestObserverPropertyInline extends WebComponent {
    @property({ type: Number })
    @observer(function(this: TestObserverPropertyInline, newValue?: number, oldValue?: number) {
        this.counterChangeCallCount++;
        this.counterChangeLastArgs = { newValue, oldValue };
        // Store the context to verify `this` refers to the component instance
        this.counterChangeThisContext = this;
    })
    declare counter: number;

    @property({ type: String })
    @observer(function(this: TestObserverPropertyInline, newValue?: string, oldValue?: string) {
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
            <p>Tests @observer decorator on properties with inline functions</p>
            <div>Counter: <span id="counter">${this.counter}</span></div>
            <div>Name: <span id="name">${this.name}</span></div>
            <div>Counter Changes: <span id="counter-changes">${this.counterChangeCallCount}</span></div>
            <div>Name Changes: <span id="name-changes">${this.nameChangeCallCount}</span></div>
        `;
    }
}

export { TestObserverPropertyInline };

customElements.define("test-observer-property-inline", TestObserverPropertyInline);
