import { WebComponentLit } from "../../../src/app/web-components/web-component/web-component-lit.js";
import { html } from "lit";

@WebComponentLit.register({
    properties: {
        sourceObject: { type: Object },
        derivedValue: { type: String, computed: "sourceObject.data" }
    }
}, "test-computed-path")
class TestComputedPath extends WebComponentLit {
    declare sourceObject: { data: string };
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
