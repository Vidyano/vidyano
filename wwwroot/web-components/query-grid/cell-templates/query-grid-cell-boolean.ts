import * as Vidyano from "../../../libs/vidyano/vidyano.js"
import * as Polymer from "../../../libs/polymer/polymer.js"
import { QueryGridCell } from "./query-grid-cell.js"
import { Icon } from "../../icon/icon.js"
import { WebComponent } from "../../web-component/web-component.js"

@WebComponent.register({
    properties: {
        value: {
            type: Object,
            observer: "_valueChanged"
        },
        oldValue: {
            type: Object,
            readOnly: true
        }
    },
    observers: [
        "_update(value, oldValue, isConnected)"
    ],
    sensitive: true
})
export class QueryGridCellBoolean extends QueryGridCell {
    static get template() { return Polymer.html`<link rel="import" href="query-grid-cell-boolean.html">` }

    private _isHidden: boolean;
    private _icon: HTMLElement;
    private _textNode: Text;

    protected _valueChanged(value: Vidyano.QueryResultItemValue, oldValue: Vidyano.QueryResultItemValue) {
        super._valueChanged(value, oldValue);
        this._setOldValue(oldValue == null ? null : oldValue);
    }

    private _update(value: Vidyano.QueryResultItemValue, oldValue: Vidyano.QueryResultItemValue) {
        this._setSensitive(value?.column.isSensitive);

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