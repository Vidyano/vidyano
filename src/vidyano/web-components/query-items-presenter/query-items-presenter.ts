import { html, unsafeCSS } from "lit";
import { property, state } from "lit/decorators.js";
import * as Vidyano from "vidyano";
import { AppServiceHooks } from "components/app-service-hooks/app-service-hooks";
import { IFileDropDetails } from "components/file-drop/file-drop";
import { QueryGrid } from "components/query-grid/query-grid";
import "components/query-grid-gallery/query-grid-gallery";
import { keybinding, listener, observer, WebComponent } from "components/web-component/web-component";
import { IConfigurableAction, WebComponentConfigurationController } from "components/web-component/web-component-configuration-controller";
import styles from "./query-items-presenter.css";

export class QueryItemsPresenter extends WebComponent {
    static styles = unsafeCSS(styles);

    #renderedQuery: Vidyano.Query;

    @property({ type: Object })
    query: Vidyano.Query;

    @state()
    loading: boolean = true;

    @state()
    templated: boolean = false;

    @state()
    fileDrop: boolean = false;

    // Configuration controller to add configurable actions to the context menu
    readonly #configurable = new WebComponentConfigurationController(this, (actions: IConfigurableAction[]) => {
        if (this.query?.isSystem)
            return;

        actions.push({
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
    });

    @observer("query", "query.currentChart", "isConnected")
    private async _renderQuery(query: Vidyano.Query, currentChart: Vidyano.QueryChart, isConnected: boolean) {
        if (!isConnected)
            return;

        this.innerHTML = "";
        this.#renderedQuery = null;

        if (!query) {
            this.fileDrop = false;
            this.templated = false;

            return;
        }

        this.loading = true;

        const config = this.app.configuration.getQueryConfig(query);

        this.fileDrop = !!config && !!config.fileDropAttribute && !!query.actions[config.fileDropAction];
        this.templated = !!config && config.hasTemplate;

        if (this.templated) {
            if (this.#renderedQuery !== query) {
                // TODO: Migrate to Lit - config.stamp() uses Polymer templates
                this.appendChild(config.stamp(query, config.as || "query"));
                this.#renderedQuery = query;
            }
        }
        else {
            if (!currentChart) {
                if (query !== this.query || this.#renderedQuery === query || !!query.currentChart)
                    return;

                // TODO: Migrate to Lit - QueryGrid is Polymer-based
                const grid = new QueryGrid();
                this.#renderedQuery = grid.query = this.query;
                this.appendChild(grid);
            }
            else {
                const chartConfig = this.app.configuration.getQueryChartConfig(currentChart.type);
                if (!chartConfig) {
                    console.error(`No chart configuration found for type '${currentChart.type}'`);
                    return;
                }

                if (query !== this.query || this.#renderedQuery === query)
                    return;

                this.#renderedQuery = query;

                // TODO: Migrate to Lit - chartConfig.stamp() uses Polymer templates
                this.appendChild(chartConfig.stamp(currentChart, chartConfig.as || "chart"));
            }
        }

        this.loading = false;
    }

    @listener("file-dropped")
    private async _onFileDropped(e: CustomEvent) {
        if (!this.fileDrop)
            return;

        const details: IFileDropDetails[] = e.detail;
        for (let detail of details) {
            await (<AppServiceHooks>this.query.service.hooks).onQueryFileDrop(this.query, detail.name, detail.contents);
        }
    }

    @keybinding("f5")
    @keybinding("ctrl+r")
    private _refresh() {
        this.query?.search();
    }

    @keybinding("insert")
    private _new() {
        if (!this.query)
            return;

        const action = <Vidyano.Action>this.query.actions["New"];
        if (action)
            action.execute();
    }

    @keybinding("delete")
    private _delete() {
        if (!this.query?.selectedItems?.length)
            return;

        const action = <Vidyano.Action>this.query.actions["Delete"];
        if (action)
            action.execute();
    }

    @keybinding("f2")
    private _bulkEdit() {
        if (!this.query)
            return;

        const action = <Vidyano.Action>this.query.actions["BulkEdit"];
        if (action)
            action.execute();
    }

    render() {
        return html`
            ${this.fileDrop ? html`
                <vi-file-drop class="file-drop-container">
                    <slot></slot>
                </vi-file-drop>
            ` : html`
                <slot></slot>
            `}
            <vi-spinner ?hidden=${!this.loading}></vi-spinner>
        `;
    }
}

customElements.define("vi-query-items-presenter", QueryItemsPresenter);
