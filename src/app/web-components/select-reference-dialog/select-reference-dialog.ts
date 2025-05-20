import * as Vidyano from "vidyano"
import * as Polymer from "polymer"
import { Dialog } from "components/dialog/dialog.js"
import { IItemTapEventArgs } from "components/query-grid/query-grid-row.js"
import "components/notification/notification.js"
import { WebComponent } from "components/web-component/web-component.js"

@WebComponent.register({
    properties: {
        query: Object,
        canSelect: Boolean,
        canAddNewReference: Boolean,
        initializing: {
            type: Boolean,
            observer: "_initializingChanged"
        }
    },
    forwardObservers: [
        "_selectedItemsChanged(query.selectedItems)"
    ]
})
export class SelectReferenceDialog extends Dialog {
    static get template() { return Dialog.dialogTemplate(Polymer.html`<link rel="import" href="select-reference-dialog.html">`) }

    canSelect: boolean;

    constructor(public query: Vidyano.Query, forceSearch?: boolean, public canAddNewReference: boolean = false, keepFilter?: boolean) {
        super();

        query["_query-grid-vertical-scroll-offset"] = undefined;

        if (keepFilter)
            return;

        if (!query.filters)
            query.resetFilters();

        if (forceSearch || !!query.textSearch || !query.hasSearched)
            query.search();
    }

    private _initializingChanged(value: boolean) {
        if (!value)
            this._focusElement(this.$.search);
    }

    private _selectedItemsChanged() {
        if (!this.isConnected)
            return;

        this.canSelect = this.query && this.query.selectedItems && this.query.selectedItems.length > 0;
    }

    private _invalidateCanSelect(selectedItems: Vidyano.QueryResultItem[] = (this.query ? this.query.selectedItems : undefined)) {
        this.canSelect = selectedItems && selectedItems.length > 0;
    }

    private _queryPropertyChanged(sender: Vidyano.Query, detail: Vidyano.PropertyChangedArgs) {
        if (detail.propertyName === "selectedItems")
            this._invalidateCanSelect(detail.newValue);
    }

    private _select() {
        if (!this.canSelect)
            return;

        this.close(this.query.selectedItems);
    }

    private _addNew() {
        this.close("AddNewReference");
    }

    private _search(e: CustomEvent, detail: string) {
        if (!this.query)
            return;

        this.query.textSearch = detail;
        this.query.search();
    }

    private _selectReference(e: CustomEvent) {
        e.preventDefault();

        const detail = <IItemTapEventArgs>e.detail;
        if (this.query.maxSelectedItems === 1)
            this.close([detail.item]);
        else
            detail.item.isSelected = !detail.item.isSelected;
    }
}