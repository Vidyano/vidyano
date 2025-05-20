import * as Polymer from "polymer"
import { WebComponent } from "components/web-component/web-component.js"

@WebComponent.register()
export class PopupMenuItemSeparator extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="popup-menu-item-separator.html">`; }
}