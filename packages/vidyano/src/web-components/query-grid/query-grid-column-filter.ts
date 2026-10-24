import * as Polymer from "polymer"
import * as Vidyano from "@vidyano/core"
import "components/checkbox/checkbox"
import "components/input-search/input-search"
import { List } from "components/list/list"
import { Popup } from "components/popup/popup"
import { ISize } from "components/size-tracker/size-tracker"
import { QueryGrid } from "./query-grid"
import { QueryGridColumn } from "./query-grid-column"

export interface IQueryGridColumnFilterDistinct {
    type: string;
    value: string;
    displayValue: string;
}

@Polymer.WebComponent.register({
    properties: {
        column: Object,
        queryColumn: {
            type: Object,
            computed: "column.column"
        },
        distincts: Array,
        filtered: {
            type: Boolean,
            reflectToAttribute: true,
            value: false
        },
        queryFiltering: {
            type: Boolean,
            computed: "queryColumn.query.isFiltering",
            reflectToAttribute: true
        },
        inversed: {
            type: Boolean,
            computed: "queryColumn.selectedDistinctsInversed"
        },
        loading: {
            type: Boolean,
            readOnly: true,
            reflectToAttribute: true
        },
        searchText: {
            type: String,
            observer: "_searchTextChanged"
        },
        disabled: {
            type: Boolean,
            computed: "!column.canFilter",
            reflectToAttribute: true
        },
        sensitive: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "queryColumn.isSensitive"
        },
        render: {
            type: Boolean,
            readOnly: true,
            value: false
        }
    },
    observers: [
        "_update(queryColumn.selectedDistincts, queryColumn.selectedDistinctsInversed, isConnected)",
        "_renderDistincts(queryColumn.selectedDistincts, queryColumn.distincts)"
    ],
    forwardObservers: [
        "queryColumn.selectedDistincts",
        "queryColumn.selectedDistinctsInversed",
        "queryColumn.distincts",
        "queryColumn.query.isFiltering"
    ],
    sensitive: true
}, "vi-query-grid-column-filter")
export class QueryGridColumnFilter extends Polymer.WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="query-grid-column-filter.html">` }

    private _searchTextDebouncer: Polymer.Debounce.Debouncer;
    private _resizeStart: ISize;
    readonly loading: boolean; private _setLoading: (loading: boolean) => void;
    readonly render: boolean; private _setRender: (render: boolean) => void;
    column: QueryGridColumn;
    queryColumn: Vidyano.QueryColumn;
    searchText: string;
    label: string;
    distincts: IQueryGridColumnFilterDistinct[];
    inversed: boolean;
    filtered: boolean;

    disconnectedCallback() {
        super.disconnectedCallback();

        (<Popup>this.shadowRoot.querySelector("#filter"))?.close();
        this.searchText = "";
        this._searchTextDebouncer?.cancel();
        this._setLoading(false);
    }

    private _render(e: Event) {
        e.stopPropagation();

        this._setRender(true);
        Polymer.flush();

        Polymer.Async.microTask.run(() => {
            (<Popup>this.shadowRoot.querySelector("#filter")).popup();
            this.removeAttribute("open");
        });
    }

    protected _update() {
        if (this.filtered = !!this.queryColumn && this.queryColumn.selectedDistincts.length > 0) {
            const objects = [];
            const textSearch = [];

            this.queryColumn.selectedDistincts.forEach(value => {
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

            this.label = (!this.inversed ? "= " : "≠ ") + label;
        }
        else
            this.label = "=";
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

    private async _popupOpening(e: CustomEvent) {
        if (!this.column.canFilter)
            return;

        const search = <Popup>this.$.search || (this.$.search = <Popup>this.shadowRoot.querySelector("#search"));
        this._focusElement(search);

        const filter = <Popup>this.$.filter || (this.$.filter = <Popup>this.shadowRoot.querySelector("#filter"));
        filter.closeDelay = parseInt(this.app.configuration.getSetting("vi-query-grid-column-filter.close-delay", "750"));

        if (this.column.canListDistincts && (!this.queryColumn.distincts || this.column.distincts.isDirty)) {
            this._setLoading(true);

            try {
                await this.queryColumn.refreshDistincts();
                this._setLoading(false);
            }
            catch (e) {
                this._setLoading(false);
                this.app.showAlert(e, "Error");
            }
        }

        const distinctsList = <List>this.$.distincts || (this.$.distincts = <List>this.shadowRoot.querySelector("#distincts"));
        distinctsList.scrollToTop();

        // A resize while the popup was hidden stopped the list from listening to scroll, and reopening at the same size reports no new resize
        distinctsList.notifyResize();
    }

    private _popupClosed() {
        this.searchText = "";
    }

    private _searchTextChanged(searchText: string, oldSearchText: string) {
        if (!searchText && !oldSearchText)
            return;

        if (this.queryColumn && this.queryColumn.distincts && this.queryColumn.distincts.hasMore) {
            this._setLoading(true);

            this._searchTextDebouncer = Polymer.Debounce.Debouncer.debounce(
                this._searchTextDebouncer,
                Polymer.Async.timeOut.after(250),
                async () => {
                    if (this.searchText !== searchText)
                        return;

                    try {
                        await this.queryColumn.refreshDistincts(searchText);
                        if (this.searchText === searchText)
                            this._renderDistincts();
                    }
                    finally {
                        if (this.searchText === searchText)
                            this._setLoading(false);
                    }
                });
        }
    }

    private _getFilteredDistincts(distincts: IQueryGridColumnFilterDistinct[], searchText: string): IQueryGridColumnFilterDistinct[] {
        if (!searchText)
            return distincts;

        searchText = searchText.toLowerCase();
        return distincts.filter(d => {
            // The has-more row
            if (!d.type)
                return true;

            if (!d.displayValue)
                return false;

            return d.displayValue.toLowerCase().contains(searchText);
        });
    }

    private _distinctClick(e: Polymer.Gestures.TapEvent) {
        const distinctValue = e.model.distinct.value;

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
        this._setLoading(true);

        try {
            if (search)
                await this.column.query.search();

            await this.queryColumn.refreshDistincts(this.searchText);
        }
        finally {
            this._setLoading(false);
        }
    }

    private _renderDistincts() {
        if (!this.queryColumn)
            return;

        const distinctType = !this.inversed ? "include" : "exclude";
        let distincts = this.queryColumn.selectedDistincts.map(v => ({
            type: distinctType,
            value: v,
            displayValue: this._getDistinctDisplayValue(v),
            checked: true
        }));

        if (this.queryColumn.distincts) {
            distincts = distincts.concat(this.queryColumn.distincts.matching.filter(v => this.queryColumn.selectedDistincts.indexOf(v) === -1).map(v => {
                return {
                    type: "matching",
                    value: v,
                    displayValue: this._getDistinctDisplayValue(v),
                    checked: false
                };
            })).concat(this.queryColumn.distincts.remaining.filter(v => this.queryColumn.selectedDistincts.indexOf(v) === -1).map(v => {
                return {
                    type: "remaining",
                    value: v,
                    displayValue: this._getDistinctDisplayValue(v),
                    checked: false
                };
            }));

            this.distincts = (this.queryColumn.distincts.hasMore ? distincts.concat([<any>{}]) : distincts);
        }
        else
            this.distincts = distincts;
    }

    private _getHighlightedDistinctDisplayValue(displayValue: string, searchText: string): string {
        if (!searchText)
            return this._escapeHTML(displayValue);

        // Split on the raw text so matches never land inside escaped entities; odd parts are the matches
        searchText = searchText.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
        const exp = new RegExp(`(${searchText})`, "gi");
        return displayValue.split(exp).map((part, index) => index % 2 ? `<span class='match'>${this._escapeHTML(part)}</span>` : this._escapeHTML(part)).join("");
    }

    private async _search(e: CustomEvent<string>) {
        const selectedDistincts = this.queryColumn.selectedDistincts;
        const searchText = e.detail;
        if (searchText) {
            this.queryColumn.selectedDistincts = selectedDistincts.concat(["1|@" + searchText]);
            this.searchText = "";
            // _updateDistincts below refreshes the distincts already
            this._searchTextDebouncer?.cancel();
        }

        this._renderDistincts();
        if (!await this.column.query.search()) {
            // Roll the text filter back and keep the text, so the user can retry
            if (searchText) {
                this.queryColumn.selectedDistincts = selectedDistincts;
                this.searchText = searchText;
            }

            this._renderDistincts();
            return;
        }

        this._renderDistincts();
        this._updateFilters();
        this._updateDistincts(false);
    }

    private _inverse(e: Event) {
        e.stopPropagation();

        this.queryColumn.selectedDistinctsInversed = !this.queryColumn.selectedDistinctsInversed;

        if (this.queryColumn.selectedDistincts.length > 0)
            this._updateDistincts();
    }

    private _clear(e: CustomEvent) {
        if (!this.filtered) {
            e.stopPropagation();
            return;
        }

        this.queryColumn.selectedDistincts = [];
        this.queryColumn.selectedDistinctsInversed = false;
        this._updateDistincts(!this._updateFilters());

        Popup.closeAll();
    }

    private _onResize(e: Polymer.Gestures.TrackEvent) {
        const filterContent = <HTMLDivElement>this.$.filterContent || (this.$.filterContent = <HTMLDivElement>this.shadowRoot.querySelector("#filterContent"));;
        const filter = <Popup>this.$.filter || (this.$.filter = <Popup>this.shadowRoot.querySelector("#filter"));

        if (e.detail.state === "start") {
            this.app.isTracking = true;
            filter.sticky = true;

            this._resizeStart = { width: filterContent.offsetWidth, height: filterContent.offsetHeight };
        }
        else if (e.detail.state === "track") {
            filterContent.style.width = `${this._resizeStart.width + e.detail.dx}px`;
            filterContent.style.height = `${this._resizeStart.height + e.detail.dy}px`;
        }
        else if (e.detail.state === "end") {
            filter.sticky = false;

            this._resizeStart = null;
            this.app.isTracking = false;

            const distinctsList = <HTMLDivElement>this.$.distincts || (this.$.distincts = <HTMLDivElement>this.shadowRoot.querySelector("#distincts"));
            distinctsList.dispatchEvent(new CustomEvent("iron-resize"));
        }
    }

    private _catchClick(e: Event) {
        e.stopPropagation();
    }
}
