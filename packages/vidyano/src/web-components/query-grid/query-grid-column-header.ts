import { html, unsafeCSS } from "lit"
import { property, state } from "lit/decorators.js"
import * as Vidyano from "@vidyano/core"
import { computed, listener, observer, WebComponent } from "components/web-component/web-component"
import * as IconRegister from "components/icon/icon-register"
import "components/popup-menu/popup-menu"
import { PopupMenu } from "components/popup-menu/popup-menu"
import { Popup } from "components/popup/popup"
import { QueryGridColumn } from "./query-grid-column"
import "./query-grid-column-filter"
import styles from "./query-grid-column-header.css"

// Registered once instead of as an inline <vi-icon>: the register keeps the first connected icon element, and with it that header's grid, alive
IconRegister.add("QueryGrid_Group", `
    <svg viewBox="0 0 32 32">
        <g>
            <path d="M 2 8 L 2 14 L 22 14 L 22 8 L 2 8 z M 10 18 L 10 24 L 30 24 L 30 18 L 10 18 z " />
        </g>
    </svg>`);

const observeOnConnected = new WeakSet<Element>();

// The distances Polymer's tap and track gestures used, so a drag on the label does not sort and a click on the resizer does not resize
const TAP_DISTANCE = 25;
const TRACK_DISTANCE = 5;

let resizeObserver: ResizeObserver;
resizeObserver = new ResizeObserver(allEntries => {
    window.requestAnimationFrame(() => {
        // Entries may be batched for multiple grids, make sure the event is dispatched to the correct grid

        const parents = new Map<HTMLElement, ResizeObserverEntry[]>();
        allEntries.forEach(e => {
            // A detached grid does not listen for the width, the header reports again once it is re-attached
            if (!e.target.isConnected) {
                resizeObserver.unobserve(e.target);
                observeOnConnected.add(e.target);
                return;
            }

            // A header inside a hidden (display: none) container has no size yet, keep observing it until it is shown
            if (!(e["borderBoxSize"] != null ? e["borderBoxSize"][0].inlineSize : (<HTMLElement>e.target).offsetWidth))
                return;

            const parent = parents.get(e.target.parentElement) || parents.set(e.target.parentElement, []).get(e.target.parentElement);
            parent.push(e);
        });

        parents.forEach((entries, parent) => {
            try {
                // parent can be null if the the element is no longer in the DOM
                parent?.dispatchEvent(new CustomEvent("column-width-changed", {
                    detail: {
                        type: "column",
                        entries: entries.map(e => {
                            const header = e.target as QueryGridColumnHeader;

                            let width = e["borderBoxSize"] != null ? e["borderBoxSize"][0].inlineSize : header.offsetWidth;
                            return [header.column.name, width];
                        }),
                    },
                    bubbles: true,
                    cancelable: true,
                    composed: true
                }));
            }
            finally {
                entries.forEach(e => resizeObserver.unobserve(e.target));
            }
        });
    });
});

export class QueryGridColumnHeader extends WebComponent {
    static styles = unsafeCSS(styles);

    #_lastMeasuredColumn: Vidyano.QueryColumn;
    #_minimumColumnWidth: number;
    #_calculatedWidth: number;
    #_resizingRAF: number;
    #_tapStart: { x: number; y: number };

    @property({ type: Object })
    column: QueryGridColumn;

    /** Whether this is the only visible column, which cannot be hidden. */
    @property({ type: Boolean })
    lastVisible: boolean = false;

    @property({ type: Boolean, reflect: true })
    @computed(function(this: QueryGridColumnHeader, column: QueryGridColumn) {
        return !!column?.canSort;
    }, "column")
    declare readonly canSort: boolean;

    @property({ type: Boolean })
    @computed(function(this: QueryGridColumnHeader, column: QueryGridColumn) {
        return !!column?.canGroupBy;
    }, "column")
    declare readonly canGroupBy: boolean;

    @property({ type: Boolean })
    @computed("column.isPinned")
    declare readonly isPinned: boolean;

    @property({ type: String })
    @computed(function(this: QueryGridColumnHeader, direction: Vidyano.SortDirection) {
        return direction === "ASC" ? "SortAsc" : (direction === "DESC" ? "SortDesc" : null);
    }, "column.column.sortDirection")
    declare readonly sortingIcon: string;

    @property({ type: String })
    @computed(function(this: QueryGridColumnHeader, label: string) {
        return this.translateMessage("GroupByColumn", label);
    }, "column.label", "translations")
    declare readonly groupByLabel: string;

    @property({ type: String })
    @computed(function(this: QueryGridColumnHeader, isPinned: boolean) {
        return isPinned ? this.translations.Unpin : this.translations.Pin;
    }, "isPinned", "translations")
    declare readonly pinLabel: string;

    @property({ type: String, reflect: true })
    @computed(function(this: QueryGridColumnHeader, column: QueryGridColumn) {
        let safeName = column.name.replace(/[\. ]/g, "_");

        if (/^\d/.test(safeName))
            safeName = "_" + safeName;

        return safeName;
    }, "column")
    declare readonly name: string;

    @state()
    renderPopupMenu: boolean = false;

    render() {
        return html`
            <div class="container">
                <div class="row">
                    <div class="label" ?can-sort=${this.canSort} @pointerdown=${this._labelPointerDown} @click=${this._labelClick}>
                        <label title=${this.column?.label ?? ""}>${this.column?.label}</label>
                        <vi-icon id="sortingIcon" .source=${this.sortingIcon}></vi-icon>
                    </div>
                    ${!this.renderPopupMenu ? html`
                        <vi-button icon="CaretDown" inverse @click=${this._renderPopupMenu}></vi-button>
                    ` : html`
                        <vi-popup-menu right-align id="menu">
                            <vi-button slot="header" icon="CaretDown" inverse></vi-button>
                            <vi-popup-menu-item label=${this.translateMessage("SortAscending")} icon="SortAsc" @click=${this._sortAsc} ?hidden=${!this.canSort}></vi-popup-menu-item>
                            <vi-popup-menu-item label=${this.translateMessage("SortDescending")} icon="SortDesc" @click=${this._sortDesc} ?hidden=${!this.canSort}></vi-popup-menu-item>
                            <vi-popup-menu-item-separator ?hidden=${!this.canSort}></vi-popup-menu-item-separator>
                            <vi-popup-menu-item label=${this.groupByLabel} icon="QueryGrid_Group" @click=${this._group} ?hidden=${!this.canGroupBy}></vi-popup-menu-item>
                            <vi-popup-menu-item label=${this.pinLabel} icon="Pin" ?checked=${this.isPinned} @click=${this._togglePin}></vi-popup-menu-item>
                            <vi-popup-menu-item label=${this.translateMessage("HideColumn")} icon="Eye" @click=${this._hide} ?disabled=${this.lastVisible}></vi-popup-menu-item>
                            <vi-popup-menu-item-separator></vi-popup-menu-item-separator>
                            <vi-popup-menu-item label=${this.translateMessage("Manage")} icon="Configure" @click=${this._configure}></vi-popup-menu-item>
                        </vi-popup-menu>
                    `}
                </div>
                <vi-query-grid-column-filter .column=${this.column} part="filter"></vi-query-grid-column-filter>
                <div class="resizer" @pointerdown=${this._resizerPointerDown}></div>
            </div>
        `;
    }

    private async _renderPopupMenu(e: Event) {
        e.stopPropagation();

        const hadFocus = !this.renderPopupMenu && this.shadowRoot.activeElement != null;

        this.renderPopupMenu = true;
        await this.updateComplete;

        const menu = <PopupMenu>this.shadowRoot.querySelector("#menu");
        menu.popup();

        // The focused placeholder caret was replaced by the menu's own caret, which is only focusable once the menu has rendered
        if (hadFocus)
            requestAnimationFrame(() => menu.querySelector<HTMLElement>("vi-button[slot='header']").focus());
    }

    private _labelPointerDown(e: PointerEvent) {
        this.#_tapStart = { x: e.clientX, y: e.clientY };
    }

    private _labelClick(e: MouseEvent) {
        const start = this.#_tapStart;
        this.#_tapStart = null;

        if (start && (Math.abs(e.clientX - start.x) > TAP_DISTANCE || Math.abs(e.clientY - start.y) > TAP_DISTANCE))
            return;

        this._sort(e.ctrlKey);
    }

    private _sort(multiSort: boolean, direction?: Vidyano.SortDirection) {
        if (!this.canSort)
            return;

        if (direction == null) {
            switch (this.column.sortDirection) {
                case "ASC": {
                    direction = "DESC";
                    break;
                }
                case "DESC": {
                    direction = multiSort && this.column.query.sortOptions.length > 1 ? "" : "ASC";
                    break;
                }
                case "": {
                    direction = "ASC";
                    break;
                }
            }
        }

        this.column.column.sort(direction, multiSort);
    }

    @listener("contextmenu")
    private _onContextmenu(e: Event) {
        this._renderPopupMenu(e);
        e.preventDefault();
    }

    private _sortAsc(e: MouseEvent) {
        e.stopPropagation();
        Popup.closeAll();
        this._sort(e.ctrlKey, "ASC");
    }

    private _sortDesc(e: MouseEvent) {
        e.stopPropagation();
        Popup.closeAll();
        this._sort(e.ctrlKey, "DESC");
    }

    private _group() {
        Popup.closeAll();
        this.column.query.group(this.column.column);
    }

    private _togglePin() {
        Popup.closeAll();
        this.column.isPinned = !this.column.isPinned;

        this.dispatchEvent(new CustomEvent("query-grid-column:update", {
            bubbles: true,
            composed: true
        }));
    }

    private _hide() {
        // The only visible column cannot be hidden
        if (this.lastVisible)
            return;

        Popup.closeAll();
        this.column.isHidden = !this.column.isHidden;
        this.dispatchEvent(new CustomEvent("query-grid-column:update", {
            bubbles: true,
            composed: true
        }));
    }

    private _configure() {
        this.dispatchEvent(new CustomEvent("query-grid-column:configure", {
            bubbles: true,
            composed: true
        }));
    }

    connectedCallback() {
        super.connectedCallback();

        if (observeOnConnected.delete(this))
            resizeObserver.observe(this, { box: "border-box" });

        this._queueMeasure(this.column);
    }

    @observer("column")
    private _queueMeasure(column: QueryGridColumn) {
        if (!column || !this.isConnected || this.#_lastMeasuredColumn === column.column)
            return;

        resizeObserver.observe(this, { box: "border-box" });
        this.#_lastMeasuredColumn = column.column;
    }

    private _resizerPointerDown(e: PointerEvent) {
        if (e.button !== 0)
            return;

        // Keeps the drag from selecting text
        e.preventDefault();

        const resizer = <HTMLElement>e.currentTarget;
        resizer.setPointerCapture(e.pointerId);

        let tracking = false;
        let dx = 0;

        const move = (m: PointerEvent) => {
            if (m.pointerId !== e.pointerId)
                return;

            dx = m.clientX - e.clientX;

            if (tracking)
                this._resizeTrack(dx);
            else if (Math.abs(dx) > TRACK_DISTANCE || Math.abs(m.clientY - e.clientY) > TRACK_DISTANCE) {
                tracking = true;
                this._resizeStart();
            }
        };

        const end = (u: PointerEvent) => {
            if (u.pointerId !== e.pointerId)
                return;

            document.removeEventListener("pointermove", move);
            document.removeEventListener("pointerup", end);
            document.removeEventListener("pointercancel", end);
            if (resizer.hasPointerCapture(e.pointerId))
                resizer.releasePointerCapture(e.pointerId);

            if (u.type === "pointerup")
                dx = u.clientX - e.clientX;

            if (tracking)
                this._resizeEnd(dx);
        };

        // On the document, like Polymer's track gesture, so the drag keeps following the pointer if the capture is lost
        document.addEventListener("pointermove", move);
        document.addEventListener("pointerup", end);
        document.addEventListener("pointercancel", end);
    }

    private _resizeStart() {
        if (!this.#_minimumColumnWidth)
            this.#_minimumColumnWidth = parseInt(getComputedStyle(this).getPropertyValue("--vi-query-grid--minimum-column-width") || "50");

        this.#_calculatedWidth = Math.max(this.getBoundingClientRect().width, this.#_minimumColumnWidth);

        this.app.isTracking = true;
        this.classList.add("resizing");
    }

    private _resizeTrack(dx: number) {
        if (this.#_resizingRAF)
            cancelAnimationFrame(this.#_resizingRAF);

        this.#_resizingRAF = requestAnimationFrame(() => {
            this.#_resizingRAF = null;
            this._resize(Math.max(this.#_calculatedWidth + dx, this.#_minimumColumnWidth));
        });
    }

    private _resizeEnd(dx: number) {
        if (this.#_resizingRAF) {
            cancelAnimationFrame(this.#_resizingRAF);
            this.#_resizingRAF = null;
        }

        this.classList.remove("resizing");

        this.#_calculatedWidth = Math.max(this.#_calculatedWidth + dx, this.#_minimumColumnWidth);
        this.column.width = `${this.#_calculatedWidth}px`;

        this._resize(this.#_calculatedWidth, true);
        this.app.isTracking = false;
    }

    private _resize(width: number, save?: boolean) {
        this.dispatchEvent(new CustomEvent("column-width-changed", {
            detail: {
                type: "current",
                entries: [[this.column.name, width]],
                save: save
            },
            bubbles: true,
            cancelable: true,
            composed: true
        }));
    }
}

customElements.define("vi-query-grid-column-header", QueryGridColumnHeader);
