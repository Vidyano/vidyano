import * as Vidyano from "vidyano"
import * as Polymer from "polymer"
import { Dialog } from "components/dialog/dialog.js"
import "components/notification/notification.js"
import "components/persistent-object-tab-presenter/persistent-object-tab-presenter.js"
import "./query-grid-filter-dialog-name.js"
import { WebComponent } from "components/web-component/web-component.js"

@WebComponent.register({
    properties: {
        persistentObject: {
            type: Object,
            readOnly: true
        }
    },
    forwardObservers: [
        "persistentObject.isBusy"
    ]
})
export class QueryGridFilterDialog extends Dialog {
    static get template() { return Dialog.dialogTemplate(Polymer.html`<link rel="import" href="query-grid-filter-dialog.html">`) }

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