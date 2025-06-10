import { WebComponentLit } from "../../../src/app/web-components/web-component/web-component-lit.js";
import { html } from "lit";

@WebComponentLit.register({
    properties: {
        inputValue: { type: String },
        computedAsyncValue: { type: String, computed: "_computeAsyncValue(inputValue)" }
    }
}, "test-async-computed")
class TestAsyncComputed extends WebComponentLit {
    declare inputValue: string;
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
