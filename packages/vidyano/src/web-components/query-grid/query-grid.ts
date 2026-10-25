import { html, nothing, unsafeCSS } from "lit"
import { property, state } from "lit/decorators.js"
import * as Vidyano from "@vidyano/core"
import { WebComponent, computed, listener, notify, observer } from "components/web-component/web-component"
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
import "components/size-tracker/size-tracker"
import "components/sortable/sortable"
import { Popup } from "components/popup/popup"
import { QueryGridColumn } from "./query-grid-column"
import { QueryGridConfigureDialog } from "./query-grid-configure-dialog"
import { QueryGridRow } from "./query-grid-row"
import { QueryGridUserSettings } from "./query-grid-user-settings"
import { ISize } from "components/size-tracker/size-tracker"
import { ISortableDragEndDetails } from "components/sortable/sortable"
import { PopupMenuItem } from "components/popup-menu/popup-menu-item"
import styles from "./query-grid.css"

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

// The columns measured per frame once the grid shows its rows
const MEASURE_BATCH_SIZE = 8;

class Debouncer {
    #handle: number = null;

    constructor(private readonly _schedule: (callback: () => void) => number, private readonly _cancel: (handle: number) => void) {
    }

    run(callback: () => void) {
        this.cancel();
        this.#handle = this._schedule(() => {
            this.#handle = null;
            callback();
        });
    }

    cancel() {
        if (this.#handle === null)
            return;

        this._cancel(this.#handle);
        this.#handle = null;
    }

    isActive() {
        return this.#handle !== null;
    }
}

const animationFrameDebouncer = () => new Debouncer(callback => requestAnimationFrame(callback), handle => cancelAnimationFrame(handle));
const timeOutDebouncer = (milliseconds: number) => new Debouncer(callback => window.setTimeout(callback, milliseconds), handle => window.clearTimeout(handle));

export class QueryGrid extends WebComponent {
    static styles = unsafeCSS(styles);

    private readonly _columnWidths = new Map<string, ColumnWidthDetail>();
    private _virtualGridStartIndex: number = 0;
    private _rowsOrigin: number = 0;
    private _verticalSpacerCorrection: number = 1;
    private readonly _getItemsDebouncer = timeOutDebouncer(20);
    private readonly _updateCellDebouncer = animationFrameDebouncer();
    private readonly _updateMoreDebouncer = timeOutDebouncer(50);
    private readonly _verticalSpacerDebouncer = animationFrameDebouncer();
    private readonly _measureColumnsDebouncer = animationFrameDebouncer();
    private readonly _unmeasuredColumns = new Set<string>();
    #rowColumnCountChosen = false;
    #columnMeasure: Promise<void>;
    #measuredItems = new Set<QueryGridItem>();
    private _pinnedStyle: HTMLStyleElement;
    private _lastSelectedItemIndex: number;
    private _controlsSizeObserver: ResizeObserver;
    private _programmaticScroll: boolean;
    private _renderedSkip: number;
    private _renderedMaxRows: number;
    private _cancelledOnDisconnect: boolean;
    private _serviceBusDisposer: Vidyano.ServiceBusSubscriptionDisposer;
    private _userSettingsSource: [query: Vidyano.Query, columns: Vidyano.QueryColumn[]];
    private _itemsOnDisconnect: Vidyano.QueryItems;
    private _rowsBeforeDragEnd: [row: QueryGridRow, marker: Node][];
    private _pendingReorders = 0;
    #initializing = true;

    @property({ type: Object })
    @observer(function(this: QueryGrid, query: Vidyano.Query, oldQuery: Vidyano.Query) {
        this._queryChanged(query, oldQuery);
    })
    query: Vidyano.Query;

    @property({ type: Boolean, reflect: true })
    asLookup: boolean = false;

    @property({ type: Boolean, reflect: true })
    noSelection: boolean = false;

    @property({ type: Boolean, reflect: true })
    noInlineActions: boolean = false;

    @property({ type: Number, reflect: true })
    maxRows: number = null;

    @property({ type: Number, reflect: true })
    skip: number = 0;

    // Read-only, the grid ends initializing itself once the column widths are measured
    @property({ attribute: false, noAccessor: true })
    @notify()
    get initializing(): boolean {
        return this.#initializing;
    }
    set initializing(_: boolean) {
    }

    @property({ attribute: false })
    userSettings: QueryGridUserSettings;

    @property({ attribute: false })
    columns: QueryGridColumn[];

    @property({ attribute: false })
    pinnedColumns: QueryGridColumn[];

    @property({ attribute: false })
    columnWidths: Record<string, number>;

    @property({ type: Number })
    @observer(function(this: QueryGrid, rowHeight: number) {
        this._rowHeightChanged(rowHeight);
    })
    rowHeight: number;

    @property({ type: Number })
    @observer(function(this: QueryGrid, horizontalScrollOffset: number, oldHorizontalScrollOffset: number) {
        this._updateHorizontalScrollOffset(horizontalScrollOffset, oldHorizontalScrollOffset);
    })
    horizontalScrollOffset: number;

    @property({ type: Number })
    @observer(function(this: QueryGrid, verticalScrollOffset: number, oldVerticalScrollOffset: number) {
        this._onVerticalScrollOffsetChanged(verticalScrollOffset, oldVerticalScrollOffset);
    })
    verticalScrollOffset: number;

    @state()
    viewportHeight: number = 0;

    @state()
    viewportWidth: number;

    @state()
    visibleColumnHeaderSize: ISize;

    @state()
    moreColumns: MoreColumns;

    /** The working copy of the virtual rows, the rendered rows follow it on the next animation frame. */
    virtualItems: QueryGridItem[];

    @state()
    private _renderedItems: QueryGridItem[];

    @property({ attribute: false })
    @computed(function(this: QueryGrid, query: Vidyano.Query): QueryGridItems {
        if (!query) {
            return {
                length: 0,
                groups: [],
                forceUpdate: true
            };
        }

        let length: number;
        let groups: Vidyano.QueryResultItemGroup[];

        if (!query.groupingInfo?.groups)
            length = query.totalItems || 0;
        else {
            groups = [];
            length = query.groupingInfo.groups.reduce((n, g) => {
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
    }, "query", "query.lastUpdated", "query.items", { allowUndefined: true })
    declare readonly items: QueryGridItems;

    // Same dependencies as items, so both are up to date when the rows are updated
    @property({ type: Boolean, reflect: true })
    @computed(function(this: QueryGrid, query: Vidyano.Query) {
        return !!query?.groupingInfo?.groups;
    }, "query", "query.lastUpdated", "query.items", { allowUndefined: true })
    declare readonly hasGrouping: boolean;

    @property({ type: Number })
    @computed(function(this: QueryGrid, viewportHeight: number, rowHeight: number, canReorder: boolean, totalItems: number) {
        if (!viewportHeight || !rowHeight)
            return 0;

        if (canReorder && totalItems > 0)
            return totalItems;

        return Math.ceil(Math.max(Math.ceil(viewportHeight / rowHeight) * 1.5, this.virtualRowCount || 0));
    }, "viewportHeight", "rowHeight", "query.canReorder", "query.totalItems", { allowUndefined: true })
    declare readonly virtualRowCount: number;

    @property({ type: Boolean, reflect: true })
    @computed(function(this: QueryGrid, query: Vidyano.Query, noSelection: boolean, asLookup: boolean) {
        return !noSelection && !!query && (asLookup || query.actions.some(a => a.isVisible && a.definition.selectionRule !== Vidyano.ExpressionParser.alwaysTrue));
    }, "query", "noSelection", "asLookup", "query.actions.*.isVisible", { allowUndefined: true })
    declare readonly canSelect: boolean;

    @property({ type: Boolean, reflect: true })
    @computed(function(this: QueryGrid, query: Vidyano.Query, noInlineActions: boolean, asLookup: boolean) {
        return !noInlineActions && !!query && !query.asLookup && !asLookup && (query.actions.some(a => a.isVisible && a.definition.selectionRule !== Vidyano.ExpressionParser.alwaysTrue && a.definition.selectionRule(1)));
    }, "query", "noInlineActions", "asLookup", "query.actions.*.isVisible", { allowUndefined: true })
    declare readonly inlineActions: boolean;

    @property({ type: Boolean, reflect: true })
    @computed("query.canFilter")
    declare readonly canFilter: boolean;

    @property({ type: Boolean, reflect: true })
    @computed(function(this: QueryGrid, canReorder: boolean, hasGrouping: boolean) {
        return !!canReorder && !hasGrouping;
    }, "query.canReorder", "hasGrouping", { allowUndefined: true })
    declare readonly canReorder: boolean;

    @property({ type: Boolean })
    @computed(function(this: QueryGrid, query: Vidyano.Query) {
        return query?.items.length > PHYSICAL_UPPER_LIMIT;
    }, "query", "query.totalItems", "query.items.*", { allowUndefined: true })
    declare readonly physicalUpperLimitExceeded: boolean;

    @property({ type: Boolean, reflect: true })
    @computed(function(this: QueryGrid, query: Vidyano.Query, maxRows: number) {
        return !!maxRows && query?.items.length > maxRows;
    }, "query", "maxRows", "query.totalItems", "query.items.*", { allowUndefined: true })
    declare readonly hasMoreRows: boolean;

    @state()
    @computed("query.isBusy")
    private declare readonly _isBusy: boolean;

    @state()
    @computed("query.totalItem")
    private declare readonly _totalItem: Vidyano.QueryResultItem;

    /** The number of leading columns the rows render, the columns after them are measured later. Undefined until the first rows are rendered. */
    @state()
    private _rowColumnCount: number;

    @state()
    @computed(function(this: QueryGrid, columns: QueryGridColumn[], rowColumnCount: number) {
        return this.memoize(this._rowColumns, columns?.slice(0, rowColumnCount ?? columns.length));
    }, "columns", "_rowColumnCount", { allowUndefined: true })
    private declare readonly _rowColumns: QueryGridColumn[];

    @state()
    @computed(function(this: QueryGrid, columns: QueryGridColumn[], columnWidths: Record<string, number>) {
        if (!columns || !columnWidths)
            return null;

        let offset = 0;
        const offsets = columns.map(column => {
            return [offset, offset += columnWidths[column.name] || 0] as [number, number];
        });

        // Widths that are applied again unchanged leave the rows alone
        return this.memoize(this._offsets, offsets, (a, b) => a?.length === b.length && a.every(([left, right], i) => left === b[i][0] && right === b[i][1]));
    }, "_rowColumns", "columnWidths", { allowUndefined: true })
    private declare readonly _offsets: [cellLeft: number, cellRight: number][];

    @state()
    @computed(function(this: QueryGrid, viewportWidth: number, horizontalScrollOffset: number) {
        return [horizontalScrollOffset, viewportWidth + horizontalScrollOffset];
    }, "viewportWidth", "horizontalScrollOffset")
    private declare readonly _visibleRange: [left: number, right: number];

    constructor() {
        super();

        this.requestUpdate("initializing", undefined);
    }

    connectedCallback() {
        this.toggleAttribute("initializing", this.initializing);
        if (!this.hasAttribute("role"))
            this.setAttribute("role", "grid");

        super.connectedCallback();

        // Callers read the initial column template and the rendered header right after attaching the grid
        if (!this.hasUpdated)
            this.performUpdate();
        else {
            this._observeControlsSize();
            this._queueMeasureColumns();
        }

        this._serviceBusDisposer = Vidyano.ServiceBus.subscribe("app-route:deactivate", this._onAppRouteDeactivate.bind(this), true);

        // The observed query paths are notified again on connect, a scroll to the top is only needed for items that changed while detached
        if (this._itemsOnDisconnect !== undefined)
            this.updateComplete.then(() => this._itemsOnDisconnect = undefined);

        // Redo the work that was cancelled when the grid was removed, nothing else would start it again
        if (this._cancelledOnDisconnect && this.items) {
            this._cancelledOnDisconnect = false;
            this.items.forceUpdate = true;
            this._update(this.verticalScrollOffset, this.virtualRowCount, this.rowHeight, this.items, this.skip, this.maxRows);
            this._updateMore(this.visibleColumnHeaderSize, this.horizontalScrollOffset);
        }
    }

    disconnectedCallback() {
        this._controlsSizeObserver?.disconnect();
        this._serviceBusDisposer?.();
        this._serviceBusDisposer = null;

        this._cancelledOnDisconnect = [this._getItemsDebouncer, this._updateCellDebouncer, this._updateMoreDebouncer, this._measureColumnsDebouncer].some(d => d.isActive());
        this._itemsOnDisconnect = this.query?.items ?? null;

        // A removed grid sends nothing to the server
        this._getItemsDebouncer.cancel();
        this._updateCellDebouncer.cancel();
        this._updateMoreDebouncer.cancel();
        this._measureColumnsDebouncer.cancel();

        super.disconnectedCallback();
    }

    firstUpdated(changedProperties: Map<PropertyKey, unknown>) {
        super.firstUpdated(changedProperties);

        this._observeControlsSize();

        new MutationObserver(() => this._updateRowOrder()).observe(this.$.grid, { childList: true, attributes: true, attributeFilter: ["selected", "actions-open"], subtree: true });

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
     * The row ids in display order, assistive technology reads the rows in that order instead of their order in the document.
     */
    private _rowsInDisplayOrder(): string {
        const count = this._renderedItems?.length;
        if (!count || this.canReorder)
            return null;

        return Array.from({ length: count }, (_, index) => `row${(this._virtualGridStartIndex + index) % count}`).join(" ");
    }

    updated(changedProperties: Map<PropertyKey, unknown>) {
        super.updated(changedProperties);

        if (changedProperties.has("_renderedItems"))
            this._updateRowOrder();
    }

    /**
     * Marks the stripe, the first row and the rows that follow a selected row or a row with open actions, in display order: the rows are
     * not in document order, so nth-of-type and sibling selectors can't. Reorderable rows are in document order, also while they are dragged.
     */
    private _updateRowOrder() {
        const rows = Array.from(this.$.grid.querySelectorAll<QueryGridRow>(":scope > vi-query-grid-row"));
        if (!this.canReorder)
            rows.sort((a, b) => a.index - b.index);

        rows.forEach((row, i) => {
            const previous = rows[i - 1];
            row.toggleAttribute("odd", (this._virtualGridStartIndex + i) % 2 === 0);
            row.toggleAttribute("first", i === 0);
            row.toggleAttribute("after-highlighted", !!previous && (previous.hasAttribute("selected") || previous.hasAttribute("actions-open")));
        });
    }

    render() {
        return html`
            <header>
                <div class="controls">
                    ${this.canReorder ? html`<div class="reorder"></div>` : nothing}
                    ${this.hasGrouping ? html`<vi-query-grid-grouping .query=${this.query} @scroll-top=${this._scrollToTop}></vi-query-grid-grouping>` : nothing}
                    ${this.canSelect ? html`<vi-query-grid-select-all .query=${this.query}></vi-query-grid-select-all>` : nothing}
                    ${this.canFilter ? html`<vi-query-grid-filters .query=${this.query}></vi-query-grid-filters>` : nothing}
                    <div class="spacer"></div>
                </div>
                <div class="headers">
                    <div grid>
                        ${this.columns?.map(column => html`<vi-query-grid-column-header .column=${column} .lastVisible=${this.columns.length === 1}></vi-query-grid-column-header>`)}
                        <vi-size-tracker @size-changed=${this._onHeaderSizeChanged}></vi-size-tracker>
                    </div>
                    ${this.moreColumns?.left.length ? html`
                        <vi-popup class="more left" @popup-opening=${this._onMoreOpening} @popup-closed=${this._onMoreClosed}>
                            <vi-button slot="header" inverse icon="ChevronLeft"></vi-button>
                            <vi-scroller no-horizontal></vi-scroller>
                        </vi-popup>` : nothing}
                </div>
                ${this.moreColumns?.right.length ? html`
                    <vi-popup class="more right" @popup-opening=${this._onMoreOpening} @popup-closed=${this._onMoreClosed} placement="bottom-end">
                        <vi-button slot="header" inverse icon="ChevronRight"></vi-button>
                        <vi-scroller no-horizontal></vi-scroller>
                    </vi-popup>` : nothing}
            </header>

            <vi-scroller .horizontalScrollOffset=${this.horizontalScrollOffset} @horizontal-scroll-offset-changed=${this._onScrollerHorizontalScrollOffsetChanged}
                         .verticalScrollOffset=${this.verticalScrollOffset} @vertical-scroll-offset-changed=${this._onScrollerVerticalScrollOffsetChanged}
                         @outer-height-changed=${this._onScrollerOuterHeightChanged} @outer-width-changed=${this._onScrollerOuterWidthChanged}>
                <div id="gridWrapper">
                    <vi-sortable id="grid" role="rowgroup" aria-owns=${this._rowsInDisplayOrder() ?? nothing} ?grid=${this.initializing} .disabled=${!this.canReorder} handle=".reorder" @drag-start=${this._onReorderStart} @drag-end=${this._onReorderEnd}>
                        ${this._renderedItems?.map((item, slot) => {
                            // A row keeps its item while the item stays in the window, rows are placed by the item's index instead of their order
                            const count = this._renderedItems.length;
                            const index = (slot - this._virtualGridStartIndex % count + count) % count;
                            const position = this._virtualGridStartIndex + index;
                            return html`<vi-query-grid-row id=${`row${slot}`} aria-rowindex=${position + (this.skip || 0) + 1} .item=${item} .index=${index} .top=${this.canReorder ? null : (position - this._rowsOrigin) * this.rowHeight} .columns=${this._rowColumns} .offsets=${this._offsets} .visibleRange=${this._visibleRange} ?initializing=${this.initializing} .canReorder=${this.canReorder}></vi-query-grid-row>`;
                        })}
                        ${this.physicalUpperLimitExceeded ? html`
                            <div class="physical-upper-limit-exceeded" style="transform: translateY(${(Math.min(this._virtualGridStartIndex + (this._renderedItems?.length ?? 0), PHYSICAL_UPPER_LIMIT - (this.skip || 0)) - this._rowsOrigin) * this.rowHeight}px)">
                                <vi-icon source="Ellipsis"></vi-icon>
                            </div>` : nothing}
                    </vi-sortable>
                </div>
            </vi-scroller>

            ${this._totalItem ? html`
                <footer>
                    <vi-query-grid-footer .item=${this._totalItem} .columns=${this.columns}></vi-query-grid-footer>
                </footer>` : nothing}

            <vi-spinner ?hidden=${!this._isBusy}></vi-spinner>
        `;
    }

    private _observeControlsSize() {
        this._controlsSizeObserver ??= new ResizeObserver(this._controlsSizeChanged.bind(this));
        this._controlsSizeObserver.observe(this.shadowRoot.querySelector(".controls"));
    }

    private _onScrollerHorizontalScrollOffsetChanged(e: CustomEvent) {
        this.horizontalScrollOffset = e.detail.value;
    }

    private _onScrollerVerticalScrollOffsetChanged(e: CustomEvent) {
        this.verticalScrollOffset = e.detail.value;
    }

    private _onScrollerOuterHeightChanged(e: CustomEvent) {
        this.viewportHeight = e.detail.value;
    }

    private _onScrollerOuterWidthChanged(e: CustomEvent) {
        this.viewportWidth = e.detail.value;
    }

    private _onHeaderSizeChanged(e: CustomEvent) {
        this.visibleColumnHeaderSize = e.detail.value;
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

    private _setInitializing(initializing: boolean) {
        const oldInitializing = this.#initializing;
        if (oldInitializing === initializing)
            return;

        this.#initializing = initializing;
        this.toggleAttribute("initializing", initializing);

        if (initializing) {
            // The columns are measured again on the rows that are rendered next
            this.#rowColumnCountChosen = false;
            this._unmeasuredColumns.clear();
            this._measureColumnsDebouncer.cancel();

            // A row keeps the cells of the columns with the same name and type, a hidden one would stay hidden
            this.shadowRoot?.querySelectorAll("vi-query-grid-row > [unmeasured]").forEach(cell => cell.removeAttribute("unmeasured"));
        }

        this.requestUpdate("initializing", oldInitializing);
    }

    @observer("initializing")
    private _onInitializingChanged(initializing: boolean) {
        if (initializing) {
            // Rows fill every cell while the column widths are measured from the cell content
            this.columnWidths = null;
            return;
        }

        const offset = queryScrollOffsets.get(this.query);
        if (offset !== undefined) {
            // Run as animation frame, otherwise the browser will set an incorrect scroll height
            requestAnimationFrame(() => {
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

    @observer("query", "query.columns", { allowUndefined: true })
    private _queryColumnsChanged(query: Vidyano.Query, columns: Vidyano.QueryColumn[]) {
        // A reconnected grid is notified of the same query columns again, its settings stay
        if (this._userSettingsSource?.[0] === query && this._userSettingsSource[1] === columns)
            return;

        this._updateUserSettings(query);
    }

    private _updateUserSettings(query: Vidyano.Query) {
        this._userSettingsSource = [query, query?.columns];
        this.userSettings = query ? QueryGridUserSettings.Load(query) : null;
    }

    @observer("query.items")
    private _queryItemsChanged(items: Vidyano.QueryItems) {
        const itemsOnDisconnect = this._itemsOnDisconnect;
        this._itemsOnDisconnect = undefined;

        if (items === itemsOnDisconnect)
            return;

        // The reordered items take the place of the old ones, the dropped row stays where it was released
        if (this._pendingReorders > 0) {
            this._lastSelectedItemIndex = undefined;
            return;
        }

        // Scroll to top when the query items reference changes, for example after search.
        this._scrollToTop();
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
    @listener("column-width-changed")
    private _columnWidthChanged(e: CustomEvent) {
        e.stopPropagation();

        // Always attempt to update column widths when this event is triggered.
        const detail: { type: "cell" | "column" | "current", entries: [column: string, width: number][], save?: boolean } = e.detail;

        // Once the widths apply, the first row only reports a cell width a column does not have yet: a measured column keeps the widest cell over the rows
        const entries = detail.type === "cell" && !this.initializing ? detail.entries.filter(([column]) => this._columnWidths.get(column)?.cell === undefined && !this._unmeasuredColumns.has(column)) : detail.entries;
        entries.forEach(([column, width]) => {
            let columnWidthDetail: ColumnWidthDetail = this._columnWidths.get(column);
            if (!columnWidthDetail)
                this._columnWidths.set(column, columnWidthDetail = {});

            columnWidthDetail[detail.type] = width;
            if (detail.type !== "current")
                columnWidthDetail.current = Math.max(columnWidthDetail.cell, columnWidthDetail.column) || Number.NaN;
        });

        if (!this.columns || this._columnWidths.size < this.columns.length)
            return;

        if (this._rowColumns.some(c => !this._unmeasuredColumns.has(c.name) && Number.isNaN(this._columnWidths.get(c.name)?.current)) && (this.query.items.length || this.query.isBusy))
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
        Array.from(this._unmeasuredColumns).filter(name => !this._columnWidths.has(name)).forEach(name => this._unmeasuredColumns.delete(name));

        if (this._rowColumns.some(c => !this._unmeasuredColumns.has(c.name) && Number.isNaN(this._columnWidths.get(c.name)?.current))) {
            // Without data cells every column takes its header width, the rows render all columns once data arrives
            this._columnWidths.forEach(cw => cw.current = cw.column);
            this._rowColumnCount = undefined;
            this._unmeasuredColumns.clear();
        }
        else {
            // The columns the rows add later are measured on the same items
            if (this.initializing) {
                this.columns.slice(this._rowColumns.length).forEach(c => this._unmeasuredColumns.add(c.name));
                this.#measuredItems = new Set(this._renderedItems);
            }

            // A column that is not measured yet takes its header width, which its measured width can only exceed
            this._unmeasuredColumns.forEach(name => this._columnWidths.get(name).current = this._columnWidths.get(name).column);
        }

        this._setColumnTracks(this.columns);
        // The rows have no cells yet for the columns that are measured later, their tracks already hold a width
        if (Array.from(this._columnWidths).every(([name, w]) => w.cell >= 0 || this._unmeasuredColumns.has(name)))
            this.style.removeProperty("--vi-query-grid-columns-no-data");

        // Rows defer the cells outside the horizontal viewport from now on
        this.columnWidths = Object.fromEntries(Array.from(this._columnWidths).map(([column, width]) => [column, Math.ceil(width.current)]));
        this._setInitializing(false);
        this._queueMeasureColumns();
    }

    /**
     * Gets the number of leading columns the first rows render: the columns that start inside the visible width, using the header widths,
     * which the measured widths can only exceed. The other columns are measured once the rows show.
     */
    private _initialRowColumnCount(): number {
        const headers = Array.from(this.shadowRoot.querySelectorAll<HTMLElement>("header [grid] > vi-query-grid-column-header"));
        if (!this.viewportWidth || headers.length !== this.columns.length)
            return this.columns.length;

        // A restored scroll offset shows columns further to the right
        const right = (queryScrollOffsets.get(this.query)?.horizontal ?? this.horizontalScrollOffset ?? 0) + this.viewportWidth;

        let count = 0;
        for (let left = 0; count < headers.length && (left < right || this.columns[count].isPinned); count++)
            left += headers[count].getBoundingClientRect().width;

        return count;
    }

    private _setRowColumnCount(count: number, columns = this.columns) {
        this._rowColumnCount = count;

        // The measuring rows share one grid, it has a track for each column they render
        if (this.initializing)
            this.style.setProperty("--vi-query-grid-row-columns", columns.slice(0, count).map(c => c.width || "max-content").join(" "));
    }

    private get _hasUnmeasuredColumns(): boolean {
        return !!this.columns && (this._rowColumns.length < this.columns.length || this._unmeasuredColumns.size > 0);
    }

    private _queueMeasureColumns() {
        if (!this.initializing && this._hasUnmeasuredColumns) {
            this._measureColumnsDebouncer.run(async () => {
                await this._measureColumns(MEASURE_BATCH_SIZE, false);
                this._measureVisibleColumns();
                this._queueMeasureColumns();
            });
        }
    }

    /**
     * Adds the next `count` columns to the rows, and every column that starts left of the visible width's right edge when `measure` is set.
     * Added cells stay hidden until the columns are measured: when `measure` is set or the last column is added. Each column then takes the
     * widest cell over the rows that measured the other columns, as when all columns were measured together.
     */
    private _measureColumns(count: number, measure = true): Promise<void> {
        // A measure that runs already is awaited instead of measuring the same columns twice
        return this.#columnMeasure ??= this._measureNextColumns(count, measure).finally(() => this.#columnMeasure = null);
    }

    private async _measureNextColumns(count: number, measure: boolean) {
        const columns = this.columns;
        const offset = this.horizontalScrollOffset ?? 0;

        let end = Math.min(columns.length, this._rowColumns.length + count);
        if (measure) {
            let left = columns.slice(0, end).reduce((sum, c) => sum + (this.columnWidths?.[c.name] ?? 0), 0);
            for (; end < columns.length && left < offset + this.viewportWidth; end++)
                left += this.columnWidths?.[columns[end].name] ?? 0;
        }

        // Stay unmeasured when the grid is removed or its columns change before the widths are read
        const added = columns.slice(this._rowColumns.length, end);
        added.forEach(c => this._unmeasuredColumns.add(c.name));
        if (added.length)
            this._rowColumnCount = end === columns.length ? undefined : end;

        // The rows create the cells of the new columns and fill them
        await this.updateComplete;
        const rows = Array.from(this.$.grid.querySelectorAll<QueryGridRow>("vi-query-grid-row"));
        await Promise.all(rows.map(row => row.updateComplete));
        const addedCells = rows.flatMap(row => added.map(c => row.cells[this._rowColumns.indexOf(c)]).filter(cell => !!cell));
        await Promise.all(addedCells.map(cell => cell.updateComplete));

        if (!this.isConnected || this.initializing || this.columns !== columns)
            return;

        // Hidden cells take no style or layout work until they are measured
        if (!measure && end < columns.length) {
            addedCells.forEach(cell => cell.toggleAttribute("unmeasured", true));
            return;
        }

        const unmeasured = this._rowColumns.filter(c => this._unmeasuredColumns.has(c.name));
        const indexes = unmeasured.map(c => this._rowColumns.indexOf(c));
        const measuredRows = rows.filter(row => this.#measuredItems.has(row.item) && !row.classList.contains("hidden") && !row.isGroup);

        // The column at the left edge of the visible width keeps its place when the columns before it get their measured widths
        const left = (column: QueryGridColumn) => columns.slice(0, columns.indexOf(column)).reduce((sum, c) => sum + (this.columnWidths?.[c.name] ?? 0), 0);
        const edge = offset + columns.filter(c => c.isPinned).reduce((sum, c) => sum + (this.columnWidths?.[c.name] ?? 0), 0);
        const anchor = offset > 0 ? columns.find(c => !c.isPinned && left(c) + (this.columnWidths?.[c.name] ?? 0) > edge) : null;
        const anchorOffset = anchor ? edge - left(anchor) : 0;

        // A measuring cell takes its max-content width, the width a max-content track gives it, without restyling the other cells
        const cells = rows.flatMap(row => indexes.map(index => row.cells[index]).filter(cell => !!cell));
        cells.forEach(cell => {
            cell.removeAttribute("unmeasured");
            cell.toggleAttribute("measuring", !cell.column.width);
        });
        const cellWidths = indexes.map(index => measuredRows.reduce((max, row) => Math.max(max, row.cells[index]?.getBoundingClientRect().width ?? 0), 0));
        cells.forEach(cell => cell.removeAttribute("measuring"));

        unmeasured.forEach((column, i) => {
            const width = this._columnWidths.get(column.name);
            // A saved width is not measured, its header has that width
            width.cell = column.width ? width.column : cellWidths[i];
            width.current = Math.max(width.cell, width.column) || Number.NaN;
            this._unmeasuredColumns.delete(column.name);
        });

        this._applyColumnWidths();

        const shift = anchor ? left(anchor) + anchorOffset - edge : 0;
        if (shift !== 0)
            this._scrollProgrammatically(() => this.horizontalScrollOffset = offset + shift);
    }

    /**
     * Measures the columns that come into view before their turn, before the frame shows them.
     */
    @observer("horizontalScrollOffset", "viewportWidth", "columnWidths")
    private _measureVisibleColumns() {
        // A measure that runs checks again when it is done
        if (this.initializing || this.#columnMeasure || !this.columnWidths || !this._hasUnmeasuredColumns)
            return;

        let left = 0;
        const right = (this.horizontalScrollOffset ?? 0) + this.viewportWidth;
        const visibleUnmeasured = this.columns.some((column, index) => {
            const unmeasured = index >= this._rowColumns.length || this._unmeasuredColumns.has(column.name);
            const isVisible = left < right;
            left += this.columnWidths[column.name] ?? 0;
            return unmeasured && isVisible;
        });

        if (visibleUnmeasured)
            this._measureColumns(0);
    }

    private _scrollToTop() {
        // The range anchor is an index into the old items
        this._lastSelectedItemIndex = undefined;

        this._scrollProgrammatically(() => this.verticalScrollOffset = 0);
    }

    private _scrollProgrammatically(scroll: () => void) {
        // The offset observers run on the next update, the flag stays up until then
        this._programmaticScroll = true;
        scroll();

        this.updateComplete.then(() => this._programmaticScroll = false);
    }

    private _setColumnTracks(columns: QueryGridColumn[]) {
        const widths = columns.map(c => Math.ceil(this._columnWidths.get(c.name).current));
        this.style.setProperty("--vi-query-grid-columns", `${widths.map(w => `${w}px`).join(" ")} minmax(0, 1fr)`);
        this.style.setProperty("--vi-query-grid-columns-width", `${widths.reduce((sum, w) => sum + w, 0)}px`);

        // New widths move the headers without changing the header area size or the scroll offset that trigger this
        this._updateMore(this.visibleColumnHeaderSize, this.horizontalScrollOffset);
    }

    @observer("verticalScrollOffset", "virtualRowCount", "rowHeight", "items", "skip", "maxRows", { allowUndefined: true })
    private _update(verticalScrollOffset: number, virtualRowCount: number, rowHeight: number, items: QueryGridItems, skip: number, maxRows?: number) {
        if (!virtualRowCount || !items || !this.query)
            return;

        // The browser clamped the scroll height: the unscaled row position lies past it, the rows move back to the real scroll position
        const clampOffset = this._verticalSpacerCorrection > 1 ? verticalScrollOffset * (this._verticalSpacerCorrection - 1) : 0;
        verticalScrollOffset *= this._verticalSpacerCorrection;
        const viewportStartRowIndex = Math.floor(verticalScrollOffset / rowHeight);
        const viewportEndRowIndex = Math.ceil((verticalScrollOffset + this.viewportHeight) / rowHeight);

        const virtualItemsLength = Math.min(virtualRowCount, maxRows || Number.MAX_SAFE_INTEGER);
        if (!this.virtualItems || this.virtualItems.length !== virtualItemsLength) {
            this.virtualItems = new Array(virtualItemsLength);
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

            // A null item at a real index is one whose page is loading
            if (item === undefined || (item === null && realIndex >= 0)) {
                if (realIndex < this.query.totalItems || this.query.hasMore) {
                    placeholder.query = this.query;
                    this.virtualItems[virtualIndex] = <any>placeholder;
                    queuedItemIndexes.push(realIndex);
                }
                else
                    this.virtualItems[virtualIndex] = null;
            }
        }

        this._updateCellDebouncer.run(async () => {
            if (this.initializing && !this.#rowColumnCountChosen) {
                this.#rowColumnCountChosen = true;
                this._setRowColumnCount(this._initialRowColumnCount());
            }
            // The columns that are not measured yet are measured on the rows that measured the others, before those show other items
            else if (!this.initializing && this._hasUnmeasuredColumns && Array.from(this.#measuredItems).some(item => this.virtualItems.indexOf(item) < 0)) {
                this._measureColumnsDebouncer.cancel();
                let pending: number;
                while ((pending = this.columns.length - this._rowColumns.length + this._unmeasuredColumns.size) > 0 && this.isConnected && !this.initializing) {
                    await this._measureColumns(this.columns.length);
                    if (this.columns.length - this._rowColumns.length + this._unmeasuredColumns.size >= pending)
                        break;
                }
            }

            this._virtualGridStartIndex = newVirtualGridStartIndex;

            // An item keeps its row while it stays in the window: the row of an index is that index modulo the row count
            const count = this.virtualItems.length;
            const rendered = new Array<QueryGridItem>(count);
            this.virtualItems.forEach((item, index) => rendered[(newVirtualGridStartIndex + index) % count] = item);
            this._renderedItems = rendered;

            // Past the browser's height limit the rows are placed from the window start, offsets from 0 would exceed what it renders
            this._rowsOrigin = this._verticalSpacerCorrection > 1 ? newVirtualGridStartIndex : 0;
            this.$.grid.style.transform = `translateY(${this._rowsOrigin * rowHeight - clampOffset}px)`;
        });

        this._getItemsDebouncer.run(() => {
            if (this._virtualGridStartIndex !== newVirtualGridStartIndex)
                return;

            queuedItemIndexes.forEach(index => this.query.items[index]);
        });

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

    @observer("viewportHeight", "rowHeight", "items", "maxRows", "skip", { allowUndefined: true })
    private _updateVerticalSpacer(viewportHeight: number, rowHeight: number, items: QueryGridItems, maxRows?: number, skip?: number) {
        if (!items || !rowHeight)
            return;

        this.setAttribute("aria-rowcount", String(Math.min(items.length, PHYSICAL_UPPER_LIMIT)));

        // Measured after the rows of this update are rendered
        this._verticalSpacerDebouncer.run(() => {
            const gridWrapper = this.$.gridWrapper;
            const newHeight = Math.min(Math.max(0, Math.min(items.length, PHYSICAL_UPPER_LIMIT) - (skip || 0)), maxRows || Number.MAX_SAFE_INTEGER) * rowHeight;
            gridWrapper.style.height = `${newHeight}px`;

            this._verticalSpacerCorrection = (newHeight - this.viewportHeight) / (gridWrapper.clientHeight - viewportHeight);
        });
    }

    @observer("columns", "columns.*.isPinned")
    private _updatePinnedColumns(columns: QueryGridColumn[]) {
        const pinnedColumns = columns.filter(c => c.isPinned);
        this.pinnedColumns = pinnedColumns;

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

    @observer("userSettings.columns")
    private _updateColumns(userSettingsColumns: QueryGridColumn[]) {
        let columns = userSettingsColumns.filter(c => !c.isHidden);
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
            this._setRowColumnCount(this._rowColumnCount, columns);
        }
        else {
            // A reordered column that is not measured yet can land among the measured ones, the rows render all columns and measure it there
            if (this._rowColumns.length < this.columns.length) {
                this.columns.slice(this._rowColumns.length).forEach(c => this._unmeasuredColumns.add(c.name));
                this._rowColumnCount = undefined;
            }

            // Columns were hidden, pinned or reordered: each column keeps its own measured width instead of the width of its old position
            if (columns.every(c => this._columnWidths.get(c.name)?.current > 0))
                this._setColumnTracks(columns);
        }

        // A re-attached grid is notified of the same columns again, the rows keep their cells
        this.columns = this.memoize(this.columns, columns);
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

    @listener("item-select")
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

    private _onReorderStart() {
        // The row of a pending drop is still out of place, the snapshot from before that drop stays
        if (this._pendingReorders > 0)
            return;

        // Each row is rendered right after its own marker, the rows go back there once the reordered items arrive
        this._rowsBeforeDragEnd = Array.from(this.$.grid.querySelectorAll<QueryGridRow>("vi-query-grid-row")).map(row => [row, row.previousSibling]);
    }

    private async _onReorderEnd(e: CustomEvent) {
        const details: ISortableDragEndDetails = e.detail;

        if (details.newIndex == null)
            return;

        if (details.newIndex === details.oldIndex)
            return;

        this._pendingReorders++;
        try {
            await this.query.reorder(
                (details.element.previousElementSibling as QueryGridRow)?.item as Vidyano.QueryResultItem ?? null,
                (details.element as QueryGridRow).item as Vidyano.QueryResultItem,
                (details.element.nextElementSibling as QueryGridRow)?.item as Vidyano.QueryResultItem ?? null);
        }
        finally {
            this._rowsBeforeDragEnd.forEach(([row, marker]) => marker.parentNode.insertBefore(row, marker.nextSibling));

            // The items observer runs on the next update
            await this.updateComplete;
            this._pendingReorders--;
        }
    }

    @listener("query-grid-column:update")
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

    @listener("query-grid-column:configure")
    private async _onConfigure() {
        if (await this.app.showDialog(new QueryGridConfigureDialog(this.query, this.userSettings)))
            this._onColumnUpdate();
    }

    private _reset() {
        this._updateUserSettings(this.query);
        this._update(this.verticalScrollOffset, this.virtualRowCount, this.rowHeight, this.items, this.skip, this.maxRows);
    }

    @observer("visibleColumnHeaderSize", "horizontalScrollOffset", { allowUndefined: true })
    private _updateMore(visibleColumnHeaderSize: ISize, horizontalScrollOffset: number) {
        if (visibleColumnHeaderSize == null || horizontalScrollOffset == null)
            return;

        this._updateMoreDebouncer.run(() => {
            const headers = Array.from(this.shadowRoot.querySelectorAll("header [grid] > vi-query-grid-column-header")) as QueryGridColumnHeader[];
            const unpinnedHeaders = headers.filter(h => !h.column.isPinned);

            // The pinned headers stay in view and cover the headers scrolled behind them
            const pinnedWidth = headers.filter(h => h.column.isPinned).reduce((width, h) => width + h.offsetWidth, 0);

            this.moreColumns = {
                left: unpinnedHeaders.filter(h => h.offsetLeft - horizontalScrollOffset < pinnedWidth).sort((a, b) => a.column.label.localeCompare(b.column.label)),
                right: unpinnedHeaders.filter(h => (h.offsetLeft + h.offsetWidth / 2) > visibleColumnHeaderSize.width).sort((a, b) => a.column.label.localeCompare(b.column.label))
            };
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

customElements.define("vi-query-grid", QueryGrid);
