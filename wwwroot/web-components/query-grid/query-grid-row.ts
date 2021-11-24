import * as Vidyano from "../../libs/vidyano/vidyano.js"
import * as Polymer from "../../libs/@polymer/polymer.js"
import { Path } from "../../libs/pathjs/pathjs.js"
import "../popup/popup.js"
import { App } from "../app/app.js"
import { ActionButton } from "../action-button/action-button.js"
import { Popup } from "../popup/popup.js"
import type { QueryGrid } from "./query-grid.js"
import { QueryGridCell } from "./cell-templates/query-grid-cell.js";
import { QueryGridCellBoolean } from "./cell-templates/query-grid-cell-boolean.js";
import { QueryGridCellDefault } from "./cell-templates/query-grid-cell-default.js";
import { QueryGridCellImage } from "./cell-templates/query-grid-cell-image.js";
import { QueryGridRowGroup } from "./query-grid-row-group.js";
import { WebComponent, WebComponentListener } from "../web-component/web-component.js"

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
            detail: entries.map(e => {
                let width = e["borderBoxSize"] != null ? e["borderBoxSize"][0].inlineSize : (<HTMLElement>e.target).offsetWidth;
                return [(<QueryGridCell>e.target).column, width];
            }),
            bubbles: true,
            cancelable: true,
            composed: true
        }));
    
        entries.forEach(e => resizeObserver.unobserve(e.target));
    });
});

export interface IItemTapEventArgs {
    item: Vidyano.QueryResultItem;
}

@WebComponent.register({
    properties: {
        index: Number,
        item: {
            type: Object,
            observer: "_itemChanged"
        },
        columns: {
            type: Array,
            observer: "_columnsChanged"
        },
        offsets: Array,
        visibleRange: Array,
        initializing: {
            type: Boolean,
            reflectToAttribute: true
        }
    },
    forwardObservers: [
        "item.isSelected"
    ],
    listeners: {
        "tap": "_onTap"
    },
    observers: [
        "_flush(offsets, visibleRange)"
    ]
})
export class QueryGridRow extends WebComponentListener(WebComponent) {
    static get template() { return Polymer.html`<link rel="import" href="query-grid-row.html">` }

    item: Vidyano.QueryResultItem | Vidyano.QueryResultItemGroup;

    private _groupElement: QueryGridRowGroup;
    private _visibleCells: QueryGridCell[];
    private _invisibleCellValues: [QueryGridCell, Vidyano.QueryResultItemValue][] = [];
    columns: Vidyano.QueryColumn[];
    index: number;
    offsets: number[];
    visibleRange: [ left: number, right: number];

    private _columnsChanged(columns: Vidyano.QueryColumn[]) {
        const existingCells = <QueryGridCell[]>Array.from((<HTMLSlotElement>this.$.columns).assignedElements());

        for (let i=0; i < columns.length; i++) {
            const column = columns[i];
            let cell: QueryGridCell = existingCells.find(c => c.column === column);
            if (!cell) {
                let cellConstructor: new() => QueryGridCell;
                switch(column.type) {
                    case "Boolean":
                    case "NullableBoolean": {
                        cellConstructor = QueryGridCellBoolean;
                        break;
                    }
                    case "Image": {
                        cellConstructor = QueryGridCellImage;
                        break;
                    }
                    default: {
                        cellConstructor = QueryGridCellDefault;
                        break;
                    }
                }

                cell = new cellConstructor();
                cell.column = column;
                cell.classList.add("column");
            }
            else
                existingCells.remove(cell);

            this.appendChild(cell);
        }

        existingCells.forEach(cell => {
            resizeObserver.unobserve(cell);
            this.removeChild(cell);
        });
    }

    private _itemChanged(item: Vidyano.QueryResultItem | Vidyano.QueryResultItemGroup, oldItem: Vidyano.QueryResultItem | Vidyano.QueryResultItemGroup) {
        if (item != null) {
            this.classList.toggle("loading", !(item instanceof Vidyano.QueryResultItem || item instanceof Vidyano.QueryResultItemGroup));
            this.classList.remove("hidden");
        }
        else if (item === null)
            this.classList.add("hidden");

        const cells = (<HTMLSlotElement>this.$.columns).assignedElements();

        if (item instanceof Vidyano.QueryResultItem || oldItem instanceof Vidyano.QueryResultItem) {
            this._invisibleCellValues = [];
            cells.forEach((cell: QueryGridCell, index: number) => {
                if (!this._visibleCells || this._visibleCells.indexOf(cell) >= 0)
                    cell.value = this.item instanceof Vidyano.QueryResultItem ? this.item.getFullValue(cell.column.name) : null;
                else
                    this._invisibleCellValues.push([cell, this.item instanceof Vidyano.QueryResultItem ? this.item.getFullValue(cell.column.name) : null]);
            });
        }

        if (oldItem instanceof Vidyano.QueryResultItemGroup) {
            this._groupElement.group = null;
            this._groupElement.style.display = "none";

            if (!(item instanceof Vidyano.QueryResultItemGroup)) {
                cells.forEach((cell: QueryGridCellDefault) => {
                    cell.style.display = "block";
                });
            }
        }

        if (item instanceof Vidyano.QueryResultItemGroup) {
            if (!this._groupElement)
                this.shadowRoot.appendChild(this._groupElement = new QueryGridRowGroup());
            else
                this._groupElement.style.display = "flex";

            this._groupElement.group = item;
            this._groupElement.style.gridColumn = `1 / span ${this.columns.length}`;

            cells.forEach((cell: QueryGridCellDefault) => {
                cell.style.display = "none";
            });
        }
    }

    private _flush(offsets: [cellLeft: number, cellRight: number][], visibleRange: [left: number, right: number]) {
        const cells = <QueryGridCell[]>(<HTMLSlotElement>this.$.columns).assignedElements();

        this._visibleCells = cells.filter((cell, index) => {
            const visible = this.columns[index].isPinned || !(offsets[index][1] < visibleRange[0] || offsets[index][0] > visibleRange[1] - 64);
            if (visible && this._visibleCells && this._visibleCells.indexOf(cell) < 0) {
                const invisibleCellIndex = this._invisibleCellValues.findIndex(cellValue => cellValue[0] === cell);
                if (invisibleCellIndex >= 0) {
                    const update = this._invisibleCellValues.splice(invisibleCellIndex, 1)[0];
                    update[0].value = update[1];
                }
            }

            return visible;
        });
    }

    private async _onTap(e: Polymer.Gestures.TapEvent) {
        if (!this.item)
            return;

        if (this.item instanceof Vidyano.QueryResultItem) {
            if (this.item.getTypeHint("extraclass", "").split(" ").some(c => c.toUpperCase() === "DISABLED"))
                return;

            if (this.fire("item-tap", { item: this.item }, { bubbles: true, composed: true, cancelable: true }).defaultPrevented)
                return;

            let openaction = this.item.getTypeHint("openaction", null);
            if (openaction) {
                const action = this.item.query.actions.find(a => a.name === openaction) || Vidyano.Action.get(this.item.service, openaction, this.item.query);
                if (action)
                    await action.execute({ selectedItems: [this.item] });
                else
                    console.warn(`Unknown openaction '${openaction}'.`);

                return;
            }

            if (this.item.query.canRead && !this.item.query.asLookup) {
                if (e.detail.sourceEvent && ((<KeyboardEvent>e.detail.sourceEvent).ctrlKey || (<KeyboardEvent>e.detail.sourceEvent).shiftKey) && this.app instanceof App) {
                    // Open in new window/tab
                    window.open(Path.routes.root + this.app.getUrlForPersistentObject(this.item.query.persistentObject.id, this.item.id));

                    e.stopPropagation();
                    return;
                }

                const grid = (this.getRootNode() as ShadowRoot).host as QueryGrid;
                grid["_itemOpening"] = this.item;
                const po = await this.item.getPersistentObject();
                if (!po)
                    return;

                if (grid["_itemOpening"] === this.item) {
                    grid["_itemOpening"] = undefined;

                    this.item.query.service.hooks.onOpen(po);
                }
            }
        }

        // TODO: Group collapse/expand

        // const div = document.createElement("div");
        // div.style.position = "absolute";
        // div.style.background = "red";
        // div.style.width = "500px";
        // div.style.height = "500px";
        // div.style.zIndex = "1000";

        // this.shadowRoot.insertBefore(div, this.shadowRoot.children[0]);
        // this.style.zIndex = "1";
    }

    private _onSelect(e: Polymer.Gestures.TapEvent) {
        e.stopPropagation();

        const mouse = e.detail.sourceEvent instanceof MouseEvent ? e.detail.sourceEvent : null;
        this.fire("item-select", {
            item: this.item,
            shift: mouse ? mouse.shiftKey : false,
            ctrl: this.app.configuration.getSetting("vi-query-grid.single-click", "true").toLowerCase() === "true" || (mouse ? mouse.ctrlKey : true)
        }, { bubbles: true });
    }

    // TODO: Actions popup displays out of viewport
    private async _onActionsOpening(e: CustomEvent) {
        if (this.item.query.selectedItems.length > 0 && this.item.query.selectedItems.indexOf(<Vidyano.QueryResultItem>this.item) < 0) {
            this.item.query.selectAll.allSelected = this.item.query.selectAll.inverse = false;
            this.item.query.selectedItems = [<Vidyano.QueryResultItem>this.item];
        }

        const actions = (<Vidyano.Action[]>this.item.query.actions || []).filter(a => a.isVisible && a.definition.selectionRule !== Vidyano.ExpressionParser.alwaysTrue && a.selectionRule(Math.max(1, this.item.query.selectedItems.length)));
        if (actions.length === 0)
            return;

        const actionGroups: { [name: string]: Vidyano.ActionGroup } = {};
        actions.forEach(action => {
            let actionOrGroup: Vidyano.Action | Vidyano.ActionGroup;
            if (action.group) {
                if (!!actionGroups[action.group.name])
                    return;

                actionOrGroup = actionGroups[action.group.name] = action.group;
            }
            else
                actionOrGroup = action;

            const button = new ActionButton(this.item.query.selectedItems.length === 0 ? <Vidyano.QueryResultItem>this.item : null, actionOrGroup);
            button.forceLabel = true;
            button.openOnHover = true;
            button.setAttribute("overflow", "");

            (<Popup>e.target).appendChild(button);
        });

        this.style.zIndex = "1";

        e.stopPropagation();
    }

    private _onActionsClosed(e: CustomEvent) {
        const actions = <Popup>e.target;
        Array.from(actions.children).filter(c => !c.hasAttribute("slot")).forEach(c => actions.removeChild(c));

        this.style.zIndex = "auto";

        e.stopPropagation();
    }

    measure() {
        const cells = (<HTMLSlotElement>this.$.columns).assignedElements();
        cells.forEach((cell: HTMLElement) => resizeObserver.observe(cell, { box: "border-box" }));
    }
}