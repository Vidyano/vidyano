import * as Polymer from "../../libs/polymer/polymer"
import { WebComponent } from "../../web-components/web-component/web-component"
import "../../web-components/popup-menu/popup-menu"

@WebComponent.register({
    
})
export class PopupMenuTest extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="popup-menu-test.html">`; }
}