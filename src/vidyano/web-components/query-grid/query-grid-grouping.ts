import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
import "components/popup-menu/popup-menu"
import { PopupMenuItem } from "components/popup-menu/popup-menu-item"

@Polymer.WebComponent.register({
    properties: {
        query: Object
    }
}, "vi-query-grid-grouping")
export class QueryGridGrouping extends Polymer.WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="query-grid-grouping.html">` }

    query: Vidyano.Query;

    private _toggleCollapse(e: Polymer.Gestures.TapEvent) {
        const collapse = (<PopupMenuItem>e.currentTarget).icon === "QueryGrid_Group_Collapse";
        this.query.groupingInfo.groups.forEach(g => g.isCollapsed = collapse);

        this.dispatchEvent(new CustomEvent("scroll-top", {
            bubbles: true,
            composed: true
        }));
    }

    private _remove() {
        this.query.group("");
    }
}
