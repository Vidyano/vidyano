import { html } from "lit";
import { WebComponentLit } from "../../../src/app/web-components/web-component/web-component-lit.js";
import { observer, property } from "../../../src/app/web-components/web-component/web-component-decorators.js";

class TestMultiObserver extends WebComponentLit {
    @property({ type: Number })
    declare counter: number;

    @property({ type: Number, computed: "_doubleCounter(counter)" })
    declare readonly doubled: number;

    // Public properties for testing
    doubleCounterCallCount: number = 0;
    counterOrDoubledChangedCallCount: number = 0;
    counterOrDoubledChangedLastArgs: { counter?: number, doubled?: number } | undefined;

    constructor() {
        super();
        this.counter = 1;
    }

    render() {
        return html`
            <p>Demonstrates a multi-property observer and a computed property.</p>
            <div>Counter: <span id="counter">${this.counter}</span></div>
            <div>Doubled: <span id="doubled">${this.doubled}</span></div>
        `;
    }

    private _doubleCounter(counter: number): number {
        this.doubleCounterCallCount++;
        return counter * 2;
    }

    @observer("counter", "doubled")
    private _counterOrDoubledChanged(counter: number, doubled: number): void {
        this.counterOrDoubledChangedCallCount++;
        this.counterOrDoubledChangedLastArgs = { counter, doubled };
    }
}

export { TestMultiObserver };

customElements.define("test-multi-observer", TestMultiObserver);