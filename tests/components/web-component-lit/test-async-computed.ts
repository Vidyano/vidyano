import { WebComponentLit } from "../../../src/vidyano/web-components/web-component/web-component-lit.js";
import { property } from "../../../src/vidyano/web-components/web-component/web-component-decorators.js";
import { html } from "lit";

class TestAsyncComputed extends WebComponentLit {
    @property({ type: String })
    declare inputValue: string;

    @property({ type: String, computed: "_computeAsyncValue(inputValue)" })
    declare readonly computedAsyncValue: string;

    constructor() {
        super();
        this.inputValue = "initial";
    }

    async _computeAsyncValue(inputValue: string): Promise<string> {
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

    render() {
        return html`
            <p>Tests async computed properties.</p>
            <div>Input Value: <span id="input">${this.inputValue}</span></div>
            <div>Computed Async Value: <span id="computed">${this.computedAsyncValue ?? 'Loading...'}</span></div>
        `;
    }
}

export { TestAsyncComputed };

customElements.define("test-async-computed", TestAsyncComputed);