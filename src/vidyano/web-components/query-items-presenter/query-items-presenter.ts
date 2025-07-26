import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
import { AppServiceHooks } from "components/app-service-hooks/app-service-hooks"
import { IFileDropDetails } from "components/file-drop/file-drop"
import { QueryGrid } from "components/query-grid/query-grid"
import "components/query-grid-gallery/query-grid-gallery"
import { ConfigurableWebComponent } from "components/web-component/web-component-configurable"

@ConfigurableWebComponent.register({
    properties: {
        query: Object,
        loading: {
            type: Boolean,
            reflectToAttribute: true,
            readOnly: true,
            value: true
        },
        templated: {
            type: Boolean,
            reflectToAttribute: true,
            readOnly: true
        },
        fileDrop: {
            type: Boolean,
            reflectToAttribute: true,
            readOnly: true
        }
    },
    keybindings: {
        "f5 ctrl+r": "_refresh",
        "ctrl+n": "_new",
        "delete": "_delete",
        "f2": "_bulkEdit"
    },
    observers: [
        "_renderQuery(query, query.currentChart, isConnected)"
    ],
    forwardObservers: [
        "query.currentChart"
    ],
    listeners: {
        "file-dropped": "_onFileDropped",
        "vi:configure": "_configure"
    }
}, "vi-query-items-presenter")
export class QueryItemsPresenter extends ConfigurableWebComponent {
    static get template() { return Polymer.html`<link rel="import" href="query-items-presenter.html">` }

    private _renderedQuery: Vidyano.Query;
    readonly loading: boolean; private _setLoading: (loading: boolean) => void;
    readonly templated: boolean; private _setTemplated: (templated: boolean) => void;
    readonly fileDrop: boolean; private _setFileDrop: (fileDrop: boolean) => void;
    query: Vidyano.Query;

    private async _renderQuery(query: Vidyano.Query, currentChart: Vidyano.QueryChart, isConnected: boolean) {
        if (!isConnected)
            return;

        this.empty();
        this._renderedQuery = null;

        if (!query) {
            this._setFileDrop(false);
            this._setTemplated(false);

            return;
        }

        this._setLoading(true);

        const config = this.app.configuration.getQueryConfig(query);

        this._setFileDrop(!!config && !!config.fileDropAttribute && !!query.actions[config.fileDropAction]);
        this._setTemplated(!!config && config.hasTemplate);

        if (this.templated) {
            if (this._renderedQuery !== query) {
                this.appendChild(config.stamp(query, config.as || "query"));
                this._renderedQuery = query;
            }
        }
        else {
            if (!currentChart) {
                if (query !== this.query || this._renderedQuery === query || !!query.currentChart)
                    return;

                const grid = new QueryGrid();
                this._renderedQuery = grid.query = this.query;
                this.appendChild(grid);
            }
            else {
                const chartConfig = this.app.configuration.getQueryChartConfig(currentChart.type);
                if (!chartConfig) {
                    console.error(`No chart configuration found for type '${currentChart.type}'`);
                    return;
                }

                if (query !== this.query || this._renderedQuery === query)
                    return;

                this._renderedQuery = query;

                this.appendChild(chartConfig.stamp(currentChart, chartConfig.as || "chart"));
            }
        }

        this._setLoading(false);
    }

    private async _onFileDropped(e: CustomEvent) {
        if (!this.fileDrop)
            return;

        const details: IFileDropDetails[] = e.detail;
        for (let detail of details) {
            await (<AppServiceHooks>this.query.service.hooks).onQueryFileDrop(this.query, detail.name, detail.contents);
        }
    }

    private _refresh() {
        if (this.query)
            this.query.search();
    }

    private _new() {
        if (!this.query)
            return;

        const action = <Vidyano.Action>this.query.actions["New"];
        if (action)
            action.execute();
    }

    private _delete() {
        if (!this.query || !this.query.selectedItems || this.query.selectedItems.length === 0)
            return true;

        const action = <Vidyano.Action>this.query.actions["Delete"];
        if (action)
            action.execute();
    }

    private _bulkEdit() {
        if (!this.query)
            return;

        const action = <Vidyano.Action>this.query.actions["BulkEdit"];
        if (action)
            action.execute();
    }

    private _configure(e: CustomEvent) {
        if (this.query.isSystem)
            return;

        e.detail.push({
            label: `Query: ${this.query.label}`,
            icon: "viConfigure",
            action: () => {
                this.app.changePath(`Management/PersistentObject.b9d2604d-2233-4df2-887a-709d93502843/${this.query.id}`);
            },
            subActions: [{
                label: `Persistent Object: ${this.query.persistentObject.type}`,
                icon: "viConfigure",
                action: () => {
                    this.app.changePath(`Management/PersistentObject.316b2486-df38-43e3-bee2-2f7059334992/${this.query.persistentObject.id}`);
                }
            }]
        });
    }
}