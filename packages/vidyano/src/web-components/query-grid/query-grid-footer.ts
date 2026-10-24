import * as Polymer from "polymer"
import * as Vidyano from "@vidyano/core"
import { QueryGridCell } from "./cell-templates/query-grid-cell"
import "./cell-templates/query-grid-cell-boolean"
import "./cell-templates/query-grid-cell-common-mark"
import "./cell-templates/query-grid-cell-image"
import { QueryGridCellDefault } from "./cell-templates/query-grid-cell-default"
import { QueryGridColumn } from "./query-grid-column"

@Polymer.WebComponent.register({
    properties: {
        item: Object,
        columns: Array
    },
    observers: [
        "_render(item, columns)"
    ]
}, "vi-query-grid-footer")
export class QueryGridFooter extends Polymer.WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="query-grid-footer.html">` }

    item: Vidyano.QueryResultItem;
    columns: QueryGridColumn[];

    private _render(item: Vidyano.QueryResultItem, columns: QueryGridColumn[]) {
        const existingCells = Array.from(this.children).filter(c => c instanceof QueryGridCell) as QueryGridCell[];

        (columns || []).forEach(column => {
            const value = item ? item.getFullValue(column.name) : null;
            const cellType = this._getCellType(item, column, value);

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

        return QueryGridCell.getCellTypeConstructor(column.type) || QueryGridCellDefault;
    }
}
