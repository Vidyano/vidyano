import { html, nothing, unsafeCSS } from "lit";
import { WebComponentLit, property } from "components/web-component/web-component-lit.js";
import { autoUpdate, computePosition, flip, Placement, shift, size } from '@floating-ui/dom';
import { ISize } from "components/size-tracker/size-tracker";
import { Scroller } from "components/scroller/scroller";
import "components/size-tracker/size-tracker";
import styles from "./popup.css";

/**
 * Closes all popups when clicking outside. Walks the event path to check if
 * the click originated from within any popup or an element referencing a popup.
 */
document.addEventListener("pointerdown", (e: PointerEvent) => {
    if (!e.target)
        return;

    const hasOpenPopupInPath = e.composedPath().some(el => {
        if (el === document || !(el instanceof Element))
            return false;

        const containingPopup = el.closest("vi-popup") as Popup | null;
        if (containingPopup?.open)
            return true;

        // Legacy: Support for elements with a .popup property reference
        // Allows programmatic association of trigger elements to popups
        const elPopupRef = 'popup' in el ? (el as any).popup : undefined;
        if (elPopupRef instanceof Popup && elPopupRef.open) {
            console.warn('[Deprecated] Using .popup property on elements is deprecated. Use proper DOM hierarchy instead.', el);
            return true;
        }

        return false;
    });

    if (!hasOpenPopupInPath)
        Popup.closeAll();
});

const openPopups: Popup[] = [];

export class Popup extends WebComponentLit {
    static styles = unsafeCSS(styles);

    /**
     * Delay in milliseconds before closing the popup when hover is lost.
     */
    @property({ type: Number })
    closeDelay: number = 500;

    /**
     * Delay in milliseconds before opening the popup on hover.
     */
    @property({ type: Number })
    openDelay: number = 0;

    /**
     * Whether the popup is disabled and cannot be opened.
     */
    @property({ type: Boolean, reflect: true })
    disabled: boolean = false;

    /**
     * Whether the popup trigger element has hover state.
     */
    @property({ type: Boolean, state: true, observer: '_onHoverChanged' })
    hover: boolean = false;

    /**
     * Whether the popup is currently open.
     */
    @property({ type: Boolean, state: true, observer: '_onOpenChanged' })
    open: boolean = false;

    /**
     * Whether the popup should open automatically on hover instead of requiring a click.
     */
    @property({ type: Boolean, reflect: true })
    openOnHover: boolean = false;

    /**
     * The placement of the popup relative to its anchor element.
     */
    @property({ type: String, reflect: true })
    placement: Placement = "bottom-start";

    /**
     * Whether the popup should stay open when clicking outside of it.
     */
    @property({ type: Boolean, reflect: true })
    sticky: boolean = false;

    /**
     * Whether the popup should automatically match the width of its anchor element.
     */
    @property({ type: Boolean, reflect: true })
    autoWidth: boolean = false;

    @property({ type: Boolean, state: true })
    popupRendered: boolean = false;

    #cleanup: ReturnType<typeof autoUpdate>;
    #toggleSize: ISize;
    #resolver: Function;
    #closeOnMoveoutTimer: ReturnType<typeof setTimeout>;
    #openOnHoverTimer: ReturnType<typeof setTimeout>;

    render() {
        return html`
            <vi-size-tracker @sizechanged=${this._onAnchorSizeChanged} part="size-tracker"></vi-size-tracker>
            <div id="anchor"
                 class="layout horizontal"
                 part="anchor"
                 @click=${this._handleAnchorClick}
                 @mouseenter=${this._handleAnchorMouseEnter}
                 @mouseleave=${this._handleAnchorMouseLeave}>
                <slot name="header"></slot>
            </div>
            
            ${this.popupRendered ? html`
                <div id="popup"
                     part="popup"
                     class="relative"
                     @click=${this._onContentClick}
                     @mouseenter=${this._onContentMouseEnter}
                     @mouseleave=${this._onContentMouseLeave}
                     popover="">
                    <vi-size-tracker @sizechanged=${this.refit} part="popup-size-tracker"></vi-size-tracker>
                    <slot part="content"></slot>
                </div>
            ` : nothing}
        `;
    }

    connectedCallback() {
        super.connectedCallback();
        this.addEventListener("popupparent", this._onPopupparent);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.removeEventListener("popupparent", this._onPopupparent);
        this.#cleanup?.();
        clearTimeout(this.#openOnHoverTimer);
        clearTimeout(this.#closeOnMoveoutTimer);
    }

    /**
     * Opens the popup and returns a promise that resolves when it is closed.
     * If the popup is already open, returns an immediately resolved promise.
     * @returns A promise that resolves when the popup is closed.
     */
    popup(): Promise<any> {
        if (this.open)
            return Promise.resolve();

        return new Promise(resolve => {
            this.#resolver = resolve;
            this.#open();
        });
    }

    /**
     * Closes the popup and any child popups.
     * Dispatches a cancelable "popup-closing" event before closing, and a "popup-closed" event after.
     * If the "popup-closing" event is cancelled, the popup will remain open.
     */
    close() {
        const closingEvent = new CustomEvent("popup-closing", {
            bubbles: false,
            cancelable: true,
            composed: true
        });
        this.dispatchEvent(closingEvent);
        if (!this.open || closingEvent.defaultPrevented)
            return;

        clearTimeout(this.#openOnHoverTimer);
        this.#openOnHoverTimer = undefined;

        if (this.#closeOnMoveoutTimer) {
            clearTimeout(this.#closeOnMoveoutTimer);
            this.#closeOnMoveoutTimer = undefined;
        }

        const openChild = openPopups[openPopups.indexOf(this) + 1];
        if (openChild != null)
            openChild.close();

        this.open = false;
        this.hover = false;

        if (this.#resolver)
            this.#resolver();

        this.#cleanup?.();
        const index = openPopups.indexOf(this);
        if (index > -1) {
            openPopups.splice(index, 1);
        }

        this.dispatchEvent(new CustomEvent("popup-closed", {
            bubbles: false,
            composed: true
        }));
    }

    /**
     * Repositions the popup relative to its anchor element using Floating UI.
     * Automatically handles viewport boundaries, flipping, and sizing constraints.
     * Called automatically when the popup opens or when the anchor size changes.
     */
    async refit() {
        const anchor = this.shadowRoot?.getElementById("anchor");
        const popup = this.shadowRoot?.getElementById("popup");

        if (!anchor || !popup) return;

        let { x, y } = await computePosition(anchor, popup, {
            placement: this.placement,
            strategy: "fixed",
            middleware: [
                flip(),
                shift({
                    rootBoundary: "viewport"
                }),
                size({
                    apply({ availableWidth, availableHeight, elements }) {
                        const slottedElements = elements.floating.querySelector("slot").assignedElements();
                        if (slottedElements.length === 1 && slottedElements[0] instanceof Scroller) {
                            Object.assign(slottedElements[0].style, {
                                maxWidth: `${availableWidth - 5}px`,
                                maxHeight: `${availableHeight - 5}px`,
                            });
                        }
                    },
                })
            ]
        });

        Object.assign(popup.style, {
            left: `${x}px`,
            top: `${y}px`,
            minWidth: this.autoWidth && this.#toggleSize?.width ? `${this.#toggleSize.width}px` : undefined
        });
    }

    async #open() {
        if (!this.popupRendered) {
            this.popupRendered = true;

            this.requestUpdate();
            await this.updateComplete;
        }
        
        this.#completeOpen();
    }

    #completeOpen() {
        const parentPopup = this.#findParentPopup();
        const openingEvent = new CustomEvent("popup-opening", {
            bubbles: false,
            cancelable: true,
            composed: true
        });
        this.dispatchEvent(openingEvent);
        if (this.open || this.hasAttribute("disabled") || openingEvent.defaultPrevented)
            return;

        const firstOpenNonParentChild = openPopups[parentPopup == null ? 0 : openPopups.indexOf(parentPopup) + 1];
        if (firstOpenNonParentChild != null)
            firstOpenNonParentChild.close();

        const anchor = this.shadowRoot?.getElementById("anchor");
        const popup = this.shadowRoot?.getElementById("popup");

        if (anchor && popup) {
            this.#cleanup = autoUpdate(anchor, popup, this.refit.bind(this));
        }

        this.open = true;
        openPopups.push(this);

        this.dispatchEvent(new CustomEvent("popup-opened", {
            bubbles: false,
            composed: true
        }));
    }

    #findParentPopup(): Popup {
        const e = new CustomEvent("popupparent", {
            detail: { popup: null },
            bubbles: true,
            composed: true
        });

        const node = this.parentElement || (<ShadowRoot>this.parentNode)?.host || this;
        node.dispatchEvent(e);

        return !e.defaultPrevented ? e.detail.popup as Popup : null;
    }

    private _handleAnchorClick(e: MouseEvent) {
        if (this.openOnHover || this.disabled)
            return;

        clearTimeout(this.#openOnHoverTimer);
        this.#openOnHoverTimer = undefined;

        if (this.open) {
            if (!this.sticky)
                this.close();
            return;
        }

        this.popup();
        e.stopPropagation();
    }

    private _handleAnchorMouseEnter() {
        if (!this.openOnHover)
            return;

        clearTimeout(this.#openOnHoverTimer);
        clearTimeout(this.#closeOnMoveoutTimer);

        if (this.open)
            return;

        if (this.openDelay > 0) {
            this.#openOnHoverTimer = setTimeout(() => {
                this.popup();
                this.#openOnHoverTimer = undefined;
            }, this.openDelay);
        } else {
            this.popup();
        }
    }

    private _handleAnchorMouseLeave() {
        if (!this.openOnHover)
            return;

        clearTimeout(this.#openOnHoverTimer);
        this.#openOnHoverTimer = undefined;
    }

    private _onContentClick(e?: Event) {
        if (this.sticky)
            e.stopPropagation();
    }

    private _onContentMouseEnter(e: MouseEvent) {
        this.hover = true;

        clearTimeout(this.#openOnHoverTimer);
        this.#openOnHoverTimer = undefined;

        if (this.#closeOnMoveoutTimer) {
            clearTimeout(this.#closeOnMoveoutTimer);
            this.#closeOnMoveoutTimer = undefined;
        }
    }

    private _onContentMouseLeave(e: MouseEvent) {
        if (e.relatedTarget == null) {
            e.stopPropagation();
            return;
        }

        if (!this.sticky) {
            this.#closeOnMoveoutTimer = setTimeout(() => {
                this.close();
            }, this.closeDelay);
        }
    }

    private _onHoverChanged(hover: boolean) {
        this.toggleAttribute("hover", hover);
    }

    private _onOpenChanged(open: boolean) {
        this.toggleAttribute("open", open);

        const popup = this.shadowRoot?.getElementById("popup");
        if (!popup?.isConnected)
            return;

        try {
            const isPopoverOpen = popup.matches(':popover-open');
            if (open && !isPopoverOpen) {
                popup.showPopover();
            } else if (!open && isPopoverOpen) {
                popup.hidePopover();
            }
        } catch (e) {
            console.warn("Popover state change failed:", e);
        }
    }

    private _onAnchorSizeChanged(e: CustomEvent) {
        this.#toggleSize = e.detail;
        if (!this.open)
            return;

        this.refit();
        e.stopPropagation();
    }

    private _onPopupparent(e: CustomEvent) {
        e.detail.popup = this;
        e.stopPropagation();
    }

    /**
     * Closes all open popups, or only popups descended from the specified parent element.
     * @param parent - Optional parent element. If provided, only closes popups that are descendants of this element.
     */
    static closeAll(parent?: HTMLElement | WebComponentLit) {
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

customElements.define("vi-popup", Popup);