import { html, nothing, unsafeCSS } from "lit";
import { property, query } from "lit/decorators.js";
import { listener, observer, WebComponent } from "components/web-component/web-component";
import * as IconRegister from "components/icon/icon-register";
import { Popup } from "components/popup/popup";
import "./popup-menu-item";
import "./popup-menu-item-separator";
import "./popup-menu-item-split";
import "./popup-menu-item-with-actions";
import styles from "./popup-menu.css";

export class PopupMenu extends WebComponent {
    static styles = unsafeCSS(styles);

    @query('#popup')
    private popupElement!: Popup;

    /** Whether the popup menu is disabled and cannot be opened. */
    @property({ type: Boolean, reflect: true })
    disabled: boolean;

    /** Whether the popup menu should open when hovering over it. */
    @property({ type: Boolean, reflect: true })
    openOnHover: boolean;

    /** Whether the popup menu should only open via context menu (right-click). */
    @property({ type: Boolean, reflect: true })
    contextMenuOnly: boolean = false;

    /** Whether the shift key must be pressed to open the context menu. */
    @property({ type: Boolean })
    shiftKey: boolean;

    /** Whether the ctrl key must be pressed to open the context menu. */
    @property({ type: Boolean })
    ctrlKey: boolean;

    /** Whether the popup menu is currently open. */
    @property({ type: Boolean, reflect: true })
    open: boolean;

    /** Whether the popup should automatically adjust its width to fit content. */
    @property({ type: Boolean, reflect: true })
    autoWidth: boolean;

    /** The placement of the popup menu relative to its trigger element. */
    @property({ type: String, reflect: true })
    placement: string = "bottom-start";

    #contextHost: Element;
    #openContextEventListener: EventListener;

    /**
     * Renders the popup menu component with its trigger slot and menu items.
     * @returns The Lit template for the popup menu.
     */
    render() {
        return html`
            <vi-popup .openOnHover=${this.openOnHover} id="popup" .disabled=${this.disabled} .open=${this.open} placement=${this.placement} .autoWidth=${this.autoWidth}>
                ${!this.contextMenuOnly ? html`
                    <slot name="header" slot="header"></slot>
                ` : nothing}
                <div>
                    <slot id="items" @slotchange=${this._popupMenuIconSpaceHandler}></slot>
                </div>
            </vi-popup>
        `;
    }

    /**
     * Opens the popup menu programmatically.
     * @returns A promise that resolves when the popup is opened.
     */
    async popup(): Promise<any> {
        await this.updateComplete;
        return this.popupElement.popup();
    }

    @observer("isConnected", "contextMenuOnly")
    private _hookContextMenu(isConnected: boolean, contextMenu: boolean) {
        if (isConnected && contextMenu) {
            this.#contextHost = (this.getRootNode() as ShadowRoot).host;
            this.#contextHost.addEventListener("contextmenu", this.#openContextEventListener = this._openContext.bind(this));
        }
        else if (this.#contextHost) {
            this.#contextHost.removeEventListener("contextmenu", this.#openContextEventListener);
            this.#contextHost = this.#openContextEventListener = undefined;
        }
    }

    private async _openContext(e: MouseEvent): Promise<boolean> {
        if (!this.contextMenuOnly)
            return true;

        if (e.button === 2 && !!this.shiftKey === !!e.shiftKey && !!this.ctrlKey === !!e.ctrlKey) {
            e.preventDefault();
            e.stopPropagation();

            await this.updateComplete;

            // Close if already open to reposition
            if (this.popupElement.open)
                this.popupElement.close();

            this.popupElement.style.left = e.pageX + "px";
            this.popupElement.style.top = e.pageY + "px";

            await this.popupElement.popup();

            return false;
        }
    }

    private _popupMenuIconSpaceHandler(e: Event) {
        const elements = (e.target as HTMLSlotElement).assignedElements() as any[];
        const iconSpace = elements.some(e => e.icon && IconRegister.exists(e.icon));

        elements.forEach(e => {
            e.iconSpace = e.forceIconSpace || (iconSpace && (!e.icon || !IconRegister.exists(e.icon)));
        });
    }

    @listener("mouseenter")
    private _mouseenter() {
        if (this.openOnHover)
            this.popup();
    }

    @listener("mousemove")
    private _mousemove(e: MouseEvent) {
        e.stopPropagation();
    }

    @listener("click")
    private _onClick(e: MouseEvent) {
        e.stopPropagation();
    }
}

customElements.define("vi-popup-menu", PopupMenu);
