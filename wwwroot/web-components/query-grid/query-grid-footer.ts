import * as Vidyano from "../../libs/vidyano/vidyano.js"
import * as Polymer from "../../libs/@polymer/polymer.js"
import { QueryGridColumn } from "./query-grid-column.js"
import { WebComponent, WebComponentListener } from "../web-component/web-component.js"

@WebComponent.register({
    properties: {
        item: Object,
        columns: Array
    }
})
export class QueryGridFooter extends WebComponentListener(WebComponent) {
    static get template() { return Polymer.html`<link rel="import" href="query-grid-footer.html">` }

    item: Vidyano.QueryResultItem;
    columns: Vidyano.QueryColumn[];

    private _computeIsNumeric(column: QueryGridColumn) {
        return Vidyano.DataType.isNumericType(column.type);
    }

    private _computeItemValue(item: Vidyano.QueryResultItem, column: QueryGridColumn) {
        const value = item.getValue(column.name);
        
        const format = item.getTypeHint("displayformat", null);
        return !String.isNullOrEmpty(format) ? String.format(format, value) : value;
    }
}