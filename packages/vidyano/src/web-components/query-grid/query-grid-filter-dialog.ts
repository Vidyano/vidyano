import * as Polymer from "polymer"
import * as Vidyano from "@vidyano/core"
import "components/notification/notification"
import { PersistentObjectAttributePresenter } from "components/persistent-object-attribute-presenter/persistent-object-attribute-presenter"
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute"
import { QueryGridFilterDialogName } from "./query-grid-filter-dialog-name"

/**
 * Presents the filter name attribute with the group/name editor instead of the default string editor.
 */
export class QueryGridFilterDialogNamePresenter extends PersistentObjectAttributePresenter {
    protected createAttributeElement(): PersistentObjectAttribute {
        return <PersistentObjectAttribute><unknown>new QueryGridFilterDialogName();
    }
}

customElements.define("vi-query-grid-filter-dialog-name-presenter", QueryGridFilterDialogNamePresenter);

@Polymer.WebComponent.register({
    properties: {
        persistentObject: {
            type: Object,
            readOnly: true
        }
    },
    forwardObservers: [
        "persistentObject.isBusy"
    ]
}, "vi-query-grid-filter-dialog")
export class QueryGridFilterDialog extends Polymer.Dialog {
    static get template() { return Polymer.Dialog.dialogTemplate(Polymer.html`<link rel="import" href="query-grid-filter-dialog.html">`) }

    readonly persistentObject: Vidyano.PersistentObject; private _setPersistentObject: (persistentObject: Vidyano.PersistentObject) => void;

    constructor(private _filters: Vidyano.QueryFilters, private _filter: Vidyano.QueryFilter) {
        super();

        this._setPersistentObject(_filter.persistentObject);
        this.persistentObject.beginEdit();
    }

    private async _save() {
        const isNew = this.persistentObject.isNew;
        if (await this._filters.save(this._filter)) {
            super.close();
            return;
        }

        this._setPersistentObject(this._filter.persistentObject);
    }

    close(result?: any) {
        this._filter.persistentObject.cancelEdit();
        super.close();
    }
}
