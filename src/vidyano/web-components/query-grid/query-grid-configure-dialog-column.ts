import * as Polymer from "polymer"
import { QueryGridColumn } from "./query-grid-column"

@Polymer.WebComponent.register({
    properties: {
        column: Object,
        isPinned: {
            type: Boolean,
            reflectToAttribute: true
        },
        isHidden: {
            type: Boolean,
            reflectToAttribute: true
        }
    }
}, "vi-query-grid-configure-dialog-column")
export class QueryGridConfigureDialogColumn extends Polymer.WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="query-grid-configure-dialog-column.html">`; }

    offset: number;
    isPinned: boolean;
    isHidden: boolean;

    constructor(public column: QueryGridColumn) {
        super();

        // Column can be null when sorting since the sorting component clones the element.
        if (!column)
            return;

        this.offset = this.column.offset;
        this.isPinned = this.column.isPinned;
        this.isHidden = this.column.isHidden;
    }

    private _togglePin() {
        this.isPinned = !this.isPinned;

        this.dispatchEvent(new CustomEvent("distribute-columns", {
            bubbles: true,
            composed: true
        }));
    }

    private _toggleVisible() {
        this.isHidden = !this.isHidden;
    }
}
