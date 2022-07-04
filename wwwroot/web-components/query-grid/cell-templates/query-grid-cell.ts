import * as Vidyano from "../../../libs/vidyano/vidyano.js"
import { WebComponent } from "../../web-component/web-component.js"
import type { QueryGridRow } from "../query-grid-row.js"

let resizeObserver: ResizeObserver;
resizeObserver = new ResizeObserver(allEntries => {
    window.requestAnimationFrame(() => {
        // Entries may be batched for multiple grids, make sure the event is dispatched to the correct grid
        
        const parents = new Map<HTMLElement, ResizeObserverEntry[]>();
        allEntries.forEach(e => {
            const parent = parents.get(e.target.parentElement) || parents.set(e.target.parentElement, []).get(e.target.parentElement);
            parent.push(e);
        });

        parents.forEach((entries, parent) => {
            try {
                // parent can be null if the the element is no longer in the DOM
                parent?.dispatchEvent(new CustomEvent("column-width-changed", {
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
            }
            finally {
                entries.forEach(e => (e.target as QueryGridCell)._unobserve());
            }
        });
    });
});

@WebComponent.register({
    properties: {
        column: Object,
        value: Object,
        sensitive: {
            type: Boolean,
            readOnly: true,
            reflectToAttribute: true
        }
    },
    observers: [
        "_queueMeasure(value, isConnected)"
    ]
})
export abstract class QueryGridCell extends WebComponent {
    #_lastMeasuredColumn: Vidyano.QueryColumn;
    #_isObserved: boolean;

    readonly sensitive: boolean; protected _setSensitive: (sensitive: boolean) => void;

    column: Vidyano.QueryColumn;
    value: Vidyano.QueryResultItemValue;
    valueQueued: Vidyano.QueryResultItemValue;

    disconnectedCallback() {
        super.disconnectedCallback();

        if (this.#_isObserved) {
            resizeObserver.unobserve(this);
            this.#_isObserved = false;
        }
    }

    get isObserved() {
        return this.#_isObserved;
    }

    private _queueMeasure(value: Vidyano.QueryResultItemValue, isConnected: boolean) {
        if (!isConnected || this.#_lastMeasuredColumn === this.column)
            return;

        const row = this.parentElement as QueryGridRow;
        if (!row.item || row.item.query.items[0] !== row.item)
            return;

        this.#_lastMeasuredColumn = this.column;
        
        this.#_isObserved = true;
        resizeObserver.observe(this, { box: "border-box" });
    }

    _unobserve() {
        resizeObserver.unobserve(this);
        this.#_isObserved = false;
    }

    static registerCellType(type: string, constructor: QueryGridCellConstructor) {
        registeredQueyGridCellTypes[type] = constructor;
    }

    static getCellTypeConstructor(type: string) {
        return registeredQueyGridCellTypes[type];
    }
}

export type QueryGridCellConstructor = new (...args:any[]) => QueryGridCell;

const registeredQueyGridCellTypes: { [type: string]: QueryGridCellConstructor} = {};