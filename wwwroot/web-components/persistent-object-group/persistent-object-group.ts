import * as Polymer from "../../libs/polymer/polymer.js"
import * as Vidyano from "../../libs/vidyano/vidyano.js"
import { PersistentObjectAttributeConfig } from "../app/config/persistent-object-attribute-config.js"
import { PersistentObjectAttributePresenter } from "../persistent-object-attribute-presenter/persistent-object-attribute-presenter.js"
import { WebComponent } from "../web-component/web-component.js"

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

@WebComponent.register({
    properties: {
        group: Object,
        groupIndex: {
            type: Number,
            value: 0
        },
        columns: {
            type: Number,
            value: 1
        },
        label: {
            type: String,
            computed: "_computeLabel(group, groupIndex, translations)"
        },
        noLabel: {
            type: Boolean,
            reflectToAttribute: true
        },
        loading: {
            type: Boolean,
            reflectToAttribute: true,
            readOnly: true,
            value: true
        }
    },
    observers: [
        "_arrange(group.attributes, columns, isConnected)"
    ],
    listeners: {
        "attribute-loading": "_onAttributeLoading",
        "attribute-loaded": "_onAttributeLoaded"
    },
    forwardObservers: [
        "group.attributes",
        "_onAttributeVisibilityChanged(group.attributes.*.isVisible)"
    ]
})
export class PersistentObjectGroup extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-group.html">`; }

    private _asyncHandles: number[] = [];
    private _items: IPersistentObjectGroupItem[];
    private _itemsChecksum: string;
    private _presentersLoading: number = 0;
    readonly loading: boolean; private _setLoading: (loading: boolean) => void;
    group: Vidyano.PersistentObjectAttributeGroup;
    columns: number;

    private _computeLabel(group: Vidyano.PersistentObjectAttributeGroup, groupIndex: number, translations: any): string {
        if (group.label && groupIndex === 0) {
            const firstAttribute = group.attributes[0];
            if (firstAttribute && firstAttribute.tab.label === group.label)
                return "";
        }
        else if (!group.label && groupIndex > 0)
            return this.translations["DefaultAttributesGroup"];

        return group.label;
    }

    private _arrange(attributes: Vidyano.PersistentObjectAttribute[], columns: number, isConnected: boolean) {
        attributes = attributes.filter(a => a.isVisible);
        if (!isConnected || !columns || !attributes?.length)
            return;

        let oldItems: IPersistentObjectGroupItem[] = [];
        if (!this._items)
            this._items = attributes.map(attr => this._itemFromAttribute(attr));
        else {
            oldItems = this._items.slice();
            this._items = attributes.map(attr => {
                let item = oldItems.find(i => i.attribute === attr);
                if (item) {
                    item.x = item.attribute.column;
                    item.width = Math.min(columns, item.config.calculateWidth(item.attribute));

                    oldItems.splice(oldItems.indexOf(item), 1);
                }
                else
                    item = this._itemFromAttribute(attr);

                return item;
            });
        }

        let itemsChecksum: string = `${this.group.parent.type};${this.group.parent.objectId};${columns}`;
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
            let itemX = item.x < columns ? item.x : null;
            const itemWidth = itemX == null ? Math.min(item.width, columns) : Math.min(item.width, columns - itemX);
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
                while (itemX < columns - itemWidth);
            }

            do {
                if (areas.length < row + itemHeight) {
                    const newRow = Array.range(1, columns).map(_ => "");
                    areas.push(newRow);
                    column = 0;

                    let added = 0;
                    for (let x in infiniteColumns) {
                        newRow[x] = infiniteColumns[x];
                        added++;
                    }

                    if (added + itemWidth > columns)
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
                if (column >= columns || column + itemWidth - 1 >= columns) {
                    row++;
                    column = itemX || 0;
                }
            }
            while (true);

            if (item.height === 0 && itemWidth !== columns) {
                for (let x = 0; x < itemWidth; x++)
                    infiniteColumns[column + x] = item.area;
            }

            for (let x = 0; x < itemWidth; x++) {
                for (let y = 0; y < (item.height !== 0 ? itemHeight : areas.length - row); y++)
                    areas[row + y][column + x] = item.area;
            }

            if (!item.presenter)
                item.presenter = this.onCreatePersistentObjectAttributePresenter(item.attribute);

            const renderItem = item;
            const renderHandle = Polymer.Async.animationFrame.run(() => {
                if (this._itemsChecksum !== itemsChecksum)
                    return;

                if (!renderItem.presenter.isConnected || renderItem.presenter.parentElement !== this)
                    this.appendChild(renderItem.presenter);

                renderItem.presenter.updateStyles({
                    "--vi-persistent-object-group--attribute-area": renderItem.area
                });
            });
            this._asyncHandles.push(renderHandle);

            item = items.shift();
        }

        let newRow: string[];
        for (let x in infiniteColumns) {
            if (!newRow) {
                newRow = Array.range(1, columns).map(_ => "");
                areas.push(newRow);
            }

            newRow[x] = infiniteColumns[x];
        }

        this.updateStyles({
            "--vi-persistent-object-group--grid-areas": areas.map(r => `"${r.map(a => a || ".").join(" ")}"`).join(" ")
        });

        this._itemsChecksum = itemsChecksum;
    }

    private _itemFromAttribute(attribute: Vidyano.PersistentObjectAttribute): IPersistentObjectGroupItem {
        const config = this.app.configuration.getAttributeConfig(attribute);
        const item = {
            attribute: attribute,
            config: config,
            area: attribute.name,
            x: attribute.column,
            width: Math.min(this.columns, config.calculateWidth(attribute)),
            height: config.calculateHeight(attribute)
        };

        item.area = item.area.split("").map(c => c.charCodeAt(0) > 255 || (c >= "0" && c <= "9") || (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") ? c : "_").join("");
        if (/[0-9]/.test(item.area[0]))
            item.area = `_${item.area}`;

        if (item.height > 10)
            item.height = 1;

        return item;
    }

    private _onAttributeLoading(e: CustomEvent) {
        if (!this.loading) {
            this._presentersLoading = 0;
            this._setLoading(true);
        }
        else
            this._presentersLoading++;
    }

    private _onAttributeLoaded(e: CustomEvent) {
        if (--this._presentersLoading <= 0)
            this._setLoading(false);
    }

    private _onAttributeVisibilityChanged(info: string) {
        if (!info)
            return;

        this._arrange(this.group.attributes, this.columns, this.isConnected);
    }

    protected onCreatePersistentObjectAttributePresenter(attribute: Vidyano.PersistentObjectAttribute) {
        const presenter = new PersistentObjectAttributePresenter();
        presenter.attribute = attribute;
        
        return presenter;
    }
}