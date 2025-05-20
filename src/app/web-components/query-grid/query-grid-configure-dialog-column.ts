import * as Polymer from "polymer"
import { QueryGridColumn } from "./query-grid-column.js"
import { WebComponent } from "components/web-component/web-component.js"

@WebComponent.register({
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
})
export class QueryGridConfigureDialogColumn extends WebComponent {
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

        this.fire("distribute-columns", {}, { bubbles: true });
    }

    private _toggleVisible() {
        this.isHidden = !this.isHidden;
    }
}