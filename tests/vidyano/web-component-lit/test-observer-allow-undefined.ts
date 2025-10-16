import { html } from "lit";
import { property } from "lit/decorators.js";
import { WebComponent, observer } from "../../../src/vidyano/web-components/web-component/web-component.js";

class TestObserverAllowUndefined extends WebComponent {
    @property({ type: String })
    declare firstName: string | undefined;

    @property({ type: String })
    declare lastName: string | undefined;

    // Public properties for testing
    observerCallCount: number = 0;
    observerLastArgs: { firstName?: string, lastName?: string } | null = null;

    constructor() {
        super();
        // Both properties start as undefined
    }

    render() {
        return html`
            <p>Observer SHOULD be called even when properties are undefined (allowUndefined: true).</p>
            <ul>
                <li>First Name: ${this.firstName ?? 'undefined'}</li>
                <li>Last Name: ${this.lastName ?? 'undefined'}</li>
                <li>Observer Call Count: ${this.observerCallCount}</li>
            </ul>
        `;
    }

    @observer("firstName", "lastName", { allowUndefined: true })
    private _handleNameChange(firstName: string | undefined, lastName: string | undefined): void {
        this.observerCallCount++;
        this.observerLastArgs = { firstName, lastName };
    }
}

customElements.define("test-observer-allow-undefined", TestObserverAllowUndefined);
