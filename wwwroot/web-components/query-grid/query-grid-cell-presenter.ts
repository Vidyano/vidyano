import * as Vidyano from "../../libs/vidyano/vidyano.js"
import * as Polymer from "../../libs/polymer/polymer.js"
import { WebComponent } from "../web-component/web-component.js"
import { QueryGridCellDefault } from "./cell-templates/query-grid-cell-default.js"

@WebComponent.register({
    properties: {
        value: {
            type: Object,
            observer: "_valueChanged"
        }
    }
})
export class QueryGridCellPresenter extends WebComponent {
    private cell: QueryGridCellDefault;

    private _valueChanged(value: Vidyano.QueryResultItemValue) {
        if (!this.cell) {
            this.cell = new QueryGridCellDefault();
            this.appendChild(this.cell);
        }

        this.cell.value = value;
    }
}