import * as Polymer from "polymer"
import * as IconRegister from "components/icon/icon-register"
import { Popup } from "components/popup/popup"
import "./popup-menu-item"
import "./popup-menu-item-separator"
import "./popup-menu-item-split"
import "./popup-menu-item-with-actions"
import { WebComponent } from "components/web-component/web-component"

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
}, "vi-popup-menu")
export class PopupMenu extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="popup-menu.html">`; }

    #contextHost: Element;
    #openContextEventListener: EventListener;
    contextMenuOnly: boolean;
    shiftKey: boolean;
    ctrlKey: boolean;
    openOnHover: boolean;
    open: boolean;

    popup(): Promise<any> {
        return (<Popup>this.$.popup).popup();
    }

    private _hookContextMenu(isConnected: boolean, contextMenu: boolean) {
        if (isConnected && contextMenu) {
            this.#contextHost = (this.getRootNode() as ShadowRoot).host;
            this.#contextHost.addEventListener("contextmenu", () => this.#openContextEventListener = this._openContext.bind(this));
        }
        else if (this.#contextHost) {
            this.#contextHost.removeEventListener("contextmenu", this.#openContextEventListener);
            this.#contextHost = this.#openContextEventListener = undefined;
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