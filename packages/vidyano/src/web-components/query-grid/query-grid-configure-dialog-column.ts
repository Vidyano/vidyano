import { html, unsafeCSS } from "lit";
import { property } from "lit/decorators.js";
import { WebComponent } from "components/web-component/web-component";
import { QueryGridColumn } from "./query-grid-column";
import styles from "./query-grid-configure-dialog-column.css";

export class QueryGridConfigureDialogColumn extends WebComponent {
    static styles = unsafeCSS(styles);

    offset: number;

    @property({ attribute: false })
    column: QueryGridColumn;

    @property({ type: Boolean, reflect: true })
    isPinned: boolean;

    @property({ type: Boolean, reflect: true })
    isHidden: boolean;

    /** Whether this is the only visible column, which cannot be hidden. */
    @property({ type: Boolean })
    lastVisible: boolean = false;

    constructor(column: QueryGridColumn) {
        super();

        // Column can be null when sorting since the sorting component clones the element.
        if (!column)
            return;

        this.column = column;
        this.offset = column.offset;
        this.isPinned = column.isPinned;
        this.isHidden = column.isHidden;
    }

    render() {
        return html`
            <vi-icon source="Hamburger"></vi-icon>
            <label>${this.column?.column.label}</label>
            <div class="buttons">
                <vi-button inverse icon="Pin" @click=${this._togglePin}></vi-button>
                <vi-button inverse icon="Eye" @click=${this._toggleVisible} ?disabled=${this.lastVisible}></vi-button>
            </div>
        `;
    }

    private _togglePin() {
        this.isPinned = !this.isPinned;

        this.dispatchEvent(new CustomEvent("distribute-columns", {
            bubbles: true,
            composed: true
        }));
    }

    private _toggleVisible() {
        if (this.lastVisible)
            return;

        this.isHidden = !this.isHidden;

        this.dispatchEvent(new CustomEvent("column-visibility-toggled", {
            bubbles: true,
            composed: true
        }));
    }
}

customElements.define("vi-query-grid-configure-dialog-column", QueryGridConfigureDialogColumn);
