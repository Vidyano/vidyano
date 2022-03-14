import * as Vidyano from "../../libs/vidyano/vidyano"
import * as Polymer from "../../libs/polymer/polymer"
import { Icon } from "../icon/icon"
import "../popup-menu/popup-menu"
import { PopupMenuItem } from "../popup-menu/popup-menu-item"
import { WebComponent } from "../web-component/web-component"

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

Icon.Add
`<vi-icon name="QueryGrid_Group">
    <svg viewBox="0 0 32 32">
        <g>
            <path d="M 2 8 L 2 14 L 22 14 L 22 8 L 2 8 z M 10 18 L 10 24 L 30 24 L 30 18 L 10 18 z " />
        </g>
    </svg>
</vi-icon>`;

Icon.Add
`<vi-icon name="QueryGrid_Group_Collapse">
    <svg viewBox="0 0 32 32">
        <g>
            <path d="M 10,3 H 22 L 16,9 Z" />
            <path d="m 6,11.666666 h 20 v 3 H 6 Z" />
            <path d="m 6,17.333333 h 20 v 3 H 6 Z" />
            <path d="m 16,23 -6,6 h 12 z" />
        </g>
    </svg>
</vi-icon>`;

Icon.Add
`<vi-icon name="QueryGrid_Group_Expand">
    <svg viewBox="0 0 32 32">
        <g>
            <path d="M 10,9 H 22 L 16,3 Z" />
            <path d="m 6,11.666666 h 20 v 3 H 6 Z" />
            <path d="m 6,17.333333 h 20 v 3 H 6 Z" />
            <path d="M 16,29 10,23 H 22 Z" />
        </g>
    </svg>
</vi-icon>`;