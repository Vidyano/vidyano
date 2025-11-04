import { html, nothing, unsafeCSS } from "lit";
import { property, query, state } from "lit/decorators.js";
import { listener, WebComponent } from "components/web-component/web-component";
import * as IconRegister from "components/icon/icon-register";
import { Popup } from "components/popup/popup";
import styles from "./popup-menu-item.css";

export class PopupMenuItem extends WebComponent {
    static styles = unsafeCSS(styles);

    @query('#popup')
    private popupElement!: Popup;

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

    /** Whether the menu item is in a checked state. */
    @property({ type: Boolean, reflect: true })
    checked: boolean = false;

    @state()
    hasChildren: boolean = false;

    /**
     * Creates a new popup menu item.
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
     * Renders the popup menu item with optional submenu support.
     * @returns The Lit template for the menu item.
     */
    render() {
        const showIcon = IconRegister.exists(this.icon);
        const showIconSpace = this.forceIconSpace || this.iconSpace;

        return html`
            <vi-popup open-on-hover class="flex" id="popup" placement="right-start">
                <vi-button slot="header" ?inverse=${!this.checked} @click=${this._catchClick}>
                    ${showIcon ? html`<vi-icon id="icon" source=${this.icon}></vi-icon>` : showIconSpace ? html`<div class="icon-space"></div>` : nothing}
                    <span class="label">${this.label}</span>
                    ${this.hasChildren ? html`<vi-icon source="Forward"></vi-icon>` : nothing}
                </vi-button>
                <div>
                    <slot id="subItems" @slotchange=${this._onSubItemsChange}></slot>
                </div>
            </vi-popup>
        `;
    }

    private _onSubItemsChange(e: Event) {
        const slot = e.target as HTMLSlotElement;
        this.hasChildren = slot.assignedNodes({ flatten: true }).length > 0;

        const elements = slot.assignedElements() as any[];
        const iconSpace = elements.some(e => e.icon && IconRegister.exists(e.icon));
        elements.forEach(e => e.iconSpace = e.forceIconSpace || (iconSpace && (!e.icon || !IconRegister.exists(e.icon))));
    }

    @listener("click")
    private _onClick(e: MouseEvent) {
        if (this._action) {
            this._action();
            Popup.closeAll();

            e.stopPropagation();
            e.preventDefault();
        }
    }

    private _catchClick(e: MouseEvent) {
        if (!this.hasChildren)
            return;

        if (this.popupElement.open) {
            e.stopPropagation();
            e.stopImmediatePropagation();
            e.preventDefault();
        }
    }
}

customElements.define("vi-popup-menu-item", PopupMenuItem);
