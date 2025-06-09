import { WebComponentLit } from "../../../src/app/web-components/web-component/web-component-lit.js";
import { html } from "lit";

@WebComponentLit.register({
    properties: {
        message: { type: String }
    },
    listeners: {
        "click": "_handleHostClick" // Listener for the host element
    }
}, "test-event-listeners")
class TestEventListeners extends WebComponentLit {
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
            <p>Demonstrates event listeners on host and child elements.</p>
            <div id="hostElement">Host Element (Click Me)</div>
            <button id="myButton" @click="${this._handleButtonClick}">Child Button (Click Me)</button>
            <div>Message: <span id="message">${this.message}</span></div>
        `;
    }

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
