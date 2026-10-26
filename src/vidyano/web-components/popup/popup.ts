import * as Polymer from "polymer"
import "components/size-tracker/size-tracker"
import { ISize } from "components/size-tracker/size-tracker"
import { WebComponent } from "components/web-component/web-component"
import { autoUpdate, computePosition, flip, Placement, shift, size} from '@floating-ui/dom'

import { Scroller } from "components/scroller/scroller"

let _documentClosePopupListener: EventListener;
document.addEventListener("mousedown", _documentClosePopupListener = e => {
    const target = e.target;
    if (!target)
        return;

    let shouldClose = true;
    for (const el of e.composedPath()) {
        // Stop iterating if we reach the document root
        if (el === document)
            break;

        // Skip processing if the current item in the path is not an Element
        if (!(el instanceof Element))
            continue;

        // Is the click within the DOM structure of an open popup?
        const containingPopup = el.closest("vi-popup") as Popup | null;
        if (containingPopup && containingPopup.open) {
            shouldClose = false;
            break;
        }

        // Is the click on the trigger element that references an open popup?
        const elPopupRef = (el as any).popup;
        if (elPopupRef instanceof Popup && elPopupRef.open) {
             shouldClose = false;
             break;
        }
    }

    if (shouldClose)
        Popup.closeAll();
});
document.addEventListener("touchstart", _documentClosePopupListener);

const openPopups: Popup[] = [];

@WebComponent.register({
    properties: {
        closeDelay: {
            type: Number,
            value: 500
        },
        openDelay: {
            type: Number,
            value: 0
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
            notify: true,
            observer: "_openChanged"
        },
        openOnHover: {
            type: Boolean,
            reflectToAttribute: true,
            value: false
        },
        placement: {
            type: String,
            reflectToAttribute: true,
            value: "bottom-start"
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
        },
        supportsPopover: {
            type: Boolean,
            readOnly: true,
            value: () => HTMLElement.prototype.hasOwnProperty("popover")
        },
    },
    observers: [
        "_hookTapAndHoverEvents(isConnected, openOnHover)"
    ],
    listeners: {
        "tap": "_tap"
    }
}, "vi-popup")
export class Popup extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="popup.html">` }

    #cleanup: ReturnType<typeof autoUpdate>;
    private _tapHandler: EventListener;
    private _enterHandler: EventListener;
    private _leaveHandler: EventListener;
    private _headerLeaveHandler: EventListener;
    private _toggleSize: ISize;
    private _header: HTMLElement;
    private _resolver: Function;
    private _closeOnMoveoutTimer: ReturnType<typeof setTimeout>;
    private _openOnHoverTimer: ReturnType<typeof setTimeout>;
    private _currentTarget: HTMLElement | WebComponent;
    readonly open: boolean; protected _setOpen: (val: boolean) => void;
    readonly hover: boolean; private _setHover: (val: boolean) => void;
    readonly renderPopupCoreFit: boolean; private _setRenderPopupCoreFit: (renderPopupCoreFit: boolean) => void;
    readonly supportsPopover: boolean;
    placement: Placement;
    disabled: boolean;
    sticky: boolean;
    closeDelay: number;
    openDelay: number;
    openOnHover: boolean;
    autoWidth: boolean;

    connectedCallback() {
        super.connectedCallback();

        this.addEventListener("popupparent", this._onPopupparent);
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        this.removeEventListener("popupparent", this._onPopupparent);
        this.#cleanup?.();

        clearTimeout(this._openOnHoverTimer);
        clearTimeout(this._closeOnMoveoutTimer);
    }

    popup(): Promise<any> {
        if (this.open)
            return Promise.resolve();

        return new Promise(resolve => {
            this._resolver = resolve;
            this._open();
        });
    }

    private _open() {
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

        this.#cleanup = autoUpdate(this.$.anchor, this.$.popup, this.refit.bind(this));
        this._setOpen(true);

        openPopups.push(this);

        this.fire("popup-opened", null, { bubbles: false, cancelable: false });
    }

    private _sizeChanged(e: CustomEvent) {
        if (!this.open)
            return;

        this.refit();
    }

    /**
     * Repositions the popup relative to its anchor element using Floating UI.
     * The popup flips to the side of its anchor with the most room and shifts along it to stay in the viewport;
     * only content that still doesn't fit gets capped: a single slotted vi-scroller, or else the popup itself, which then scrolls.
     */
    async refit() {
        const popup = this.$.popup as HTMLElement;

        let maxPopupWidth = Infinity;
        let { x, y } = await computePosition(this.$.anchor, popup, {
            placement: this.placement,
            strategy: "fixed",
            middleware: [
                // Pick the side on the content's full size, not on the size a cap shrank the popup to or on the empty size
                // measured before the popover was shown. Only the first pass: once size() caps the popup it resets to the
                // capped rects, which fit the chosen side and place the popup at its real size
                {
                    name: "contentSize",
                    fn: ({ rects, middlewareData }) => {
                        if (middlewareData.contentSize)
                            return {};

                        const content = this._measureContent(popup);
                        const measured = Math.abs(rects.floating.width - content.width) < 1 && Math.abs(rects.floating.height - content.height) < 1;
                        return {
                            data: content,
                            reset: measured ? undefined : { rects: { reference: rects.reference, floating: { ...rects.floating, ...content } } }
                        };
                    }
                },
                flip(),
                shift({
                    boundary: this.supportsPopover ? undefined : this.findParent<Scroller>(e => e instanceof Scroller)?.scroller,
                    rootBoundary: this.supportsPopover ? "viewport" : undefined
                }),
                size({
                    apply: ({ availableWidth, availableHeight, middlewareData }) => {
                        const maxWidth = Math.max(0, availableWidth - 5);
                        const maxHeight = Math.max(0, availableHeight - 5);
                        maxPopupWidth = maxWidth;

                        const scroller = this._slottedScroller(popup);
                        if (scroller) {
                            Object.assign(scroller.style, {
                                maxWidth: `${maxWidth}px`,
                                maxHeight: `${maxHeight}px`,
                            });
                            // The scroller scrolls, drop a cap the popup got while it held other content
                            Object.assign(popup.style, { maxWidth: "", maxHeight: "", overflow: "" });
                            return;
                        }

                        // Last resort, the content fits on no side of the anchor: cap the popup and let it scroll
                        const content: { width: number; height: number } = middlewareData.contentSize;
                        const capped = content.width > maxWidth || content.height > maxHeight;
                        Object.assign(popup.style, {
                            maxWidth: capped ? `${maxWidth}px` : "",
                            maxHeight: capped ? `${maxHeight}px` : "",
                            overflow: capped ? "auto" : ""
                        });
                    },
                })
            ]
        });

        Object.assign(popup.style, {
            left: `${x}px`,
            top: `${y}px`,
            minWidth: this.autoWidth && this._toggleSize?.width ? `${Math.min(this._toggleSize.width, maxPopupWidth)}px` : undefined
        });
    }

    private _slottedScroller(popup: HTMLElement): Scroller | null {
        const slottedElements = popup.querySelector("slot").assignedElements();
        return slottedElements.length === 1 && slottedElements[0] instanceof Scroller ? slottedElements[0] : null;
    }

    /**
     * Measures the popup at its content's full size, in the viewport's top left corner where a fixed popup can take its natural width.
     * A cap a previous refit put on the popup or its scroller is lifted for the measurement; the position, the cap
     * and the scroll position the cap allowed are put back before the browser paints.
     */
    private _measureContent(popup: HTMLElement): { width: number; height: number } {
        const scroller = this._slottedScroller(popup);
        const capped = scroller ?? popup;
        const { maxWidth, maxHeight } = capped.style;
        const isCapped = !!(maxWidth || maxHeight);
        const scrolled = isCapped ? (scroller ? scroller.scroller : popup) : null;
        const { scrollTop, scrollLeft } = scrolled ?? { scrollTop: 0, scrollLeft: 0 };
        const { left, top } = popup.style;

        Object.assign(popup.style, { left: "0px", top: "0px" });
        if (isCapped)
            capped.style.maxWidth = capped.style.maxHeight = "";

        const { width, height } = popup.getBoundingClientRect();
        Object.assign(popup.style, { left, top });

        if (isCapped) {
            Object.assign(capped.style, { maxWidth, maxHeight });

            if (scrolled) {
                scrolled.scrollTop = scrollTop;
                scrolled.scrollLeft = scrollLeft;
            }
        }

        return { width, height };
    }

    close() {
        if (!this.open || this.fire("popup-closing", null, { bubbles: false, cancelable: true }).defaultPrevented)
            return;

        // Clear any pending open timer
        clearTimeout(this._openOnHoverTimer);
        this._openOnHoverTimer = undefined;

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

        this.#cleanup?.();
        openPopups.remove(this);

        this.fire("popup-closed", null, { bubbles: false, cancelable: false });
    }

    private _hookTapAndHoverEvents() {
        this._header = <HTMLElement>this.$.anchor || this.parentElement;

        if (this._header === this.parentElement)
            (<any>this._header).popup = this;

        if (this.isConnected) {
            if (this.openOnHover) {
                // Add delay logic to mouseenter
                this._header.addEventListener("mouseenter", this._enterHandler = () => {
                    clearTimeout(this._openOnHoverTimer); // Clear previous timer if any
                    clearTimeout(this._closeOnMoveoutTimer); // Clear pending close timer when re-entering header

                    if (!this.open) { // Only schedule open if not already open
                        if (this.openDelay > 0) {
                            this._openOnHoverTimer = setTimeout(() => {
                                this.popup();
                                this._openOnHoverTimer = undefined;
                            }, this.openDelay);
                        } else {
                            this.popup(); // Open immediately if delay is 0
                        }
                    }
                });
                // Add listener to header to cancel open timer on leave
                this._header.addEventListener("mouseleave", this._headerLeaveHandler = () => {
                    clearTimeout(this._openOnHoverTimer);
                    this._openOnHoverTimer = undefined;
                });
                // Keep existing leave handler on popup content for closing
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

            if (this._headerLeaveHandler) {
                this._header.removeEventListener("mouseleave", this._headerLeaveHandler);
                this._headerLeaveHandler = undefined;
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

        // Clear any pending hover open timer for instant click open
        clearTimeout(this._openOnHoverTimer);
        this._openOnHoverTimer = undefined;

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

        // Clear pending open timer if mouse enters content before timer fires
        clearTimeout(this._openOnHoverTimer);
        this._openOnHoverTimer = undefined;

        if (this._closeOnMoveoutTimer) {
            clearTimeout(this._closeOnMoveoutTimer);
            this._closeOnMoveoutTimer = undefined;
        }
    }

    protected _contentMouseLeave(e: MouseEvent) {
        if (this.openOnHover && !this.sticky) {
            this._closeOnMoveoutTimer = setTimeout(() => {
                this.close();
            }, this.closeDelay);
        }


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

    private _openChanged(open: boolean) {
        if (!this.supportsPopover)
            return;

        if (open)
            this.$.popup.showPopover();
        else
            this.$.popup.hidePopover();
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

    private _getPopover(supportsPopover: boolean) {
        // Return empty string to prevent Polymer from stamping 'true' as attribute value
        return supportsPopover ? "" : null;
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