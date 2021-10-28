import * as Polymer from "../../libs/@polymer/polymer.js"
import { PopupCore } from "./popup-core.js"
import { SizeTracker } from "../size-tracker/size-tracker.js"
import { WebComponent, WebComponentListener } from "../web-component/web-component.js"

@WebComponent.register({
    properties: {
        autoSizeContent: {
            type: Boolean,
            reflectToAttribute: true
        },
        openOnHover: {
            type: Boolean,
            reflectToAttribute: true,
            value: false
        },
        closeDelay: {
            type: Number,
            value: 500
        }
    },
    observers: [
        "_hookTapAndHoverEvents(isConnected, openOnHover)"
    ],
    listeners: {
        "tap": "_tap"
    }
})
export class Popup extends WebComponentListener(PopupCore) {
    static get template() { return Polymer.html`<link rel="import" href="popup.html">` }

    private _tapHandler: EventListener;
    private _enterHandler: EventListener;
    private _leaveHandler: EventListener;
    private _header: HTMLElement;
    autoSizeContent: boolean;
    openOnHover: boolean;

    popup(): Promise<any> {
        return super.popup(this._header);
    }

    protected _open(target: HTMLElement | WebComponent) {
        super._open(target, this.$.content);

        const rootSizeTracker = <SizeTracker><any>this.$.toggleSizeTracker;
        rootSizeTracker.measure();
    }

    private _hookTapAndHoverEvents() {
        this._header = <HTMLElement>this.shadowRoot.querySelector("[toggle]") || this.parentElement;

        if (this._header === this.parentElement)
            (<any>this._header).popup = this;

        if (this.isConnected) {
            if (this.openOnHover) {
                this._header.addEventListener("mouseenter", this._enterHandler = this._onOpen.bind(this));
                this.addEventListener("mouseleave", this._leaveHandler = this.close.bind(this));
            }
            else
                this._header.addEventListener("tap", this._tapHandler = this._tap.bind(this));
        }
        else {
            if (this._enterHandler) {
                this._header.removeEventListener("mouseenter", this._enterHandler);
                this._enterHandler = undefined;
            }

            if (this._leaveHandler) {
                this.removeEventListener("mouseleave", this._leaveHandler);
                this._leaveHandler = undefined;
            }

            if (this._tapHandler) {
                this._header.removeEventListener("tap", this._tapHandler);
                this._tapHandler = undefined;
            }
        }
    }

    private _tap(e: CustomEvent) {
        if (this.disabled)
            return;

        if (this.open) {
            if (!this.sticky)
                this.close();

            return;
        }

        const path = e.composedPath().slice();
        do {
            if (this._header !== path.shift())
                continue;

            this._onOpen(e);

            e.stopPropagation();
            break;
        }
        while (path.length);
    }

    private _onOpen(e: Event) {
        if (!this.open)
            this._open(this._header);

        e.stopPropagation();
        e.preventDefault();
    }

    protected _contentMouseLeave(e: MouseEvent) {
        if (this.openOnHover)
            return;

        super._contentMouseLeave(e);
    }

    private _toggleSizeChanged(e: Event, detail: { width: number; height: number }) {
        if (!this.autoSizeContent) {
            if (this._currentOrientation === "vertical") {
                let minWidth = detail.width;
                if (this.boundingTarget) {
                    const maxWidth = this._getTargetRect(this.boundingTarget).targetRect.width;
                    if (maxWidth > 0) {
                        this.$.content.style.maxWidth = maxWidth + "px";

                        if (minWidth > maxWidth)
                            minWidth = maxWidth;
                    }
                    else
                        this.$.content.style.maxWidth = "initial";
                }

                this.$.content.style.minWidth = minWidth + "px";
            }
            else
                this.$.content.style.minHeight = detail.height + "px";
        }
        else {
            if (this._currentOrientation === "vertical") {
                if (this.boundingTarget)
                    this.$.content.style.maxWidth = this._getTargetRect(this.boundingTarget).targetRect.width + "px";

                this.$.content.style.width = detail.width + "px";
            }
            else
                this.$.content.style.height = detail.height + "px";
        }

        e.stopPropagation();
    }

    static closeAll(parent?: HTMLElement | WebComponent) {
        PopupCore.closeAll(parent);
    }
}