import * as Polymer from "polymer"
import { WebComponent } from "components/web-component/web-component"

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