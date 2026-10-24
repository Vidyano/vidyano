import * as Polymer from "polymer"
import * as Vidyano from "@vidyano/core"
import { AppRoute, IAppRouteDeactivateArgs } from "components/app-route/app-route"
import "./cell-templates/query-grid-cell-default"
import "./query-grid-column-measure"
import "./query-grid-column-header"
import { QueryGridColumnHeader } from "./query-grid-column-header"
import "./query-grid-filters"
import "./query-grid-footer"
import "./query-grid-grouping"
import "./query-grid-row"
import "./query-grid-select-all"
import "components/scroller/scroller"
import { Popup } from "components/popup/popup"
import { QueryGridColumn } from "./query-grid-column"
import { QueryGridConfigureDialog } from "./query-grid-configure-dialog"
import { QueryGridRow } from "./query-grid-row"
import { QueryGridUserSettings } from "./query-grid-user-settings"
import { ISize, SizeTracker } from "components/size-tracker/size-tracker";
import { ISortableDragEndDetails, Sortable } from "components/sortable/sortable"
import { PopupMenuItem } from "components/popup-menu/popup-menu-item"

const placeholder: { query?: Vidyano.Query; } = {};

interface QueryGridItems {
    forceUpdate?: boolean;
    groups?: Vidyano.QueryResultItemGroup[];
    length: number;
}

type QueryGridItem = Vidyano.QueryResultItem | Vidyano.QueryResultItemGroup;
type ColumnWidthDetail = { cell?: number; column?: number; current?: number };

type QueryScrollOffset = { vertical: number, horizontal: number };
const queryScrollOffsets: WeakMap<Vidyano.Query, QueryScrollOffset> = new WeakMap();

type MoreColumns = { left: QueryGridColumnHeader[], right: QueryGridColumnHeader[] };

const PHYSICAL_UPPER_LIMIT = 100000;

// The forwarded query properties the grid needs to see again when a change happened while it was detached
const detachedQueryPaths: (keyof Vidyano.Query)[] = ["canReorder", "columns", "isBusy", "lastUpdated", "items", "totalItem", "totalItems"];

@Polymer.WebComponent.register({
    properties: {
        initializing: {
            type: Boolean,
            notify: true,
            readOnly: true,
            value: true,
            reflectToAttribute: true,
            observer: "_onInitializingChanged"
        },
        query: {
            type: Object,
            observer: "_queryChanged"
        },
        asLookup: {
            type: Boolean,
            reflectToAttribute: true,
            value: false
        },
        items: {
            type: Array,
            computed: "_computeItems(query.lastUpdated, query.items)"
        },
        columns: {
            type: Array,
            computed: "_computeColumns(userSettings.columns)"
        },
        pinnedColumns: {
            type: Array,
            readOnly: true
        },
        columnWidths: {
            type: Object,
            readOnly: true
        },
        horizontalScrollOffset: {
            type: Number,
            observer: "_updateHorizontalScrollOffset"
        },
        rowHeight: {
            type: Number,
            observer: "_rowHeightChanged"
        },
        userSettings: {
            type: Object,
            readOnly: true
        },
        verticalScrollOffset: {
            type: Number,
            observer: "_onVerticalScrollOffsetChanged"
        },
        viewportHeight: {
            type: Number,
            value: 0
        },
        viewportWidth: Number,
        contentWidth: Number,
        virtualRowCount: {
            type: Number,
            computed: "_computeVirtualRowCount(viewportHeight, rowHeight, query.canReorder, query.totalItems)",
            value: 0
        },
        virtualItems: {
            type: Array,
            readOnly: true
        },
        hasGrouping: {
            type: Boolean,
            readOnly: true,
            reflectToAttribute: true
        },
        noSelection: {
            type: Boolean,
            reflectToAttribute: true,
            value: false
        },
        canSelect: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeCanSelect(query, noSelection, asLookup, query.actions.*)"
        },
        noInlineActions: {
            type: Boolean,
            reflectToAttribute: true,
            value: false
        },
        inlineActions: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeInlineActions(query, noInlineActions, asLookup, query.actions.*)"
        },
        canFilter: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "query.canFilter"
        },
        canReorder: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeCanReorder(query.canReorder, hasGrouping)"
        },
        visibleColumnHeaderSize: Object,
        moreColumns: {
            type: Object,
            readOnly: true
        },
        physicalUpperLimitExceeded: {
            type: Boolean,
            computed: "_computePhysicalUpperLimitExceeded(query.items.length)"
        },
        maxRows : {
            type: Number,
            reflectToAttribute: true,
            value: null
        },
        hasMoreRows: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeHasMoreRows(query.items.length, maxRows)"
        },
        skip: {
            type: Number,
            reflectToAttribute: true,
            value: 0
        },
    },
    forwardObservers: [
        "query.actions.*.isVisible",
        "query.canReorder",
        "query.columns",
        "query.isBusy",
        "query.lastUpdated",
        "query.items.*",
        "query.totalItem",
        "query.totalItems",
        "_updatePinnedColumns(columns.*.isPinned)"
    ],
    listeners: {
        "column-width-changed": "_columnWidthChanged",
        "item-select": "_itemSelect",
        "query-grid-column:configure": "_onConfigure",
        "query-grid-column:update": "_onColumnUpdate"
    },
    observers: [
        "_scrollToTop(query.items)", // Scroll to top when the query items reference changes, for example after search.
        "_update(verticalScrollOffset, virtualRowCount, rowHeight, items, skip, maxRows)",
        "_updateVerticalSpacer(viewportHeight, rowHeight, items, maxRows, skip)",
        "_updateUserSettings(query, query.columns)",
        "_updateMore(visibleColumnHeaderSize, horizontalScrollOffset)"
    ],
    serviceBusObservers: {
        "app-route:deactivate": "_onAppRouteDeactivate"
    }
}, "vi-query-grid")
export class QueryGrid extends Polymer.WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="query-grid.html">` }

    private readonly _columnWidths = new Map<string, ColumnWidthDetail>();
    private readonly items: QueryGridItems;
    private _virtualGridStartIndex: number = 0;
    private _verticalSpacerCorrection: number = 1;
    private _getItemsDebouncer: Polymer.Debounce.Debouncer;
    private _updateCellDebouncer: Polymer.Debounce.Debouncer;
    private _pinnedStyle: HTMLStyleElement;
    private _lastSelectedItemIndex: number;
    private _controlsSizeObserver: ResizeObserver;
    private _updateMoreDebouncer: Polymer.Debounce.Debouncer;
    private _programmaticScroll: boolean;
    private _renderedSkip: number;
    private _renderedMaxRows: number;
    private _cancelledOnDisconnect: boolean;
    private _queryOnDisconnect: Vidyano.Query;
    private _queryValuesOnDisconnect: any[];

    query: Vidyano.Query;
    asLookup: boolean;
    maxRows: number;
    noSelection: boolean;
    noInlineActions: boolean;
    readonly initializing: boolean; private _setInitializing: (initializing: boolean) => void;
    readonly virtualItems: QueryGridItem[]; private _setVirtualItems: (virtualItems: QueryGridItem[]) => void;
    readonly columns: QueryGridColumn[];
    readonly pinnedColumns: QueryGridColumn[]; private _setPinnedColumns: (pinnedColumns: QueryGridColumn[]) => void;
    readonly columnWidths: Record<string, number>; private _setColumnWidths: (columnWidths: Record<string, number>) => void;
    readonly viewportHeight: number;
    readonly virtualRowCount: number;
    readonly hasGrouping: boolean; private _setHasGrouping: (hasGrouping: boolean) => void;
    readonly userSettings: QueryGridUserSettings; private _setUserSettings: (userSettings: QueryGridUserSettings) => void;
    rowHeight: number;
    skip: number;
    horizontalScrollOffset: number;
    verticalScrollOffset: number;
    visibleColumnHeaderSize: ISize;
    readonly moreColumns: MoreColumns; private _setMoreColumns: (moreColumns: MoreColumns) => void;
    readonly physicalUpperLimitExceeded: boolean;

    connectedCallback() {
        super.connectedCallback();

        this._controlsSizeObserver = new ResizeObserver(this._controlsSizeChanged.bind(this));
        this._controlsSizeObserver.observe(this.shadowRoot.querySelector(".controls"));

        // Changes of the query are not forwarded while the grid is detached, catch up on the ones that happened
        if (this.query && this.query === this._queryOnDisconnect) {
            detachedQueryPaths.forEach((path, i) => {
                if (this.query[path] !== this._queryValuesOnDisconnect[i])
                    this.notifyPath(`query.${path}`);
            });
        }

        this._queryOnDisconnect = this._queryValuesOnDisconnect = null;

        // Redo the work that was cancelled when the grid was removed, nothing else would start it again
        if (this._cancelledOnDisconnect && this.items) {
            this._cancelledOnDisconnect = false;
            this.items.forceUpdate = true;
            this._update(this.verticalScrollOffset, this.virtualRowCount, this.rowHeight, this.items, this.skip, this.maxRows);
            this._updateMore(this.visibleColumnHeaderSize, this.horizontalScrollOffset);
        }
    }

    disconnectedCallback() {
        this._controlsSizeObserver.disconnect();

        this._cancelledOnDisconnect = [this._getItemsDebouncer, this._updateCellDebouncer, this._updateMoreDebouncer].some(d => d?.isActive());
        this._queryOnDisconnect = this.query;
        this._queryValuesOnDisconnect = detachedQueryPaths.map(path => this.query?.[path]);

        // A removed grid sends nothing to the server
        this._getItemsDebouncer?.cancel();
        this._updateCellDebouncer?.cancel();
        this._updateMoreDebouncer?.cancel();

        super.disconnectedCallback();
    }

    ready() {
        super.ready();

        requestAnimationFrame(() => {
            // The custom property keeps the length as written (e.g. 2.5em), a probe resolves it to pixels
            const probe = document.createElement("div");
            probe.style.cssText = "position: absolute; visibility: hidden; height: var(--vi-query-grid-row-height);";
            this.shadowRoot.appendChild(probe);
            this.rowHeight = Math.round(parseFloat(window.getComputedStyle(probe).height));
            probe.remove();
        });
    }

    /**
     * Service bus observer for storing query grid state when the parent app route changes
     */
    private _onAppRouteDeactivate(sender: AppRoute, message: string, detail: IAppRouteDeactivateArgs) {
        // A newly connected grid receives the last deactivate message again, it should not overwrite the stored offsets
        if (this.initializing || !this.findParent(e => e === sender))
            return;

        queryScrollOffsets.set(this.query, {
            vertical: this.verticalScrollOffset,
            horizontal: this.horizontalScrollOffset
        });
    }

    private _onInitializingChanged(initializing: boolean, oldInitializing: boolean) {
        if (initializing) {
            // Rows fill every cell while the column widths are measured from the cell content
            this._setColumnWidths(null);
            return;
        }

        const offset = queryScrollOffsets.get(this.query);
        if (offset !== undefined) {
            // Run as animation frame, otherwise the browser will set an incorrect scroll height
            Polymer.Async.animationFrame.run(() => {
                this._scrollProgrammatically(() => {
                    this.verticalScrollOffset = offset.vertical;
                    this.horizontalScrollOffset = offset.horizontal;
                });

                queryScrollOffsets.delete(this.query);
            });
        }
    }

    /**
     * If the query changes, the grid will go back in initializing mode.
     */
    private _queryChanged(query: Vidyano.Query, oldQuery: Vidyano.Query) {
        if (oldQuery) {
            // The widths were measured on the old query's data
            this._columnWidths.clear();
            this._setInitializing(true);

            // A new query has its own columns, the old horizontal offset means nothing there
            this._scrollProgrammatically(() => this.horizontalScrollOffset = 0);
        }
    }

    /**
     * Is called when the header controls wrapper changes size.
     */
    private _controlsSizeChanged(entries: ResizeObserverEntry[]) {
        let width = entries[0]["borderBoxSize"] != null ? entries[0]["borderBoxSize"][0].inlineSize : (<HTMLElement>entries[0].target).offsetWidth;
        this.style.setProperty("--vi-query-grid-controls-width", `${width}px`);
    }

    /**
     * Is called when the first query grid row or the header columns report their size.
     */
    private _columnWidthChanged(e: CustomEvent) {
        e.stopPropagation();

        // Always attempt to update column widths when this event is triggered.
        const detail: { type: "cell" | "column" | "current", entries: [column: string, width: number][], save?: boolean } = e.detail;
        detail.entries.forEach(([column, width]) => {
            let columnWidthDetail: ColumnWidthDetail = this._columnWidths.get(column);
            if (!columnWidthDetail)
                this._columnWidths.set(column, columnWidthDetail = {});

            columnWidthDetail[detail.type] = width;
            if (detail.type !== "current")
                columnWidthDetail.current = Math.max(columnWidthDetail.cell, columnWidthDetail.column) || Number.NaN;
        });

        if (this._columnWidths.size < this.columns.length)
            return;

        if (this.columns.some(c => Number.isNaN(this._columnWidths.get(c.name)?.current)) && (this.query.items.length || this.query.isBusy))
            return;

        this._applyColumnWidths();

        if (detail.save) {
            const query = this.query;
            this.userSettings.save(false).catch(e => query.setNotification(e));
        }
    }

    /**
     * Writes the measured column widths and ends initializing, a column without a cell width falls back to its header width.
     */
    private _applyColumnWidths() {
        // Remove previously added columns which are no longer relevant
        Array.from(this._columnWidths).filter(cw => !this.columns.find(c => c.name === cw[0])).forEach(c => this._columnWidths.delete(c[0]));

        const widths = Array.from(this._columnWidths.values());
        if (widths.some(w => Number.isNaN(w.current)))
            this._columnWidths.forEach(cw => cw.current = cw.column);

        this._setColumnTracks(this.columns);
        if (widths.every(w => w.cell >= 0))
            this.style.removeProperty("--vi-query-grid-columns-no-data");

        // Rows defer the cells outside the horizontal viewport from now on
        this._setColumnWidths(Object.fromEntries(Array.from(this._columnWidths).map(([column, width]) => [column, Math.ceil(width.current)])));
        this._setInitializing(false);
    }

    private _scrollToTop() {
        // The range anchor is an index into the old items
        this._lastSelectedItemIndex = undefined;

        this._scrollProgrammatically(() => this.verticalScrollOffset = 0);
    }

    private _scrollProgrammatically(scroll: () => void) {
        this._programmaticScroll = true;
        try {
            scroll();
        }
        finally {
            this._programmaticScroll = false;
        }
    }

    private _setColumnTracks(columns: QueryGridColumn[]) {
        const widths = columns.map(c => Math.ceil(this._columnWidths.get(c.name).current));
        this.style.setProperty("--vi-query-grid-columns", `${widths.map(w => `${w}px`).join(" ")} minmax(0, 1fr)`);
        this.style.setProperty("--vi-query-grid-columns-width", `${widths.reduce((sum, w) => sum + w, 0)}px`);
    }

    private _update(verticalScrollOffset: number, virtualRowCount: number, rowHeight: number, items: QueryGridItems, skip: number, maxRows?: number) {
        if (!virtualRowCount)
            return;

        // The browser clamped the scroll height: the unscaled row position lies past it, the rows move back to the real scroll position
        const clampOffset = this._verticalSpacerCorrection > 1 ? verticalScrollOffset * (this._verticalSpacerCorrection - 1) : 0;
        verticalScrollOffset *= this._verticalSpacerCorrection;
        const viewportStartRowIndex = Math.floor(verticalScrollOffset / rowHeight);
        const viewportEndRowIndex = Math.ceil((verticalScrollOffset + this.viewportHeight) / rowHeight);

        const virtualItemsLength = Math.min(virtualRowCount, maxRows || Number.MAX_SAFE_INTEGER);
        if (!this.virtualItems || this.virtualItems.length !== virtualItemsLength) {
            this._setVirtualItems(new Array(virtualItemsLength));
            items.forceUpdate = true;
        }

        if (skip !== this._renderedSkip || maxRows !== this._renderedMaxRows) {
            this._renderedSkip = skip;
            this._renderedMaxRows = maxRows;
            items.forceUpdate = true;
        }
        
        let newVirtualGridStartIndex: number = 0;
        if (viewportEndRowIndex - this._virtualGridStartIndex > virtualRowCount)
            newVirtualGridStartIndex = viewportStartRowIndex;
        else if (viewportStartRowIndex < this._virtualGridStartIndex) {
            newVirtualGridStartIndex = viewportEndRowIndex - virtualRowCount;

            // Round an odd start up instead of down, the window is aligned to the viewport end so rounding down would leave the last visible row uncovered
            if (newVirtualGridStartIndex % 2 !== 0 && this._verticalSpacerCorrection === 1 && newVirtualGridStartIndex < viewportStartRowIndex)
                newVirtualGridStartIndex++;
        }
        else if (this.virtualItems.some(item => item === placeholder))
            newVirtualGridStartIndex = this._virtualGridStartIndex;
        else if (items.forceUpdate) {
            items.forceUpdate = false;
            newVirtualGridStartIndex = this._virtualGridStartIndex;
        }
        else
            return;

        if (newVirtualGridStartIndex % 2 !== 0 && this._verticalSpacerCorrection === 1)
            newVirtualGridStartIndex--;

        if (newVirtualGridStartIndex < 0)
            newVirtualGridStartIndex = 0;

        const queuedItemIndexes: number[] = [];
        for (let virtualIndex=0; virtualIndex < this.virtualRowCount && (!maxRows || virtualIndex < maxRows); virtualIndex++) {
            const index = newVirtualGridStartIndex + virtualIndex + skip;

            const [item, realIndex] = this._getItem(index, true);
            this.virtualItems[virtualIndex] = item;

            if (this.virtualItems[virtualIndex] === undefined) {
                if (realIndex < this.query.totalItems || this.query.hasMore) {
                    placeholder.query = this.query;
                    this.virtualItems[virtualIndex] = <any>placeholder;
                    queuedItemIndexes.push(realIndex);
                }
                else
                    this.virtualItems[virtualIndex] = null;
            }
        }

        this._updateCellDebouncer = Polymer.Debounce.Debouncer.debounce(
            this._updateCellDebouncer,
            Polymer.Async.animationFrame,
            () => {
                this._virtualGridStartIndex = newVirtualGridStartIndex;
                this.splice("virtualItems", 0, this.virtualRowCount, ...this.virtualItems);

                this.$.grid.style.transform = `translateY(${newVirtualGridStartIndex * rowHeight - clampOffset}px)`;
            }
        );

        this._getItemsDebouncer = Polymer.Debounce.Debouncer.debounce(
            this._getItemsDebouncer,
            Polymer.Async.timeOut.after(20),
            () => {
                if (this._virtualGridStartIndex !== newVirtualGridStartIndex)
                    return;

                queuedItemIndexes.forEach(index => this.query.items[index]);
            }
        );

        if (this.initializing && this.query.isBusy) {
            // Query grid is displayed for the first time but query has no items, there will be no rows to trigger the column width synchronization.
            this.query.queueWork(async () => {
                if (!this.initializing || this.query.items.length)
                    return;

                // The headers reported their widths while the search was busy, nothing will report them again
                if (this.columns.every(c => this._columnWidths.get(c.name)?.column >= 0))
                    this._applyColumnWidths();
                else
                    this._setInitializing(false);
            });
        }
    }

    private _computeItems(): QueryGridItems {
        if (!this.query) {
            return {
                length: 0,
                groups: [],
                forceUpdate: true
            };
        }

        let length: number;
        let groups: Vidyano.QueryResultItemGroup[];

        this._setHasGrouping(!!this.query.groupingInfo && !!this.query.groupingInfo.groups);

        if (!this.hasGrouping)
            length = this.query.totalItems || 0;
        else {
            groups = [];
            length = this.query.groupingInfo.groups.reduce((n, g) => {
                groups[n] = g;
                return n + (g.isCollapsed ? 1 : 1 + g.count);
            }, 0);

            // Add terminator
            groups[length] = null;
        }

        return {
            length: length,
            groups: groups,
            forceUpdate: true
        };
    }

    private _getItem(index: number, disableLazyLoading?: boolean): [QueryGridItem, number] {
        const queryLazyLoading = this.query.disableLazyLoading;
        try {
            this.query.disableLazyLoading = disableLazyLoading;

            if (!this.query.hasMore && index >= Math.min(this.items.length, PHYSICAL_UPPER_LIMIT))
                return [null, -1];

            if (!this.hasGrouping)
                return [this.query.items[index], index];

            let diff = 0;
            let result: QueryGridItem;
            this.items.groups.some((g, nn) => {
                if (nn < index) {
                    diff++;
                    if (g.isCollapsed)
                        diff -= g.count;

                    return false;
                } else if (nn === index) {
                    result = g;
                    return true;
                }

                index -= diff;
                result = this.query.items[index];

                return true;
            });

            return [result, index];
        }
        finally {
            this.query.disableLazyLoading = queryLazyLoading;
        }
    }

    private _updateVerticalSpacer(viewportHeight: number, rowHeight: number, items: QueryGridItem[], maxRows?: number, skip?: number) {
        Polymer.Render.beforeNextRender(this, () => {
            const newHeight = Math.min(Math.max(0, Math.min(items.length, PHYSICAL_UPPER_LIMIT) - (skip || 0)), maxRows || Number.MAX_SAFE_INTEGER) * rowHeight;
            this.$.gridWrapper.style.height = `${newHeight}px`;

            this._verticalSpacerCorrection = (newHeight - this.viewportHeight) / (this.$.gridWrapper.clientHeight - viewportHeight);
        });
    }

    private _updatePinnedColumns() {
        const pinnedColumns = this.columns.filter(c => c.isPinned);
        this._setPinnedColumns(pinnedColumns);

        if (!pinnedColumns.length) {
            if (this._pinnedStyle != null) {
                this.shadowRoot.removeChild(this._pinnedStyle);
                this._pinnedStyle = null;
            }

            return;
        }

        if (this._pinnedStyle == null)
            this.shadowRoot.appendChild(this._pinnedStyle = document.createElement("style"));
            
        this._pinnedStyle.innerHTML = `
            header [grid] > *:nth-child(-n+${pinnedColumns.length}), vi-query-grid-row > .column:nth-child(-n+${pinnedColumns.length} of .column), vi-query-grid-footer > .column:nth-child(-n+${pinnedColumns.length}) {
                transform: translateX(var(--vi-query-grid-horizontal, 0));
            }

            header [grid] > *:nth-child(-n+${pinnedColumns.length}) {
                z-index: 1;
            }

            vi-query-grid-row > .column:nth-child(${pinnedColumns.length} of .column), vi-query-grid-footer > .column:nth-child(${pinnedColumns.length}) {
                border-right: 1px solid var(--theme-light-border);
            }
        `;
    }

    private _updateUserSettings(query: Vidyano.Query) {
        this._setUserSettings(query ? QueryGridUserSettings.Load(query) : null)
    }

    private _computeColumns(columns: QueryGridColumn[]) {
        columns = columns.filter(c => !c.isHidden);
        columns = [...columns.filter(c => c.isPinned), ...columns.filter(c => !c.isPinned)];

        if (this.columns) {
            const signature = (columns: QueryGridColumn[]) => columns.orderBy(c => c.name).map(c => c.name).join(";");
            if (signature(columns) !== signature(this.columns.filter(c => !c.isHidden)))
                this._setInitializing(true);
        }

        if (this.initializing) {
            const init = columns.map(c => c.width || "max-content").join(" ");
            this.style.setProperty("--vi-query-grid-columns-no-data", init);
            this.style.setProperty("--vi-query-grid-columns", init);
            this.style.removeProperty("--vi-query-grid-columns-width");
        }
        // Columns were hidden, pinned or reordered: each column keeps its own measured width instead of the width of its old position
        else if (columns.every(c => this._columnWidths.get(c.name)?.current > 0))
            this._setColumnTracks(columns);

        return columns;
    }

    private _computeLastVisibleColumn(columns: QueryGridColumn[]) {
        return columns?.length === 1;
    }

    private _computeVirtualRowCount(viewportHeight: number, rowHeight: number, canReorder: boolean, totalItems: number) {
        if (!viewportHeight)
            return 0;

        if (canReorder && totalItems > 0)
            return totalItems;

        return Math.ceil(Math.max(Math.ceil(viewportHeight / rowHeight) * 1.5, this.virtualRowCount || 0));
    }

    private _computeOffsets(columns: QueryGridColumn[], columnWidths: Record<string, number>) {
        if (!columns || !columnWidths)
            return null;

        let offset = 0;
        return columns.map(column => {
            return [offset, offset += columnWidths[column.name] || 0];
        });
    }

    private _computeVisibleRange(viewportWidth: number, horizontalScrollOffset: number) {
        return [horizontalScrollOffset, viewportWidth + horizontalScrollOffset];
    }

    private _computeCanSelect(query: Vidyano.Query, noSelection: boolean, asLookup: boolean): boolean {
        return !noSelection && !!query && (asLookup || query.actions.some(a => a.isVisible && a.definition.selectionRule !== Vidyano.ExpressionParser.alwaysTrue));
    }

    private _computeInlineActions(query: Vidyano.Query, noInlineActions: boolean, asLookup: boolean): boolean {
        return !noInlineActions && !!query && !query.asLookup && !asLookup && (query.actions.some(a => a.isVisible && a.definition.selectionRule !== Vidyano.ExpressionParser.alwaysTrue && a.definition.selectionRule(1)));
    }

    private _computeCanReorder(canReorder: boolean, hasGrouping: boolean) {
        return canReorder && !hasGrouping;
    }

    private _computePhysicalUpperLimitExceeded(totalItems: number) {
        return totalItems > PHYSICAL_UPPER_LIMIT;
    }

    private _computeHasMoreRows(totalItems: number, maxRows: number) {
        return !!maxRows && totalItems > maxRows;
    }

    private _rowHeightChanged(rowHeight: number) {
        this.style.setProperty("--vi-query-grid-row-height", `${rowHeight}px`);
    }

    private _updateHorizontalScrollOffset(horizontalScrollOffset: number, oldHorizontalScrollOffset: number) {
        this.style.setProperty("--vi-query-grid-horizontal", `${horizontalScrollOffset}px`);
        this._closePopupsOnUserScroll(oldHorizontalScrollOffset);
    }

    private _onVerticalScrollOffsetChanged(verticalScrollOffset: number, oldVerticalScrollOffset: number) {
        this._closePopupsOnUserScroll(oldVerticalScrollOffset);
    }

    private _closePopupsOnUserScroll(oldScrollOffset: number) {
        // The first offset is the scroller's initial position when the grid is attached
        if (oldScrollOffset === undefined || this._programmaticScroll)
            return;

        Popup.closeAll();
    }

    private _itemSelect(e: CustomEvent) {
        const detail: { item: Vidyano.QueryResultItem; shift: boolean; ctrl: boolean; } = e.detail;

        const indexOfItem = this.query.items.indexOf(detail.item);
        if (!detail.item.isSelected && this._lastSelectedItemIndex >= 0 && detail.shift) {
            const selected = this.query.selectRange(Math.min(this._lastSelectedItemIndex, indexOfItem), Math.max(this._lastSelectedItemIndex, indexOfItem));
            if (selected) {
                this._lastSelectedItemIndex = indexOfItem;
                return;
            }

            // A range over the selection limit leaves the selection unchanged, a range over unloaded items falls back to a plain click
            if (selected === null)
                return;
        }

        if (detail.ctrl) {
            // Ctrl+click: Always toggle the item's selection
            detail.item.isSelected = !detail.item.isSelected;
        }
        else {
            const selectAll = this.query.selectAll;
            const hasSelectAllFeature = selectAll?.isAvailable;
            const isAllSelectedMode = hasSelectAllFeature && selectAll.allSelected;

            if (isAllSelectedMode) {
                // When selectAll is active, single click toggles the item
                detail.item.isSelected = !detail.item.isSelected;
            }
            else {
                // Normal click behavior (no Ctrl, no selectAll mode)
                if (hasSelectAllFeature && selectAll) {
                    // Clear any selectAll state
                    selectAll.allSelected = false;
                    selectAll.inverse = false;
                }

                // Set selection: clear all if multiple selected or item is selected, otherwise select only this item
                const shouldClearAndSelectOnly = this.query.selectedItems.length > 1 || !detail.item.isSelected;
                this.query.selectedItems = shouldClearAndSelectOnly ? [detail.item] : [];
            }
        }

        if (detail.item.isSelected)
            this._lastSelectedItemIndex = indexOfItem;
    }

    private __rowsBeforeDragEnd: QueryGridRow[]; 
    private async _onReorderStart(e: CustomEvent) {
        this.__rowsBeforeDragEnd = Array.from(this.$.grid.querySelectorAll("vi-query-grid-row"));
    }

    private async _onReorderEnd(e: CustomEvent) {
        const details: ISortableDragEndDetails = e.detail;

        if (details.newIndex == null)
            return;

        if (details.newIndex === details.oldIndex)
            return;

        try {
            await this.query.reorder(
                (details.element.previousElementSibling as QueryGridRow)?.item as Vidyano.QueryResultItem ?? null,
                (details.element as QueryGridRow).item as Vidyano.QueryResultItem,
                (details.element.nextElementSibling as QueryGridRow)?.item as Vidyano.QueryResultItem ?? null);
        }
        finally {
            this.__rowsBeforeDragEnd.forEach(row => this.$.grid.appendChild(row));
        }
    }

    private async _onColumnUpdate() {
        try {
            await this.userSettings.save();
        }
        catch (e) {
            // The change stays for this session, the user is told it was not saved
            this.query.setNotification(e);
        }

        this._reset();
    }

    private async _onConfigure() {
        if (await this.app.showDialog(new QueryGridConfigureDialog(this.query, this.userSettings)))
            this._onColumnUpdate();
    }

    private _reset() {
        this._updateUserSettings(this.query);
        this._update(this.verticalScrollOffset, this.virtualRowCount, this.rowHeight, this.items, this.skip, this.maxRows);
    }

    private _updateMore(visibleColumnHeaderSize: ISize, horizontalScrollOffset: number) {
        if (visibleColumnHeaderSize == null || horizontalScrollOffset == null)
            return;          

        this._updateMoreDebouncer = Polymer.Debounce.Debouncer.debounce(
            this._updateMoreDebouncer,
            Polymer.Async.timeOut.after(50),
            () => {
                const sizeTracker = this.$.columnHeadersDomRepeat as SizeTracker;
                const headers = Array.from(sizeTracker.parentElement.querySelectorAll("vi-query-grid-column-header")) as QueryGridColumnHeader[];
                const unpinnedHeaders = headers.filter(h => !h.column.isPinned);

                // The pinned headers stay in view and cover the headers scrolled behind them
                const pinnedWidth = headers.filter(h => h.column.isPinned).reduce((width, h) => width + h.offsetWidth, 0);

                this._setMoreColumns({
                    left: unpinnedHeaders.filter(h => h.offsetLeft - horizontalScrollOffset < pinnedWidth).sort((a, b) => a.column.label.localeCompare(b.column.label)),
                    right: unpinnedHeaders.filter(h => (h.offsetLeft + h.offsetWidth / 2) > visibleColumnHeaderSize.width).sort((a, b) => a.column.label.localeCompare(b.column.label))
                });
            });
    }

    private _onMoreOpening(e: CustomEvent) {
        const popup = e.target as Popup;
        const isLeft = popup.classList.contains("left");
        const headers = isLeft ? this.moreColumns.left : this.moreColumns.right;
        
        popup.querySelector("vi-scroller").append(...headers.map(h => {
            return new PopupMenuItem(h.column.label, null, () => {
                const pinnedColumns = this.columns.filter(c => c.isPinned);
                const pinnedOffset = pinnedColumns.length > 0 ? pinnedColumns.sum(c => this._columnWidths.get(c.name)?.current || 0) : 0;
                this.horizontalScrollOffset = h.offsetLeft - pinnedOffset;
            });
        }));
    }

    private _onMoreClosed(e: CustomEvent) {
        const popup = e.target as Popup;
        popup.querySelector("vi-scroller").innerHTML = "";
    }
}
