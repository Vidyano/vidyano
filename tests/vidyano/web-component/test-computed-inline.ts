import { html } from "lit";
import { property } from "lit/decorators.js";
import { WebComponent, observer, computed } from "../../../src/vidyano/web-components/web-component/web-component.js";

class TestComputedInline extends WebComponent {
    @property({ type: String })
    @observer(TestComputedInline.prototype._firstNameChanged)
    declare firstName: string;

    @property({ type: String })
    declare lastName: string;

    @property({ type: String })
    @computed(function(this: TestComputedInline, firstName: string, lastName: string): string {
        this.computeFullNameCallCount++;
        this.computeFullNameLastArgs = { firstName, lastName };
        const result = `${firstName} ${lastName}`;
        this.computeFullNameLastResult = result;

        return result;
    }, "firstName", "lastName")
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
            <p>Tests @computed decorator with inline function</p>
            <ul>
                <li>First Name: ${this.firstName}</li>
                <li>Last Name: ${this.lastName}</li>
                <li><strong>Computed Full Name: ${this.fullName}</strong></li>
            </ul>
        `;
    }

    private _firstNameChanged(newValue: string, oldValue: string): void {
        this.firstNameChangedCallCount++;
        this.firstNameChangedLastArgs = { newValue, oldValue };
    }
}

customElements.define("test-computed-inline", TestComputedInline);