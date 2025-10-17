import { html } from "lit";
import { property } from "lit/decorators.js";
import { WebComponent, computed } from "../../../src/vidyano/web-components/web-component/web-component.js";

class TestComputedUndefinedBlocking extends WebComponent {
    @property({ type: String })
    declare firstName: string | undefined;

    @property({ type: String })
    declare lastName: string | undefined;

    @property({ type: String })
    @computed(function(this: TestComputedUndefinedBlocking, firstName: string, lastName: string): string {
        this.computeCallCount++;
        this.computeLastArgs = { firstName, lastName };
        return `${firstName} ${lastName}`;
    }, "firstName", "lastName")
    declare readonly fullName: string | undefined;

    // Public properties for testing
    computeCallCount: number = 0;
    computeLastArgs: { firstName?: string, lastName?: string } | null = null;

    constructor() {
        super();
        // Both properties start as undefined
    }

    render() {
        return html`
            <p>Computed property should NOT be calculated when dependencies are undefined (default behavior).</p>
            <ul>
                <li>First Name: ${this.firstName ?? 'undefined'}</li>
                <li>Last Name: ${this.lastName ?? 'undefined'}</li>
                <li>Full Name: ${this.fullName ?? 'undefined'}</li>
                <li>Compute Call Count: ${this.computeCallCount}</li>
            </ul>
        `;
    }

}

customElements.define("test-computed-undefined-blocking", TestComputedUndefinedBlocking);
