import * as Polymer from "../../libs/polymer/polymer.js"
import * as Vidyano from "../../libs/vidyano/vidyano.js"
import { SidePane } from "../side-pane/side-pane.js"
import { Sortable, ISortableDragEndDetails } from "../sortable/sortable.js"
import { WebComponent } from "../web-component/web-component.js"

@WebComponent.register()
class QueryReorderSortable extends Sortable {
}

@WebComponent.register({
    properties: {
        query: Object,
        displayColumn: {
            type: String,
            computed: "_computeDisplayColumn(query.columns)"
        },
        isSaving: {
            type: Boolean,
            readOnly: true
        }
    },
    forwardObservers: [
        "query.columns"
    ],
    listeners: {
        "drag-end": "_onReorder"
    }
})
export class QueryReorder extends SidePane {
    static get template() { return SidePane.sidePaneTemplate(Polymer.html`<link rel="import" href="query-reorder.html">`); }

    readonly isSaving: boolean; private _setIsSaving: (isSaving: boolean) => void;
    private _operations: { before: Vidyano.QueryResultItem, item: Vidyano.QueryResultItem, after: Vidyano.QueryResultItem}[] = [];

    constructor(public query: Vidyano.Query) {
        super();
    }

    private _onReorder(e: CustomEvent) {
        const details: ISortableDragEndDetails = e.detail;
        
        if (details.newIndex == null)
            return;

        const domRepeat = this.$.itemsDomRepeat as Polymer.DomRepeat;
        const operation = {
            before: domRepeat.modelForElement(details.element.previousElementSibling as HTMLElement)?.["item"] ?? null,
            item: domRepeat.modelForElement(details.element)["item"],
            after: domRepeat.modelForElement(details.element.nextElementSibling as HTMLElement)?.["item"] ?? null,
        };

        this._operations.push(operation);
    }

    async _save() {
        this._setIsSaving(true);

        try {
            do {
                const operation = this._operations[0];
                await this.query.reorder(operation.before, operation.item, operation.after);

                this._operations.shift();
            }
            while (this._operations.length > 0);

            this.query.search();
            this.close();
        }
        finally {
            this._setIsSaving(false);
        }
    }

    private _computeDisplayColumn(columns: Vidyano.QueryColumn[]) {
        return columns.orderBy(c => c.offset)[0].name;
    }

    private _getItemDisplayValue(item: Vidyano.QueryResultItem, displayColumn: string) {
        return item.getValue(displayColumn);
    }
}