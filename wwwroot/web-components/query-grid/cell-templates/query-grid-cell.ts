import * as Vidyano from "../../../libs/vidyano/vidyano.js"
import { WebComponent } from "../../web-component/web-component.js"
import type { QueryGridRow } from "../query-grid-row.js"

let resizeObserver: ResizeObserver;
resizeObserver = new ResizeObserver(allEntries => {
    // Entries may be batched for multiple grids, make sure the event is dispatched to the correct grid
    
    const parents = new Map<HTMLElement, ResizeObserverEntry[]>();
    allEntries.forEach(e => {
        const parent = parents.get(e.target.parentElement) || parents.set(e.target.parentElement, []).get(e.target.parentElement);
        parent.push(e);
    });

    parents.forEach((entries, parent) => {
        parent.dispatchEvent(new CustomEvent("column-width-changed", {
            detail: {
                type: "cell",
                entries: entries.map(e => {
                    let width = e["borderBoxSize"] != null ? e["borderBoxSize"][0].inlineSize : (<HTMLElement>e.target).offsetWidth;
                    return [(<QueryGridCell>e.target).column.name, width];
                }),
            },
            bubbles: true,
            cancelable: true,
            composed: true
        }));
    
        entries.forEach(e => resizeObserver.unobserve(e.target));
    });
});

@WebComponent.register({
    properties: {
        column: Object,
        value: Object
    },
    observers: [
        "_queueMeasure(value, isConnected)"
    ]
})
export abstract class QueryGridCell extends WebComponent {
    #_lastMeasuredValue: Vidyano.QueryResultItemValue;

    column: Vidyano.QueryColumn;
    value: Vidyano.QueryResultItemValue;
    valueQueued: Vidyano.QueryResultItemValue;

    private _queueMeasure(value: Vidyano.QueryResultItemValue, isConnected: boolean) {
        if (!value || !isConnected)
            return;

        const row = this.parentElement as QueryGridRow;
        if ((this.parentElement as QueryGridRow).shadowRoot.host.parentElement.children[0] !== row)
            return;

        if (this.#_lastMeasuredValue === value)
            return;

        resizeObserver.observe(this, { box: "border-box" });
        this.#_lastMeasuredValue = value;
    }
}