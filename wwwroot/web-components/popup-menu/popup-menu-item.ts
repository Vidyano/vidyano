import * as Polymer from "../../libs/polymer/polymer.js"
import { Popup } from "../popup/popup.js"
import { PopupMenu } from "./popup-menu.js"
import { WebComponent } from "../../web-components/web-component/web-component.js"

@WebComponent.register({
    properties: {
        label: String,
        icon: String,
        noIcon: {
            type: Boolean,
            reflectToAttribute: true,
            value: false
        },
        checked: {
            type: Boolean,
            reflectToAttribute: true,
            value: false
        },
        hasChildren: {
            type: Boolean,
            reflectToAttribute: true,
            value: false,
            readOnly: true
        }
    },
    listeners: {
        "tap": "_onTap"
    }
})
export class PopupMenuItem extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="popup-menu-item.html">`; }

    private _observer: Polymer.FlattenedNodesObserver;
    readonly hasChildren: boolean; private _setHasChildren: (hasChildren: boolean) => void;
    checked: boolean;

    constructor(public label?: string, public icon?: string, private _action?: () => void) {
        super();
    }

    connectedCallback() {
        super.connectedCallback();

        const subItems = <HTMLSlotElement>this.$.subItems;
        this._observer = new Polymer.FlattenedNodesObserver(this.$.subItems, info => {
            this._setHasChildren(subItems.assignedNodes({ flatten: true }).length > 0);
        });
    }

    disconnectedCallback() {
        this._observer.disconnect();
        super.disconnectedCallback();
    }

    private _onTap(e: Polymer.Gestures.TapEvent) {
        if (this._action) {
            this._action();
            Popup.closeAll();

            e.stopPropagation();
            e.preventDefault();
        }
    }

    private _catchTap(e: Polymer.Gestures.TapEvent) {
        if (!this.hasChildren)
            return;

        if ((<PopupMenu>this.$.popup).open) {
            e.stopPropagation();
            e.stopImmediatePropagation();
            e.preventDefault();
        }
    }
}