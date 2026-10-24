import * as Polymer from "polymer"
import * as Vidyano from "@vidyano/core"
import { QueryGridCell } from "./query-grid-cell"
import { Icon } from "components/icon/icon"
@Polymer.WebComponent.register({
    properties: {
        value: {
            type: Object,
            observer: "_valueChanged"
        }
    },
    sensitive: true
}, "vi-query-grid-cell-boolean")
export class QueryGridCellBoolean extends QueryGridCell {
    static get template() { return Polymer.html`<link rel="import" href="query-grid-cell-boolean.html">` }

    #foreground: { currentValue?: any; originalValue?: any } = { currentValue: null };
    private _isHidden: boolean;
    private _icon: HTMLElement;
    private _textNode: Text;

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
            if (this._icon) {
                this._icon.setAttribute("hidden", "");
                this._isHidden = true;
            }

            if (this._textNode && this._textNode.nodeValue)
                this._textNode.nodeValue = "";
        } else {
            const displayValue: boolean = value ? value.getValue() : null;
            // The cell's column is the grid's wrapper, so a missing value reads the hints from the query column
            const typeHints = (value?.column ?? this.column?.query?.getColumn(this.column.name))?.typeHints;
            if (displayValue == null) {
                if (this._icon) {
                    this._icon.setAttribute("hidden", "");
                    this._isHidden = true;
                }

                const nullKey = typeHints?.["nullkey"];
                const nullText = nullKey ? (this.translations[nullKey] || nullKey) : "—";
                if (!this._textNode)
                    this._textNode = <Text>this.shadowRoot.appendChild(document.createTextNode(nullText));
                else
                    this._textNode.nodeValue = nullText;
            } else if (!typeHints || ((!typeHints["falsekey"] && !displayValue) || (!typeHints["truekey"] && displayValue))) {
                if (this._isHidden) {
                    this._icon.removeAttribute("hidden");
                    this._isHidden = false;
                }

                if (this._textNode && this._textNode.nodeValue)
                    this._textNode.nodeValue = "";

                if (!this._icon) {
                    const icon = new Icon();
                    icon.source = "Selected";

                    this._icon = <HTMLElement>this.shadowRoot.appendChild(icon);
                }

                if (!value.getValue())
                    this._icon.removeAttribute("is-selected");
                else
                    this._icon.setAttribute("is-selected", "");
            }
            else {
                const displayTextKey = typeHints[displayValue ? "truekey" : "falsekey"];
                const displayTextValue = this.translations[displayTextKey] || displayTextKey;
                if (!this._textNode)
                    this._textNode = <Text>this.shadowRoot.appendChild(document.createTextNode(displayTextValue));
                else
                    this._textNode.nodeValue = displayTextValue;
            }
        }
    }
}

QueryGridCell.registerCellType("Boolean", QueryGridCellBoolean);
QueryGridCell.registerCellType("NullableBoolean", QueryGridCellBoolean);
QueryGridCell.registerCellType("YesNo", QueryGridCellBoolean);
