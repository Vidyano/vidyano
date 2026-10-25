import { html, nothing, unsafeCSS } from "lit";
import { property } from "lit/decorators.js";
import * as Polymer from "polymer"
import * as Vidyano from "@vidyano/core"
import { WebComponent, computed, observer } from "components/web-component/web-component"
import "components/button/button"
import "components/checkbox/checkbox"
import "components/input-search/input-search"
import type { InputSearch } from "components/input-search/input-search"
import "components/list/list"
import type { List } from "components/list/list"
import { Popup } from "components/popup/popup"
import "components/spinner/spinner"
import { ISize } from "components/size-tracker/size-tracker"
import { QueryGridColumn } from "./query-grid-column"
import styles from "./query-grid-column-filter.css"

export interface IQueryGridColumnFilterDistinct {
    type: string;
    value: string;
    displayValue: string;
}

interface IQueryGridColumnFilterDistinctItem extends IQueryGridColumnFilterDistinct {
    checked: boolean;
    html?: string;
}

function escapeHTML(value: string): string {
    const span = document.createElement("span");
    span.innerText = value;

    return span.innerHTML;
}

export class QueryGridColumnFilter extends WebComponent {
    static styles = unsafeCSS(styles);

    #searchTextTimer: ReturnType<typeof setTimeout>;
    #focusTimer: ReturnType<typeof setTimeout>;
    #resizeStart: ISize & { x: number; y: number };

    @property({ type: Object })
    column: QueryGridColumn;

    @property({ type: Object })
    @computed("column.column")
    declare readonly queryColumn: Vidyano.QueryColumn;

    @property({ type: Array })
    @computed(function(this: QueryGridColumnFilter, queryColumn: Vidyano.QueryColumn, selectedDistincts: string[], distincts: Vidyano.IQueryColumnDistincts, inversed: boolean) {
        return this._computeDistincts(queryColumn, selectedDistincts, distincts, inversed);
    }, "queryColumn", "queryColumn.selectedDistincts", "queryColumn.distincts", "inversed", "service", { allowUndefined: true })
    declare readonly distincts: IQueryGridColumnFilterDistinctItem[];

    @property({ type: Array })
    @computed(function(this: QueryGridColumnFilter, distincts: IQueryGridColumnFilterDistinctItem[], searchText: string) {
        return this._computeFilteredDistincts(distincts, searchText);
    }, "distincts", "searchText", { allowUndefined: true })
    declare readonly filteredDistincts: IQueryGridColumnFilterDistinctItem[];

    @property({ type: Boolean, reflect: true })
    @computed(function(this: QueryGridColumnFilter, selectedDistincts: string[]) {
        return selectedDistincts?.length > 0;
    }, "queryColumn.selectedDistincts", { allowUndefined: true })
    declare readonly filtered: boolean;

    @property({ type: String })
    @computed(function(this: QueryGridColumnFilter, selectedDistincts: string[], inversed: boolean) {
        return this._computeLabel(selectedDistincts, inversed);
    }, "queryColumn.selectedDistincts", "inversed", "service", { allowUndefined: true })
    declare readonly label: string;

    @property({ type: Boolean, reflect: true })
    @computed("queryColumn.query.isFiltering")
    declare readonly queryFiltering: boolean;

    @property({ type: Boolean })
    @computed("queryColumn.selectedDistinctsInversed")
    declare readonly inversed: boolean;

    @property({ type: Boolean, reflect: true })
    loading: boolean = false;

    @property({ type: String })
    @observer(function(this: QueryGridColumnFilter, searchText: string, oldSearchText: string) {
        this._searchTextChanged(searchText, oldSearchText);
    })
    searchText: string = "";

    @property({ type: Boolean, reflect: true })
    @computed(function(this: QueryGridColumnFilter, column: QueryGridColumn) {
        return !column.canFilter;
    }, "column")
    declare readonly disabled: boolean;

    @property({ type: Boolean, reflect: true })
    @computed("queryColumn.isSensitive")
    declare readonly sensitive: boolean;

    @property({ type: Boolean, state: true })
    popupRendered: boolean = false;

    disconnectedCallback() {
        super.disconnectedCallback();

        (<Popup>this.shadowRoot.querySelector("#filter"))?.close();
        this.searchText = "";
        this.#cancelSearchTextRefresh();
        clearTimeout(this.#focusTimer);
        this.loading = false;
    }

    render() {
        if (!this.popupRendered) {
            return html`
                <vi-button id="preRender" inverse @click=${this._render}>
                    <span id="label">${this.label}</span>
                    <vi-icon source="Filter"></vi-icon>
                </vi-button>
            `;
        }

        return html`
            <vi-popup id="filter" @popup-opening=${this._popupOpening} @popup-closed=${this._popupClosed} ?disabled=${this.disabled}>
                <vi-button slot="header" inverse>
                    <span id="label">${this.label}</span>
                    <vi-icon source="Filter"></vi-icon>
                </vi-button>
                <div id="filterContentHost" @click=${this._catchClick}>
                    <div id="filterContent">
                        <div class="left"></div>
                        <div class="menuItem" ?disabled=${!this.filtered} @click=${this._clear}>
                            <vi-icon source="Filter_Reset"></vi-icon>
                            <span>${this.translateMessage("ClearFilterFrom", this.column?.label)}</span>
                        </div>
                        <div class="split"></div>
                        <div class="advanced">
                            <vi-input-search id="search" .value=${this.searchText} @value-changed=${this._searchValueChanged} @search=${this._search}></vi-input-search>
                            <div class="values">
                                <button id="inverse" @click=${this._inverse} ?inversed=${this.inversed}>
                                    <vi-icon source="Filter_Inverse"></vi-icon>
                                </button>
                                ${this.loading ? html`<vi-spinner></vi-spinner>` : nothing}
                                <vi-list id="distincts" class=${this.sensitive && this.isAppSensitive ? "sensitive" : ""} .items=${this.filteredDistincts} as="distinct" @click=${this._distinctClick}>
                                    <template>
                                        <div>
                                            <dom-if if="[[distinct.type]]">
                                                <template>
                                                    <div class="item">
                                                        <vi-checkbox checked="[[distinct.checked]]"></vi-checkbox>
                                                        <span distinct-type$="[[distinct.type]]" inner-h-t-m-l="[[distinct.html]]"></span>
                                                    </div>
                                                </template>
                                            </dom-if>
                                            <dom-if if="[[!distinct.type]]">
                                                <template>
                                                    <div class="hasMore">
                                                        <vi-icon source="Selected"></vi-icon>
                                                        <vi-icon source="Ellipsis"></vi-icon>
                                                    </div>
                                                </template>
                                            </dom-if>
                                        </div>
                                    </template>
                                </vi-list>
                            </div>
                        </div>
                    </div>
                    <div id="resizehandle" @pointerdown=${this._resizeStart} @pointermove=${this._resizeTrack} @pointerup=${this._resizeEnd} @pointercancel=${this._resizeEnd}></div>
                </div>
            </vi-popup>
        `;
    }

    private async _render(e: Event) {
        e.stopPropagation();

        this.popupRendered = true;
        await this.updateComplete;

        (<Popup>this.shadowRoot.querySelector("#filter")).popup();
        this.removeAttribute("open");
    }

    private _computeLabel(selectedDistincts: string[], inversed: boolean): string {
        if (!selectedDistincts?.length)
            return "=";

        const objects = [];
        const textSearch = [];

        selectedDistincts.forEach(value => {
            if (value && value.startsWith("1|@"))
                textSearch.push(value);
            else
                objects.push(value);
        });

        let label = "";
        if (objects.length > 0)
            label += objects.map(o => this._getDistinctDisplayValue(o)).join(", ");

        if (textSearch.length > 0) {
            if (label.length > 0)
                label += ", ";

            label += textSearch.map(t => this._getDistinctDisplayValue(t)).join(", ");
        }

        return (!inversed ? "= " : "≠ ") + label;
    }

    private _getDistinctDisplayValue(value: string) {
        if (!String.isNullOrWhiteSpace(value) && value !== "|") {
            const indexOfPipe = value.indexOf("|");

            if (indexOfPipe === 0)
                return value.substr(1);

            if (indexOfPipe > 0)
                return value.substr(indexOfPipe + parseInt(value.substr(0, indexOfPipe), 10) + 1);
        }

        return value == null ? this.service?.getTranslatedMessage("DistinctNullValue") : this.service?.getTranslatedMessage("DistinctEmptyValue");
    }

    private async _popupOpening() {
        if (!this.column.canFilter)
            return;

        this.#focusSearch();

        const filter = <Popup>this.shadowRoot.querySelector("#filter");
        filter.closeDelay = parseInt(this.app.configuration.getSetting("vi-query-grid-column-filter.close-delay", "750"));

        if (this.column.canListDistincts && (!this.queryColumn.distincts || this.column.distincts.isDirty)) {
            this.loading = true;

            try {
                await this.queryColumn.refreshDistincts();
                this.loading = false;
            }
            catch (e) {
                this.loading = false;
                this.app.showAlert(e, "Error");
            }
        }

        // Let the list take the refreshed items before it scrolls
        await this.updateComplete;

        const distinctsList = <List>this.shadowRoot.querySelector("#distincts");
        distinctsList.scrollToTop();

        // A resize while the popup was hidden stopped the list from listening to scroll, and reopening at the same size reports no new resize
        distinctsList.notifyResize();
    }

    #focusSearch(attempt: number = 0) {
        const search = <InputSearch>this.shadowRoot.querySelector("#search");
        search?.focus();

        // The popup content only becomes focusable once it is shown
        if (!search || search.matches(":focus-within") || attempt >= 10)
            return;

        this.#focusTimer = setTimeout(() => this.#focusSearch(attempt + 1), 100);
    }

    private _popupClosed() {
        clearTimeout(this.#focusTimer);
        this.searchText = "";
    }

    private _searchValueChanged(e: CustomEvent<{ value: string }>) {
        this.searchText = e.detail.value;
    }

    private _searchTextChanged(searchText: string, oldSearchText: string) {
        if (!searchText && !oldSearchText)
            return;

        // Disconnecting clears the text without refreshing the distincts
        if (!this.isConnected)
            return;

        if (this.queryColumn && this.queryColumn.distincts && this.queryColumn.distincts.hasMore) {
            this.loading = true;

            clearTimeout(this.#searchTextTimer);
            this.#searchTextTimer = setTimeout(async () => {
                if (this.searchText !== searchText)
                    return;

                try {
                    await this.queryColumn.refreshDistincts(searchText);
                }
                finally {
                    if (this.searchText === searchText)
                        this.loading = false;
                }
            }, 250);
        }
    }

    #cancelSearchTextRefresh() {
        clearTimeout(this.#searchTextTimer);
        this.#searchTextTimer = undefined;
    }

    private _computeFilteredDistincts(distincts: IQueryGridColumnFilterDistinctItem[], searchText: string): IQueryGridColumnFilterDistinctItem[] {
        if (!distincts)
            return distincts;

        let filtered = distincts;
        if (searchText) {
            const lowerSearchText = searchText.toLowerCase();
            filtered = distincts.filter(d => {
                // The has-more row
                if (!d.type)
                    return true;

                if (!d.displayValue)
                    return false;

                return d.displayValue.toLowerCase().contains(lowerSearchText);
            });
        }

        return filtered.map(d => d.type ? { ...d, html: this._getHighlightedDistinctDisplayValue(d.displayValue, searchText) } : d);
    }

    private _distinctClick(e: Event) {
        const item = <HTMLElement>e.composedPath().find(el => el instanceof HTMLElement && el.classList.contains("item"));
        if (!item)
            return;

        const template = (<HTMLElement>e.currentTarget).querySelector("template");
        const distinct: IQueryGridColumnFilterDistinctItem = Polymer.Templatize.modelForElement(template, item)?.["distinct"];
        if (!distinct)
            return;

        const distinctValue = distinct.value;
        if (this.queryColumn.selectedDistincts.indexOf(distinctValue) === -1)
            this.queryColumn.selectedDistincts = this.queryColumn.selectedDistincts.concat([distinctValue]);
        else
            this.queryColumn.selectedDistincts = this.queryColumn.selectedDistincts.filter(d => d !== distinctValue);

        this._updateDistincts(!this._updateFilters());

        e.stopPropagation();
    }

    /**
     * Creates the current filter on the first selection, and drops an unsaved one again when no column has a selection left.
     * Returns true when dropping it already ran the search.
     */
    private _updateFilters(): boolean {
        const filters = this.column.query.filters;
        if (!filters)
            return false;

        if (this.queryColumn.selectedDistincts.length > 0) {
            if (!filters.currentFilter)
                this._createCurrentFilter(filters);

            return false;
        }

        if (filters.currentFilter?.persistentObject.isNew && !this._hasSelection()) {
            filters.currentFilter = null;
            return true;
        }

        return false;
    }

    private async _createCurrentFilter(filters: Vidyano.QueryFilters) {
        const filter = await filters.createNew();

        // Skip it when the selection was cleared or another filter became current meanwhile
        if (!filters.currentFilter && this._hasSelection())
            filters.currentFilter = filter;
    }

    private _hasSelection(): boolean {
        return this.column.query.columns.some(c => c.selectedDistincts.length > 0);
    }

    private async _updateDistincts(search: boolean = true) {
        this.loading = true;

        try {
            if (search)
                await this.column.query.search();

            await this.queryColumn.refreshDistincts(this.searchText);
        }
        finally {
            this.loading = false;
        }
    }

    private _computeDistincts(queryColumn: Vidyano.QueryColumn, selectedDistincts: string[], distincts: Vidyano.IQueryColumnDistincts, inversed: boolean): IQueryGridColumnFilterDistinctItem[] {
        if (!queryColumn)
            return undefined;

        const distinctType = !inversed ? "include" : "exclude";
        let items: IQueryGridColumnFilterDistinctItem[] = selectedDistincts.map(v => ({
            type: distinctType,
            value: v,
            displayValue: this._getDistinctDisplayValue(v),
            checked: true
        }));

        if (!distincts)
            return items;

        items = items.concat(distincts.matching.filter(v => selectedDistincts.indexOf(v) === -1).map(v => ({
            type: "matching",
            value: v,
            displayValue: this._getDistinctDisplayValue(v),
            checked: false
        }))).concat(distincts.remaining.filter(v => selectedDistincts.indexOf(v) === -1).map(v => ({
            type: "remaining",
            value: v,
            displayValue: this._getDistinctDisplayValue(v),
            checked: false
        })));

        return distincts.hasMore ? items.concat([<IQueryGridColumnFilterDistinctItem>{}]) : items;
    }

    private _getHighlightedDistinctDisplayValue(displayValue: string, searchText: string): string {
        if (!searchText)
            return escapeHTML(displayValue);

        // Split on the raw text so matches never land inside escaped entities; odd parts are the matches
        searchText = searchText.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
        const exp = new RegExp(`(${searchText})`, "gi");
        return displayValue.split(exp).map((part, index) => index % 2 ? `<span class='match'>${escapeHTML(part)}</span>` : escapeHTML(part)).join("");
    }

    private async _search(e: CustomEvent<string>) {
        const selectedDistincts = this.queryColumn.selectedDistincts;
        const searchText = e.detail;
        if (searchText) {
            this.queryColumn.selectedDistincts = selectedDistincts.concat(["1|@" + searchText]);
            this.searchText = "";

            // _updateDistincts below refreshes the distincts already, so drop the refresh the cleared text schedules
            await this.updateComplete;
            this.#cancelSearchTextRefresh();
        }

        if (!await this.column.query.search()) {
            // Roll the text filter back and keep the text, so the user can retry
            if (searchText) {
                this.queryColumn.selectedDistincts = selectedDistincts;
                this.searchText = searchText;
            }

            return;
        }

        this._updateFilters();
        this._updateDistincts(false);
    }

    private _inverse(e: Event) {
        e.stopPropagation();

        this.queryColumn.selectedDistinctsInversed = !this.queryColumn.selectedDistinctsInversed;

        if (this.queryColumn.selectedDistincts.length > 0)
            this._updateDistincts();
    }

    private _clear(e: Event) {
        if (!this.filtered) {
            e.stopPropagation();
            return;
        }

        this.queryColumn.selectedDistincts = [];
        this.queryColumn.selectedDistinctsInversed = false;
        this._updateDistincts(!this._updateFilters());

        Popup.closeAll();
    }

    private _resizeStart(e: PointerEvent) {
        if (e.button !== 0)
            return;

        e.preventDefault();
        (<HTMLElement>e.currentTarget).setPointerCapture(e.pointerId);

        const filterContent = this.shadowRoot.querySelector<HTMLDivElement>("#filterContent");
        this.app.isTracking = true;
        (<Popup>this.shadowRoot.querySelector("#filter")).sticky = true;

        this.#resizeStart = { width: filterContent.offsetWidth, height: filterContent.offsetHeight, x: e.clientX, y: e.clientY };
    }

    private _resizeTrack(e: PointerEvent) {
        if (!this.#resizeStart)
            return;

        const filterContent = this.shadowRoot.querySelector<HTMLDivElement>("#filterContent");
        filterContent.style.width = `${this.#resizeStart.width + e.clientX - this.#resizeStart.x}px`;
        filterContent.style.height = `${this.#resizeStart.height + e.clientY - this.#resizeStart.y}px`;
    }

    private _resizeEnd() {
        if (!this.#resizeStart)
            return;

        (<Popup>this.shadowRoot.querySelector("#filter")).sticky = false;

        this.#resizeStart = null;
        this.app.isTracking = false;

        (<List>this.shadowRoot.querySelector("#distincts")).notifyResize();
    }

    private _catchClick(e: Event) {
        e.stopPropagation();
    }
}

customElements.define("vi-query-grid-column-filter", QueryGridColumnFilter);
