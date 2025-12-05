import { html } from "lit";
import { property } from "lit/decorators.js";
import { WebComponent, observer } from "../../../src/vidyano/web-components/web-component/web-component.js";

// Grandparent (abstract) class with observer
abstract class GrandparentObserverComponent extends WebComponent {
    @property({ type: String })
    @observer(function(this: GrandparentObserverComponent, newValue: string, oldValue: string): void {
        this.firstNameObserverCallCount++;
    })
    firstName: string = "John";

    firstNameObserverCallCount: number = 0;

    render() {
        return html`
            <div id="first-name">${this.firstName}</div>
            <div id="age">${(this as any).age}</div>
            <div id="email">${(this as any).email}</div>
            <div id="first-name-count">${this.firstNameObserverCallCount}</div>
            <div id="age-count">${(this as any).ageObserverCallCount}</div>
            <div id="email-count">${(this as any).emailObserverCallCount}</div>
        `;
    }
}

// Parent class - NEVER REGISTERED as a custom element
// Has its own @observer decorator (like PersistentObjectAttributeString)
class ParentObserverComponent extends GrandparentObserverComponent {
    @property({ type: Number })
    @observer(function(this: ParentObserverComponent, newValue: number, oldValue: number): void {
        this.ageObserverCallCount++;
    })
    age: number = 30;

    ageObserverCallCount: number = 0;
}

// Child class that extends parent - THIS ONE IS REGISTERED
class ChildObserverComponent extends ParentObserverComponent {
    @property({ type: String })
    @observer(function(this: ChildObserverComponent, newValue: string, oldValue: string): void {
        this.emailObserverCallCount++;
    })
    email: string = "john@example.com";

    emailObserverCallCount: number = 0;
}

// Register only the child component (not the parent or grandparent)
customElements.define("test-observer-deep-inheritance", ChildObserverComponent);
