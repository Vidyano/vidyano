import { html } from "lit";
import { property } from "lit/decorators.js";
import { WebComponent, observer } from "../../../src/vidyano/web-components/web-component/web-component.js";

class TestObserverUndefinedBlocking extends WebComponent {
    @property({ type: String })
    declare firstName: string | null | undefined;

    @property({ type: String })
    declare lastName: string | null | undefined;

    // Public properties for testing
    observerCallCount: number = 0;
    observerLastArgs: { firstName?: string | null, lastName?: string | null } | null = null;

    constructor() {
        super();
        // Both properties start as undefined
    }

    render() {
        return html`
            <p>Observer should NOT be called when any property is undefined (default behavior).</p>
            <ul>
                <li>First Name: ${this.firstName ?? 'undefined'}</li>
                <li>Last Name: ${this.lastName ?? 'undefined'}</li>
                <li>Observer Call Count: ${this.observerCallCount}</li>
            </ul>
        `;
    }

    @observer("firstName", "lastName")
    private _handleNameChange(firstName: string | null, lastName: string | null): void {
        this.observerCallCount++;
        this.observerLastArgs = { firstName, lastName };
    }
}

customElements.define("test-observer-undefined-blocking", TestObserverUndefinedBlocking);
