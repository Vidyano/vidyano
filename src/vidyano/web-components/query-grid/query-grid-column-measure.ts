import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
import type { QueryGrid } from "./query-grid"
import { ISize } from "components/size-tracker/size-tracker"

@Polymer.WebComponent.register({
    properties: {
        grid: Object,
        column: Object,
        key: String
    },
    observers: [
        "_report(grid, column, size)"
    ]
}, "vi-query-grid-column-measure")
export class QueryGridColumnMeasure extends Polymer.WebComponent {
    private _reported: boolean;

    static get template() {
        return Polymer.html`
            <style>:host { height: 0; }</style>
            <div style="position: relative; height: 1px;">
                <vi-size-tracker size="{{size}}"></vi-size-tracker>
            </div>`
    }

    private _report(grid: QueryGrid, column: Vidyano.QueryColumn, size: ISize) {
        if (this._reported)
            return;

        this.dispatchEvent(new CustomEvent("column-size-changed", {
            detail: { column, size },
            bubbles: true,
            composed: true
        }));
        this._reported = true;
    }
}
