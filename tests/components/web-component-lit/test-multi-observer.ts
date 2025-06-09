import { WebComponentLit } from "../../../src/app/web-components/web-component/web-component-lit.js";
import { html } from "lit";

@WebComponentLit.register({
    properties: {
        counter: { type: Number },
        doubled: { type: Number, computed: "_doubleCounter(counter)" }
    },
    observers: [
        "_counterOrDoubledChanged(counter, doubled)"
    ]
}, "test-multi-observer")
class TestMultiObserver extends WebComponentLit {
    declare counter: number;
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

    private _counterOrDoubledChanged(counter: number, doubled: number): void {
        this.counterOrDoubledChangedCallCount++;
        this.counterOrDoubledChangedLastArgs = { counter, doubled };
    }
}

export { TestMultiObserver };
