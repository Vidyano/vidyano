import * as Vidyano from "../../libs/vidyano/vidyano.js"
import * as Polymer from "../../libs/polymer/polymer"
import { AppRoute } from "../../web-components/app-route/app-route.js"
import { WebComponent, WebComponentListener } from "../../web-components/web-component/web-component.js"
import "../../web-components/scroller/scroller.js"
import "../../web-components/query-grid/query-grid.js"

@WebComponent.register({
    properties: {
        query: {
            type: Object,
            readOnly: true
        },
        withGrouping: {
            type: Boolean,
            value: true
        }
    },
    observers: [
        "_getQueries(service, withGrouping)"
    ]
})
export class QueryGridTest extends WebComponentListener(WebComponent) {
    static get template() { return Polymer.html`<link rel="import" href="query-grid-test.html">`; }

    readonly query: Vidyano.Query; private _setQuery: (query: Vidyano.Query) => void;

    private async _getQueries(service: Vidyano.Service, withGrouping: boolean) {
        const queryName = (this.parentElement as AppRoute).parameters.name;
        Vidyano.ServiceBus.send("vi-menu-item:select", { name: `QueryGridTest_${queryName}` });

        const po = await service.getPersistentObject(null, "29a160cd-c146-36a8-bf8c-8d159341c1a2", withGrouping ? "grouped" : null);
        this._setQuery(po.queries.find(q => q.name.toLocaleLowerCase().endsWith(`_${queryName.toLowerCase()}`)));
    }
}