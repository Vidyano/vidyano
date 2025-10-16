import { html, nothing, unsafeCSS } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { keyed } from "lit/directives/keyed.js";
import { property } from "lit/decorators.js";
import * as Vidyano from "vidyano";
import { WebComponent, computed } from "components/web-component/web-component.js";
import type { App } from "components/app/app.js";
import "components/action-button/action-button.js";
import "components/overflow/overflow.js";
import "components/input-search/input-search.js";
import "components/query-chart-selector/query-chart-selector.js";
import styles from "./action-bar.css";

export class ActionBar extends WebComponent {
    static styles = unsafeCSS(styles);

    @property({ type: Object })
    serviceObject: Vidyano.ServiceObjectWithActions;

    @property({ type: Array })
    @computed("_computePinnedActions(serviceObject, serviceObject.actions.*.isPinned)", { allowUndefined: true })
    pinnedActions: (Vidyano.Action | Vidyano.ActionGroup)[];

    @property({ type: Array })
    @computed("_computeUnpinnedActions(serviceObject, serviceObject.actions.*.isPinned)", { allowUndefined: true })
    unpinnedActions: (Vidyano.Action | Vidyano.ActionGroup)[];

    @property({ type: Boolean })
    @computed("_computeHasCharts(serviceObject.charts, app)")
    hasCharts: boolean = false;

    @property({ type: Boolean })
    @computed("_computeCanSearch(serviceObject)")
    canSearch: boolean;

    @property({ type: Boolean, reflect: true })
    @computed("_computeNoActions(pinnedActions, unpinnedActions, serviceObject.actions.*.isVisible)", { allowUndefined: true })
    noActions: boolean;

    @property({ type: Boolean, reflect: true })
    accent: boolean;

    @property({ type: Number })
    @computed("serviceObject.selectedItemCount")
    selectedItemCount: number;

    #searchResizeObserver: ResizeObserver;

    connectedCallback() {
        super.connectedCallback();
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        this.#searchResizeObserver?.disconnect();
    }

    private _setupSearchResizeObserver() {
        if (!this.#searchResizeObserver) {
            this.#searchResizeObserver = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    const { width } = entry.contentRect;
                    this.style.setProperty('--search-width', `${width}px`);
                }
            });
        }
        
        requestAnimationFrame(() => {
            const searchElement = this.shadowRoot?.querySelector('.search') as HTMLElement;
            if (searchElement && this.#searchResizeObserver) {
                this.#searchResizeObserver.disconnect(); // Disconnect from any previous elements
                this.#searchResizeObserver.observe(searchElement);
            }
        });
    }

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

    protected firstUpdated(changedProperties: Map<string | number | symbol, unknown>) {
        super.firstUpdated(changedProperties);

        if (this.canSearch)
            this._setupSearchResizeObserver();
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
            ${this.#chartSelector()}
            ${this.#selectedItems(this.selectedItemCount)}
            ${this.#searchBar()}
        `;
    }

    #chartSelector() {
        if (!this.hasCharts)
            return nothing;

        return html`<vi-query-chart-selector .query=${this.serviceObject}></vi-query-chart-selector>`;
    }

    #selectedItems(selectedItemCount: number) {
        if (this.serviceObject instanceof Vidyano.Query === false || !(selectedItemCount > 0))
            return nothing;

        // Use keyed directive to force re-render and re-trigger animation when count changes
        return keyed(selectedItemCount, html`
            <div class="selected-items">
                <vi-button inverse label=${this.service.getTranslatedMessage("Selected", Vidyano.CultureInfo.currentCulture.formatNumber(selectedItemCount))} icon="SearchReset" @click=${() => (this.serviceObject as Vidyano.Query).clearSelection()}></vi-button>
            </div>`);
    }

    #searchBar() {
        if (!this.canSearch)
            return nothing;

        return html`
            <div class="search">
                <div class="resizer" @pointerdown=${this._searchResize}></div>
                <vi-input-search
                    .value=${(this.serviceObject as Vidyano.Query).textSearch}
                    @value-changed=${(e: CustomEvent) => (this.serviceObject as Vidyano.Query).textSearch = e.detail.value}
                    @search=${this._search}
                ></vi-input-search>
            </div>
        `;
    }

    private _searchResize = (e: PointerEvent) => {
        e.preventDefault();

        const searchElement = this.shadowRoot?.querySelector('.search') as HTMLElement;
        const resizerElement = e.target as HTMLElement;
        if (!searchElement || !resizerElement)
            return;

        // Capture the pointer to maintain control even if mouse moves fast or for touch
        resizerElement.setPointerCapture(e.pointerId);
        
        const startX = e.clientX;

        // Get the current width from the computed style
        const computedStyle = window.getComputedStyle(searchElement);
        const startWidth = parseFloat(computedStyle.width);

        if (e.pointerType === 'mouse') {
            document.body.style.cursor = 'ew-resize';
        }

        const doResize = (moveEvent: PointerEvent) => {
            const newWidth = startWidth - (moveEvent.clientX - startX);
            if (newWidth >= 200 && newWidth <= 600)
                this.style.setProperty('--search-width', `${newWidth}px`);
        };

        const stopResize = () => {
            // Release the pointer capture
            resizerElement.releasePointerCapture(e.pointerId);
            
            document.body.style.cursor = '';
            
            resizerElement.removeEventListener('pointermove', doResize);
            resizerElement.removeEventListener('pointerup', stopResize);
            resizerElement.removeEventListener('pointercancel', stopResize);
        };

        resizerElement.addEventListener('pointermove', doResize);
        resizerElement.addEventListener('pointerup', stopResize);
        resizerElement.addEventListener('pointercancel', stopResize);
    };
}

customElements.define("vi-action-bar", ActionBar);
