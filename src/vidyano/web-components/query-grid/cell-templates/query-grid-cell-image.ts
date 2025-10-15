import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
import { QueryGridCell } from "./query-grid-cell"
@Polymer.WebComponent.register({
    properties: {
        value: {
            type: Object,
            observer: "_valueChanged"
        }
    },
    sensitive: true
}, "vi-query-grid-cell-image")
export class QueryGridCellImage extends QueryGridCell {
    static get template() { return Polymer.html`<link rel="import" href="query-grid-cell-image.html">` }

    private _isHidden: boolean;
    private _image: HTMLDivElement;

    protected _valueChanged(value: Vidyano.QueryResultItemValue, oldValue: Vidyano.QueryResultItemValue) {
        super._valueChanged(value, oldValue);

        if (!value || !value.value) {
            if (this._image && !this._image.hasAttribute("hidden")) {
                this._image.style.backgroundImage = "";
                this._image.setAttribute("hidden", "");
                this._isHidden = true;
            }

            return;
        }

        if (!this._image) {
            this.shadowRoot.appendChild(this._image = document.createElement("div"));
            this._image.classList.add("image");
        }

        if (this._isHidden) {
            this._image.removeAttribute("hidden");
            this._isHidden = false;
        }

        this._image.style.backgroundImage = "url(" + value.value.asDataUri() + ")";
    }
}

QueryGridCell.registerCellType("Image", QueryGridCellImage);
