import { html } from "lit";
import { property, query } from "lit/decorators.js";
import { WebComponent, keybinding } from "../../../src/vidyano/web-components/web-component/web-component.js";

class TestKeybindingInput extends WebComponent {
    // Public properties for testing
    deleteCallCount: number = 0;
    insertCallCount: number = 0;
    lastEvent: KeyboardEvent | null = null;

    @query("input")
    inputElement: HTMLInputElement;

    render() {
        return html`
            <style>
                :host {
                    display: block;
                    padding: 20px;
                    border: 2px solid #ccc;
                }
                .info {
                    margin-bottom: 10px;
                }
                input {
                    padding: 8px;
                    font-size: 14px;
                }
            </style>
            <div class="info">
                <p>Delete count: <span id="delete-count">${this.deleteCallCount}</span></p>
                <p>Insert count: <span id="insert-count">${this.insertCallCount}</span></p>
            </div>
            <input type="text" placeholder="Type here..." />
        `;
    }

    override connectedCallback() {
        super.connectedCallback();
        if (!this.hasAttribute('tabindex'))
            this.setAttribute('tabindex', '0');
    }

    @keybinding("delete")
    private _handleDelete(e: KeyboardEvent) {
        this.deleteCallCount++;
        this.lastEvent = e;
        this.requestUpdate();
    }

    @keybinding("insert")
    private _handleInsert(e: KeyboardEvent) {
        this.insertCallCount++;
        this.lastEvent = e;
        this.requestUpdate();
    }
}

export { TestKeybindingInput };

customElements.define("test-keybinding-input", TestKeybindingInput);
