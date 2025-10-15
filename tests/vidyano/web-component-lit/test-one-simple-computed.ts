import { html } from "lit";
import { property } from "lit/decorators.js";
import { WebComponentLit, observe, computed } from "../../../src/vidyano/web-components/web-component/web-component-lit.js";

class TestOneSimpleComputed extends WebComponentLit {
    @property({ type: String })
    @observe("_firstNameChanged")
    declare firstName: string;

    @property({ type: String })
    declare lastName: string;

    @property({ type: String })
    @computed("_computeFullName(firstName, lastName)")
    declare readonly fullName: string;

    // Public properties for testing
    firstNameChangedCallCount: number = 0;
    firstNameChangedLastArgs: { newValue?: string, oldValue?: string } | undefined;
    computeFullNameCallCount: number = 0;
    computeFullNameLastArgs: { firstName?: string, lastName?: string } | undefined;
    computeFullNameLastResult: string | undefined;

    constructor() {
        super();
        
        this.firstName = "Jane";
        this.lastName = "Doe";
    }

    override connectedCallback(): void {
        super.connectedCallback();
    }

    render() {
        return html`
            <p>Demonstrates a computed property and a single-property observer.</p>
            <ul>
                <li>First Name: ${this.firstName}</li>
                <li>Last Name: ${this.lastName}</li>
                <li><strong>Computed Full Name: ${this.fullName}</strong></li>
            </ul>
        `;
    }

    private _computeFullName(firstName: string, lastName: string): string {
        this.computeFullNameCallCount++;
        this.computeFullNameLastArgs = { firstName, lastName };
        const result = `${firstName} ${lastName}`;
        this.computeFullNameLastResult = result;

        return result;
    }

    private _firstNameChanged(newValue: string, oldValue: string): void {
        this.firstNameChangedCallCount++;
        this.firstNameChangedLastArgs = { newValue, oldValue };
    }
}

customElements.define("test-one-simple-computed", TestOneSimpleComputed);