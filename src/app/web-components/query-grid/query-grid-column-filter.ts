import * as Vidyano from "vidyano"
import * as Polymer from "polymer"
import "components/checkbox/checkbox.js"
import "components/input-search/input-search.js"
import { Popup } from "components/popup/popup.js"
import { ISize } from "components/size-tracker/size-tracker.js"
import { QueryGrid } from "./query-grid.js"
import { QueryGridColumn } from "./query-grid-column.js"
import { WebComponent } from "components/web-component/web-component.js"

export interface IQueryGridColumnFilterDistinct {
    type: string;
    value: string;
    displayValue: string;
}

@WebComponent.register({
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
    ]
})
export class QueryGridColumnFilter extends WebComponent {
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

        this.searchText = "";
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
        else {
            const distinctsList = <HTMLDivElement>this.$.distincts || (this.$.distincts = <HTMLDivElement>this.shadowRoot.querySelector("#distincts"));
            distinctsList.scrollTop = 0;
        }
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

        this._updateFilters();
        this._updateDistincts();

        e.stopPropagation();
    }

    private async _updateFilters() {
        if (!this.column.query.filters)
            return;

        if (this.queryColumn.selectedDistincts.length > 0 && !this.column.query.filters.currentFilter) {
            const filter = await this.queryColumn.query.filters.createNew();
            this.column.query.filters.currentFilter = filter;
        }
    }

    private async _updateDistincts() {
        this._setLoading(true);

        try {
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
            return displayValue;

        searchText = searchText.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
        const exp = new RegExp(`(${searchText})`, "gi");
        return displayValue.replace(exp, "<span class='match'>$1</span>");
    }

    private async _search() {
        if (this.searchText) {
            this.queryColumn.selectedDistincts = this.queryColumn.selectedDistincts.concat(["1|@" + this.searchText]);
            this.searchText = "";
        }

        this._renderDistincts();
        if (!await this.column.query.search())
            return;

        this._renderDistincts();
        this._updateFilters();
        this._updateDistincts();
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
        this._updateDistincts();

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