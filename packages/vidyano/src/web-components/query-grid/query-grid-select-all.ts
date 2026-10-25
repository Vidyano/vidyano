import { html, unsafeCSS } from "lit"
import { property } from "lit/decorators.js"
import * as Vidyano from "@vidyano/core"
import { WebComponent, computed, listener } from "components/web-component/web-component"
import styles from "./query-grid-select-all.css"

export class QueryGridSelectAll extends WebComponent {
    static styles = unsafeCSS(styles);

    @property({ type: Object })
    query: Vidyano.Query;

    @property({ type: Boolean, reflect: true })
    @computed("query.selectAll.isAvailable")
    declare readonly canSelectAll: boolean;

    @property({ type: Boolean, reflect: true })
    @computed(function(this: QueryGridSelectAll, selectedItems: Vidyano.QueryResultItem[], allSelected: boolean, inverse: boolean): boolean {
        return !!inverse || (!allSelected && selectedItems != null && selectedItems.length > 0);
    }, "query.selectedItems", "query.selectAll.allSelected", "query.selectAll.inverse", { allowUndefined: true })
    declare readonly partial: boolean;

    @property({ type: Boolean, reflect: true })
    @computed(function(this: QueryGridSelectAll, partial: boolean, allSelected: boolean): boolean {
        return !!partial || !!allSelected;
    }, "partial", "query.selectAll.allSelected", { allowUndefined: true })
    declare readonly selected: boolean;

    render() {
        return html`
            <paper-ripple></paper-ripple>
            <vi-icon source="Selected" ?is-selected=${this.selected}></vi-icon>
        `;
    }

    @listener("click")
    private _toggle() {
        if (!this.query)
            return;

        if (this.query.selectAll.isAvailable && !this.partial) {
            if (!this.query.selectAll.allSelected && this.query.totalItems === 0)
                return;

            this.query.selectAll.allSelected = !this.query.selectAll.allSelected;
        }
        else {
            if (this.query.selectAll.isAvailable)
                this.query.selectAll.allSelected = false;

            this.query.selectedItems = [];
        }
    }
}

customElements.define("vi-query-grid-select-all", QueryGridSelectAll);
