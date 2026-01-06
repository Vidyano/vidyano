import { html, unsafeCSS, PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import * as Vidyano from "vidyano";
import { AppServiceHooksBase } from "components/app-service-hooks/app-service-hooks-base";
import { PersistentObjectAttributeConfig } from "components/app/config/persistent-object-attribute-config";
import { PersistentObjectAttributePresenter } from "components/persistent-object-attribute-presenter/persistent-object-attribute-presenter";
import { ISize } from "components/size-tracker/size-tracker";
import "components/size-tracker/size-tracker";
import { listener, observer, WebComponent } from "components/web-component/web-component";
import styles from "./persistent-object-group.css";

interface IPersistentObjectGroupItem {
    attribute: Vidyano.PersistentObjectAttribute;
    config: PersistentObjectAttributeConfig;
    presenter?: PersistentObjectAttributePresenter;
    area: string;
    x: number;
    width: number;
    height: number;
}

export class PersistentObjectGroup extends WebComponent {
    static styles = unsafeCSS(styles);

    private _asyncHandles: number[] = [];
    private _items: IPersistentObjectGroupItem[] = [];
    private _itemsChecksum: string;
    private _presentersLoading: number = 0;
    private _customLabel: string;
    private _computedLabel: string = "";
    private _computedColumns: number;
    private _customColumns: number | undefined;
    private _width: number;

    @property({ type: Object })
    group: Vidyano.PersistentObjectAttributeGroup;

    @property({ type: Number })
    groupIndex: number = 0;

    @property({ type: Number })
    get columns(): number {
        if (this._customColumns !== undefined && this._customColumns > 0)
            return this._customColumns;

        return this._computedColumns;
    }
    set columns(value: number | undefined) {
        const old = this.columns;
        this._customColumns = value;
        this.requestUpdate("columns", old);
    }

    @property({ type: String })
    get label(): string {
        return this._customLabel ?? this._computedLabel;
    }
    set label(value: string) {
        this._customLabel = value;
        this.requestUpdate("label");
    }

    @state()
    loading: boolean = true;

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
        super.attributeChangedCallback(name, oldValue, newValue);

        if (name === "columns") {
            const value = parseInt(newValue, 10);
            this._customColumns = !isNaN(value) && value > 0 ? value : undefined;
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._asyncHandles.forEach(h => cancelAnimationFrame(h));
        this._asyncHandles = [];
    }

    private _updateColumns(e: CustomEvent<ISize>) {
        const newWidth = e.detail.width;
        if (this._width === newWidth)
            return;

        this._width = newWidth;

        const styles = getComputedStyle(this);
        const breakpoint4 = parseInt(styles.getPropertyValue("--vi-persistent-object-group-columns-4-min-width")) || 1_500;
        const breakpoint3 = parseInt(styles.getPropertyValue("--vi-persistent-object-group-columns-3-min-width")) || 1_000;
        const breakpoint2 = parseInt(styles.getPropertyValue("--vi-persistent-object-group-columns-2-min-width")) || 500;

        const oldColumns = this.columns;

        if (this._width >= breakpoint4)
            this._computedColumns = 4;
        else if (this._width > breakpoint3)
            this._computedColumns = 3;
        else if (this._width > breakpoint2)
            this._computedColumns = 2;
        else
            this._computedColumns = 1;

        if (oldColumns !== this.columns)
            this.requestUpdate("columns", oldColumns);
    }

    @observer("group", "groupIndex")
    private _computeLabel() {
        const group = this.group;
        const groupIndex = this.groupIndex;

        let label = "";
        if (group) {
            if (group.label && groupIndex === 0) {
                const firstAttribute = group.attributes[0];
                if (!(firstAttribute && firstAttribute.tab.label === group.label))
                    label = group.label;
            }
            else if (!group.label && groupIndex > 0)
                label = this.translations["DefaultAttributesGroup"];
            else
                label = group.label;
        }

        if (this._computedLabel !== label) {
            this._computedLabel = label;
            if (this._customLabel === undefined)
                this.requestUpdate("label");
        }
    }

    @observer("group.attributes.*.isVisible", "columns", "isConnected")
    private _arrange() {
        if (!this.isConnected)
            return;

        const attributes = this.group?.attributes.filter(a => a.isVisible) || [];
        if (!attributes.length) {
            this._items = [];
            this.style.removeProperty("--vi-persistent-object-group--grid-areas");
            return;
        }

        // 1. Sync Items
        const oldItems = this._items ? this._items.slice() : [];
        this._items = attributes.map(attr => {
            let item = oldItems.find(i => i.attribute === attr);
            if (item) {
                item.x = item.attribute.column;
                item.width = Math.min(this.columns, Math.max(item.attribute.columnSpan, 1));
            }
            else {
                item = this._itemFromAttribute(attr);
            }
            return item;
        });

        // 2. Checksum Optimization
        let itemsChecksum: string = `${this.group.parent.type};${this.group.parent.objectId};${this.columns}`;
        const itemsSorted = this._items.slice().sort((a, b) => a.attribute.offset - b.attribute.offset);
        itemsSorted.forEach(item => itemsChecksum = `${itemsChecksum}${item.attribute.offset};${item.attribute.name};${item.height};${item.width};`);

        if (this._itemsChecksum === itemsChecksum)
            return;

        // 3. Calculate Layout
        const layout = this._calculateLayout(itemsSorted, this.columns);
        
        // 4. Apply Grid Definition
        this.style.setProperty("--vi-persistent-object-group--grid-areas", layout.gridAreas);

        // 5. Sync Light DOM Children
        const renderHandle = requestAnimationFrame(() => {
            if (this._itemsChecksum !== itemsChecksum) return;

            const currentAttributes = new Set(this._items.map(i => i.attribute));
            Array.from(this.children).forEach(child => {
                if (child instanceof PersistentObjectAttributePresenter && !currentAttributes.has(child.attribute)) {
                    this.removeChild(child);
                }
            });

            this._items.forEach(item => {
                if (!item.presenter) {
                    item.presenter = this.createPersistentObjectAttributePresenter(item.attribute);
                }

                if (item.presenter.parentElement !== this) {
                    this.appendChild(item.presenter);
                }

                const area = layout.itemAreas.get(item);
                if (area) {
                    item.presenter.style.setProperty("--vi-persistent-object-group--attribute-area", area);
                }
            });
        });

        this._asyncHandles.push(renderHandle);
        this._itemsChecksum = itemsChecksum;
    }

    private _calculateLayout(items: IPersistentObjectGroupItem[], columns: number) {
        const grid: string[][] = [];
        const itemAreas = new Map<IPersistentObjectGroupItem, string>();
        let infiniteColumns: { [col: number]: string } = {};
        const queue = items.slice();
        
        let currentRow = 0;
        let currentCol = 0;

        while (queue.length > 0) {
            const item = queue.shift();
            if (!item) break;

            const itemHeight = Math.max(item.height, 1);
            let itemX: number | null = item.x < columns ? item.x : null;
            let itemWidth = itemX == null 
                ? Math.min(item.width, columns) 
                : Math.min(item.width, columns - itemX);

            let placed = false;
            while (!placed) {
                this._ensureGridRows(grid, currentRow + itemHeight, columns, infiniteColumns);

                const infiniteCount = Object.keys(infiniteColumns).length;
                if (infiniteCount > 0 && infiniteCount + itemWidth > columns) {
                    infiniteColumns = {};
                }

                if (itemX != null && infiniteColumns[itemX]) {
                     infiniteColumns = {};
                     currentRow++;
                     currentCol = 0;
                     continue;
                }
                
                if (itemX != null) {
                    if (itemX < currentCol) {
                        currentRow++;
                        currentCol = 0;
                        continue;
                    }
                    currentCol = itemX;
                }

                let overlaps = false;
                if (currentCol + itemWidth > columns) {
                    overlaps = true;
                } else {
                    for (let r = 0; r < itemHeight; r++) {
                        for (let c = 0; c < itemWidth; c++) {
                            if (grid[currentRow + r][currentCol + c]) {
                                overlaps = true;
                                break;
                            }
                        }
                        if (overlaps) break;
                    }
                }

                if (!overlaps) {
                    itemAreas.set(item, item.area);

                    for (let r = 0; r < itemHeight; r++) {
                        for (let c = 0; c < itemWidth; c++) {
                             grid[currentRow + r][currentCol + c] = item.area;
                        }
                    }
                    
                    if (item.height === 0 && itemWidth !== columns) {
                        for (let c = 0; c < itemWidth; c++) {
                            infiniteColumns[currentCol + c] = item.area;
                        }
                        for (let r = itemHeight; r < grid.length - currentRow; r++) { 
                             for (let c = 0; c < itemWidth; c++) {
                                 grid[currentRow + r][currentCol + c] = item.area;
                             }
                        }
                    }

                    currentCol += itemWidth;
                    if (currentCol >= columns) {
                        currentRow++;
                        currentCol = 0;
                    }
                    placed = true;
                } else {
                    if (itemX != null) {
                        currentRow++;
                        currentCol = 0;
                    } else {
                        currentCol++;
                        if (currentCol + itemWidth > columns) {
                            currentRow++;
                            currentCol = 0;
                        }
                    }
                }
            }
        }
        
        const infiniteKeys = Object.keys(infiniteColumns).map(Number);
        if (infiniteKeys.length > 0) {
             const newRow = new Array(columns).fill("");
             for (const c of infiniteKeys) {
                 newRow[c] = infiniteColumns[c];
             }
             grid.push(newRow);
        }
        
        const gridAreas = grid.map(row => 
            `"${row.map(cell => cell || ".").join(" ")}"`
        ).join(" ");

        return { gridAreas, itemAreas };
    }

    private _ensureGridRows(grid: string[][], neededRows: number, columns: number, infiniteColumns: { [col: number]: string }) {
        while (grid.length < neededRows) {
            const newRow = new Array(columns).fill("");
            for(let c in infiniteColumns) {
                newRow[c] = infiniteColumns[c];
            }
            grid.push(newRow);
        }
    }

    private _itemFromAttribute(attribute: Vidyano.PersistentObjectAttribute): IPersistentObjectGroupItem {
        const config = this.app.configuration.getAttributeConfig(attribute);
        const hooks = <AppServiceHooksBase>this.app.service.hooks;
        const height = hooks.calculateAttributeHeight?.(attribute) ?? 1;
        const width = hooks.calculateAttributeWidth?.(attribute) ?? Math.max(attribute.columnSpan, 1);
        
        let area = attribute.name.replace(/[^a-zA-Z0-9]/g, "_");
        if (/^[0-9]/.test(area))
            area = `_${area}`;

        const item: IPersistentObjectGroupItem = {
            attribute: attribute,
            config: config,
            area: area,
            x: attribute.column,
            width: Math.min(this.columns, width),
            height: height > 10 ? 1 : height
        };

        return item;
    }

    @listener("attribute-loading")
    private _onAttributeLoading(e: CustomEvent) {
        if (!this.loading) {
            this._presentersLoading = 0;
            this.loading = true;
        }
        else
            this._presentersLoading++;
    }

    @listener("attribute-loaded")
    private _onAttributeLoaded(e: CustomEvent) {
        if (--this._presentersLoading <= 0)
            this.loading = false;
    }

    protected createPersistentObjectAttributePresenter(attribute: Vidyano.PersistentObjectAttribute) {
        return new PersistentObjectAttributePresenter(attribute);
    }

    protected renderLabel() {
        return html`<label>${this.label}</label>`;
    }

    render() {
        return html`
            <vi-size-tracker @sizechanged=${this._updateColumns} trigger-zero></vi-size-tracker>
            ${this.renderLabel()}
            <div id="grid">
                <slot></slot>
            </div>
        `;
    }
}

customElements.define("vi-persistent-object-group", PersistentObjectGroup);
