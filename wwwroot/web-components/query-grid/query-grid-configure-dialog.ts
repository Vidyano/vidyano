import * as Polymer from "../../libs/@polymer/polymer.js"
import * as Vidyano from "../../libs/vidyano/vidyano.js"
import { Dialog } from "../dialog/dialog.js"
import { QueryGridConfigureDialogColumn } from "./query-grid-configure-dialog-column.js"
import { QueryGridUserSettings } from "./query-grid-user-settings.js"
import { Sortable } from "../sortable/sortable.js"
import { WebComponent } from "../web-component/web-component.js"

@WebComponent.register({
    properties: {
        query: Object
    },
    listeners: {
        "distribute-columns": "_distributeColumns",
        "reorder-columns": "_reorderColumns"
    }
})
export class QueryGridConfigureDialog extends Dialog {
    static get template() { return Dialog.dialogTemplate(Polymer.html`<link rel="import" href="query-grid-configure-dialog.html">`); }
    private _elements: QueryGridConfigureDialogColumn[];

    constructor(public query: Vidyano.Query, private _settings: QueryGridUserSettings) {
        super();
    }

    connectedCallback() {
        this._elements = this._settings.columns.filter(c => c.width !== "0").map(c => new QueryGridConfigureDialogColumn(c));
        this._distributeColumns();

        super.connectedCallback();
    }

    private _distributeColumns(e?: CustomEvent) {
        const columns = this._elements.orderBy(c => c.column.offset);

        Polymer.Async.animationFrame.run(() => {
            this._updateColumns(this.$.pinned, columns.filter(c => c.isPinned));
            this._updateColumns(this.$.unpinned, columns.filter(c => !c.isPinned));
        });

        e?.stopPropagation();
    }

    private _updateColumns(target: HTMLElement, columns: QueryGridConfigureDialogColumn[]) {
        columns.orderBy(c => c.offset).forEach(col => target.appendChild(col));
    }

    private _reorderColumns(e: CustomEvent) {
        const list = e.composedPath()[0] as QueryGridConfigureDialogColumnList;
        const children = <QueryGridConfigureDialogColumn[]>Array.from(list.children);
        const offsets = children.orderBy(c => c.column.offset).map(c => c.column.offset);

        children.forEach((child: QueryGridConfigureDialogColumn, index: number) => {
            child.offset = offsets[index];
        });

        e.stopPropagation();
    }

    private _save() {
        this._elements.forEach(c => {
            c.column.isPinned = c.isPinned;
            c.column.isHidden = c.isHidden;
            c.column.offset = c.offset;

            if (c.calculatedWidth !== c.column.calculatedWidth) {
                c.column.calculatedWidth = c.calculatedWidth;
                c.column.width = c.column.column.width;
            }
        });

        this.close(true);
    }

    private _reset() {
        this._elements.forEach(c => {
            c.isPinned = c.column.column.isPinned;
            c.isHidden = c.column.column.isHidden;
            c.offset = c.column.column.offset;
            c.calculatedWidth = undefined;
        });

        this._distributeColumns();
    }
}

@WebComponent.register({
})
export class QueryGridConfigureDialogColumnList extends Sortable {
    protected _dragEnd() {
        this.fire("reorder-columns", {}, { bubbles: true });
    }
}