import { html } from "lit";
import { property } from "lit/decorators.js";
import { WebComponent, computed } from "../../../src/vidyano/web-components/web-component/web-component.js";

class TestComputedAllowUndefined extends WebComponent {
    @property({ type: String })
    declare firstName: string | undefined;

    @property({ type: String })
    declare lastName: string | undefined;

    @property({ type: String })
    @computed("_computeFullName(firstName, lastName)", { allowUndefined: true })
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
            <p>Computed property SHOULD be calculated even when dependencies are undefined (allowUndefined: true).</p>
            <ul>
                <li>First Name: ${this.firstName ?? 'undefined'}</li>
                <li>Last Name: ${this.lastName ?? 'undefined'}</li>
                <li>Full Name: ${this.fullName ?? 'undefined'}</li>
                <li>Compute Call Count: ${this.computeCallCount}</li>
            </ul>
        `;
    }

    private _computeFullName(firstName: string | undefined, lastName: string | undefined): string {
        this.computeCallCount++;
        this.computeLastArgs = { firstName, lastName };
        return `${firstName ?? ''} ${lastName ?? ''}`.trim();
    }
}

customElements.define("test-computed-allow-undefined", TestComputedAllowUndefined);
