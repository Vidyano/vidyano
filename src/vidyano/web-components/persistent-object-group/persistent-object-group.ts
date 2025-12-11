import { html, unsafeCSS } from "lit";
import { property, state } from "lit/decorators.js";
import * as Vidyano from "vidyano";
import { AppServiceHooksBase } from "components/app-service-hooks/app-service-hooks-base";
import { PersistentObjectAttributeConfig } from "components/app/config/persistent-object-attribute-config";
import { PersistentObjectAttributePresenter } from "components/persistent-object-attribute-presenter/persistent-object-attribute-presenter";
import { listener, observer, WebComponent } from "components/web-component/web-component";
import styles from "./persistent-object-group.css";

interface IPersistentObjectGroupItem {
    attribute: Vidyano.PersistentObjectAttribute;
    config: PersistentObjectAttributeConfig;
    presenter?: PersistentObjectAttributePresenter;
    area?: string;
    x: number;
    width: number;
    height: number;
}

interface IPersistentObjectGroupRow {
    host: HTMLTableRowElement;
    cells: HTMLTableCellElement[];
}

export class PersistentObjectGroup extends WebComponent {
    static styles = unsafeCSS(styles);

    private _asyncHandles: number[] = [];
    private _items: IPersistentObjectGroupItem[];
    private _itemsChecksum: string;
    private _presentersLoading: number = 0;
    private _customLabel: string;
    private _computedLabel: string = "";

    @property({ type: Object })
    group: Vidyano.PersistentObjectAttributeGroup;

    @property({ type: Number })
    groupIndex: number = 0;

    @property({ type: Number })
    columns: number;

    @property({ type: String })
    get label(): string {
        return this._customLabel ?? this._computedLabel;
    }
    set label(value: string) {
        this._customLabel = value;
        this.requestUpdate("label");
    }

    // Uses @observer instead of @computed to allow custom label override via setter
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

    @state()
    loading: boolean = true;

    @observer("group.attributes", "columns", "isConnected")
    private _arrange() {
        if (!this.isConnected)
            return;

        const attributes = this.group?.attributes.filter(a => a.isVisible) || [];
        if (!attributes.length)
            return;

        if (this.columns === undefined) {
            // Default to 1 column - triggers _arrange again with all properties settled.
            // Parent bindings have had time to set columns; if still undefined, assume single column.
            this.columns = 1;
            return;
        }

        let oldItems: IPersistentObjectGroupItem[] = [];
        if (!this._items)
            this._items = attributes.map(attr => this._itemFromAttribute(attr));
        else {
            oldItems = this._items.slice();
            this._items = attributes.map(attr => {
                let item = oldItems.find(i => i.attribute === attr);
                if (item) {
                    item.x = item.attribute.column;
                    item.width = Math.min(this.columns, Math.max(item.attribute.columnSpan, 1));

                    oldItems.splice(oldItems.indexOf(item), 1);
                }
                else
                    item = this._itemFromAttribute(attr);

                return item;
            });
        }

        let itemsChecksum: string = `${this.group.parent.type};${this.group.parent.objectId};${this.columns}`;
        const items = this._items.slice().orderBy(item => item.attribute.offset);
        items.forEach(item => itemsChecksum = `${itemsChecksum}${item.attribute.offset};${item.attribute.name};${item.height};${item.width};`);

        if (this._itemsChecksum === itemsChecksum)
            return;

        oldItems.filter(item => item.presenter.isConnected).forEach(item => this.removeChild(item.presenter));

        const areas: string[][] = [];

        let item = items.shift();
        let column = 0, row = 0;
        let infiniteColumns: {
            [index: number]: string;
        } = {};

        while (!!item) {
            const itemHeight = Math.max(item.height, 1);
            let itemX = item.x < this.columns ? item.x : null;
            const itemWidth = itemX == null ? Math.min(item.width, this.columns) : Math.min(item.width, this.columns - itemX);
            if (Object.keys(infiniteColumns).length > 0) {
                do {
                    if (infiniteColumns[itemX]) {
                        if (itemX != null) {
                            infiniteColumns = {};
                            row++;
                            break;
                        }
                        else
                            itemX++;
                    }
                    else {
                        for (let x = 1; x < itemWidth; x++) {
                            if (infiniteColumns[itemX + x]) {
                                infiniteColumns = {};
                                row++;
                                break;
                            }
                        }

                        break;
                    }
                }
                while (itemX < this.columns - itemWidth);
            }

            do {
                if (areas.length < row + itemHeight) {
                    const newRow = Array.range(1, this.columns).map(_ => "");
                    areas.push(newRow);
                    column = 0;

                    let added = 0;
                    for (let x in infiniteColumns) {
                        newRow[x] = infiniteColumns[x];
                        added++;
                    }

                    if (added + itemWidth > this.columns)
                        infiniteColumns = {};

                    continue;
                }

                if (itemX != null) {
                    if (itemX < column) {
                        column = itemX;
                        row++;
                        continue;
                    }
                    else
                        column = itemX;
                }

                if (!Array.range(column, column + itemWidth - 1).some(c => !!areas[row][c]))
                    break;

                column++;
                if (column >= this.columns || column + itemWidth - 1 >= this.columns) {
                    row++;
                    column = itemX || 0;
                }
            }
            while (true);

            if (item.height === 0 && itemWidth !== this.columns) {
                for (let x = 0; x < itemWidth; x++)
                    infiniteColumns[column + x] = item.area;
            }

            for (let x = 0; x < itemWidth; x++) {
                for (let y = 0; y < (item.height !== 0 ? itemHeight : areas.length - row); y++)
                    areas[row + y][column + x] = item.area;
            }

            if (!item.presenter)
                item.presenter = this.createPersistentObjectAttributePresenter(item.attribute);

            const renderItem = item;
            const renderHandle = requestAnimationFrame(() => {
                if (this._itemsChecksum !== itemsChecksum)
                    return;

                if (!renderItem.presenter.isConnected || renderItem.presenter.parentElement !== this)
                    this.appendChild(renderItem.presenter);

                renderItem.presenter.style.setProperty("--vi-persistent-object-group--attribute-area", renderItem.area);
            });
            this._asyncHandles.push(renderHandle);

            item = items.shift();
        }

        let newRow: string[];
        for (let x in infiniteColumns) {
            if (!newRow) {
                newRow = Array.range(1, this.columns).map(_ => "");
                areas.push(newRow);
            }

            newRow[x] = infiniteColumns[x];
        }

        this.style.setProperty("--vi-persistent-object-group--grid-areas", areas.map(r => `"${r.map(a => a || ".").join(" ")}"`).join(" "));

        this._itemsChecksum = itemsChecksum;
    }

    private _itemFromAttribute(attribute: Vidyano.PersistentObjectAttribute): IPersistentObjectGroupItem {
        const config = this.app.configuration.getAttributeConfig(attribute);
        const hooks = <AppServiceHooksBase>this.app.service.hooks;
        const height = hooks.calculateAttributeHeight?.(attribute) ?? 1;
        const width = hooks.calculateAttributeWidth?.(attribute) ?? Math.max(attribute.columnSpan, 1);
        const item = {
            attribute: attribute,
            config: config,
            area: attribute.name,
            x: attribute.column,
            width: Math.min(this.columns, width),
            height: height
        };

        item.area = item.area.split("").map(c => c.charCodeAt(0) > 255 || (c >= "0" && c <= "9") || (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") ? c : "_").join("");
        if (/[0-9]/.test(item.area[0]))
            item.area = `_${item.area}`;

        if (item.height > 10)
            item.height = 1;

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
        const presenter = new PersistentObjectAttributePresenter();
        presenter.attribute = attribute;

        return presenter;
    }

    protected renderLabel() {
        return html`<label>${this.label}</label>`;
    }

    render() {
        return html`
            ${this.renderLabel()}
            <div id="grid">
                <slot></slot>
            </div>
        `;
    }
}

customElements.define("vi-persistent-object-group", PersistentObjectGroup);
