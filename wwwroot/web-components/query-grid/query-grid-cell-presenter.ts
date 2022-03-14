import * as Vidyano from "../../libs/vidyano/vidyano"
import * as Polymer from "../../libs/polymer/polymer"
import { WebComponent } from "../web-component/web-component"
import { QueryGridCellDefault } from "./cell-templates/query-grid-cell-default"

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