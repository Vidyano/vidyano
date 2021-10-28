import * as Vidyano from "../../libs/vidyano/vidyano.js"
import * as Polymer from "../../libs/@polymer/polymer.js"
import { Icon } from "../icon/icon.js";
import { WebComponent, WebComponentListener } from "../web-component/web-component.js"

@WebComponent.register({
    properties: {
        group: Object,
        first: {
            type: Boolean,
            computed: "_computeFirst(group)"
        },
        collapsed: {
            type: Boolean,
            computed: "group.isCollapsed"
        }
    },
    listeners: {
        "tap": "_tap"
    }
})
export class QueryGridRowGroup extends WebComponentListener(WebComponent) {
    static get template() { return Polymer.html`<link rel="import" href="query-grid-row-group.html">` }

    group: Vidyano.QueryResultItemGroup;

    private _computeFirst(group: Vidyano.QueryResultItemGroup) {
        return !!group && group.start === 0;
    }

    private _tap() {
        this.group.isCollapsed = !this.group.isCollapsed;
    }
}

Icon.Add(Polymer.html`<link rel="import" href="query-grid-row-group-icons.html">`);