import * as Polymer from "../../libs/polymer/polymer.js"
import { WebComponent } from "../../web-components/web-component/web-component.js"
import "../../web-components/popup-menu/popup-menu.js"

@WebComponent.register({
    
})
export class PopupMenuTest extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="popup-menu-test.html">`; }
}