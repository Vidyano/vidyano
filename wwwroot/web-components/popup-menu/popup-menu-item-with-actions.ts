import * as Polymer from "../../libs/polymer/polymer.js"
import * as IconRegister from "../icon/icon-register.js"
import { Popup } from "../popup/popup.js"
import { WebComponent } from "../../web-components/web-component/web-component.js"

@WebComponent.register({
    properties: {
        label: String,
        icon: String,
        iconSpace: {
            type: Boolean,
            reflectToAttribute: true
        },
    },
    listeners: {
        "tap": "_onTap"
    }
})
export class PopupMenuItemWithActions extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="popup-menu-item-with-actions.html">`; }

    iconSpace: boolean;

    constructor(public label?: string, public icon?: string, private _action?: () => void) {
        super();
    }

    private _popupMenuIconSpaceHandler(e: Event) {
        const elements = (e.target as HTMLSlotElement).assignedElements() as any[];
        const iconSpace = elements.some(e => e.icon && IconRegister.exists(e.icon));
    
        elements.forEach(e => e.iconSpace = iconSpace && (!e.icon || !IconRegister.exists(e.icon)));
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