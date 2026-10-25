import { property } from "lit/decorators.js";
import { WebComponent, observer } from "../../src/web-components/web-component/web-component.js";
import { html } from "lit";
import { MockReference } from "./test-computed-chained-root.js";

export class TestObserverDisconnectedUpdate extends WebComponent {
    @property({ type: Object })
    source: MockReference;

    sourceValueCallCount = 0;

    constructor() {
        super();
        this.source = new MockReference("first");
    }

    render() {
        return html`<div id="source-value">${this.source?.value ?? 'N/A'}</div>`;
    }

    @observer("source.value")
    private _sourceValueChanged() {
        this.sourceValueCallCount++;
    }
}

customElements.define("test-observer-disconnected-update", TestObserverDisconnectedUpdate);
