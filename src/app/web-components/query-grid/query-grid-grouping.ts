import * as Vidyano from "vidyano"
import * as Polymer from "polymer"
import "components/ponents/popup-menu/popup-menu.js"
import { PopupMenuItem } from "components/popup-menu/popup-menu-item.js"
import { WebComponent } from "components/web-component/web-component.js"

@WebComponent.register({
    properties: {
        query: Object
    }
})
export class QueryGridGrouping extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="query-grid-grouping.html">` }

    query: Vidyano.Query;

    private _toggleCollapse(e: Polymer.Gestures.TapEvent) {
        const collapse = (<PopupMenuItem>e.currentTarget).icon === "QueryGrid_Group_Collapse";
        this.query.groupingInfo.groups.forEach(g => g.isCollapsed = collapse);

        this.fire("scroll-top");
    }

    private _remove() {
        this.query.group("");
    }
}