import * as Polymer from "../../libs/polymer/polymer"
import { Popup } from "../popup/popup"
import { WebComponent, WebComponentListener } from "../../web-components/web-component/web-component"

@WebComponent.register({
    properties: {
        label: String,
        icon: String
    },
    listeners: {
        "tap": "_onTap"
    }
})
export class PopupMenuItemWithActions extends WebComponentListener(WebComponent) {
    static get template() { return Polymer.html`<link rel="import" href="popup-menu-item-with-actions.html">`; }

    constructor(public label?: string, public icon?: string, private _action?: () => void) {
        super();
    }

    private _onTap(e: Polymer.Gestures.TapEvent) {
        if (this._action) {
            this._action();
            Popup.closeAll();

            e.preventDefault();
            e.stopPropagation();
        }
    }

    private _actionsTap(e: Polymer.Gestures.TapEvent) {
        Popup.closeAll();
        e.stopPropagation();
    }

    private _catch(e: Event) {
        e.stopPropagation();
        e.preventDefault();
    }
}