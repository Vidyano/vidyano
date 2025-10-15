import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
import "components/action-bar/action-bar"
import { AppCacheEntryQuery } from "components/app-cache/app-cache-entry-query"
import type { App } from "components/app/app"
import "components/notification/notification"

@Polymer.WebComponent.register({
    properties: {
        query: {
            type: Object,
            observer: "_queryChanged"
        },
        noActions: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeNoActions(query.actions)"
        },
        label: {
            type: String,
            computed: "_computeLabel(query.labelWithTotalItems, currentFilter)"
        },
        currentFilter: {
            type: Object,
            computed: "query.filters.currentFilter",
            value: null
        },
        hideHeader: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeHideHeader(query, app)"
        }
    },
    forwardObservers: [
        "query.labelWithTotalItems",
        "query.filters.currentFilter.name"
    ]
}, "vi-query")
export class Query extends Polymer.WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="query.html">`; }

    private _cacheEntry: AppCacheEntryQuery;
    query: Vidyano.Query;

    connectedCallback() {
        super.connectedCallback();

        this._queryChanged();
    }

    private _queryChanged() {
        if (this.query && this.isConnected) {
            this._cacheEntry = <AppCacheEntryQuery>(<App>this.app).cache(new AppCacheEntryQuery(this.query.id));
            this._cacheEntry.query = this.query;
        }
        else
            this._cacheEntry = null;
    }

    private _computeNoActions(actions: Vidyano.Action[]): boolean {
        return actions && actions.filter(a => a.isVisible).length === 0 && actions["Filter"] == null;
    }

    private _computeSearchOnHeader(noActions: boolean, query: Vidyano.Query): boolean {
        return noActions && query && query.actions["Filter"] != null;
    }

    private _computeLabel(labelWithTotalItems: string, currentFilter: Vidyano.QueryFilter): string {
        return labelWithTotalItems + (currentFilter && currentFilter.name ? " — " + currentFilter.name : "");
    }

    private _computeHideHeader(query: Vidyano.Query, app: App): boolean {
        if (!query || !app)
            return false;

        const config = app.configuration.getQueryConfig(query);
        return !!config && !!config.hideHeader;
    }
}
