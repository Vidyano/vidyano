import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
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

        if (!value) {
            if (this._icon) {
                this._icon.setAttribute("hidden", "");
                this._isHidden = true;
            }

            if (this._textNode && this._textNode.nodeValue)
                this._textNode.nodeValue = "";
        } else {
            const displayValue: boolean = value.getValue();
            if (displayValue == null) {
                if (this._icon) {
                    this._icon.setAttribute("hidden", "");
                    this._isHidden = true;
                }

                if (!this._textNode)
                    this._textNode = <Text>this.shadowRoot.appendChild(document.createTextNode(value.column.typeHints["nullkey"] || "—"));
                else
                    this._textNode.nodeValue = value.column.typeHints["nullkey"] || "—";
            } else if (!value.column.typeHints || ((!value.column.typeHints["falsekey"] && !displayValue) || (!value.column.typeHints["truekey"] && displayValue))) {
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
                const displayTextKey = value.column.typeHints[displayValue ? "truekey" : "falsekey"];
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
