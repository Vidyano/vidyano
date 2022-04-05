import * as Vidyano from "../../libs/vidyano/vidyano.js"
import * as Polymer from "../../libs/polymer/polymer.js"
import "../popup-menu/popup-menu.js"
import { PopupMenuItem } from "../popup-menu/popup-menu-item.js"
import { WebComponent } from "../web-component/web-component.js"

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
    }

    private _remove() {
        this.query.group("");
    }
}