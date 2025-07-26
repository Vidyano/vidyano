import * as Vidyano from "vidyano"
import * as Polymer from "polymer"
import { WebComponent } from "components/web-component/web-component"

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
}, "vi-query-grid-row-group")
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