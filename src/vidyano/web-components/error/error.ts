import * as Polymer from "polymer"
import { WebComponent } from "components/web-component/web-component"

@WebComponent.register({
    properties: {
        icon: {
            type: String,
            value: "Notification_Error"
        },
        title: String,
        message: String
    }
}, "vi-error")
export class Error extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="error.html">`; }
}