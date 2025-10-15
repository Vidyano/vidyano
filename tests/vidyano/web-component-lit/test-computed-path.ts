import { property } from "lit/decorators.js";
import { WebComponentLit, computed } from "../../../src/vidyano/web-components/web-component/web-component-lit.js";
import { html } from "lit";

class TestComputedPath extends WebComponentLit {
    @property({ type: Object })
    declare sourceObject: { data: string };

    @property({ type: String })
    @computed("sourceObject.data")
    declare readonly derivedValue: string;

    constructor() {
        super();
        this.sourceObject = { data: "initial" };
    }

    render() {
        return html`
            <p>Demonstrates a computed property using a path string.</p>
            <div>Source Data: <span id="source">${this.sourceObject?.data}</span></div>
            <div>Derived Value: <span id="derived">${this.derivedValue}</span></div>
        `;
    }
}

// Export the class for type checking in tests if needed, though Playwright works on the registered element.
export { TestComputedPath };

customElements.define("test-computed-path", TestComputedPath);