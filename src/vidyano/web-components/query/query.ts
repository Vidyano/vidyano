import { html, nothing, unsafeCSS } from "lit";
import { property } from "lit/decorators.js";
import * as Vidyano from "vidyano";
import "components/action-bar/action-bar";
import { AppCacheEntryQuery } from "components/app-cache/app-cache-entry-query";
import type { App } from "components/app/app";
import "components/notification/notification";
import { computed, observer, WebComponent } from "components/web-component/web-component";
import styles from "./query.css";

export class Query extends WebComponent {
    static styles = unsafeCSS(styles);

    /** Cache entry for the query */
    private _cacheEntry: AppCacheEntryQuery;

    /** The query to display */
    @property({ type: Object })
    @observer(function(this: Query) {
        if (this.query && this.isConnected) {
            this._cacheEntry = <AppCacheEntryQuery>(<App>this.app).cache(new AppCacheEntryQuery(this.query.id));
            this._cacheEntry.query = this.query;
        }
        else
            this._cacheEntry = null;
    })
    query: Vidyano.Query;

    /** Whether the query has no visible actions */
    @property({ type: Boolean, reflect: true })
    @computed(function(this: Query, actions: Vidyano.Action[]): boolean {
        return actions?.filter(a => a.isVisible).length === 0 && !actions["Filter"];
    }, "query.actions")
    declare readonly noActions: boolean;

    /** The label to display in the header, including filter name if applicable */
    @property({ type: String })
    @computed(function(this: Query, labelWithTotalItems: string, currentFilter: Vidyano.QueryFilter): string {
        return labelWithTotalItems + (currentFilter?.name ? " — " + currentFilter.name : "");
    }, "query.labelWithTotalItems", "currentFilter")
    declare readonly label: string;

    /** The currently active query filter */
    @property({ type: Object })
    @computed(function(this: Query, query: Vidyano.Query): Vidyano.QueryFilter | null {
        return query?.filters?.currentFilter ?? null;
    }, "query.filters.currentFilter", { allowUndefined: true })
    declare readonly currentFilter: Vidyano.QueryFilter | null;

    /** Whether to hide the header based on query configuration */
    @property({ type: Boolean, reflect: true })
    @computed(function(this: Query, query: Vidyano.Query, app: App): boolean {
        if (!query || !app)
            return false;

        const config = app.configuration.getQueryConfig(query);
        return !!config && !!config.hideHeader;
    }, "query", "app")
    declare readonly hideHeader: boolean;


    render() {
        return html`
            ${!this.hideHeader ? html`
                <header>${this.label}</header>
                ${!this.noActions ? html`<vi-action-bar class="action-bar" .serviceObject=${this.query}></vi-action-bar>` : nothing}
                <vi-notification .serviceObject=${this.query}></vi-notification>
            ` : nothing}
            <vi-query-items-presenter .query=${this.query}></vi-query-items-presenter>
        `;
    }
}

customElements.define("vi-query", Query);
