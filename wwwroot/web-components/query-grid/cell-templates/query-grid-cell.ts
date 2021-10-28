import * as Vidyano from "../../../libs/vidyano/vidyano.js"
import { WebComponent } from "../../web-component/web-component.js"

@WebComponent.register({
    properties: {
        column: Object,
        value: Object
    }
})
export abstract class QueryGridCell extends WebComponent {
    column: Vidyano.QueryColumn;
    value: Vidyano.QueryResultItemValue;
    valueQueued: Vidyano.QueryResultItemValue;
}