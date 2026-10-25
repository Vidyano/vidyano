import { html, nothing, unsafeCSS } from "lit";
import { state } from "lit/decorators.js";
import * as Vidyano from "@vidyano/core"
import { QueryGridCell } from "./query-grid-cell"
import "components/icon/icon"
import styles from "./query-grid-cell-boolean.css";

export class QueryGridCellBoolean extends QueryGridCell {
    static styles = unsafeCSS(styles);

    // Once shown, the icon is hidden instead of removed, so recycling the cell does not recreate it
    @state()
    private _icon: { selected: boolean; hidden: boolean };

    @state()
    private _text: string;

    render() {
        return html`${this._icon ? html`<vi-icon source="Selected" ?is-selected=${this._icon.selected} ?hidden=${this._icon.hidden}></vi-icon>` : nothing}${this._text}`;
    }

    protected _valueChanged(value: Vidyano.QueryResultItemValue, oldValue: Vidyano.QueryResultItemValue) {
        super._valueChanged(value, oldValue);

        if (!!value && !!oldValue && value.getValue() === oldValue.getValue()) {
            const oldHints = oldValue.column.typeHints;
            const hints = value.column.typeHints;
            if ((!oldHints && !hints) || (hints && oldHints && JSON.stringify(value.column.typeHints) === JSON.stringify(oldValue.column.typeHints)))
                return;
        }

        // undefined means the row has no item; null is a value missing from the item and shows as null
        if (value === undefined) {
            this._hideIcon();
            this._text = "";
        } else {
            const displayValue: boolean = value ? value.getValue() : null;
            // The cell's column is the grid's wrapper, so a missing value reads the hints from the query column
            const typeHints = (value?.column ?? this.column?.query?.getColumn(this.column.name))?.typeHints;
            if (displayValue == null) {
                this._hideIcon();

                const nullKey = typeHints?.["nullkey"];
                this._text = nullKey ? this.translateMessage(nullKey) : "—";
            } else if (!typeHints || ((!typeHints["falsekey"] && !displayValue) || (!typeHints["truekey"] && displayValue))) {
                this._text = "";
                this._icon = { selected: !!displayValue, hidden: false };
            }
            else {
                this._hideIcon();

                const displayTextKey = typeHints[displayValue ? "truekey" : "falsekey"];
                this._text = this.translateMessage(displayTextKey);
            }
        }
    }

    private _hideIcon() {
        if (this._icon && !this._icon.hidden)
            this._icon = { selected: this._icon.selected, hidden: true };
    }
}

QueryGridCell.registerCellType("Boolean", QueryGridCellBoolean);
QueryGridCell.registerCellType("NullableBoolean", QueryGridCellBoolean);
QueryGridCell.registerCellType("YesNo", QueryGridCellBoolean);

customElements.define("vi-query-grid-cell-boolean", QueryGridCellBoolean);
