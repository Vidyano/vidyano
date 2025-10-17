import { html } from "lit";
import { property } from "lit/decorators.js";
import { WebComponent, keybinding } from "../../../src/vidyano/web-components/web-component/web-component.js";

class TestKeybinding extends WebComponent {
    @property({ type: String })
    declare message: string;

    // Public properties for testing
    escapeCallCount: number = 0;
    ctrlSCallCount: number = 0;
    altKCallCount: number = 0;
    shiftEnterCallCount: number = 0;
    lastEvent: KeyboardEvent | null = null;

    constructor() {
        super();
        this.message = "Press Escape, Ctrl+S, Alt+K, or Shift+Enter";
    }

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
            </style>
            <div class="info">
                <p>${this.message}</p>
                <p>Escape count: <span id="escape-count">${this.escapeCallCount}</span></p>
                <p>Ctrl+S count: <span id="ctrl-s-count">${this.ctrlSCallCount}</span></p>
                <p>Alt+K count: <span id="alt-k-count">${this.altKCallCount}</span></p>
                <p>Shift+Enter count: <span id="shift-enter-count">${this.shiftEnterCallCount}</span></p>
            </div>
        `;
    }

    override connectedCallback() {
        super.connectedCallback();
        // Make the component focusable so it can receive keyboard events
        if (!this.hasAttribute('tabindex')) {
            this.setAttribute('tabindex', '0');
        }
    }

    @keybinding("escape")
    private _handleEscape(e: KeyboardEvent) {
        this.escapeCallCount++;
        this.lastEvent = e;
        this.requestUpdate();
    }

    @keybinding("ctrl+s")
    private _handleCtrlS(e: KeyboardEvent) {
        e.preventDefault(); // Prevent browser save
        this.ctrlSCallCount++;
        this.lastEvent = e;
        this.requestUpdate();
    }

    @keybinding("alt+k")
    private _handleAltK(e: KeyboardEvent) {
        this.altKCallCount++;
        this.lastEvent = e;
        this.requestUpdate();
    }

    @keybinding("shift+enter")
    private _handleShiftEnter(e: KeyboardEvent) {
        this.shiftEnterCallCount++;
        this.lastEvent = e;
        this.requestUpdate();
    }
}

export { TestKeybinding };

customElements.define("test-keybinding", TestKeybinding);
