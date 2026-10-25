import { html, nothing, unsafeCSS } from "lit";
import { state } from "lit/decorators.js";
import * as Vidyano from "@vidyano/core"
import { QueryGridCell } from "./query-grid-cell"
import styles from "./query-grid-cell-image.css";

export class QueryGridCellImage extends QueryGridCell {
    static styles = unsafeCSS(styles);

    // Undefined until the first image, then an empty string hides the element instead of removing it
    @state()
    private _image: string;

    render() {
        return this._image === undefined ? nothing : html`<div class="image" ?hidden=${!this._image} style=${this._image ? `background-image: ${this._image}` : ""}></div>`;
    }

    protected _valueChanged(value: Vidyano.QueryResultItemValue, oldValue: Vidyano.QueryResultItemValue) {
        super._valueChanged(value, oldValue);

        if (!value || !value.value) {
            if (this._image)
                this._image = "";

            return;
        }

        this._image = "url(" + value.value.asDataUri() + ")";
    }
}

QueryGridCell.registerCellType("Image", QueryGridCellImage);

customElements.define("vi-query-grid-cell-image", QueryGridCellImage);
