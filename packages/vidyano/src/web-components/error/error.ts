import * as Polymer from "polymer"
@Polymer.WebComponent.register({
    properties: {
        icon: {
            type: String,
            value: "Notification_Error"
        },
        title: String,
        message: String
    }
}, "vi-error")
export class Error extends Polymer.WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="error.html">`; }
}
