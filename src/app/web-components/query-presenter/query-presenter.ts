import * as Vidyano from "vidyano"
import * as Polymer from "polymer"
import { AppCacheEntryQuery } from "components/app-cache/app-cache-entry-query"
import { App } from "components/app/app"
import { Query } from "components/query/query"
import "components/query-items-presenter/query-items-presenter"
import { WebComponent } from "components/web-component/web-component"

interface IQueryPresenterRouteParameters {
    programUnitName: string;
    id: string;
}

@WebComponent.register({
    properties: {
        queryId: {
            type: String,
            reflectToAttribute: true
        },
        query: {
            type: Object,
            observer: "_queryChanged"
        },
        loading: {
            type: Boolean,
            readOnly: true,
            value: true,
            reflectToAttribute: true
        },
        error: {
            type: String,
            readOnly: true
        },
        hasError: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeHasError(error)"
        }
    },
    observers: [
        "_updateQuery(queryId, app)",
        "_updateTitle(query.labelWithTotalItems)"
    ],
    listeners: {
        "app-route-activate": "_activate"
    },
    forwardObservers: [
        "query.labelWithTotalItems"
    ]
}, "vi-query-presenter")
export class QueryPresenter extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="query-presenter.html">`; }

    private _cacheEntry: AppCacheEntryQuery;
    readonly loading: boolean; private _setLoading: (loading: boolean) => void;
    readonly error: string; private _setError: (error: string) => void;
    queryId: string;
    query: Vidyano.Query;

    private _activate(e: CustomEvent) {
        const { parameters }: { parameters: IQueryPresenterRouteParameters; } = e.detail;

        this._cacheEntry = <AppCacheEntryQuery>(<App>this.app).cache(new AppCacheEntryQuery(parameters.id));
        if (this._cacheEntry && this._cacheEntry.query)
            this.query = this._cacheEntry.query;
        else {
            this.queryId = this.query = undefined;
            this.queryId = parameters.id;
        }
    }

    private _computeHasError(error: string): boolean {
        return !String.isNullOrEmpty(error);
    }

    private async _updateQuery(queryId: string, app: App) {
        this._setError(null);

        if ((this.query && queryId && this.query.id.toUpperCase() === queryId.toUpperCase()))
            return;

        this.empty();

        if (this.queryId) {
            if (this.query)
                this.query = null;

            try {
                this._setLoading(true);

                const query = await app.service.getQuery(this.queryId);
                if (query.id.toUpperCase() === this.queryId.toUpperCase()) {
                    this._cacheEntry = <AppCacheEntryQuery>(<App>this.app).cache(new AppCacheEntryQuery(query.id));
                    this.query = this._cacheEntry.query = query;
                }
            }
            catch (e) {
                this._setError(e);
            }
            finally {
                this._setLoading(false);
            }
        }
        else
            this.query = null;
    }

    private async _queryChanged(query: Vidyano.Query, oldQuery: Vidyano.Query) {
        if (this.isConnected && oldQuery)
            this.empty();

        if (query) {
            if(this.queryId !== query.id)
                this.queryId = query.id;

            if (this.query !== query)
                return;

            this._renderQuery(query);
        }
    }

    private _renderQuery(query: Vidyano.Query) {
        if (query !== this.query)
            return;

        const queryComponent = new Query();
        queryComponent.query = query;
        this.appendChild(queryComponent);

        this._setLoading(false);
    }

    private _updateTitle(title: string) {
        this.fire("title-changed", { title: title }, { bubbles: true });
    }
}

export default QueryPresenter;