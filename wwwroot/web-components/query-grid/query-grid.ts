import * as Vidyano from "../../libs/vidyano/vidyano.js"
import * as Polymer from "../../libs/@polymer/polymer.js"
import "@polymer/iron-list"
import "./cell-templates/query-grid-cell-default.js"
import "./query-grid-cell-presenter.js"
import "./query-grid-column-measure.js"
import "./query-grid-column-header.js"
import "./query-grid-row.js"
import "../scroller/scroller.js"
import { WebComponent, WebComponentListener } from "../web-component/web-component.js"
import { QueryGridRow } from "./query-grid-row.js"

const placeholder = {};

interface QueryGridItems {
    forceUpdate?: boolean;
    groups?: Vidyano.QueryResultItemGroup[];
    length: number;
}

type QueryGridItem = Vidyano.QueryResultItem | Vidyano.QueryResultItemGroup;

@WebComponent.register({
    properties: {
        initializing: {
            type: Boolean,
            readOnly: true,
            value: true,
            reflectToAttribute: true
        },
        updating: {
            type: Boolean,
            readOnly: true
        },
        query: {
            type: Object
        },
        items: {
            type: Array,
            computed: "_computeItems(query.lastUpdated)"
        },
        columns: {
            type: Array,
            computed: "_computeColumns(query.columns)"
        },
        pinnedColumns: {
            type: Array,
            computed: "_computePinnedColumns(columns)",
            observer: "_pinnedColumnsChanged"
        },
        columnWidths: {
            type: Array,
            readOnly: true,
            observer: "_columnWidthsChanged"
        },
        horizontalScrollOffset: {
            type: Number,
            observer: "_updateHorizontalScrollOffset"
        },
        rowHeight: {
            type: Number,
            observer: "_rowHeightChanged"
        },
        verticalScrollOffset: Number,
        viewportHeight: {
            type: Number,
            value: 0
        },
        viewportWidth: Number,
        virtualRowCount: {
            type: Number,
            computed: "_computeVirtualRowCount(viewportHeight, rowHeight)",
            value: 0
        },
        virtualItems: {
            type: Array,
            readOnly: true
        },
        hasGrouping: {
            type: Boolean,
            readOnly: true
        }
    },
    forwardObservers: [
        "query.columns",
        "query.isBusy",
        "query.lastUpdated"
    ],
    listeners: {
        "column-width-changed": "_columnWidthChanged",
        "item-select": "_itemSelect"
    },
    observers: [
        "_update(verticalScrollOffset, virtualRowCount, rowHeight, items)",
        "_updateVerticalSpacer(viewportHeight, rowHeight, items)"
    ]
})
export class QueryGrid extends WebComponentListener(WebComponent) {
    static get template() { return Polymer.html`<link rel="import" href="query-grid.html">` }

    private readonly _columnWidths = new Map<Vidyano.QueryColumn, number[]>();
    private readonly items: QueryGridItems;
    private _virtualGridStartIndex: number = 0;
    private _verticalSpacerCorrection: number = 1;
    private _getItemsDebouncer: Polymer.Debounce.Debouncer;
    private _updateCellDebouncer: Polymer.Debounce.Debouncer;
    private _pinnedStyle: HTMLStyleElement;
    private _lastSelectedItemIndex: number;

    query: Vidyano.Query;
    readonly initializing: boolean; private _setInitializing: (initializing: boolean) => void;
    readonly updating: boolean; private _setUpdating: (updating: boolean) => void;
    readonly virtualItems: QueryGridItem[]; private _setVirtualItems: (virtualItems: QueryGridItem[]) => void;
    readonly columns: Vidyano.QueryColumn[];
    readonly columnWidths: number[]; private _setColumnWidths: (columnsWidths: number[]) => void;
    readonly viewportHeight: number;
    readonly virtualRowCount: number;
    readonly hasGrouping: boolean; private _setHasGrouping: (hasGrouping: boolean) => void;
    rowHeight: number;

    ready() {
        super.ready();

        requestAnimationFrame(() => this.rowHeight = parseInt(window.getComputedStyle(this).getPropertyValue("--vi-query-grid-row-height")) || 32);
    }

    private _columnWidthsChanged(columnWidths: number[]) {
        this.style.setProperty("--vi-query-grid-columns", `${columnWidths.map(width => `${width}px`).join(" ")} minmax(0, 1fr)`);
    }

    private _columnWidthChanged(e: CustomEvent) {
        e.stopPropagation();

        if (!this.initializing)
            return;

        const entries: [column: Vidyano.QueryColumn, width: number][] = e.detail;
        entries.forEach(entry => {
            const currentWidth = this._columnWidths.get(entry[0]);
            if (!currentWidth) {
                this._columnWidths.set(entry[0], [entry[1]]);
                return;
            }
            else
                currentWidth.push(entry[1]);
        });

        if (this._columnWidths.size < this.columns.length)
            return;

        const widths = Array.from(this._columnWidths.values());
        if (widths.some(w => w.length < 2))
            return;

        this._setColumnWidths(this.columns.map(c => Math.ceil(this._columnWidths.get(c).max(e => e))));
        this._setInitializing(false);
    }

    private _update(verticalScrollOffset: number, virtualRowCount: number, rowHeight: number, items: QueryGridItems) {
        if (!virtualRowCount)
            return;

        verticalScrollOffset *= this._verticalSpacerCorrection;
        const viewportStartRowIndex = Math.floor(verticalScrollOffset / rowHeight);
        const viewportEndRowIndex = Math.ceil((verticalScrollOffset + this.viewportHeight) / rowHeight);

        if (!this.virtualItems || this.virtualItems.length !== virtualRowCount) {
            this._setVirtualItems(new Array(virtualRowCount));
            items.forceUpdate = true;
        }
        
        let newVirtualGridStartIndex: number = 0;
        if (viewportEndRowIndex - this._virtualGridStartIndex > virtualRowCount)
            newVirtualGridStartIndex = viewportStartRowIndex;
        else if (viewportStartRowIndex < this._virtualGridStartIndex)
            newVirtualGridStartIndex = viewportEndRowIndex - virtualRowCount;
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

        this._setUpdating(true);

        for (let virtualIndex=0; virtualIndex < this.virtualRowCount; virtualIndex++) {
            const index = newVirtualGridStartIndex + virtualIndex;

            const [item, realIndex] = this._getItem(index);
            this.virtualItems[virtualIndex] = item;

            if (this.virtualItems[virtualIndex] === undefined) {
                if (realIndex < this.query.totalItems) {
                    this.virtualItems[virtualIndex] = <any>placeholder;

                    this._getItemsDebouncer = Polymer.Debounce.Debouncer.debounce(
                        this._getItemsDebouncer,
                        Polymer.Async.timeOut.after(20),
                        () => {
                            this.query.queueWork(async () => {
                                if (this._virtualGridStartIndex !== newVirtualGridStartIndex || this.virtualItems[virtualIndex] == null)
                                    return;
        
                                return this.query.getItems(realIndex, Math.max(this.query.pageSize, virtualRowCount), true);
                            }, false);
                        }
                    );
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

                this.$.grid.style.transform = `translateY(${newVirtualGridStartIndex * rowHeight}px)`;

                if (this.initializing) {
                    // Ensure items are bound
                    Polymer.flush();

                    const firstItemRow = (<QueryGridRow[]>Array.from(this.$.grid.querySelectorAll("vi-query-grid-row"))).find(r => r.item instanceof Vidyano.QueryResultItem);
                    if (firstItemRow != null)
                        firstItemRow.measure();
                }

                this._setUpdating(false);
            }
        );
    }

    private _computeItems(): QueryGridItems {
        let length: number;
        let groups: Vidyano.QueryResultItemGroup[];

        this._setHasGrouping(!!this.query.groupingInfo && !!this.query.groupingInfo.groups);

        if (!this.hasGrouping)
            length = this.query.totalItems;
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

    private _getItem(index: number): [QueryGridItem, number] {
        if (!this.hasGrouping)
            return [this.query.items[index], index];

        if (index >= this.items.length)
            return [null, -1];

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

    private _updateVerticalSpacer(viewportHeight: number, rowHeight: number, items: QueryGridItem[]) {
        Polymer.Render.beforeNextRender(this, () => {
            const newHeight = items.length * rowHeight;
            this.$.gridWrapper.style.height = `${newHeight}px`;

            this._verticalSpacerCorrection = (newHeight - this.viewportHeight) / (this.$.gridWrapper.clientHeight - viewportHeight);
        });
    }

    private _computeColumns(columns: Vidyano.QueryColumn[]) {
        columns = columns.orderBy(c => c.offset).filter(c => !c.isHidden);
        Polymer.Async.microTask.run(() => {
            this.style.setProperty("--vi-query-grid-columns", `repeat(${columns.length}, max-content)`);
        });

        return columns;
    }

    private _computePinnedColumns(columns: Vidyano.QueryColumn[]) {
        return columns.filter(c => c.isPinned);
    }

    private _pinnedColumnsChanged(columns: Vidyano.QueryColumn[]) {
        if (!columns.length) {
            if (this._pinnedStyle != null) {
                this.shadowRoot.removeChild(this._pinnedStyle);
                this._pinnedStyle = null;
            }

            return;
        }

        if (this._pinnedStyle == null)
            this.shadowRoot.appendChild(this._pinnedStyle = document.createElement("style"));
            
        this._pinnedStyle.innerHTML = `
            header > [grid] > *:nth-child(-n+${columns.length}), vi-query-grid-row > .column:nth-child(-n+${columns.length}) {
                will-change: transform;
                transform: translateX(var(--vi-query-grid-horizontal));
                z-index: 1;
            }

            vi-query-grid-row > .column:nth-child(${columns.length}) {
                border-right: 1px solid var(--theme-light-border);
            }
        `;
    }

    private _computeVirtualRowCount(viewportHeight: number, rowHeight: number) {
        if (!viewportHeight)
            return 0;

        return Math.ceil(Math.max(Math.ceil(viewportHeight / rowHeight) * 1.5, this.virtualRowCount || 0));
    }

    private _computeOffsets(columnWidths: number[]) {
        let offset = 0;
        return columnWidths.map(width => {
            return [offset, offset += width];
        });
    }

    private _computeVisibleRange(viewportWidth: number, horizontalScrollOffset: number) {
        return [horizontalScrollOffset, viewportWidth + horizontalScrollOffset];
    }

    private _rowHeightChanged(rowHeight: number) {
        this.style.setProperty("--vi-query-grid-row-height", `${rowHeight}px`);
    }

    private _updateHorizontalScrollOffset(horizontalScrollOffset: number) {
        this.style.setProperty("--vi-query-grid-horizontal", `${horizontalScrollOffset}px`);
    }

    private _itemSelect(e: CustomEvent) {
        const detail: { item: Vidyano.QueryResultItem; shift: boolean; ctrl: boolean; } = e.detail;

        const indexOfItem = this.query.items.indexOf(detail.item);
        if (!detail.item.isSelected && this._lastSelectedItemIndex >= 0 && detail.shift) {
            if (this.query.selectRange(Math.min(this._lastSelectedItemIndex, indexOfItem), Math.max(this._lastSelectedItemIndex, indexOfItem))) {
                this._lastSelectedItemIndex = indexOfItem;
                return;
            }
        }

        if (!detail.ctrl) {
            if (this.query.selectAll.isAvailable && this.query.selectAll)
                this.query.selectAll.allSelected = this.query.selectAll.inverse = false;

            this.query.selectedItems = this.query.selectedItems.length > 1 || !detail.item.isSelected ? [detail.item] : [];
        }
        else
            detail.item.isSelected = !detail.item.isSelected;

        if (detail.item.isSelected)
            this._lastSelectedItemIndex = indexOfItem;
    }
}