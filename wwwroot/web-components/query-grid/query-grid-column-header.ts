import * as Vidyano from "../../libs/vidyano/vidyano.js"
import * as Polymer from "../../libs/@polymer/polymer.js"
import "../popup-menu/popup-menu.js"
import { WebComponent, WebComponentListener } from "../web-component/web-component.js"

interface IResizeObserver {
    observe: (target: HTMLElement) => void;
    unobserve: (target: HTMLElement) => void;
}

declare class ResizeObserver implements IResizeObserver {
    constructor(observer: (entries: { target: HTMLElement; contentRect: ClientRect }[]) => void);
    observe: (target: HTMLElement, options?: { box : "border-box" | "content-box" }) => void;
    unobserve: (target: HTMLElement) => void;
}

let resizeObserver: ResizeObserver;
resizeObserver = new ResizeObserver(entries => {
    entries[0].target.parentElement.dispatchEvent(new CustomEvent("column-width-changed", {
        detail: entries.map(e => {
            let width = e["borderBoxSize"] != null ? e["borderBoxSize"][0].inlineSize : e.target.offsetWidth;
            return [(<QueryGridColumnHeader>e.target).column, width];
        }),
        bubbles: true,
        cancelable: true,
        composed: true
    }));
});

@WebComponent.register({
    properties: {
        column: Object,
        sortingIcon: {
            type: String,
            computed: "_computeSortingIcon(column.sortDirection)"
        }
    },
    forwardObservers: [
        "column.sortDirection"
    ],
    listeners: {
        
    }
})
export class QueryGridColumnHeader extends WebComponentListener(WebComponent) {
    static get template() { return Polymer.html`<link rel="import" href="query-grid-column-header.html">` }

    column: Vidyano.QueryColumn;

    connectedCallback() {
        super.connectedCallback();

        resizeObserver.observe(this, { box: "border-box" });
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        resizeObserver.unobserve(this);
    }

    private _computeSortingIcon(direction: Vidyano.SortDirection) {
        return direction === "ASC" ? "SortAsc" : (direction === "DESC" ? "SortDesc" : null);
    }
}