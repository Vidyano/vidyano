import { property } from "lit/decorators.js";
import { WebComponent, observer } from "../../src/web-components/web-component/web-component.js";
import { html } from "lit";
import { MockReference } from "./test-computed-chained-root.js";

export class TestObserverSideEffectRoot extends WebComponent {
    @property({ type: Object })
    source: MockReference;

    // Set by an observer, not by Lit or a computed
    @property({ type: Object })
    derived: MockReference;

    derivedValueCallCount = 0;
    derivedValueLastArg: string;

    constructor() {
        super();
        this.source = new MockReference("first");
    }

    render() {
        return html`<div id="derived-value">${this.derivedValueLastArg ?? 'N/A'}</div>`;
    }

    @observer("source")
    private _sourceChanged(source: MockReference) {
        this.derived = source;
    }

    @observer("derived.value")
    private _derivedValueChanged(value: string) {
        this.derivedValueCallCount++;
        this.derivedValueLastArg = value;
        this.requestUpdate();
    }
}

customElements.define("test-observer-side-effect-root", TestObserverSideEffectRoot);
