import * as Polymer from "../../libs/@polymer/polymer.js"
import { WebComponent } from "../web-component/web-component.js"

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