import * as Polymer from "../../libs/polymer/polymer.js"
import { WebComponent } from "../../web-components/web-component/web-component.js"

@WebComponent.register()
export class PopupMenuItemSeparator extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="popup-menu-item-separator.html">`; }
}