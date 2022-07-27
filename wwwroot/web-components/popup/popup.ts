import * as Polymer from "../../libs/polymer/polymer.js"
import { IronFitBehavior } from "@polymer/iron-fit-behavior"
import "../size-tracker/size-tracker.js"
import { ISize } from "../size-tracker/size-tracker.js"
import { WebComponent } from "../web-component/web-component.js"

let _documentClosePopupListener: EventListener;
document.addEventListener("mousedown", _documentClosePopupListener = e => {
    const path = e.composedPath().slice();
    do {
        const el = path.shift();
        if (!el || el === <any>document) {
            Popup.closeAll();
            break;
        }
        else if ((<any>el).__Vidyano_WebComponents_PopupCore__Instance__ && (<Popup><any>el).open)
            break;
        else if ((<any>el).popup && (<any>el).popup.__Vidyano_WebComponents_PopupCore__Instance__ && (<Popup>(<any>el).popup).open)
            break;
    }
    while (true);
});
document.addEventListener("touchstart", _documentClosePopupListener);

const openPopups: Popup[] = [];

export type VerticalAlign = "top" | "middle" | "bottom" | "auto";
export type HorizontalAlign = "left" | "center" | "right" | "auto";

type Position = {
    verticalAlign: VerticalAlign;
    horizontalAlign: HorizontalAlign;
    top: number;
    left: number;
    offscreenArea?: number;
};

class PopupCoreFit extends Polymer.mixinBehaviors(IronFitBehavior, Polymer.PolymerElement) {
    static get template() { return Polymer.html`<slot></slot>`; }

    verticalOffset: number;
    horizontalOffset: number;
    noOverlap: boolean;
    dynamicAlign: boolean;

    private __getPosition(hAlign: HorizontalAlign, vAlign: VerticalAlign, size: ISize, sizeNoMargins: ISize, positionRect: DOMRect, fitRect: DOMRect) {
        // All the possible configurations.
        // Ordered as top-left, top-right, bottom-left, bottom-right.
        const positions: Position[] = [
            {
                verticalAlign: "top",
                horizontalAlign: "left",
                top: positionRect.top + this.verticalOffset,
                left: positionRect.left - size.width + this.horizontalOffset
            }, {
                verticalAlign: "top",
                horizontalAlign: "right",
                top: positionRect.top + this.verticalOffset,
                left: positionRect.right - this.horizontalOffset
            }, {
                verticalAlign: "bottom",
                horizontalAlign: "left",
                top: positionRect.bottom + this.verticalOffset,
                left: positionRect.left + this.horizontalOffset
            }, {
                verticalAlign: "bottom",
                horizontalAlign: "right",
                top: positionRect.bottom - this.verticalOffset,
                left: positionRect.right - size.width - this.horizontalOffset
            }
        ];

        // Consider auto as null for coding convenience.
        vAlign = vAlign === "auto" ? null : vAlign;
        hAlign = hAlign === "auto" ? null : hAlign;

        if (!hAlign || hAlign === "center") {
            positions.push({
                verticalAlign: "top",
                horizontalAlign: "center",
                top: positionRect.top + this.verticalOffset + (this.noOverlap ? positionRect.height : 0),
                left: positionRect.left - sizeNoMargins.width / 2 + positionRect.width / 2 + this.horizontalOffset
            });

            positions.push({
                verticalAlign: "bottom",
                horizontalAlign: "center",
                top: positionRect.bottom - size.height - this.verticalOffset - (this.noOverlap ? positionRect.height : 0),
                left: positionRect.left - sizeNoMargins.width / 2 + positionRect.width / 2 + this.horizontalOffset
            });
        }

        if (!vAlign || vAlign === "middle") {
            positions.push({
                verticalAlign: "middle",
                horizontalAlign: "left",
                top: positionRect.top - sizeNoMargins.height / 2 + positionRect.height / 2 + this.verticalOffset,
                left: positionRect.left + this.horizontalOffset + (this.noOverlap ? positionRect.width : 0)
            });

            positions.push({
                verticalAlign: "middle",
                horizontalAlign: "right",
                top: positionRect.top - sizeNoMargins.height / 2 + positionRect.height / 2 + this.verticalOffset,
                left: positionRect.right - size.width - this.horizontalOffset - (this.noOverlap ? positionRect.width : 0)
            });
        }

        if (vAlign === "middle" && hAlign === "center") {
            positions.push({
                verticalAlign: "middle",
                horizontalAlign: "center",
                top: positionRect.top - sizeNoMargins.height / 2 + positionRect.height / 2 + this.verticalOffset,
                left: positionRect.left - sizeNoMargins.width / 2 + positionRect.width / 2 + this.horizontalOffset
            });
        }

        let position: Position;
        for (let i = 0; i < positions.length; i++) {
            const candidate = positions[i];
            const vAlignOk = candidate.verticalAlign === vAlign;
            const hAlignOk = candidate.horizontalAlign === hAlign;

            // If both vAlign and hAlign are defined, return exact match.
            // For dynamicAlign and noOverlap we"ll have more than one candidate, so
            // we"ll have to check the offscreenArea to make the best choice.
            if (!this.dynamicAlign && !this.noOverlap && vAlignOk && hAlignOk) {
                position = candidate;
                break;
            }

            // Align is ok if alignment preferences are respected. If no preferences,
            // it is considered ok.
            const alignOk = (!vAlign || vAlignOk) && (!hAlign || hAlignOk);

            // Filter out elements that don"t match the alignment (if defined).
            // With dynamicAlign, we need to consider all the positions to find the
            // one that minimizes the cropped area.
            if (!this.dynamicAlign && !alignOk)
                continue;

            candidate.offscreenArea = this.__getOffscreenArea(candidate, size, fitRect);

            // If not cropped and respects the align requirements, keep it.
            // This allows to prefer positions overlapping horizontally over the
            // ones overlapping vertically.
            if (candidate.offscreenArea === 0 && alignOk) {
                position = candidate;
                break;
            }

            position = position || candidate;
            const diff = candidate.offscreenArea - position.offscreenArea;
            // Check which crops less. If it crops equally, check if at least one align setting is ok.
            if (diff < 0 || (diff === 0 && (vAlignOk || hAlignOk)))
                position = candidate;
        }

        return position;
    }

    private __getOffscreenArea: (position: Position, size: ISize, fitRect: DOMRect) => number;
}

customElements.define("vi-popup-core-fit", <CustomElementConstructor><any>PopupCoreFit);

@WebComponent.register({
    properties: {
        closeDelay: {
            type: Number,
            value: 500
        },
        disabled: {
            type: Boolean,
            reflectToAttribute: true
        },
        hover: {
            type: Boolean,
            reflectToAttribute: true,
            readOnly: true,
            observer: "_hoverChanged"
        },
        open: {
            type: Boolean,
            readOnly: true,
            reflectToAttribute: true,
            notify: true
        },
        openOnHover: {
            type: Boolean,
            reflectToAttribute: true,
            value: false
        },
        horizontalAlign: {
            type: String,
            reflectToAttribute: true,
            value: "left"
        },
        verticalAlign: {
            type: String,
            reflectToAttribute: true,
            value: "bottom"
        },
        sticky: {
            type: Boolean,
            reflectToAttribute: true
        },
        autoWidth: {
            type: Boolean,
            reflectToAttribute: true
        },
        renderPopupCoreFit: {
            type: Boolean,
            readOnly: true
        }
    },
    observers: [
        "_hookTapAndHoverEvents(isConnected, openOnHover)"
    ],
    listeners: {
        "tap": "_tap"
    }
})
export class Popup extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="popup.html">` }

    private _tapHandler: EventListener;
    private _enterHandler: EventListener;
    private _leaveHandler: EventListener;
    private _toggleSize: ISize;
    private _header: HTMLElement;
    private __Vidyano_WebComponents_PopupCore__Instance__ = true;
    private _refitAF: number = null;
    private _resolver: Function;
    private _closeOnMoveoutTimer: ReturnType<typeof setTimeout>;
    private _currentTarget: HTMLElement | WebComponent;
    readonly open: boolean; protected _setOpen: (val: boolean) => void;
    readonly hover: boolean; private _setHover: (val: boolean) => void;
    readonly renderPopupCoreFit: boolean; private _setRenderPopupCoreFit: (renderPopupCoreFit: boolean) => void;
    verticalAlign: "top" | "middle" | "bottom" | "auto";
    horizontalAlign: "left" | "center" | "right" | "auto";
    disabled: boolean;
    sticky: boolean;
    closeDelay: number;
    openOnHover: boolean;
    autoWidth: boolean;

    connectedCallback() {
        super.connectedCallback();

        this.addEventListener("popupparent", this._onPopupparent);
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        this.removeEventListener("popupparent", this._onPopupparent);
    }

    popup(target: HTMLElement | WebComponent = this._header): Promise<any> {
        if (this.open)
            return Promise.resolve();

        return new Promise(resolve => {
            this._resolver = resolve;
            this._open(target);
        });
    }

    private _open(target: HTMLElement | WebComponent) {
        if (!this.renderPopupCoreFit) {
            this._setRenderPopupCoreFit(true);
            Polymer.flush();
        }

        const parentPopup = this._findParentPopup();
        if (this.open || this.hasAttribute("disabled") || this.fire("popup-opening", null, { bubbles: false, cancelable: true }).defaultPrevented)
            return;

        // Close non-parent popups
        const firstOpenNonParentChild = openPopups[parentPopup == null ? 0 : openPopups.indexOf(parentPopup) + 1];
        if (firstOpenNonParentChild != null)
            firstOpenNonParentChild.close();

        const fit = this.shadowRoot.getElementById("fit") as PopupCoreFit;
        (<IronFitBehavior><any>fit).positionTarget = this._currentTarget = target;
        this.refit();

        this._setOpen(true);

        openPopups.push(this);

        this.fire("popup-opened", null, { bubbles: false, cancelable: false });
    }

    private _sizeChanged(e: CustomEvent) {
        this.refit();
    }

    refit() {
        this._refitAF && cancelAnimationFrame(this._refitAF);
        this._refitAF = requestAnimationFrame(() => {
            const fit = this.shadowRoot.getElementById("fit") as PopupCoreFit;
            if (this.autoWidth && this._toggleSize?.width)
                fit.style.minWidth = `${this._toggleSize.width}px`;

            this._refitAF = null;
            (<IronFitBehavior><any>fit).refit();
        });
    }

    close() {
        if (!this.open || this.fire("popup-closing", null, { bubbles: false, cancelable: true }).defaultPrevented)
            return;

        if (!this.open && this._closeOnMoveoutTimer) {
            clearTimeout(this._closeOnMoveoutTimer);
            this._closeOnMoveoutTimer = undefined;
        }

        const openChild = openPopups[openPopups.indexOf(this) + 1];
        if (openChild != null)
            openChild.close();

        this._currentTarget = null;
        this._setOpen(false);
        this._setHover(false);

        if (this._resolver)
            this._resolver();

        openPopups.remove(this);

        this.fire("popup-closed", null, { bubbles: false, cancelable: false });
    }

    private _hookTapAndHoverEvents() {
        this._header = <HTMLElement>this.shadowRoot.querySelector("[toggle]") || this.parentElement;

        if (this._header === this.parentElement)
            (<any>this._header).popup = this;

        if (this.isConnected) {
            if (this.openOnHover) {
                this._header.addEventListener("mouseenter", this._enterHandler = () => this.popup());
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

            this.popup();

            e.stopPropagation();
            break;
        }
        while (path.length);
    }

    private _onPopupparent(e: CustomEvent) {
        e.detail.popup = this;
        e.stopPropagation();
    }

    protected _findParentPopup(): Popup {
        const e = this.fire("popupparent", { popup: null }, {
            bubbles: true,
            composed: true,
            node: this.parentElement || (<ShadowRoot>this.parentNode)?.host
        }) as CustomEvent;

        return !e.defaultPrevented ? e.detail.popup as Popup : null;
    }

    private _catchContentClick(e?: Event) {
        if (this.sticky)
            e.stopPropagation();
    }

    protected _contentMouseEnter(e: MouseEvent) {
        if (this._setHover)
            this._setHover(true);

        if (this._closeOnMoveoutTimer) {
            clearTimeout(this._closeOnMoveoutTimer);
            this._closeOnMoveoutTimer = undefined;
        }
    }

    protected _contentMouseLeave(e: MouseEvent) {
        if (this.openOnHover)
            return;

        if (e.relatedTarget == null) {
            e.stopPropagation();
            return;
        }

        if (!this.sticky) {
            this._closeOnMoveoutTimer = setTimeout(() => {
                this.close();
            }, this.closeDelay);
        }
    }

    private _hoverChanged(hover: boolean) {
        if (!this._currentTarget)
            return;

        if (hover)
            this._currentTarget.setAttribute("hover", "");
        else
            this._currentTarget.removeAttribute("hover");
    }

    private _toggleSizeChanged(e: Event, detail: { width: number; height: number }) {
        this._toggleSize = detail;
        if (!this.open)
            return;

        this.refit();

        e.stopPropagation();
    }

    static closeAll(parent?: HTMLElement | WebComponent) {
        const rootPopup = openPopups[0];
        if (rootPopup && (!parent || Popup._isDescendant(<HTMLElement>parent, rootPopup)))
            rootPopup.close();
    }

    private static _isDescendant(parent: HTMLElement, child: HTMLElement): boolean {
        let node = child.parentNode;
        while (node != null) {
            if (node === parent)
                return true;

            node = node.parentNode;
        }

        return false;
    }
}