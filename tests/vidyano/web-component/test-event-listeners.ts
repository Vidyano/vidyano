import { html } from "lit";
import { property } from "lit/decorators.js";
import { WebComponent, listener } from "../../../src/vidyano/web-components/web-component/web-component.js";

class TestEventListeners extends WebComponent {
    @property({ type: String })
    declare message: string;

    // Public properties for testing
    hostClickCount: number = 0;
    buttonClickCount: number = 0;
    lastMessageFromEvent: string | undefined;

    constructor() {
        super();
        this.message = "Hello Listeners!";
    }

    render() {
        return html`
            <style>
                :host {
                    display: block;
                }
                #hostElement {
                    display: block;
                    padding: 10px;
                    background-color: #f0f0f0;
                    cursor: pointer;
                }
                #myButton {
                    display: block;
                    margin-top: 10px;
                }
            </style>
            <p>Demonstrates event listeners on host and child elements.</p>
            <div id="hostElement">Host Element (Click Me)</div>
            <button id="myButton" @click="${this._handleButtonClick}">Child Button (Click Me)</button>
            <div>Message: <span id="message">${this.message}</span></div>
        `;
    }

    @listener("click")
    _handleHostClick(e: Event) { // Renamed to be non-private as it's part of the public API via listeners
        // Prevent host click from firing if the click originated from the button
        if (e.target === this) {
            this.hostClickCount++;
            this.lastMessageFromEvent = "Host click handler invoked";
        }
    }

    private _handleButtonClick(e: Event) {
        this.buttonClickCount++;
        this.lastMessageFromEvent = `Button clicked: ${(e.currentTarget as HTMLElement).id}`;
        e.stopPropagation(); // Prevent event from bubbling to the host
    }
}

export { TestEventListeners };

customElements.define("test-event-listeners", TestEventListeners);