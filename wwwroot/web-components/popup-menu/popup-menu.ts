import * as Polymer from "../../libs/@polymer/polymer.js"
import { Popup } from "../popup/popup.js"
import "./popup-menu-item.js"
import "./popup-menu-item-separator.js"
import "./popup-menu-item-split.js"
import "./popup-menu-item-with-actions.js"
import { WebComponent, WebComponentListener } from "../../web-components/web-component/web-component.js"

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
        rightAlign: {
            type: Boolean,
            reflectToAttribute: true,
            observer: "_alignmentChanged"
        },
        open: {
            type: Boolean,
            reflectToAttribute: true
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
export class PopupMenu extends WebComponentListener(WebComponent) {
    static get template() { return Polymer.html`<link rel="import" href="popup-menu.html">`; }

    private _openContextEventListener: EventListener;
    contextMenuOnly: boolean;
    shiftKey: boolean;
    ctrlKey: boolean;
    rightAlign: boolean;
    openOnHover: boolean;
    open: boolean;

    popup(): Promise<any> {
        return (<Popup>this.$.popup).popup();
    }

    private _hookContextMenu(isConnected: boolean, contextMenu: boolean) {
        // TODO: Fix old domHost

        // if (isConnected && contextMenu)
        //     this.domHost.addEventListener("contextmenu", this._openContextEventListener = this._openContext.bind(this));
        // else if (this._openContextEventListener) {
        //     this.domHost.removeEventListener("contextmenu", this._openContextEventListener);
        //     this._openContextEventListener = undefined;
        // }
    }

    private _openContext(e: MouseEvent): boolean {
        if (!this.contextMenuOnly)
            return true;

        if (e.which === 3 && !!this.shiftKey === !!e.shiftKey && !!this.ctrlKey === !!e.ctrlKey) {
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

    private _alignmentChanged() {
        (<Popup><any>this.$.popup).contentAlign = this.rightAlign ? "right" : "";
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