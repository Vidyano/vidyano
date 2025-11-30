import { CSSResultGroup, html, nothing, TemplateResult, unsafeCSS } from "lit";
import { property, query, state } from "lit/decorators.js";
import { observer } from "components/web-component/web-component";
import { Dialog } from "components/dialog/dialog";
import { IItemTapEventArgs } from "components/query-grid/query-grid-row";
import * as Vidyano from "vidyano";
import "components/notification/notification";
import styles from "./select-reference-dialog.css";

export class SelectReferenceDialog extends Dialog {
    static styles: CSSResultGroup = [Dialog.styles, unsafeCSS(styles)];

    @property({ type: Object })
    query: Vidyano.Query;

    @state()
    canSelect: boolean;

    @property({ type: Boolean })
    canAddNewReference: boolean;

    @state()
    @observer(function(this: SelectReferenceDialog, initializing: boolean) {
        if (initializing)
            return;

        this._focusElement(this._searchElement);

        const queryGrid = this.shadowRoot.querySelector("vi-query-grid") as any;
        const contentWidth = queryGrid?.contentWidth;
        if (contentWidth > 0)
            this.style.setProperty("--vi-select-reference-dialog--content-width", `${contentWidth}px`);
    })
    initializing: boolean;

    @query("#search")
    private _searchElement: HTMLElement;

    constructor(query: Vidyano.Query, forceSearch?: boolean, canAddNewReference: boolean = false, keepFilter?: boolean) {
        super();

        this.query = query;
        this.canAddNewReference = canAddNewReference;

        if (keepFilter)
            return;

        if (!query.filters)
            query.resetFilters();

        if (forceSearch || !!query.textSearch || !query.hasSearched)
            query.search();
    }

    protected renderContent(): TemplateResult {
        return html`
            <header>
                <h4>${this.query?.label}</h4>
                <vi-input-search
                    id="search"
                    .value=${this.query?.textSearch ?? ""}
                    @value-changed=${(e: CustomEvent) => { if (this.query) this.query.textSearch = e.detail.value; }}
                    @search=${this._search}
                    ?hidden=${this.initializing}
                    autofocus
                ></vi-input-search>
            </header>
            <main>
                <vi-notification .serviceObject=${this.query}></vi-notification>
                <vi-query-grid
                    .query=${this.query}
                    @item-tap=${this._selectReference}
                    as-lookup
                    @initializing-changed=${(e: CustomEvent) => this.initializing = e.detail.value}
                ></vi-query-grid>
            </main>
            <footer>
                <div class="actions">
                    <vi-button
                        @click=${this._select}
                        ?disabled=${!this.canSelect}
                        label=${this.translateMessage("OK")}
                    ></vi-button>
                    <vi-button
                        inverse
                        @click=${() => this.cancel()}
                        label=${this.translateMessage("Cancel")}
                    ></vi-button>
                </div>
                ${this.canAddNewReference ? html`<vi-button
                    @click=${this._addNew}
                    label=${this.translateMessage("NewReference")}
                ></vi-button>` : nothing}
            </footer>
        `;
    }

    @observer("query.selectedItems")
    private _selectedItemsChanged() {
        if (!this.isConnected)
            return;

        this.canSelect = this.query && this.query.selectedItems && this.query.selectedItems.length > 0;
    }

    private _select() {
        if (!this.canSelect)
            return;

        this.close(this.query.selectedItems);
    }

    private _addNew() {
        this.close("AddNewReference");
    }

    private _search(e: CustomEvent) {
        if (!this.query)
            return;

        this.query.textSearch = e.detail;
        this.query.search();
    }

    private _selectReference(e: CustomEvent) {
        e.preventDefault();

        const detail = <IItemTapEventArgs>e.detail;
        if (this.query.maxSelectedItems === 1)
            this.close([detail.item]);
        else
            detail.item.isSelected = !detail.item.isSelected;
    }
}

customElements.define("vi-select-reference-dialog", SelectReferenceDialog);
