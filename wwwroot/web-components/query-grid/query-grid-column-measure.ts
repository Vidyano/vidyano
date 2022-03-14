import * as Vidyano from "../../libs/vidyano/vidyano"
import * as Polymer from "../../libs/polymer/polymer"
import type { QueryGrid } from "./query-grid"
import { ISize } from "../size-tracker/size-tracker"
import { WebComponent } from "../web-component/web-component"

@WebComponent.register({
    properties: {
        grid: Object,
        column: Object,
        key: String
    },
    observers: [
        "_report(grid, column, size)"
    ]
})
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

        this.fire("column-size-changed", { column, size });
        this._reported = true;
    }
}