import { html } from "lit";
import { property } from "lit/decorators.js";
import { WebComponent, observer, computed } from "../../../src/vidyano/web-components/web-component/web-component.js";

// Base component with computed property
abstract class BaseSiblingComponent extends WebComponent {
    @property({ type: String })
    firstName: string = "John";

    @property({ type: String })
    lastName: string = "Doe";

    @computed(function(this: BaseSiblingComponent, firstName: string, lastName: string): string {
        return `${firstName} ${lastName}`;
    }, "firstName", "lastName")
    declare readonly fullName: string;
}

// Parent with its own computed (creates own config)
class ParentSiblingComponent extends BaseSiblingComponent {
    @property({ type: Number })
    age: number = 30;

    @computed(function(this: ParentSiblingComponent, age: number): string {
        return `Age: ${age}`;
    }, "age")
    declare readonly ageDisplay: string;

    @property({ type: String })
    @observer(function(this: ParentSiblingComponent, newValue: string, oldValue: string): void {
        this.firstNameChangedCount++;
    })
    declare firstName: string;

    firstNameChangedCount: number = 0;
}

// First child - REGISTERED FIRST
class SiblingChild1Component extends ParentSiblingComponent {
    @property({ type: String })
    child1Prop: string = "child1";

    override render() {
        return html`
            <div id="full-name">${this.fullName}</div>
            <div id="age-display">${this.ageDisplay}</div>
            <div id="child-prop">${this.child1Prop}</div>
            <div id="first-name-count">${this.firstNameChangedCount}</div>
        `;
    }
}

// Second child - REGISTERED SECOND (should not be affected by Child1)
class SiblingChild2Component extends ParentSiblingComponent {
    @property({ type: String })
    child2Prop: string = "child2";

    override render() {
        return html`
            <div id="full-name">${this.fullName}</div>
            <div id="age-display">${this.ageDisplay}</div>
            <div id="child-prop">${this.child2Prop}</div>
            <div id="first-name-count">${this.firstNameChangedCount}</div>
        `;
    }
}

// Register both children (Child1 first, then Child2)
customElements.define("test-sibling-child1", SiblingChild1Component);
customElements.define("test-sibling-child2", SiblingChild2Component);
