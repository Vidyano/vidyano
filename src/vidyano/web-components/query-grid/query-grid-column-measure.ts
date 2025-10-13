import * as Vidyano from "vidyano"
import * as Polymer from "polymer"
import type { QueryGrid } from "./query-grid"
import { ISize } from "components/size-tracker/size-tracker"
import { WebComponent } from "components/web-component/web-component"

@WebComponent.register({
    properties: {
        grid: Object,
        column: Object,
        key: String
    },
    observers: [
        "_report(grid, column, size)"
    ]
}, "vi-query-grid-column-measure")
export class QueryGridColumnMeasure extends WebComponent {
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