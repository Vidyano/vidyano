import * as Polymer from "../../libs/polymer/polymer"
import { WebComponent } from "../web-component/web-component"

@WebComponent.register({
    properties: {
        disabled: {
            type: Boolean,
            reflectToAttribute: true
        }
    },
    sensitive: true
})
export class Sensitive extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="sensitive.html">` }
}