import * as Vidyano from "vidyano"
import { html, unsafeCSS } from "lit"
import { property } from "lit/decorators.js";
import { WebComponentLit, observer, listener } from "components/web-component/web-component-lit"
import { App } from "components/app/app"
import { AppCacheEntryQuery } from "components/app-cache/app-cache-entry-query"
import { AppServiceHooks } from "components/app-service-hooks/app-service-hooks"
import { Query } from "components/query/query"
import "components/query-items-presenter/query-items-presenter"
import styles from "./query-presenter.css"

const QueryPresenter_Activated = Symbol("QueryPresenter_Activated");

interface IQueryPresenterRouteParameters {
    programUnitName: string;
    id: string;
}

export class QueryPresenter extends WebComponentLit {
    static override styles = unsafeCSS(styles);

    #cacheEntry: AppCacheEntryQuery;
    #pendingQueryId?: string;

    @property({ type: String, reflect: true })
    queryId?: string;

    @property({ type: Object })
    query: Vidyano.Query;

    @property({ type: Boolean, reflect: true, state: true })
    loading: boolean = true;

    @property({ type: String, state: true })
    error: string;

    /*
     * Gets whether there is an error.
     */
    get hasError(): boolean {
        return !String.isNullOrEmpty(this.error);
    }

    @listener("app-route-activate")
    private async _activate(e: CustomEvent) {
        const { parameters }: { parameters: IQueryPresenterRouteParameters; } = e.detail;

        // Validate that we have a query ID
        if (!parameters?.id) {
            this.error = "No query ID provided";
            this.loading = false;
            return;
        }

        this.queryId = parameters.id;
        this.#cacheEntry = <AppCacheEntryQuery>(<App>this.app).cache(new AppCacheEntryQuery(parameters.id));

        if (this.#cacheEntry?.query) {
            // Query already available
            this.query = this.#cacheEntry.query;
            this.loading = false;
            this.#pendingQueryId = undefined;
        }
        else {
            // Load query from server
            this.query = null;
            this.error = null;
            const requestedId = parameters.id;
            this.#pendingQueryId = requestedId;

            try {
                this.loading = true;
                const query = await this.app.service.getQuery(parameters.id);

                // Race condition check: only update if this request is still current
                if (this.#pendingQueryId === requestedId && query.id === requestedId) {
                    this.#cacheEntry = <AppCacheEntryQuery>(<App>this.app).cache(new AppCacheEntryQuery(query.id));
                    this.query = this.#cacheEntry.query = query;
                }
                else if (query.id !== requestedId)
                    console.warn(`Query ID mismatch: requested "${requestedId}" but received "${query.id}"`);
            }
            catch (e) {
                // Only show error if this request is still current
                if (this.#pendingQueryId === requestedId)
                    this.error = e;
            }
            finally {
                // Clean up loading state if this request is still current
                if (this.#pendingQueryId === requestedId) {
                    this.#pendingQueryId = undefined;
                    this.loading = false;
                }
            }
        }
    }

    @listener("app-route-deactivate")
    private async _deactivate(e: CustomEvent) {
        this.deactivateQuery(this.query);
    }

    @observer("query")
    private async _queryChanged(query: Vidyano.Query, oldQuery: Vidyano.Query) {
        this.deactivateQuery(oldQuery);

        if (this.isConnected && oldQuery)
            this.innerHTML = "";

        if (query) {
            if (this.queryId !== query.id)
                this.queryId = query.id;

            this.#renderQuery(query);
            this.activateQuery(query);
        }
    }

    /**
     * Activates a query by marking it as activated and notifying hooks.
     * Override this method to customize query activation behavior.
     * @param query - The query to activate
     */
    protected activateQuery(query: Vidyano.Query) {
        if (query && !query[QueryPresenter_Activated] && this.app?.hooks instanceof AppServiceHooks) {
            query[QueryPresenter_Activated] = true;
            this.app.hooks.onQueryActivated(query, {
                presenter: this,
            });
        }
    }

    /**
     * Deactivates a query by unmarking it and notifying hooks.
     * Override this method to customize query deactivation behavior.
     * @param query - The query to deactivate
     */
    protected deactivateQuery(query: Vidyano.Query) {
        if (query?.[QueryPresenter_Activated] && this.app?.hooks instanceof AppServiceHooks) {
            query[QueryPresenter_Activated] = false;
            this.app.hooks.onQueryDeactivated(query, {
                presenter: this,
            });
        }
    }

    /**
     * Creates the component that will display the query.
     * Override this method in subclasses to use a custom query component.
     * @param query - The query to create a component for
     * @returns The component that will display the query
     */
    protected createQueryComponent(query: Vidyano.Query): HTMLElement {
        const queryComponent = new Query();
        queryComponent.query = query;
        return queryComponent;
    }

    /**
     * Renders a query by creating and appending a Query component to the DOM.
     * This method handles the lifecycle logic (checking, appending, loading state).
     * Override createQueryComponent() to customize which component is created.
     * @param query - The query to render
     */
    #renderQuery(query: Vidyano.Query) {
        if (query !== this.query)
            return;

        const queryComponent = this.createQueryComponent(query);
        this.appendChild(queryComponent);

        this.loading = false;
    }

    @observer("query.labelWithTotalItems")
    private _updateTitle(title: string) {
        if (this.query && title !== undefined) {
            this.dispatchEvent(new CustomEvent("title-changed", { detail: { title: title }, bubbles: true }));
        }
    }

    override render() {
        return html`
            ${this.loading ? html`<vi-spinner></vi-spinner>` : null}
            ${this.hasError ? html`
                <div id="error">
                    <vi-icon source="Notification_Error"></vi-icon>
                    <span>${this.error}</span>
                </div>
            ` : null}
            <slot></slot>
        `;
    }
}

customElements.define("vi-query-presenter", QueryPresenter);

export default QueryPresenter;
