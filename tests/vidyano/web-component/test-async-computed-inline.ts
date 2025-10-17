import { property } from "lit/decorators.js";
import { WebComponent, computed } from "../../../src/vidyano/web-components/web-component/web-component.js";
import { html } from "lit";

// Inline compute function with explicit `this` typing
async function computeAsyncValue(this: TestAsyncComputedInline, inputValue: string): Promise<string> {
    if (inputValue === undefined) {
        return "Error: input was undefined";
    }

    const valForPromise = inputValue;
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(`Computed: ${valForPromise}`);
        }, 1000); // 1-second delay
    });
}

class TestAsyncComputedInline extends WebComponent {
    @property({ type: String })
    declare inputValue: string;

    @property({ type: String })
    @computed(computeAsyncValue, "inputValue")
    declare readonly computedAsyncValue: string;

    constructor() {
        super();
        this.inputValue = "initial";
    }

    render() {
        return html`
            <p>Tests async computed properties with inline function.</p>
            <div>Input Value: <span id="input">${this.inputValue}</span></div>
            <div>Computed Async Value: <span id="computed">${this.computedAsyncValue ?? 'Loading...'}</span></div>
        `;
    }
}

export { TestAsyncComputedInline };

customElements.define("test-async-computed-inline", TestAsyncComputedInline);
