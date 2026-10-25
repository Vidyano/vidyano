import { html } from "lit"
import { property, state } from "lit/decorators.js"
import * as Vidyano from "@vidyano/core"
import { WebComponent, observer } from "components/web-component/web-component"
import type { QueryGrid } from "./query-grid"
import type { ISize } from "components/size-tracker/size-tracker"
import "components/size-tracker/size-tracker"

export class QueryGridColumnMeasure extends WebComponent {
    private _reported: boolean;

    @property({ type: Object })
    grid: QueryGrid;

    @property({ type: Object })
    column: Vidyano.QueryColumn;

    @property({ type: String })
    key: string;

    @state()
    private _size: ISize;

    render() {
        return html`
            <style>:host { height: 0; }</style>
            <div style="position: relative; height: 1px;">
                <vi-size-tracker @sizechanged=${(e: CustomEvent<ISize>) => this._size = e.detail}></vi-size-tracker>
            </div>
        `;
    }

    @observer("grid", "column", "_size")
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

customElements.define("vi-query-grid-column-measure", QueryGridColumnMeasure);
