import * as Vidyano from "../../libs/vidyano/vidyano.js"
import * as Polymer from "../../libs/polymer/polymer.js"
import "../popup-menu/popup-menu.js"
import { PopupMenu } from "../popup-menu/popup-menu.js"
import { QueryGridColumn } from "./query-grid-column.js"
import "./query-grid-column-filter.js"
import { WebComponent } from "../web-component/web-component.js"

let resizeObserver: ResizeObserver;
resizeObserver = new ResizeObserver(allEntries => {
    window.requestAnimationFrame(() => {
        // Entries may be batched for multiple grids, make sure the event is dispatched to the correct grid
        const parents = new Map<HTMLElement, ResizeObserverEntry[]>();
        allEntries.forEach(e => {
            const parent = parents.get(e.target.parentElement) || parents.set(e.target.parentElement, []).get(e.target.parentElement);
            parent.push(e);
        });

        parents.forEach((entries, parent) => {
            try {
                // parent can be null if the the element is no longer in the DOM
                parent?.dispatchEvent(new CustomEvent("column-width-changed", {
                    detail: {
                        type: "column",
                        entries: entries.map(e => {
                            const header = e.target as QueryGridColumnHeader;

                            let width = e["borderBoxSize"] != null ? e["borderBoxSize"][0].inlineSize : header.offsetWidth;
                            return [header.column.name, width];
                        }),
                    },
                    bubbles: true,
                    cancelable: true,
                    composed: true
                }));
            }
            finally {
                entries.forEach(e => resizeObserver.unobserve(e.target));
            }
        });
    });
});

@WebComponent.register({
    properties: {
        column: {
            type: Object,
            observer: "_columnChanged"
        },
        canSort: {
            type: Boolean,
            reflectToAttribute: true,
            readOnly: true
        },
        sortingIcon: {
            type: String,
            computed: "_computeSortingIcon(column.column.sortDirection)"
        },
        canGroupBy: {
            type: Boolean,
            readOnly: true
        },
        isPinned: {
            type: Boolean,
            readOnly: true
        },
        groupByLabel: {
            type: String,
            computed: "_computeGroupByLabel(column.label, translations)"
        },
        pinLabel: {
            type: String,
            computed: "_computePinLabel(isPinned, translations)"
        },
        renderPopupMenu: {
            type: Boolean,
            readOnly: true,
            value: false
        },
        name: {
            type: String,
            reflectToAttribute: true,
            computed: "_computeName(column)"
        }
    },
    forwardObservers: [
        "column.column.sortDirection"
    ],
    listeners: {
        "contextmenu": "_onContextmenu"
    },
    observers: [
        "_queueMeasure(column, isConnected)"
    ]
})
export class QueryGridColumnHeader extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="query-grid-column-header.html">` }

    #_lastMeasuredColumn: Vidyano.QueryColumn;
    #_minimumColumnWidth: number;
    #_calculatedWidth: number;
    #_resizingRAF: number;

    column: QueryGridColumn;
    readonly canSort: boolean; private _setCanSort: (canSort: boolean) => void;
    readonly canGroupBy: boolean; private _setCanGroupBy: (canGroupBy: boolean) => void;
    readonly isPinned: boolean; private _setIsPinned: (isPinned: boolean) => void;
    readonly renderPopupMenu: boolean; private _setRenderPopupMenu: (renderPopupMenu: boolean) => void;

    private _renderPopupMenu(e: Event) {
        e.stopPropagation();

        this._setRenderPopupMenu(true);
        Polymer.flush();

        const menu = <PopupMenu>this.shadowRoot.querySelector("#menu");
        menu.popup();
    }

    private _columnChanged(column: QueryGridColumn, oldColumn: QueryGridColumn) {
        if (!column)
            return;

        this._setCanSort(column.canSort);
        this._setCanGroupBy(column.canGroupBy);
        this._setIsPinned(column.isPinned);
    }

    private _computeSortingIcon(direction: Vidyano.SortDirection) {
        return direction === "ASC" ? "SortAsc" : (direction === "DESC" ? "SortDesc" : null);
    }

    private _computeGroupByLabel(label: string): string {
        return this.translateMessage("GroupByColumn", label);
    }

    private _computePinLabel(isPinned: boolean): string {
        return isPinned ? this.translations.Unpin : this.translations.Pin;
    }

    private _sort(direction: Vidyano.SortDirection);
    private _sort(e: Polymer.Gestures.TapEvent);
    private _sort(eventOrDirection: Vidyano.SortDirection | Polymer.Gestures.TapEvent) {
        let newSortingDirection: Vidyano.SortDirection;
        let multiSort = false;

        if (!this.canSort)
            return;

        if (typeof eventOrDirection === "string")
            newSortingDirection = eventOrDirection;
        else {
            multiSort = (<any>eventOrDirection).detail.sourceEvent.ctrlKey;
            switch (this.column.sortDirection) {
                case "ASC": {
                    newSortingDirection = "DESC";
                    break;
                }
                case "DESC": {
                    newSortingDirection = multiSort && this.column.query.sortOptions.length > 1 ? "" : "ASC";
                    break;
                }
                case "": {
                    newSortingDirection = "ASC";
                    break;
                }
            }
        }

        this.column.column.sort(newSortingDirection, multiSort);
    }

    private _onContextmenu(e: Event) {
        this._renderPopupMenu(e);
        e.preventDefault();
    }

    private _sortAsc(e: Polymer.Gestures.TapEvent) {
        e.stopPropagation();
        this._sort("ASC");
    }

    private _sortDesc(e: Polymer.Gestures.TapEvent) {
        e.stopPropagation();
        this._sort("DESC");
    }

    private _group() {
        this.column.query.group(this.column.column);
    }

    private _togglePin() {
        this.column.isPinned = !this.column.isPinned;
        this._setIsPinned(this.column.isPinned);

        this.fire("query-grid-column:update");
    }

    private _hide() {
        this.column.isHidden = !this.column.isHidden;
        this.fire("query-grid-column:update");
    }

    private async _configure() {
        this.fire("query-grid-column:configure");
    }

    private _queueMeasure(column: QueryGridColumn, isConnected: boolean) {
        if (!column || !isConnected || this.#_lastMeasuredColumn === column?.column)
            return;

        resizeObserver.observe(this, { box: "border-box" });
        this.#_lastMeasuredColumn = column.column;
    }

    private _resizeTrack(e: TrackEvent, detail: Polymer.Gestures.TrackEventDetail) {
        if (detail.state === "start") {
            if (!this.#_minimumColumnWidth)
                this.#_minimumColumnWidth = parseInt(getComputedStyle(this).getPropertyValue("--vi-query-grid--minimum-column-width") || "50");

            this.#_calculatedWidth = Math.max(this.getBoundingClientRect().width, this.#_minimumColumnWidth);

            this.app.isTracking = true;
            this.classList.add("resizing");
        }
        else if (detail.state === "track") {
            if (this.#_resizingRAF)
                cancelAnimationFrame(this.#_resizingRAF);

            this.#_resizingRAF = requestAnimationFrame(() => {
                this._resize(Math.max(this.#_calculatedWidth + detail.dx, this.#_minimumColumnWidth));
            });
        }
        else if (detail.state === "end") {
            this.classList.remove("resizing");

            this.#_calculatedWidth = Math.max(this.#_calculatedWidth + detail.dx, this.#_minimumColumnWidth);
            this.column.width = `${this.#_calculatedWidth}px`;

            this._resize(this.#_calculatedWidth, true);
            this.app.isTracking = false;
        }
    }

    private _resize(width: number, save?: boolean) {
        this.dispatchEvent(new CustomEvent("column-width-changed", {
            detail: {
                type: "current",
                entries: [[this.column.name, width]],
                save: save
            },
            bubbles: true,
            cancelable: true,
            composed: true
        }));
    }

    private _computeName(column: QueryGridColumn) {
        return column.safeName;
    }
}