import { html, unsafeCSS } from "lit"
import { property } from "lit/decorators.js"
import * as Vidyano from "@vidyano/core"
import { WebComponent, observer } from "components/web-component/web-component"
import { QueryGridCell } from "./cell-templates/query-grid-cell"
import { QueryGridCellBoolean } from "./cell-templates/query-grid-cell-boolean"
import "./cell-templates/query-grid-cell-common-mark"
import "./cell-templates/query-grid-cell-image"
import { QueryGridCellDefault } from "./cell-templates/query-grid-cell-default"
import { QueryGridColumn } from "./query-grid-column"
import styles from "./query-grid-footer.css"

export class QueryGridFooter extends WebComponent {
    static styles = unsafeCSS(styles);

    @property({ type: Object })
    item: Vidyano.QueryResultItem;

    @property({ type: Array })
    columns: QueryGridColumn[];

    render() {
        return html`<slot></slot>`;
    }

    @observer("item", "columns")
    private _render(item: Vidyano.QueryResultItem, columns: QueryGridColumn[]) {
        const existingCells = Array.from(this.children).filter(c => c instanceof QueryGridCell) as QueryGridCell[];

        (columns || []).forEach(column => {
            const fullValue = item ? item.getFullValue(column.name) : null;
            const cellType = this._getCellType(item, column, fullValue);
            // A boolean cell shows a null value as "—", a total without a value shows nothing
            const value = cellType === QueryGridCellBoolean && fullValue?.value == null ? undefined : fullValue;

            let cell = existingCells.find(c => c.column?.name === column.name && c.constructor === cellType);
            if (cell)
                existingCells.remove(cell);
            else {
                cell = new cellType();
                cell.classList.add("column");
            }

            cell.column = <any>column;
            cell.value = value;
            this.appendChild(cell);
        });

        existingCells.forEach(cell => this.removeChild(cell));
    }

    private _getCellType(item: Vidyano.QueryResultItem, column: QueryGridColumn, value: Vidyano.QueryResultItemValue) {
        // A DisplayFormat keeps priority over the column's cell template, the default cell shows it as formatted text
        if (item && !String.isNullOrEmpty(item.getTypeHint("displayformat", column.column.getTypeHint("displayformat", null), value?.typeHints)))
            return QueryGridCellDefault;

        return QueryGridCell.resolveCellType(column);
    }
}

customElements.define("vi-query-grid-footer", QueryGridFooter);
