import * as Polymer from "../../../../libs/polymer/polymer.js"
import * as Vidyano from "../../../../libs/vidyano/vidyano.js"
import { PersistentObjectAttributePresenter } from "../../../persistent-object-attribute-presenter/persistent-object-attribute-presenter.js"
import { WebComponent } from "../../../web-component/web-component.js"

@WebComponent.register({
    properties: {
        serviceObject: Object,
        columns: Array,
        editing: Boolean,
        canDelete: Boolean,
        frozen: {
            type: Boolean,
            reflectToAttribute: true
        },
        fullEdit: {
            type: Boolean,
            value: false,
            reflectToAttribute: true
        },
        softEdit: {
            type: Boolean,
            computed: "_computeSoftEdit(serviceObject)",
            value: false
        },
        isSensitive: {
            type: Boolean,
            computed: "_computeIsSensitive(column, isAppSensitive)"
        }
    },
    forwardObservers: [
        "serviceObject.lastUpdated"
    ],
    listeners: {
        "attribute-loading": "_onAttributeLoading",
        "attribute-loaded": "_onAttributeLoaded",
    },
    sensitive: true
})
export class PersistentObjectAttributeAsDetailRow extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-as-detail-row.html">`; }

    private fullEdit: boolean;
    serviceObject: Vidyano.PersistentObject;

    private _isColumnVisible(column: Vidyano.QueryColumn) {
        return !column.isHidden && column.width !== "0";
    }

    private _attributeForColumn(obj: Vidyano.PersistentObject, column: Vidyano.QueryColumn): Vidyano.PersistentObjectAttribute {
        return obj.attributes[column.name];
    }

    private _displayValue(obj: Vidyano.PersistentObject, column: Vidyano.QueryColumn): string {
        const attr = this._attributeForColumn(obj, column);
        return attr && attr.displayValue || "";
    }

    private _computeSoftEdit(serviceObject: Vidyano.PersistentObject): boolean {
        return serviceObject && serviceObject.ownerDetailAttribute.objects[0] === serviceObject;
    }

    private _isSoftEditOnly(fullEdit: boolean, softEdit: boolean): boolean {
        return !fullEdit && softEdit;
    }

    private _computeIsSensitive(column: Vidyano.QueryColumn, isAppSensitive: boolean): boolean {
        return column.isSensitive && isAppSensitive;
    }

    private _setFullEdit(e: Polymer.Gestures.TapEvent) {
        this.fire("full-edit", null);
        Polymer.flush();

        const attribute = this._attributeForColumn(this.serviceObject, e.model.column);
        const presenters = Array.from(this.shadowRoot.querySelectorAll("vi-persistent-object-attribute-presenter"));
        const presenter = <PersistentObjectAttributePresenter>presenters.find(p => (<PersistentObjectAttributePresenter>p).attribute === attribute);
        if (!presenter)
            return;

        presenter.queueFocus();
    }

    private _delete() {
        if (this.serviceObject.isReadOnly)
            return;

        // Let the parent handle the delete
        this.dispatchEvent(new CustomEvent("delete", { detail: this.serviceObject }));
    }

    private _onAttributeLoading(e: CustomEvent) {
        e.stopPropagation();
    }

    private _onAttributeLoaded(e: CustomEvent) {
        e.stopPropagation();
    }
}