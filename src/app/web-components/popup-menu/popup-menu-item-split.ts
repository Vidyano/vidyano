import * as Polymer from "polymer"
import * as IconRegister from "components/icon/icon-register"
import { Popup } from "components/popup/popup"
import { WebComponent } from "components/web-component/web-component"

@WebComponent.register({
    properties: {
        label: String,
        icon: String,
        iconSpace: {
            type: Boolean,
            reflectToAttribute: true
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
export class PopupMenuItemSplit extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="popup-menu-item-split.html">`; }

    private _observer: Polymer.FlattenedNodesObserver;
    readonly hasChildren: boolean; private _setHasChildren: (hasChildren: boolean) => void;
    iconSpace: boolean;
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

    private _popupMenuIconSpaceHandler(e: Event) {
        const elements = (e.target as HTMLSlotElement).assignedElements() as any[];
        const iconSpace = elements.some(e => e.icon && IconRegister.exists(e.icon));
    
        elements.forEach(e => e.iconSpace = iconSpace && (!e.icon || !IconRegister.exists(e.icon)));
    }

    private _onTap(e: Polymer.Gestures.TapEvent) {
        if (this._action) {
            this._action();
            Popup.closeAll();

            e.stopPropagation();
            e.preventDefault();
        }
    }

    private _splitTap(e: Event) {
        e.stopPropagation();
    }
}