import "@polymer/iron-list"
import { IronListElement } from "@polymer/iron-list"
import * as Polymer from "polymer"
import { Scroller } from "components/scroller/scroller.js"
import { WebComponent } from "components/web-component/web-component.js"

@WebComponent.register({
    properties: {
        items: Array,
        as: String,
        parentScroller: {
            type: Boolean,
            reflectToAttribute: true,
            value: false
        }
    },
    observers: [
        "_hookIronListToScroller(parentScroller, isConnected)"
    ]
})
export class List extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="list.html">` }

    items: any[];
    as: string;
    parentScroller: boolean;

    private _hookIronListToScroller(parentScroller: boolean, isConnected: boolean) {
        if (!isConnected)
            return;

        Polymer.flush();
        Polymer.Async.microTask.run(() => {
            if (parentScroller !== this.parentScroller || !this.isConnected)
                return;

            const list = this.shadowRoot.querySelector("#list") as IronListElement;
            const scroller = <any>this.findParent(e => e instanceof Scroller, list) as Scroller;
            list.scrollTarget = scroller.scroller;

            this._sizeChanged();
        });
    }

    private _bindIronListDataHost() {
        // Workaround for making sure events are delegated to the correct host
        const list = this.shadowRoot.querySelector("#list");
        if (list["dataHost"] && list["dataHost"]["_rootDataHost"] === this) {
            const dataHostParent = this.findParent(e => e["dataHost"]);
            if (dataHostParent)
                list["dataHost"] = dataHostParent["dataHost"];
        }
    }

    private _sizeChanged() {
        this.shadowRoot.querySelector("#list").dispatchEvent(new CustomEvent("iron-resize"));
    }
}