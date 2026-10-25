import { html } from "lit";
import { ServiceBus } from "@vidyano/core";
import { WebComponent } from "../../src/web-components/web-component/web-component.js";

class TestAppSensitive extends WebComponent {
    static sendSensitive(sensitive: boolean) {
        ServiceBus.send("vi-app:sensitive-changed", sensitive);
    }

    render() {
        return html`<span id="state">${this.isAppSensitive ? "sensitive" : "plain"}</span>`;
    }
}

export { TestAppSensitive };

customElements.define("test-app-sensitive", TestAppSensitive);
