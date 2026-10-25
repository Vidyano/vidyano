import { CSSResultGroup, html, unsafeCSS } from "lit";
import { property, state } from "lit/decorators.js";
import * as Vidyano from "@vidyano/core"
import { computed } from "components/web-component/web-component"
import { QueryGridCell, QueryGridCellTemplate } from "./query-grid-cell"
import styles from "./query-grid-cell-default.css";

const classNames = (value: string) => value.split(/\s+/).filter(Boolean);

export class QueryGridCellDefault extends QueryGridCell {
    static styles: CSSResultGroup = unsafeCSS(styles);

    private _extraClass: string;
    #hasDisplayFormat: boolean;
    private _tag: { currentValue?: any; originalValue?: any } = { currentValue: null };

    @property({ type: Boolean, reflect: true })
    tag: boolean;

    @property({ type: Boolean, reflect: true })
    right: boolean;

    @property({ type: Boolean, reflect: true })
    center: boolean;

    @state()
    protected _text: string = "";

    /**
     * The template registered with QueryGridCell.registerCellTemplate that renders this cell's column, if any.
     */
    @state()
    @computed(function(this: QueryGridCellDefault, column: Vidyano.QueryColumn): QueryGridCellTemplate {
        return QueryGridCell.getCellTemplate(column);
    }, "column", "_cellTemplatesVersion")
    declare readonly cellTemplate: QueryGridCellTemplate;

    @state()
    private _cellTemplatesVersion: number = QueryGridCell.cellTemplatesVersion;

    render() {
        // The template renders here instead of in _valueChanged, so a column swap without a new value re-renders it too
        const value = this.value;
        return html`<div id="text">${this.cellTemplate && value && !this.#hasDisplayFormat ? this.cellTemplate(value.getValue(), value.column, value.item) : this._text}</div>`;
    }

    protected _valueChanged(itemValue: Vidyano.QueryResultItemValue, oldValue: Vidyano.QueryResultItemValue) {
        super._valueChanged(itemValue, oldValue);

        // Recomputes cellTemplate before rendering when templates were registered or removed since
        this._cellTemplatesVersion = QueryGridCell.cellTemplatesVersion;

        // A DisplayFormat keeps priority over the column's cell template, the cell shows it as formatted text
        this.#hasDisplayFormat = !!itemValue && !String.isNullOrEmpty(this._getTypeHint(itemValue.column, "displayformat", null));

        if (!itemValue) {
            this._clearCell();
            this._clearTagTypeHint();
            return;
        }

        let value = null;

        value = itemValue.item.getValue(itemValue.column.name);
        if (value != null && (itemValue.column.type === "Boolean" || itemValue.column.type === "NullableBoolean"))
            value = itemValue.item.query.service.getTranslatedMessage(value ? this._getTypeHint(itemValue.column, "truekey", "True") : this._getTypeHint(itemValue.column, "falsekey", "False"));
        else if (value != null && itemValue.column.type === "YesNo")
            value = itemValue.item.query.service.getTranslatedMessage(value ? this._getTypeHint(itemValue.column, "truekey", "Yes") : this._getTypeHint(itemValue.column, "falsekey", "No"));
        else if (itemValue.column.type === "Time" || itemValue.column.type === "NullableTime") {
            if (typeof value === "string") {
                value = value.trimEnd("0").trimEnd(".");
                if (value.startsWith("0:"))
                    value = value.substr(2);
                if (value.endsWith(":00"))
                    value = value.substr(0, value.length - 3);
            }
        }

        if (value != null) {
            let format = this._getTypeHint(itemValue.column, "displayformat", null);
            // Dates use the cell's default pattern unless the format gives its own {0:...} spec
            if (format == null || !format.contains("{0:")) {
                let datePattern: string;
                switch (itemValue.column.type) {
                    case "Date":
                    case "NullableDate":
                        datePattern = Vidyano.CultureInfo.currentCulture.dateFormat.shortDatePattern;
                        break;

                    case "DateTime":
                    case "NullableDateTime":
                    case "DateTimeOffset":
                    case "NullableDateTimeOffset":
                        datePattern = Vidyano.CultureInfo.currentCulture.dateFormat.shortDatePattern + " " + Vidyano.CultureInfo.currentCulture.dateFormat.shortTimePattern;
                        break;
                }

                if (datePattern) {
                    value = value.localeFormat(datePattern, true);
                    if (format === "{0}")
                        format = null;
                }
            }

            if (String.isNullOrEmpty(format))
                value = value.localeFormat ? value.localeFormat() : value.toLocaleString();
            else
                value = String.format(format, value);
        }
        else
            value = "";

        this._applyTagTypeHint(itemValue);

        const extraClass = itemValue.column.getTypeHint("extraclass", undefined, value && itemValue.typeHints);
        if (extraClass !== this._extraClass) {
            if (!String.isNullOrEmpty(this._extraClass))
                this.classList.remove(...classNames(this._extraClass));

            this._extraClass = extraClass;
            if (!String.isNullOrEmpty(extraClass))
                this.classList.add(...classNames(this._extraClass));
        }

        this._updateCell(value);
    }

    protected _clearCell() {
        this._text = "";
    }

    private _applyTagTypeHint(itemValue: Vidyano.QueryResultItemValue) {
        const tagHint = this._getTypeHint(itemValue.column, "tag", null);
        if (tagHint !== this._tag.currentValue) {
            if (this._tag.originalValue === undefined) this._tag.originalValue = this.style.getPropertyValue("--tag-background");

            if (tagHint)
                this.style.setProperty("--tag-background", tagHint);
            else if (this._tag.originalValue)
                this.style.setProperty("--tag-background", this._tag.originalValue);
            else
                this.style.removeProperty("--tag-background");

            this._tag.currentValue = tagHint;
        }
        this.tag = !!tagHint;
        // The tag follows the cell's alignment (numbers are right-aligned)
        this.right = this.tag && this.style.textAlign === "right";
        this.center = this.tag && this.style.textAlign === "center";
    }

    private _clearTagTypeHint() {
        if (this._tag.originalValue !== undefined) {
            if (this._tag.originalValue)
                this.style.setProperty("--tag-background", this._tag.originalValue);
            else
                this.style.removeProperty("--tag-background");
            this._tag.currentValue = null;
        }
        this.tag = false;
        this.right = false;
        this.center = false;
    }

    protected _updateCell(value: string) {
        this._text = value;
    }
}

QueryGridCell.defaultCellType = QueryGridCellDefault;

customElements.define("vi-query-grid-cell-default", QueryGridCellDefault);
