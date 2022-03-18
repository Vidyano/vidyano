import * as Polymer from "../../libs/polymer/polymer.js"
import { WebComponent } from "../web-component/web-component.js"

@WebComponent.register({
    properties: {
        icon: {
            type: String,
            value: "Notification_Error"
        },
        title: String,
        message: String
    }
})
export class Error extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="error.html">`; }
}