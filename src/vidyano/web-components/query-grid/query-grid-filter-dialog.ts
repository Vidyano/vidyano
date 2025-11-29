import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
import "components/notification/notification"
import "./query-grid-filter-dialog-name"

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
