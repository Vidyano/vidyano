import * as Polymer from "../../libs/@polymer/polymer.js"
import { WebComponent } from "../web-component/web-component.js"

@WebComponent.register({
    properties: {
        color: {
            type: String,
            reflectToAttribute: true
        }
    },
    observers: [
        "_updateColor(color, isConnected)"
    ]
})
export class Spinner extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="spinner.html">` }

    private _updateColor(color: string, isConnected: boolean) {
        if (!isConnected)
            return;

        this.style.setProperty("--vi-spinner-color", color);
    }
}