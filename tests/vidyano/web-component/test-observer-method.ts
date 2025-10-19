import { html } from "lit";
import { property } from "lit/decorators.js";
import { WebComponent, observer, computed } from "../../../src/vidyano/web-components/web-component/web-component.js";

class TestObserverMethod extends WebComponent {
    @property({ type: Number })
    declare counter: number;

    @property({ type: Number })
    @computed(function(this: TestObserverMethod, counter: number): number {
        this.doubleCounterCallCount++;
        return counter * 2;
    }, "counter")
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
            <p>Tests @observer decorator on methods for multi-property observation</p>
            <div>Counter: <span id="counter">${this.counter}</span></div>
            <div>Doubled: <span id="doubled">${this.doubled}</span></div>
        `;
    }

    @observer("counter", "doubled")
    private _counterOrDoubledChanged(counter: number, doubled: number): void {
        this.counterOrDoubledChangedCallCount++;
        this.counterOrDoubledChangedLastArgs = { counter, doubled };
    }
}

export { TestObserverMethod };

customElements.define("test-observer-method", TestObserverMethod);