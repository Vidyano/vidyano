import * as Polymer from "polymer"
import { WebComponent } from "components/web-component/web-component"

@WebComponent.register({
    properties: {
        disabled: {
            type: Boolean,
            reflectToAttribute: true
        }
    },
    sensitive: true
}, "vi-sensitive")
export class Sensitive extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="sensitive.html">` }
}