import * as Vidyano from "../../libs/vidyano/vidyano.js"
import * as Polymer from "../../libs/polymer/polymer.js"
import { WebComponent } from "../../web-components/web-component/web-component.js"
import "../../web-components/scroller/scroller.js"
import "../../web-components/query-grid/query-grid.js"

type QueryGridTestParameters = {
    name: string;
};

@WebComponent.register({
    properties: {
        maxRows: {
            type: Number,
            readOnly: true
        },
        query: {
            type: Object,
            readOnly: true,
        },
        queryName: {
            type: String,
            readOnly: true,
            reflectToAttribute: true
        },
        skip: {
            type: Number,
            value: 0
        },
        withGrouping: {
            type: Boolean,
            value: true
        }
    },
    listeners: {
        "app-route-activate": "_activate"
    },
    observers: [
        "_computeQuery(service, queryName, withGrouping)"
    ]
})
export class QueryGridTest extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="query-grid-test.html">`; }

    readonly maxRows: number; private _setMaxRows: (maxRows: number) => void;
    readonly query: Vidyano.Query; private _setQuery: (query: Vidyano.Query) => void;
    readonly queryName: string; private _setQueryName: (queryName: string) => void;
    skip: number;
    withGrouping: boolean;

    private _activate(e: CustomEvent) {
        const { parameters }: { parameters: QueryGridTestParameters; } = e.detail;
        this._setQueryName(parameters.name);

        if (parameters.name === "MaxRows")
            this._setMaxRows(10);
    }

    private async _computeQuery(service: Vidyano.Service, name: string, withGrouping: boolean) {
        Vidyano.ServiceBus.send("vi-menu-item:select", { name: `QueryGridTest_${name}` });

        switch (name) {
            case "MaxRows": {
                this._setQuery(await service.getQuery("f94e7b97-c09c-4082-bde0-5ab426b1e289"));
                break;
            }
            default: {
                const po = await service.getPersistentObject(null, "29a160cd-c146-36a8-bf8c-8d159341c1a2", withGrouping ? "grouped" : null);
                this._setQuery(po.queries.find(q => q.name.toLocaleLowerCase().endsWith(`_${name.toLowerCase()}`)));
            }
        }
    }

    private _showMoreData() {
        this._setMaxRows(this.maxRows + 10);
    }
}