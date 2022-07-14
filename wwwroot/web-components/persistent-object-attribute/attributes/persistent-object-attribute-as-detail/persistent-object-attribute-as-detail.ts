import * as Polymer from "../../../../libs/polymer/polymer.js"
import * as Vidyano from "../../../../libs/vidyano/vidyano.js"
import { Scroller } from "../../../scroller/scroller.js"
import { SelectReferenceDialog } from "../../../select-reference-dialog/select-reference-dialog.js"
import "./persistent-object-attribute-as-detail-row.js"
import { WebComponent } from "../../../web-component/web-component.js"
import { PersistentObjectAttribute } from "../../persistent-object-attribute.js"
import { PersistentObjectDialog } from "../../../persistent-object-dialog/persistent-object-dialog.js"

@WebComponent.register({
    properties: {
        columns: {
            type: Array,
            computed: "_computeColumns(attribute.details.columns)"
        },
        newAction: {
            type: Object,
            readOnly: true
        },
        newActionPinned: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeNewActionPinned(size.height, newAction)"
        },
        deleteAction: {
            type: Boolean,
            readOnly: true
        },
        size: {
            type: Object,
            notify: true
        },
        canDelete: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeCanDelete(editing, deleteAction, attribute.objects, attribute)"
        },
        initializing: {
            type: Boolean,
            reflectToAttribute: true,
            value: true,
            readOnly: true
        },
        activeObject: {
            type: Object,
            value: null
        },
        isAdding: {
            type: Boolean,
            readOnly: true
        },
        forceFullEdit: {
            type: Boolean,
            value: false
        }
    },
    observers: [
        "_updateWidths(columns, canDelete, isConnected)",
        "_updateActions(attribute.details.actions, editing, readOnly, attribute)"
    ],
    forwardObservers: [
        "attribute.objects.*.isDeleted"
    ]
})
export class PersistentObjectAttributeAsDetail extends PersistentObjectAttribute {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-as-detail.html">`; }

    private _inlineAddHeight: number;
    readonly initializing: boolean; private _setInitializing: (init: boolean) => void;
    readonly newAction: Vidyano.Action; private _setNewAction: (action: Vidyano.Action) => void;
    readonly deleteAction: boolean; private _setDeleteAction: (action: boolean) => void;
    readonly isAdding: boolean; private _setIsAdding: (isAdding: boolean) => void;
    attribute: Vidyano.PersistentObjectAttributeAsDetail;
    newActionPinned: boolean;

    private _isColumnVisible(column: Vidyano.QueryColumn) {
        return !column.isHidden && column.width !== "0";
    }

    private _computeColumns(columns: Vidyano.QueryColumn[]): Vidyano.QueryColumn[] {
        return columns.filter(c => !c.isHidden);
    }

    private _computeCanDelete(editing: boolean, deleteAction: boolean, objects: Vidyano.PersistentObject[], attribute: Vidyano.PersistentObjectAttributeAsDetail): boolean {
        return editing && deleteAction && (attribute.parent.isNew || (!!objects && objects.some(o => !o.isDeleted)));
    }

    private _computeNewActionPinned(height: number, newAction: Vidyano.Action): boolean {
        if (!height || !newAction)
            return false;

        const scroller = <Scroller>this.$.body;
        if (!this._inlineAddHeight) {
            const inlineAdd = <HTMLElement>scroller.querySelector(".row.add.inline");
            if (!inlineAdd)
                return false;

            this._inlineAddHeight = inlineAdd.offsetHeight;
        }

        const contentHeight = this.newActionPinned ? height : height - this._inlineAddHeight;
        return contentHeight + this._inlineAddHeight > this.$.table.offsetHeight - this.$.head.offsetHeight;
    }

    private _updateActions(actions: Vidyano.Action[], editing: boolean, readOnly: boolean, attribute: Vidyano.PersistentObjectAttributeAsDetail) {
        this._setNewAction(editing && !readOnly ? actions["New"] || null : null);
        this._setDeleteAction(editing && !readOnly && (attribute.parent.isNew || !!actions["Delete"]));
    }

    private _updateWidths(columns: Vidyano.QueryColumn[], canDelete: boolean, isConnected: boolean) {
        if (!isConnected || !columns?.length)
            return;

        let remainingFraction = 100;
        const widths = columns.filter(c => c.width !== "0").map(c => {
            if (c.width?.endsWith("%")) {
                const width = parseInt(c.width);
                remainingFraction -= width;

                return `${width}fr`;
            }
            
            const width = parseInt(c.width);
            if (!isNaN(width) && width)
                return `${width}px`;

            return null;
        });

        const remainingWidths = widths.filter(w => w === null);
        if (remainingWidths.length > 0) {
            const remainingWidth = `${remainingFraction / remainingWidths.length}fr`;
            widths.forEach((w, i) => {
                if (w)
                    return;
                
                widths[i] = remainingWidth;
            });
        }

        if (canDelete)
            widths.push("min-content");

        this.style.setProperty("--column-widths", widths.join(" "));

        this._setInitializing(false);
    }

    private async _add(e: Polymer.Gestures.TapEvent) {
        try {
            this._setIsAdding(true);
            const po = await this.attribute.newObject();
            if (!po)
                return;

            if (po.stateBehavior.indexOf("OpenAsDialog") < 0) {
                if (this.attribute.lookupAttribute && po.attributes[this.attribute.lookupAttribute]) {
                    const lookupAttribute = <Vidyano.PersistentObjectAttributeWithReference>po.attributes[this.attribute.lookupAttribute];
                    lookupAttribute.lookup.search();

                    lookupAttribute.lookup.maxSelectedItems = 0;
                    const items = <Vidyano.QueryResultItem[]>await this.app.showDialog(new SelectReferenceDialog(lookupAttribute.lookup));
                    if (items && items.length > 0) {
                        const objects = [po];

                        let item = items.shift();
                        await lookupAttribute.changeReference([item]);
                        do {
                            if (!(item = items.shift()))
                                break;

                            const po2 = await this.attribute.newObject();
                            await (<Vidyano.PersistentObjectAttributeWithReference>po2.getAttribute(this.attribute.lookupAttribute)).changeReference([item]);
                            objects.push(po2);
                        }
                        while (items.length > 0);

                        await this._finalizeAdd(...objects);
                    }
                }
                else
                    await this._finalizeAdd(po);
            }
            else {
                this.app.showDialog(new PersistentObjectDialog(po, {
                    saveLabel: po.service.actionDefinitions["AddReference"].displayName,
                    save: (po, close) => {
                        this._finalizeAdd(po);
                        close();
                    }
                }));
            }
        }
        catch (e) {
            this.attribute.parent.setNotification(e);
        }
        finally {
            this._setIsAdding(false);
        }
    }

    private async _finalizeAdd(...objects: Vidyano.PersistentObject[]) {
        objects.forEach(po => {
            po.parent = this.attribute.parent;
            this.push("attribute.objects", po);
        });
        this.set("activeObject", objects[objects.length - 1]);

        Polymer.flush();
        Polymer.Async.microTask.run(() => (<Scroller>this.$.body).verticalScrollOffset = (<Scroller>this.$.body).innerHeight);

        this.attribute.isValueChanged = true;
        this.attribute.parent.triggerDirty();

        if (this.attribute.triggersRefresh)
            await this.attribute._triggerAttributeRefresh(true);
    }

    private _setActiveObject(e: Polymer.Gestures.TapEvent) {
        if (!this.readOnly)
            this.set("activeObject", e.model.obj);

        e.stopPropagation();
    }

    private _isRowFullEdit(forceFullEdit: boolean, activeObject: Vidyano.PersistentObject, obj: Vidyano.PersistentObject) {
        return forceFullEdit || activeObject === obj;
    }

    private _titleMouseenter(e: MouseEvent) {
        const label = <HTMLLabelElement>e.target;
        label.setAttribute("title", label.textContent);
    }
}

PersistentObjectAttribute.registerAttributeType("AsDetail", PersistentObjectAttributeAsDetail);