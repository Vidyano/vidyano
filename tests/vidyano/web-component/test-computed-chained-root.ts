import { property } from "lit/decorators.js";
import { WebComponent, computed } from "../../../src/vidyano/web-components/web-component/web-component.js";
import { Observable } from "../../../src/core/observable/index.js";
import { html } from "lit";

export class MockReference extends Observable<MockReference> {
    private _value: string = "";

    get value(): string {
        return this._value;
    }

    set value(val: string) {
        if (this._value === val)
            return;

        const oldValue = this._value;
        this._value = val;
        this.notifyPropertyChanged("value", this._value, oldValue);
    }

    constructor(initialValue: string) {
        super();
        this._value = initialValue;
    }
}

export class MockConfig extends Observable<MockConfig> {
    private _options: string[] = [];

    get options(): string[] {
        return this._options;
    }

    set options(val: string[]) {
        if (this._options === val)
            return;

        const oldValue = this._options;
        this._options = val;
        this.notifyPropertyChanged("options", this._options, oldValue);
    }

    constructor(initialOptions: string[]) {
        super();
        this._options = initialOptions;
    }
}

export class TestComputedChainedRoot extends WebComponent {
    @property({ type: Object })
    config: MockConfig;

    isOtherComputeCount = 0;

    // First computed: derives a reference from config
    @computed(function(this: TestComputedChainedRoot) {
        const refName = this.config?.options?.[0];
        if (!refName)
            return null;

        return (this as any)[refName] as MockReference;
    }, "config.options")
    declare readonly derivedReference: MockReference;

    // Second computed: depends on the derived reference's value
    @computed(function(this: TestComputedChainedRoot, value: string): boolean {
        this.isOtherComputeCount++;
        return value === "other" || value === "another";
    }, "derivedReference.value")
    declare readonly isOther: boolean;

    // Mock references that can be pointed to
    refA: MockReference;
    refB: MockReference;

    constructor() {
        super();
        this.refA = new MockReference("normal");
        this.refB = new MockReference("other");
        this.config = new MockConfig(["refA"]);
    }

    render() {
        return html`
            <div>
                <div id="derived-value">${this.derivedReference?.value || 'N/A'}</div>
                <div id="is-other">${this.isOther !== undefined ? String(this.isOther) : 'N/A'}</div>
                <div id="compute-count">${this.isOtherComputeCount}</div>
            </div>
        `;
    }
}

customElements.define("test-computed-chained-root", TestComputedChainedRoot);
