import { html } from "lit";
import { property } from "lit/decorators.js";
import { WebComponent, observer, computed } from "../../../src/vidyano/web-components/web-component/web-component.js";

// Grandparent (abstract) class with computed property
abstract class GrandparentComponent extends WebComponent {
    @property({ type: String })
    firstName: string = "John";

    @property({ type: String })
    lastName: string = "Doe";

    computeCallCount: number = 0;

    @computed(function(this: GrandparentComponent, firstName: string, lastName: string): string {
        this.computeCallCount++;
        return `${firstName} ${lastName}`;
    }, "firstName", "lastName")
    declare readonly fullName: string;

    @computed(function(this: GrandparentComponent, isActive: boolean): boolean {
        return isActive;
    }, "isActive")
    declare readonly active: boolean;

    @property({ type: Boolean })
    isActive: boolean = true;

    render() {
        return html`
            <div id="full-name">${this.fullName || 'undefined'}</div>
            <div id="active">${this.active !== undefined ? (this.active ? 'active' : 'inactive') : 'undefined'}</div>
            <div id="compute-count">${this.computeCallCount}</div>
        `;
    }
}

// Parent class - NEVER REGISTERED as a custom element
// Has its own @computed decorators (like PersistentObjectAttributeString)
class ParentComponent extends GrandparentComponent {
    @property({ type: String })
    middleName: string = "M";

    @computed(function(this: ParentComponent, firstName: string, middleName: string, lastName: string): string {
        return `${firstName} ${middleName}. ${lastName}`;
    }, "firstName", "middleName", "lastName")
    declare readonly fullNameWithMiddle: string;
}

// Child class that extends parent - THIS ONE IS REGISTERED
class ChildComponent extends ParentComponent {
    // Just extends, no additional properties or overrides

    override render() {
        return html`
            <div id="full-name">${this.fullName || 'undefined'}</div>
            <div id="full-name-with-middle">${this.fullNameWithMiddle || 'undefined'}</div>
            <div id="active">${this.active !== undefined ? (this.active ? 'active' : 'inactive') : 'undefined'}</div>
            <div id="compute-count">${this.computeCallCount}</div>
        `;
    }
}

// Register only the child component (not the parent or grandparent)
customElements.define("test-computed-deep-inheritance", ChildComponent);
