import { WebComponentLit } from "../../../src/app/web-components/web-component/web-component-lit.js";
import { property } from "../../../src/app/web-components/web-component/web-component-decorators.js";
import { html } from "lit";
import { Observable } from "../../../src/vidyano/observable/index.js";

/** A simple observable data source for the test. */
class DataSource extends Observable<any> {
    #value: string;

    constructor(value: string) {
        super();
        this.#value = value;
    }

    get value(): string {
        return this.#value;
    }

    set value(v: string) {
        if (this.#value !== v) {
            const oldValue = this.#value;
            this.notifyPropertyChanged("value", this.#value = v, oldValue);
        }
    }
}

/**
 * This component tests that a computed property deriving a new object instance
 * from an observable's deep path does not cause an excessive number of re-computations.
 * The `_computeDerivedObject` method intentionally returns a new object instance
 * on every call to test the controller's update loop stability.
 */
class TestComputedDerivedObject extends WebComponentLit {
    @property({ type: Object })
    source: DataSource;

    @property({ type: Object, computed: "_computeDerivedObject(source.value)" })
    derivedObject: { value: string };

    @property({ type: Number })
    computeCallCount: number = 0;

    constructor() {
        super();
        this.source = new DataSource("initial");
    }

    render() {
        return html`
            <p>Call Count: <span id="call-count">${this.computeCallCount}</span></p>
            <p>Derived Value: <span id="derived-value">${this.derivedObject?.value}</span></p>
        `;
    }

    _computeDerivedObject(sourceValue: string): { value: string } {
        this.computeCallCount++;
        // CRITICAL: Always return a new object instance to test the scenario.
        return { value: sourceValue };
    }

    updateSourceValue(newValue: string) {
        this.source.value = newValue;
    }
}

customElements.define("test-computed-derived-object", TestComputedDerivedObject);