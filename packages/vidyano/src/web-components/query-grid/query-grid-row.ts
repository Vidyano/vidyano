import * as Vidyano from "@vidyano/core"
import { html, nothing, unsafeCSS } from "lit"
import { property } from "lit/decorators.js"
import { Path } from "libs/pathjs/pathjs"
import { ActionButton } from "components/action-button/action-button"
import { Popup } from "components/popup/popup"
import { listener, observer, WebComponent } from "components/web-component/web-component"
import { QueryGridCell } from "./cell-templates/query-grid-cell"
import "./cell-templates/query-grid-cell-boolean"
import "./cell-templates/query-grid-cell-common-mark"
import "./cell-templates/query-grid-cell-image"
import "./cell-templates/query-grid-cell-default"
import { QueryGridRowGroup } from "./query-grid-row-group"
import "components/icon/icon"
import styles from "./query-grid-row.css"

const classNames = (extraclass: string) => extraclass.split(/\s+/).filter(Boolean);

// Same as the tap gesture: a click released further than this from where it was pressed is a drag
const TAP_DISTANCE = 25;

function cellTypeFor(column: Vidyano.QueryColumn): new () => QueryGridCell {
    return QueryGridCell.resolveCellType(column);
}

export interface IItemTapEventArgs {
    item: Vidyano.QueryResultItem;
}

export class QueryGridRow extends WebComponent {
    static styles = unsafeCSS(styles);

    @property({ type: Object })
    @observer(function(this: QueryGridRow, item: Vidyano.QueryResultItem | Vidyano.QueryResultItemGroup, oldItem: Vidyano.QueryResultItem | Vidyano.QueryResultItemGroup) {
        this._itemChanged(item, oldItem);
    })
    item: Vidyano.QueryResultItem | Vidyano.QueryResultItemGroup;

    @property({ type: Number })
    index: number;

    /** The offset of the row in the grid, or null when the row stays in flow. */
    @property({ type: Number })
    @observer(function(this: QueryGridRow, top: number) {
        this.style.transform = top == null ? "" : `translateY(${top}px)`;
    })
    top: number;

    @property({ type: Array })
    @observer(function(this: QueryGridRow, columns: Vidyano.QueryColumn[]) {
        this._columnsChanged(columns);
    })
    columns: Vidyano.QueryColumn[];

    @property({ type: Boolean, reflect: true })
    isGroup: boolean;

    @property({ type: Array })
    offsets: [cellLeft: number, cellRight: number][];

    @property({ type: Array })
    visibleRange: [left: number, right: number];

    @property({ type: Boolean, reflect: true })
    initializing: boolean = false;

    @property({ type: Boolean })
    canReorder: boolean;

    @property({ type: Boolean, reflect: true })
    selected: boolean;

    private _cells: QueryGridCell[] = [];
    private _groupElement: QueryGridRowGroup;
    private _visibleCells: QueryGridCell[];
    private _invisibleCellValues: [QueryGridCell, Vidyano.QueryResultItemValue][] = [];
    private _extraclass: string;
    private _itemPropertyChangedDisposer: () => void;
    private _pointerDown: [x: number, y: number];

    get cells(): QueryGridCell[] {
        return this._cells.slice();
    }

    override connectedCallback() {
        super.connectedCallback();

        if (!this.hasAttribute("role"))
            this.setAttribute("role", "row");

        this._observeItem(this.item);
    }

    override disconnectedCallback() {
        super.disconnectedCallback();

        this._observeItem(null);
    }

    render() {
        return html`
            ${!this.initializing ? html`
                <slot name="group"></slot>
                <div part="groupspacer" class="pinned"></div>
                ${this.canReorder ? html`
                    <div class="reorder pinned sort-handle" @click=${this._catchTap} part="reorder">
                        <vi-icon source="Hamburger"></vi-icon>
                    </div>
                ` : nothing}
                <div class="selector pinned" @click=${this._onSelect} part="selector">
                    <vi-icon source="Selected" ?is-selected=${this.selected}></vi-icon>
                </div>
                <vi-popup id="actions" class="actions pinned" part="actions" @popup-opening=${this._onActionsOpening} @popup-closed=${this._onActionsClosed} @click=${this._preventOpen}>
                    <vi-icon slot="header" source="EllipsisVertical"></vi-icon>
                </vi-popup>
                <div part="filter" class="pinned"></div>
            ` : nothing}
            <slot id="columns"></slot>
        `;
    }

    /**
     * Keeps `selected` in sync with the item. A single listener on the item is cheaper than a deep path forwarder on every recycled row.
     */
    private _observeItem(item: Vidyano.QueryResultItem | Vidyano.QueryResultItemGroup) {
        this._itemPropertyChangedDisposer?.();
        this._itemPropertyChangedDisposer = null;

        if (!(item instanceof Vidyano.QueryResultItem)) {
            this.selected = undefined;
            return;
        }

        this.selected = item.isSelected;
        if (this.isConnected) {
            this._itemPropertyChangedDisposer = item.propertyChanged.attach((_, args) => {
                if (args.propertyName === "isSelected")
                    this.selected = args.newValue;
            });
        }
    }

    private _columnsChanged(columns: Vidyano.QueryColumn[]) {
        const existingCells = this._cells.slice();
        const cells: QueryGridCell[] = [];

        for (let i=0; i < (columns?.length ?? 0); i++) {
            const column = columns[i];
            const cellType = cellTypeFor(column);
            let cell: QueryGridCell = existingCells.find(c => c.column.name === column.name && c.constructor === cellType);
            if (!cell) {
                cell = new cellType();
                cell.classList.add("column");
                cell.column = column;
                cell.value = this.item instanceof Vidyano.QueryResultItem ? this.item.getFullValue(column.name) : undefined;
            }
            else
                existingCells.remove(cell);

            cell.column = column;

            // A cell that is already in place stays connected, moving it would reconnect it
            const next = cells.length ? cells[cells.length - 1].nextSibling : this.querySelector(":scope > .column");
            if (cell !== next)
                this.insertBefore(cell, next);

            cells.push(cell);
        }

        existingCells.forEach(cell => {
            this.removeChild(cell);
        });

        this._cells = cells;
        this._invisibleCellValues = this._invisibleCellValues.filter(([cell]) => cells.indexOf(cell) >= 0);

        if (this._groupElement)
            this._groupElement.style.gridColumn = `1 / span ${cells.length + 3}`;

        // The cells were added, removed or reordered, the offsets of the visible cells changed
        this._flush(this.offsets, this.visibleRange);
    }

    private _itemChanged(item: Vidyano.QueryResultItem | Vidyano.QueryResultItemGroup, oldItem: Vidyano.QueryResultItem | Vidyano.QueryResultItemGroup) {
        if (item != null) {
            this.classList.toggle("loading", !(item instanceof Vidyano.QueryResultItem || item instanceof Vidyano.QueryResultItemGroup));
            this.classList.remove("hidden");
        }
        else if (item === null)
            this.classList.add("hidden");

        if (item !== oldItem)
            this._observeItem(item);

        if (item instanceof Vidyano.QueryResultItem || oldItem instanceof Vidyano.QueryResultItem) {
            const extraclass = item instanceof Vidyano.QueryResultItem ? item.getTypeHint("extraclass", "") : "";
            if (this._extraclass && this._extraclass !== extraclass) {
                this.classList.remove(...classNames(this._extraclass));
                this._extraclass = null;
            }

            const classes = classNames(extraclass);
            if (extraclass) {
                this.classList.add(...classes);
                this._extraclass = extraclass;
            }

            // The hint is matched case-insensitively, CSS class selectors are not
            const upperClasses = classes.map(c => c.toUpperCase());
            this.toggleAttribute("disabled-item", upperClasses.includes("DISABLED"));
            this.toggleAttribute("readonly-item", upperClasses.includes("READONLY"));

            this._invisibleCellValues = [];
            // A cell gets null for a value missing from its item and undefined when the row has no item
            this._cells.forEach(cell => {
                const value = item instanceof Vidyano.QueryResultItem ? item.getFullValue(cell.column.name) : undefined;
                if (!this._visibleCells || this._visibleCells.indexOf(cell) >= 0)
                    cell.value = value;
                else
                    this._invisibleCellValues.push([cell, value]);
            });
        }

        if (oldItem instanceof Vidyano.QueryResultItemGroup) {
            this._groupElement.group = null;
            this.isGroup = false;
        }

        if (item instanceof Vidyano.QueryResultItemGroup) {
            if (!this._groupElement) {
                this._groupElement = new QueryGridRowGroup();
                this.appendChild(this._groupElement);
            }

            this._groupElement.slot = "group";
            this.isGroup = true;

            this._groupElement.group = item;
            this._groupElement.style.gridColumn = `1 / span ${this._cells.length + 3}`;
        }
    }

    @observer("offsets", "visibleRange", { allowUndefined: true })
    private _flush(offsets: [cellLeft: number, cellRight: number][], visibleRange: [left: number, right: number]) {
        const cells = this._cells;

        // Without measured column widths (e.g. while the grid is initializing) every cell is filled
        const virtualize = !!offsets && !!visibleRange && offsets.length === cells.length;
        const visibleCells = cells.filter((cell, index) => !virtualize || cell.column.isPinned || !(offsets[index][1] < visibleRange[0] || offsets[index][0] > visibleRange[1]));

        this._invisibleCellValues = this._invisibleCellValues.filter(([cell, value]) => {
            if (visibleCells.indexOf(cell) < 0)
                return true;

            cell.value = value;
            return false;
        });

        this._visibleCells = virtualize ? visibleCells : null;
    }

    private _preventOpen(e: MouseEvent) {
        e.stopPropagation();
    }

    @listener("mouseenter")
    private _onMouseEnter() {
        if (!(this.item instanceof Vidyano.QueryResultItem))
            return;

        this._cells.forEach(cell => cell.isRowHovered = true);
    }

    @listener("mouseleave")
    private _onMouseLeave() {
        if (!(this.item instanceof Vidyano.QueryResultItem))
            return;

        this._cells.forEach(cell => cell.isRowHovered = false);
    }

    @listener("pointerdown")
    private _onPointerDown(e: PointerEvent) {
        this._pointerDown = [e.clientX, e.clientY];
    }

    private _isDrag(e: MouseEvent) {
        // Keyboard and synthetic clicks have no pointer
        if (!this._pointerDown || e.detail === 0)
            return false;

        return Math.abs(e.clientX - this._pointerDown[0]) > TAP_DISTANCE || Math.abs(e.clientY - this._pointerDown[1]) > TAP_DISTANCE;
    }

    @listener("click")
    private async _onTap(e: MouseEvent) {
        if (!(this.item instanceof Vidyano.QueryResultItem) || this._isDrag(e))
            return;

        if (classNames(this.item.getTypeHint("extraclass", "")).some(c => c.toUpperCase() === "DISABLED"))
            return;

        const tapEvent = new CustomEvent("item-tap", {
            detail: { item: this.item },
            bubbles: true,
            composed: true,
            cancelable: true
        });
        this.dispatchEvent(tapEvent);
        if (tapEvent.defaultPrevented)
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

        const grid = (this.getRootNode() as ShadowRoot).host as any;
        if (this.item.query.canRead && !this.item.query.asLookup && !grid.asLookup) {
            if ((e.ctrlKey || e.shiftKey) && 'getUrlForPersistentObject' in this.app) {
                // Open in new window/tab
                window.open(Path.routes.root + (<any>this.app).getUrlForPersistentObject(this.item.query.persistentObject.id, this.item.id));

                e.stopPropagation();
                return;
            }

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

    @listener("contextmenu")
    private async _onContextmenu(e: MouseEvent) {
        if (!(this.item instanceof Vidyano.QueryResultItem) || this.item.query.asLookup)
            return;

        if (classNames(this.item.getTypeHint("extraclass", "")).map(c => c.toUpperCase()).some(c => c === "DISABLED" || c === "READONLY"))
            return;

        const grid = <any>this.findParent(e => (e as HTMLElement).matches("vi-query-grid"));
        if (e.button !== 2 || e.shiftKey || e.ctrlKey || grid.asLookup)
            return true;

        // Hiding the inline actions also hides them from the context menu, the native menu shows instead
        if (grid.noInlineActions)
            return;

        // Without a qualifying action there is no menu, the native menu shows instead
        if (this._selectForActions().length === 0)
            return;

        let [x, y] = [e.clientX, e.clientY];

        const actionsPopup = new Popup();
        actionsPopup.style.position = "fixed";
        actionsPopup.style.left = `${x}px`;
        actionsPopup.style.top = `${y}px`;

        const anchor = document.createElement("div");

        anchor.style.width = `1px`;
        anchor.style.height = `1px`;
        anchor.setAttribute("slot", "header");
        actionsPopup.appendChild(anchor);

        actionsPopup.addEventListener("popup-opening", this._onActionsOpening.bind(this));
        actionsPopup.addEventListener("popup-closed", this._onActionsClosed.bind(this));
        grid.shadowRoot.appendChild(actionsPopup);

        e.preventDefault();

        try {
            await actionsPopup.popup();
        }
        finally {
            grid.shadowRoot.removeChild(actionsPopup);
        }
    }

    private _onSelect(e: MouseEvent) {
        e.stopPropagation();

        if (this._isDrag(e))
            return;

        this.dispatchEvent(new CustomEvent("item-select", {
            detail: {
                item: this.item,
                shift: e.shiftKey,
                ctrl: this.app.configuration.getSetting("vi-query-grid.single-click", "true").toLowerCase() === "true" || e.ctrlKey || (e as PointerEvent).pointerType === "touch"
            },
            bubbles: true,
            composed: true
        }));
    }

    /**
     * Selects this row exclusively unless it is already selected, and returns the actions the menu lists for that selection.
     * Without any, the previous selection is restored.
     */
    private _selectForActions(): Vidyano.Action[] {
        const query = this.item.query;
        const item = <Vidyano.QueryResultItem>this.item;
        const getActions = () => (<Vidyano.Action[]>query.actions || []).filter(a => a.isVisible && a.definition.selectionRule !== Vidyano.ExpressionParser.alwaysTrue && a.selectionRule(Math.max(1, query.selectedItems.length)));

        if (query.selectedItems.indexOf(item) >= 0)
            return getActions();

        const [selectedItems, allSelected, inverse] = [query.selectedItems, query.selectAll.allSelected, query.selectAll.inverse];
        query.selectAll.allSelected = query.selectAll.inverse = false;
        query.selectedItems = [item];

        // Checked after selecting, the app can change which actions are visible for a selection
        const actions = getActions();
        if (actions.length === 0) {
            query.selectAll.allSelected = allSelected;
            query.selectAll.inverse = inverse;
            query.selectedItems = selectedItems;
        }

        return actions;
    }

    // TODO: Actions popup displays out of viewport
    private async _onActionsOpening(e: CustomEvent) {
        const actions = this._selectForActions();
        if (actions.length === 0) {
            e.preventDefault();
            return;
        }

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
            button.inverse = true;
            button.openOnHover = true;
            button.setAttribute("overflow", "");

            (<Popup>e.target).appendChild(button);
        });

        this.style.zIndex = "1";
        this.setAttribute("actions-open", "");

        e.stopPropagation();
    }

    private _onActionsClosed(e: CustomEvent) {
        const actions = <Popup>e.target;
        Array.from(actions.children).filter(c => !c.hasAttribute("slot")).forEach(c => actions.removeChild(c));

        this.style.zIndex = "auto";
        this.removeAttribute("actions-open");

        e.stopPropagation();
    }

    private _catchTap(e: MouseEvent) {
        e.stopPropagation();
    }

    refresh() {
        this._itemChanged(this.item, this.item);
    }
}

customElements.define("vi-query-grid-row", QueryGridRow);
