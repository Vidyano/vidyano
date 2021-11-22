import * as Vidyano from "../../libs/vidyano/vidyano.js"
import * as Polymer from "../../libs/@polymer/polymer.js"
import "@polymer/iron-list"
import "./cell-templates/query-grid-cell-default.js"
import "./query-grid-cell-presenter.js"
import "./query-grid-column-measure.js"
import "./query-grid-column-header.js"
import "./query-grid-row.js"
import "../scroller/scroller.js"
import { Icon } from "../icon/icon.js"
import { QueryGridColumn } from "./query-grid-column.js"
import { QueryGridUserSettings } from "./query-grid-user-settings.js"
import { QueryGridRow } from "./query-grid-row.js"
import { WebComponent, WebComponentListener } from "../web-component/web-component.js"

const placeholder = {};

interface QueryGridItems {
    forceUpdate?: boolean;
    groups?: Vidyano.QueryResultItemGroup[];
    length: number;
}

type QueryGridItem = Vidyano.QueryResultItem | Vidyano.QueryResultItemGroup;

Icon.Add
`<vi-icon name="QueryGrid_Group">
    <svg viewBox="0 0 32 32">
        <g>
            <path d="M 2 8 L 2 14 L 22 14 L 22 8 L 2 8 z M 10 18 L 10 24 L 30 24 L 30 18 L 10 18 z " />
        </g>
    </svg>
</vi-icon>`;

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
            computed: "_computeColumns(userSettings.columns)"
        },
        pinnedColumns: {
            type: Array,
            readOnly: true
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
        userSettings: {
            type: Object,
            computed: "_computeUserSettings(query)"
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
        "query.lastUpdated",
        "_updatePinnedColumns(columns.*.isPinned)"
    ],
    listeners: {
        "column-width-changed": "_columnWidthChanged",
        "item-select": "_itemSelect",
        "query-grid-column:update": "_onColumnUpdate"
    },
    observers: [
        "_update(verticalScrollOffset, virtualRowCount, rowHeight, items)",
        "_updateVerticalSpacer(viewportHeight, rowHeight, items)"
    ]
})
export class QueryGrid extends WebComponentListener(WebComponent) {
    static get template() { return Polymer.html`<link rel="import" href="query-grid.html">` }

    private readonly _columnWidths = new Map<QueryGridColumn, number[]>();
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
    readonly columns: QueryGridColumn[];
    readonly pinnedColumns: QueryGridColumn[]; private _setPinnedColumns: (pinnedColumns: QueryGridColumn[]) => void;
    readonly columnWidths: number[]; private _setColumnWidths: (columnsWidths: number[]) => void;
    readonly viewportHeight: number;
    readonly virtualRowCount: number;
    readonly hasGrouping: boolean; private _setHasGrouping: (hasGrouping: boolean) => void;
    readonly userSettings: QueryGridUserSettings;
    rowHeight: number;
    horizontalScrollOffset: number;

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

        const entries: [column: QueryGridColumn, width: number][] = e.detail;
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

        // Remove previously added columns which are no longer relevant
        Array.from(this._columnWidths).filter(cw => this.columns.indexOf(cw[0]) < 0).forEach(c => this._columnWidths.delete(c[0]));

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
            header > [grid] > *:nth-child(-n+${pinnedColumns.length}), vi-query-grid-row > .column:nth-child(-n+${pinnedColumns.length}) {
                will-change: transform;
                transform: translateX(var(--vi-query-grid-horizontal));
                z-index: 1;
            }

            vi-query-grid-row > .column:nth-child(${pinnedColumns.length}) {
                border-right: 1px solid var(--theme-light-border);
            }
        `;
    }

    private _computeUserSettings(query: Vidyano.Query) {
        return QueryGridUserSettings.Load(query);
    }

    private _computeColumns(columns: QueryGridColumn[]) {
        columns = columns.orderBy(c => c.offset).filter(c => !c.isHidden);
        Polymer.Async.microTask.run(() => {
            this.style.setProperty("--vi-query-grid-columns", `repeat(${columns.length}, max-content)`);
        });

        return columns;
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

    private async _onColumnUpdate() {
        this.horizontalScrollOffset = 0;
        await this.userSettings.save();
    }
}