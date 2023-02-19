import * as Polymer from "../../libs/polymer/polymer.js"
import * as IconRegister from "../icon/icon-register.js"
import { Popup } from "../popup/popup.js"
import "./popup-menu-item.js"
import "./popup-menu-item-separator.js"
import "./popup-menu-item-split.js"
import "./popup-menu-item-with-actions.js"
import { WebComponent } from "../../web-components/web-component/web-component.js"

@WebComponent.register({
    properties: {
        disabled: {
            type: Boolean,
            reflectToAttribute: true
        },
        openOnHover: {
            type: Boolean,
            reflectToAttribute: true
        },
        contextMenuOnly: {
            type: Boolean,
            reflectToAttribute: true,
            value: false
        },
        shiftKey: Boolean,
        ctrlKey: Boolean,
        open: {
            type: Boolean,
            reflectToAttribute: true
        },
        autoWidth: {
            type: Boolean,
            reflectToAttribute: true
        },
        placement: {
            type: String,
            reflectToAttribute: true,
            value: "bottom-start"
        }
    },
    observers: [
        "_hookContextMenu(isConnected, contextMenuOnly)"
    ],
    listeners: {
        "mouseenter": "_mouseenter",
        "mousemove": "_mousemove",
        "tap": "_stopTap"
    }
})
export class PopupMenu extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="popup-menu.html">`; }

    private _openContextEventListener: EventListener;
    contextMenuOnly: boolean;
    shiftKey: boolean;
    ctrlKey: boolean;
    openOnHover: boolean;
    open: boolean;

    popup(): Promise<any> {
        return (<Popup>this.$.popup).popup();
    }

    private _hookContextMenu(isConnected: boolean, contextMenu: boolean) {
        if (isConnected && contextMenu)
            (this.getRootNode() as ShadowRoot).host.addEventListener("contextmenu", this._openContextEventListener = this._openContext.bind(this));
        else if (this._openContextEventListener) {
            (this.getRootNode() as ShadowRoot).host.removeEventListener("contextmenu", this._openContextEventListener);
            this._openContextEventListener = undefined;
        }
    }

    private _openContext(e: MouseEvent): boolean {
        if (!this.contextMenuOnly)
            return true;

        if (e.button === 2 && !!this.shiftKey === !!e.shiftKey && !!this.ctrlKey === !!e.ctrlKey) {
            const popup = <Popup><any>this.$.popup;

            popup.style.left = e.pageX + "px";
            popup.style.top = e.pageY + "px";

            if (!popup.open)
                popup.popup();
            else
                popup.close();

            e.preventDefault();
            e.stopPropagation();

            return false;
        }
    }

    private _popupMenuIconSpaceHandler(e: Event) {
        const elements = (e.target as HTMLSlotElement).assignedElements() as any[];
        const iconSpace = elements.some(e => e.icon && IconRegister.exists(e.icon));
    
        elements.forEach(e => e.iconSpace = iconSpace && (!e.icon || !IconRegister.exists(e.icon)));
    }

    private _mouseenter() {
        if (this.openOnHover)
            this.popup();
    }

    private _mousemove(e: MouseEvent) {
        e.stopPropagation();
    }

    private _stopTap(e: Polymer.Gestures.TapEvent) {
        e.stopPropagation();
    }
}