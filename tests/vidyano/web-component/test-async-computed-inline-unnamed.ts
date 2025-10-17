import { property } from "lit/decorators.js";
import { WebComponent, computed } from "../../../src/vidyano/web-components/web-component/web-component.js";
import { html } from "lit";

class TestAsyncComputedInlineUnnamed extends WebComponent {
    @property({ type: String })
    declare inputValue: string;

    @property({ type: String })
    @computed(function(this: TestAsyncComputedInlineUnnamed, inputValue: string): Promise<string> {
        if (inputValue === undefined) {
            return Promise.resolve("Error: input was undefined");
        }

        const valForPromise = inputValue;
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(`Computed: ${valForPromise}`);
            }, 1000); // 1-second delay
        });
    }, "inputValue")
    declare readonly computedAsyncValue: string;

    constructor() {
        super();
        this.inputValue = "initial";
    }

    render() {
        return html`
            <p>Tests async computed properties with inline unnamed function.</p>
            <div>Input Value: <span id="input">${this.inputValue}</span></div>
            <div>Computed Async Value: <span id="computed">${this.computedAsyncValue ?? 'Loading...'}</span></div>
        `;
    }
}

export { TestAsyncComputedInlineUnnamed };

customElements.define("test-async-computed-inline-unnamed", TestAsyncComputedInlineUnnamed);
