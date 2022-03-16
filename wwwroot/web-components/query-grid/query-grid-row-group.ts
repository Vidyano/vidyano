import * as Vidyano from "../../libs/vidyano/vidyano.js"
import * as Polymer from "../../libs/polymer/polymer.js"
import { Icon } from "../icon/icon.js"
import { WebComponent } from "../web-component/web-component.js"

@WebComponent.register({
    properties: {
        group: Object,
        first: {
            type: Boolean,
            computed: "_computeFirst(group)"
        },
        collapsed: {
            type: Boolean,
            computed: "group.isCollapsed",
            reflectToAttribute: true
        }
    },
    forwardObservers: [
        "group.isCollapsed"
    ],
    listeners: {
        "tap": "_tap"
    }
})
export class QueryGridRowGroup extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="query-grid-row-group.html">` }

    group: Vidyano.QueryResultItemGroup;

    private _computeFirst(group: Vidyano.QueryResultItemGroup) {
        return !!group && group.start === 0;
    }

    private _tap() {
        this.group.isCollapsed = !this.group.isCollapsed;
    }
}

Icon.Add `<vi-icon name="QueryGrid_Group_Row">
    <svg viewBox="0 0 32 32">
        <g>
            <path d="M 24 8 L 8 24 L 24 24 L 24 8 z "></path>
        </g>
    </svg>
</vi-icon>`;