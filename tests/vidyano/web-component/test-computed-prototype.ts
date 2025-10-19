import { html } from "lit";
import { property } from "lit/decorators.js";
import { WebComponent, computed } from "../../../src/vidyano/web-components/web-component/web-component.js";

class TestComputedPrototype extends WebComponent {
    @property({ type: String })
    declare firstName: string;

    @property({ type: String })
    declare lastName: string;

    @property({ type: String })
    @computed(TestComputedPrototype.prototype._computeFullName, "firstName", "lastName")
    declare readonly fullName: string;

    // Public properties for testing
    computeFullNameCallCount: number = 0;
    computeFullNameLastArgs: { firstName?: string, lastName?: string } | null = null;
    computeFullNameLastResult: string | null = null;

    constructor() {
        super();
        this.firstName = "Jane";
        this.lastName = "Doe";
    }

    render() {
        return html`
            <p>Tests @computed decorator with prototype function reference</p>
            <div>First Name: <span id="first-name">${this.firstName}</span></div>
            <div>Last Name: <span id="last-name">${this.lastName}</span></div>
            <div>Full Name: <strong id="full-name">${this.fullName}</strong></div>
            <div>Compute Call Count: <span id="call-count">${this.computeFullNameCallCount}</span></div>
        `;
    }

    private _computeFullName(firstName: string, lastName: string): string {
        this.computeFullNameCallCount++;
        this.computeFullNameLastArgs = { firstName, lastName };
        const result = `${firstName} ${lastName}`;
        this.computeFullNameLastResult = result;
        return result;
    }
}

export { TestComputedPrototype };

customElements.define("test-computed-prototype", TestComputedPrototype);
