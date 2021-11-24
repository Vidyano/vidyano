import * as Vidyano from "../../libs/vidyano/vidyano.js"
import * as Polymer from "../../libs/@polymer/polymer.js"
import { WebComponent, WebComponentListener } from "../../web-components/web-component/web-component.js"
import "../../web-components/scroller/scroller.js"
import "../../web-components/query-grid/query-grid.js"

@WebComponent.register({
    properties: {
        queries: {
            type: Array,
            readOnly: true
        }
    },
    observers: [
        "_getQueries(service)"
    ]
})
export class QueryGridTest extends WebComponentListener(WebComponent) {
    static get template() { return Polymer.html`<link rel="import" href="query-grid-test.html">`; }

    readonly queryies: Vidyano.Query[]; private _setQueries: (queries: Vidyano.Query[]) => void;

    private async _getQueries(service: Vidyano.Service) {
        this._setQueries((await service.getPersistentObject(null, "29a160cd-c146-36a8-bf8c-8d159341c1a2")).queries);
    }
}