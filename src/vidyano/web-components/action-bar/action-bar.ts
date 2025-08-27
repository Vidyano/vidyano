import { html, nothing, unsafeCSS } from "lit";
import { repeat } from "lit/directives/repeat.js";
import * as Vidyano from "vidyano";
import { WebComponentLit, property } from "components/web-component/web-component-lit.js";
import type { App } from "components/app/app.js";
import "components/action-button/action-button.js";
import "components/overflow/overflow.js";
import "components/input-search/input-search.js";
import "components/query-chart-selector/query-chart-selector.js";
import styles from "./action-bar.css";

export class ActionBar extends WebComponentLit {
    static styles = unsafeCSS(styles);

    @property({ type: Object })
    serviceObject: Vidyano.ServiceObjectWithActions;

    @property({ computed: "_computePinnedActions(serviceObject, serviceObject.actions.*.isPinned)" })
    pinnedActions: (Vidyano.Action | Vidyano.ActionGroup)[];

    @property({ computed: "_computeUnpinnedActions(serviceObject, serviceObject.actions.*.isPinned)" })
    unpinnedActions: (Vidyano.Action | Vidyano.ActionGroup)[];

    @property({ type: Boolean, computed: "_computeHasCharts(serviceObject.charts, app)" })
    hasCharts: boolean = false;

    @property({ type: Boolean, computed: "_computeCanSearch(serviceObject)" })
    canSearch: boolean;

    @property({ type: Boolean, reflect: true, computed: "_computeNoActions(pinnedActions, unpinnedActions, serviceObject.actions.*.isVisible)" })
    noActions: boolean;

    @property({ type: Boolean, reflect: true })
    accent: boolean;

    @property({ type: Number, computed: "serviceObject.selectedItemCount" })
    selectedItemCount: number;

    private _search() {
        if (!this.canSearch)
            return;

        const query = <Vidyano.Query>this.serviceObject;
        query.search();
    }

    private _computePinnedActions(serviceObject: Vidyano.ServiceObjectWithActions): (Vidyano.Action | Vidyano.ActionGroup)[] {
        return this.memoize(this.pinnedActions, serviceObject?.actions ? Array.from(this._transformActionsWithGroups(serviceObject.actions.filter(action => action.isPinned))) : undefined);
    }

    private _computeUnpinnedActions(serviceObject: Vidyano.ServiceObjectWithActions): (Vidyano.Action | Vidyano.ActionGroup)[] {
        return this.memoize(this.unpinnedActions, serviceObject?.actions ? Array.from(this._transformActionsWithGroups(serviceObject.actions.filter(action => !action.isPinned))) : undefined);
    }

    private *_transformActionsWithGroups(actions: Vidyano.Action[]): IterableIterator<Vidyano.Action | Vidyano.ActionGroup> {
        const actionGroups: { [name: string]: Vidyano.ActionGroup } = {};
        for (let i = 0; i < actions.length; i++) {
            const action = actions[i];
            if (!action.group) {
                yield action;
                continue;
            }

            if (!actionGroups[action.group.name])
                yield (actionGroups[action.group.name] = action.group);
        }
    }

    private _computeHasCharts(charts: Vidyano.QueryChart[], app: App): boolean {
        return !!charts && !!charts.find(c => !!app?.configuration.getQueryChartConfig(c.type));
    }

    private _computeCanSearch(serviceObject: Vidyano.ServiceObjectWithActions): boolean {
        return serviceObject instanceof Vidyano.Query && (<Vidyano.Query>serviceObject).actions["Filter"] != null;
    }

    private _computeNoActions(pinnedActions: (Vidyano.Action | Vidyano.ActionGroup)[], unpinnedActions: (Vidyano.Action | Vidyano.ActionGroup)[]): boolean {
        const actions = (pinnedActions || []).concat(unpinnedActions || []);
        if (actions.length === 0)
            return true;

        return !actions.some(a => a.isVisible);
    }

    render() {
        return html`
            <vi-overflow>
                ${repeat(this.unpinnedActions ?? [], (action) => action.name, (action) => html`
                    <vi-action-button .action=${action} inverse></vi-action-button>
                `)}
            </vi-overflow>
            ${repeat(this.pinnedActions ?? [], (action) => action.name, (action) => html`
                <vi-action-button .action=${action} no-label inverse></vi-action-button>
            `)}
            ${this.hasCharts ? html`<vi-query-chart-selector .query=${this.serviceObject}></vi-query-chart-selector>` : ""}
            ${this.#selectedItems(this.selectedItemCount)}
            ${this.canSearch ? html`
                <div class="search">
                    <vi-input-search
                        .value=${(this.serviceObject as Vidyano.Query).textSearch}
                        @value-changed=${(e: CustomEvent) => (this.serviceObject as Vidyano.Query).textSearch = e.detail.value}
                        @search=${this._search}
                    ></vi-input-search>
                </div>
            `: ""}
        `;
    }

    #selectedItems(selectedItemCount: number) {
        if (this.serviceObject instanceof Vidyano.Query === false || !(selectedItemCount > 0))
            return nothing;

        return html`<div class="selected-items">
            <vi-button label=${`${Vidyano.CultureInfo.currentCulture.formatNumber(selectedItemCount)} selected`} icon="SearchReset" @click=${() => (this.serviceObject as Vidyano.Query).clearSelection()}></vi-button>
        </div>`;
    }
}

customElements.define("vi-action-bar", ActionBar);