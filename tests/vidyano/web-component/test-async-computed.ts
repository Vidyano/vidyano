import { property } from "lit/decorators.js";
import { WebComponent, computed } from "../../../src/vidyano/web-components/web-component/web-component.js";
import { html } from "lit";

// Named async function defined outside the class
async function computeAsyncValueNamed(this: TestAsyncComputed, inputValue: string): Promise<string> {
    if (inputValue === undefined) {
        return "Error: input was undefined";
    }

    const valForPromise = inputValue;
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(`Named: ${valForPromise}`);
        }, 1000); // 1-second delay
    });
}

class TestAsyncComputed extends WebComponent {
    @property({ type: String })
    declare inputValue: string;

    // Pattern 1: Inline async function
    @property({ type: String })
    @computed(async function(this: TestAsyncComputed, inputValue: string): Promise<string> {
        if (inputValue === undefined) {
            return "Error: input was undefined";
        }

        const valForPromise = inputValue;
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(`Inline Async: ${valForPromise}`);
            }, 1000); // 1-second delay
        });
    }, "inputValue")
    declare readonly computedInlineAsync: string;

    // Pattern 2: Inline unnamed function returning Promise (no async keyword)
    @property({ type: String })
    @computed(function(this: TestAsyncComputed, inputValue: string): Promise<string> {
        if (inputValue === undefined) {
            return Promise.resolve("Error: input was undefined");
        }

        const valForPromise = inputValue;
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(`Inline Unnamed: ${valForPromise}`);
            }, 1000); // 1-second delay
        });
    }, "inputValue")
    declare readonly computedInlineUnnamed: string;

    // Pattern 3: Named function reference
    @property({ type: String })
    @computed(computeAsyncValueNamed, "inputValue")
    declare readonly computedNamed: string;

    constructor() {
        super();
        this.inputValue = "initial";
    }

    render() {
        return html`
            <p>Tests async computed properties with three different function patterns.</p>
            <div>Input Value: <span id="input">${this.inputValue}</span></div>
            <div>Inline Async: <span id="inline-async">${this.computedInlineAsync ?? 'Loading...'}</span></div>
            <div>Inline Unnamed: <span id="inline-unnamed">${this.computedInlineUnnamed ?? 'Loading...'}</span></div>
            <div>Named Function: <span id="named">${this.computedNamed ?? 'Loading...'}</span></div>
        `;
    }
}

export { TestAsyncComputed };

customElements.define("test-async-computed", TestAsyncComputed);
