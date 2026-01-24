import { html, nothing, unsafeCSS } from "lit";
import { property } from "lit/decorators.js";
import { listener, WebComponent } from "components/web-component/web-component";
import * as IconRegister from "components/icon/icon-register";
import { Popup } from "components/popup/popup";
import styles from "./popup-menu-item-with-actions.css";

export class PopupMenuItemWithActions extends WebComponent {
    static styles = unsafeCSS(styles);

    /** The text label displayed for the menu item. */
    @property({ type: String })
    label?: string;

    /** The icon identifier to display before the label. */
    @property({ type: String })
    icon?: string;

    /** Whether to reserve space for an icon even if this item has none. */
    @property({ type: Boolean, reflect: true })
    iconSpace: boolean;

    /** Whether to always show icon space, ignoring auto-calculation. */
    @property({ type: Boolean })
    forceIconSpace: boolean;

    /**
     * Creates a new popup menu item with action buttons.
     * @param label - The text label for the menu item.
     * @param icon - The icon identifier to display.
     * @param _action - The action to execute when the item is clicked.
     */
    constructor(label?: string, icon?: string, private _action?: () => void) {
        super();
        this.label = label;
        this.icon = icon;
    }

    /**
     * Renders the popup menu item with an action button area.
     * @returns The Lit template for the menu item with actions.
     */
    render() {
        const showIcon = IconRegister.exists(this.icon);
        const showIconSpace = this.forceIconSpace || this.iconSpace;

        return html`
            <div inverse class="container">
                <paper-ripple></paper-ripple>
                ${showIcon ? html`<vi-icon id="icon" source=${this.icon}></vi-icon>` : showIconSpace ? html`<div class="icon-space"></div>` : nothing}
                <span class="label">${this.label}</span>
                <div class="actions" @click=${this._onActionsClick}>
                    <slot name="button" @slotchange=${this._popupMenuIconSpaceHandler}></slot>
                </div>
            </div>
        `;
    }

    private _popupMenuIconSpaceHandler(e: Event) {
        const elements = (e.target as HTMLSlotElement).assignedElements() as any[];
        const iconSpace = elements.some(e => e.icon && IconRegister.exists(e.icon));

        elements.forEach(e => {
            e.iconSpace = e.forceIconSpace || (iconSpace && (!e.icon || !IconRegister.exists(e.icon)));
        });
    }

    @listener("click")
    private _onClick(e: MouseEvent) {
        if (this._action) {
            this._action();
            Popup.closeAll();

            e.preventDefault();
            e.stopPropagation();
        }
    }

    private _onActionsClick(e: MouseEvent) {
        Popup.closeAll();
        e.stopPropagation();
    }
}

customElements.define("vi-popup-menu-item-with-actions", PopupMenuItemWithActions);
