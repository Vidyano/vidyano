import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
import { Path } from "libs/pathjs/pathjs.js"
import { App } from "components/app/app.js"
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute.js"
import { SelectReferenceDialog } from "components/select-reference-dialog/select-reference-dialog.js"
import { WebComponent } from "components/web-component/web-component.js"
import type { Select } from "components/select/select.js"
import "components/select/select.js"

@WebComponent.register({
    properties: {
        href: String,
        canClear: {
            type: Boolean,
            readOnly: true
        },
        canAddNewReference: {
            type: Boolean,
            readOnly: true
        },
        canBrowseReference: {
            type: Boolean,
            readOnly: true
        },
        filter: {
            type: String,
            notify: true
        },
        inputtype: {
            type: String,
            computed: "_computeInputType(attribute)"
        },
        objectId: {
            type: String,
            observer: "_objectIdChanged"
        },
        selectInPlace: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "attribute.selectInPlace"
        },
        canOpenSelect: {
            type: Boolean,
            computed: "_computeCanOpenSelect(readOnly, options)"
        },
        orientation: {
            type: String,
            computed: "_computeOrientation(attribute)"
        },
        target: {
            type: String,
            computed: "_computeTarget(attribute, href)"
        },
        title: {
            type: String,
            computed: "_computeTitle(attribute.displayValue, sensitive)"
        }
    },
    observers: [
        "_update(attribute.isReadOnly, sensitive, isConnected)"
    ]
})
export class PersistentObjectAttributeReference extends PersistentObjectAttribute {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-reference.html">`; }

    readonly canClear: boolean; private _setCanClear: (val: boolean) => void;
    readonly canAddNewReference: boolean; private _setCanAddNewReference: (val: boolean) => void;
    readonly canBrowseReference: boolean; private _setCanBrowseReference: (val: boolean) => void;
    objectId: string;
    attribute: Vidyano.PersistentObjectAttributeWithReference;
    href: string;
    filter: string;

    connectedCallback() {
        super.connectedCallback();
        this._update();
    }

    protected _attributeChanged() {
        super._attributeChanged();

        this._update();
    }

    protected _valueChanged(newValue: any) {
        this._update();

        if (this.attribute && newValue !== this.attribute.value) {
            this.attribute.setValue(newValue, true).catch(Vidyano.noop);
        }
    }

    private _objectIdChanged() {
        if (this.attribute && this.attribute.objectId !== this.objectId)
            this.attribute.changeReference(this.objectId ? [this.objectId] : []);
    }

    private async _filterBlur() {
        if (!this.attribute)
            return;

        if (!String.isNullOrEmpty(this.filter) && this.filter !== this.attribute.value) {
            this.attribute.lookup.textSearch = "vi-breadcrumb:\"" + this.filter + "\"";
            const result = await this.attribute.lookup.search();
            this.attribute.lookup.textSearch = null;

            if (!result)
                return;

            if (result.length === 1) {
                await this.attribute.changeReference([result[0]]);
                this._update();
            }
            else {
                if (result.length === 0) {
                    this.filter = this.attribute.value;
                    this.attribute.lookup.textSearch = "";
                }
                else
                    this.attribute.lookup.textSearch = this.filter;

                await this._browseReference(true, true);
            }
        }
        else
            this.filter = this.attribute.value;
    }

    protected _editingChanged() {
        this._update();
    }

    private _browse(e: Polymer.Gestures.TapEvent) {
        this.attribute.lookup.textSearch = "";
        this._browseReference(false, true);
    }

    private async _browseReference(throwExceptions?: boolean, forceSearch?: boolean): Promise<any> {
        this.attribute.lookup.selectedItems = [];

        try {
            const result = await this.app.showDialog(new SelectReferenceDialog(this.attribute.lookup, forceSearch, this.canAddNewReference));
            if (!result)
                return;

            if (result instanceof Array && result.length > 0 && result[0] instanceof Vidyano.QueryResultItem) {
                await this.attribute.changeReference(result);
                this._update();
            }

            if (result === "AddNewReference")
                this._addNewReference();
        }
        finally {
            this.filter = this.attribute.value;
        }
    }

    private _addNewReference(e?: Event) {
        this.attribute.addNewReference();
    }

    private async _clearReference(e: Event) {
        await this.attribute.changeReference([]);
        this._update();
    }

    private _update() {
        if (!this.isConnected)
            return;

        const hasReference = this.attribute instanceof Vidyano.PersistentObjectAttributeWithReference;

        if (hasReference && this.attribute.objectId !== this.objectId)
            this.objectId = this.attribute ? this.attribute.objectId : null;

        if (this.app instanceof App && hasReference && this.attribute.lookup && this.attribute.lookup.canRead && this.attribute.objectId && this.app)
            this.href = Path.routes.rootPath + this.app.getUrlForPersistentObject(this.attribute.lookup.persistentObject.id, this.attribute.objectId);
        else
            this.href = null;

        this.filter = hasReference ? this.attribute.value : "";

        this._setCanClear(hasReference && this.attribute.parent.isEditing && !this.attribute.isReadOnly && !this.sensitive && !this.attribute.isRequired && !String.isNullOrEmpty(this.attribute.objectId));
        this._setCanAddNewReference(hasReference && this.attribute.parent.isEditing && !this.attribute.isReadOnly && !this.sensitive && this.attribute.canAddNewReference);
        this._setCanBrowseReference(hasReference && this.attribute.parent.isEditing && !this.attribute.isReadOnly && !this.sensitive && !this.attribute.selectInPlace);
    }

    private _openSelect() {
        const selectInPlace = <Select>this.shadowRoot.querySelector("#selectInPlace");
        selectInPlace.open();
    }

    private async _open(e: Event) {
        if (!(this.app instanceof App) || this.attribute.parent.isNew || !this.attribute.lookup.canRead)
            return;

        e.preventDefault();

        try {
            const po = await this.attribute.getPersistentObject();
            if (po)
                this.attribute.service.hooks.onOpen(po, false);
        }
        catch (e) {
            this.attribute.parent.setNotification(e, "Error");
        }
    }

    private _computeTarget(attribute: Vidyano.PersistentObjectAttribute, href: string): string {
        return attribute && href && attribute.parent.isNew ? "_blank" : "";
    }

    private _computeInputType(attribute: Vidyano.PersistentObjectAttributeWithReference): string {
        return attribute && attribute.getTypeHint("inputtype", "default", undefined, true);
    }

    private _computeOrientation(attribute: Vidyano.PersistentObjectAttributeWithReference): string {
        return attribute && attribute.getTypeHint("orientation", "vertical", undefined, true);
    }

    private _computeCanOpenSelect(isReadOnly: boolean, options: string[]): boolean {
        return !isReadOnly && !!options && options.length > 0;
    }

    private _computeTitle(displayValue: string, sensitive: boolean): string {
        return !sensitive ? displayValue : "";
    }

    private _select(e: CustomEvent) {
        e.stopPropagation();

        this.objectId = (<any>e).model.option.key;
    }
}

PersistentObjectAttribute.registerAttributeType("Reference", PersistentObjectAttributeReference);