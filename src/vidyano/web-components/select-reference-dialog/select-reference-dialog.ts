import { CSSResultGroup, html, TemplateResult, unsafeCSS } from "lit";
import { property, state } from "lit/decorators.js";
import * as Vidyano from "vidyano"
import { IItemTapEventArgs } from "components/query-grid/query-grid-row"
import { observer } from "components/web-component/web-component";
import { Dialog } from "components/dialog/dialog";
import "components/notification/notification"
import styles from "./select-reference-dialog.css";

export class SelectReferenceDialog extends Dialog {
    static styles: CSSResultGroup = [Dialog.styles, unsafeCSS(styles)];

    @property({ type: Object })
    query: Vidyano.Query;

    @state()
    canSelect: boolean;

    @state()
    canAddNewReference: boolean;

    @state()
    private _initializing: boolean = true;

    constructor(query: Vidyano.Query, forceSearch?: boolean, canAddNewReference: boolean = false, keepFilter?: boolean) {
        super();

        this.query = query;
        this.canAddNewReference = canAddNewReference;

        query["_query-grid-vertical-scroll-offset"] = undefined;

        if (keepFilter)
            return;

        if (!query.filters)
            query.resetFilters();

        if (forceSearch || !!query.textSearch || !query.hasSearched)
            query.search();
    }

    @observer("query.selectedItems")
    private _selectedItemsChanged(selectedItems: Vidyano.QueryResultItem[]) {
        this.canSelect = selectedItems && selectedItems.length > 0;
    }

    protected renderContent(): TemplateResult {
        return html`
            <header>
                <h4>${this.query.label}</h4>
                <vi-input-search
                    id="search"
                    .value=${this.query.textSearch}
                    @value-changed=${this._onSearchValueChanged}
                    @search=${this._search}
                    ?hidden=${this._initializing}
                    autofocus
                ></vi-input-search>
            </header>
            <main>
                <vi-notification .serviceObject=${this.query}></vi-notification>
                <vi-query-grid
                    .query=${this.query}
                    @item-tap=${this._selectReference}
                    as-lookup
                    .initializing=${this._initializing}
                    @initializing-changed=${this._onInitializingChanged}
                ></vi-query-grid>
            </main>
            <footer>
                <vi-button
                    @click=${this._addNew}
                    ?hidden=${!this.canAddNewReference}
                    label=${this.translations.NewReference}
                ></vi-button>
                <div class="actions">
                    <vi-button
                        @click=${this._select}
                        ?disabled=${!this.canSelect}
                        label=${this.translations.OK}
                    ></vi-button>
                    <vi-button
                        inverse
                        @click=${() => this.cancel()}
                        label=${this.translations.Cancel}
                    ></vi-button>
                </div>
            </footer>
        `;
    }

    private _onInitializingChanged(e: CustomEvent) {
        this._initializing = e.detail.value;

        if (!this._initializing)
            this._focusElement("search");
    }

    private _onSearchValueChanged(e: CustomEvent) {
        this.query.textSearch = e.detail.value;
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
