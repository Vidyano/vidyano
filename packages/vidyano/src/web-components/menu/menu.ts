import { html, nothing, unsafeCSS } from "lit";
import { property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import * as Vidyano from "@vidyano/core";
import { Path } from "libs/pathjs/pathjs";
import type { App } from "components/app/app";
import "components/button/button";
import "components/input-search/input-search";
import { Popup } from "components/popup/popup";
import "components/scroller/scroller";
import { SelectReferenceDialog } from "components/select-reference-dialog/select-reference-dialog";
import "components/user/user";
import { computed, listener, observer, WebComponent } from "components/web-component/web-component";
import { changed, extendMenu, hasItemExtensions, MenuExtendOptions, MenuExtensionsController, menuExtensionEvents, MenuItemRegion, MenuItemRender, MenuRegion, MenuRender, MenuReplaceableRegion, renderRegion, replaceMenu } from "./menu-extensions";
import "./menu-program-unit";
import styles from "./menu.css";

export type { MenuExtendOptions, MenuItemRegion, MenuItemRender, MenuRegion, MenuRender, MenuReplaceableRegion } from "./menu-extensions";

type InstantSearchResult = Vidyano.IInstantSearchResult & { href: string };

export class Menu extends WebComponent {
    static styles = unsafeCSS(styles);

    /**
     * Adds content to a region of every vi-menu, after its built-in content unless `before` is set.
     * The item regions add content to every row of the menu tree, for that row's item.
     * @returns A function that removes the content again.
     */
    static extend(region: MenuItemRegion, render: MenuItemRender): () => void;
    static extend(region: MenuRegion, render: MenuRender, options?: MenuExtendOptions): () => void;
    static extend(region: string, render: Function, options?: MenuExtendOptions): () => void {
        return extendMenu(region, render, options);
    }

    /**
     * Replaces the built-in content of a region of every vi-menu; the last replacement registered wins.
     * @returns A function that brings back the content it replaced.
     */
    static replace(region: MenuReplaceableRegion, render: MenuRender): () => void {
        return replaceMenu(region, render);
    }

    /**
     * Renders the extensions of every vi-menu again, for extensions that follow state of their own.
     */
    static refresh() {
        changed();
    }

    private static _minResizeWidth: number;
    private _resizeWidth: number;
    private _resizeStartX: number;
    private _resizeStartWidth: number;
    private _instantSearchTimeout: ReturnType<typeof setTimeout>;
    private _extensions = new MenuExtensionsController(this);

    /** The text shown in the header, unless the label slot has content. */
    @property({ type: String })
    label: string;

    @property({ type: Array })
    programUnits: Vidyano.ProgramUnit[];

    @property({ type: Object })
    activeProgramUnit: Vidyano.ProgramUnit;

    /** Whether the menu is collapsed to icons; kept in the menu-collapsed cookie. */
    @property({ type: Boolean, reflect: true })
    collapsed: boolean = !!Boolean.parse(Vidyano.cookie("menu-collapsed"));

    /** The search text that filters the menu. */
    @property({ type: String })
    @observer(Menu.prototype._filterChanged)
    filter: string = "";

    @property({ type: Boolean, reflect: true })
    @computed(function(this: Menu, filter: string): boolean {
        return !!filter;
    }, "filter")
    declare readonly filtering: boolean;

    @property({ type: Boolean, reflect: true, attribute: "is-resizing" })
    isResizing: boolean = false;

    @property({ type: Boolean, reflect: true, attribute: "hide-search" })
    hideSearch: boolean = false;

    @property({ type: Boolean, reflect: true, attribute: "search-focused" })
    @observer(Menu.prototype._searchFocusedChanged)
    searchFocused: boolean = false;

    /** Whether the mouse is over the menu, which shows a collapsed menu in full. */
    @state()
    hovering: boolean = false;

    @state()
    hasCustomLabel: boolean = false;

    @state()
    instantSearchResults: InstantSearchResult[] = null;

    @property({ type: Boolean })
    @computed(function(this: Menu, globalSearchId: string): boolean {
        return globalSearchId !== "00000000-0000-0000-0000-000000000000";
    }, "service.application.globalSearchId")
    declare readonly hasGlobalSearch: boolean;

    @property({ type: Number })
    @computed(function(this: Menu, application: Vidyano.Application): number {
        return application.getAttributeValue("InstantSearchDelay");
    }, "service.application")
    declare readonly instantSearchDelay: number;

    connectedCallback() {
        super.connectedCallback();

        this.hideSearch = this.app.configuration.getSetting("vi-menu.hide-search", "false").toLowerCase() === "true";

        if (!Menu._minResizeWidth)
            Menu._minResizeWidth = this.offsetWidth;

        const menuWidth = parseInt(Vidyano.cookie("menu-width"));
        if (menuWidth)
            this.style.setProperty("--vi-menu--expand-width", `${menuWidth}px`);
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        clearTimeout(this._instantSearchTimeout);
    }

    @listener("mouseenter")
    private _mouseenter() {
        this.hovering = true;
    }

    @listener("mouseleave")
    private _mouseleave() {
        // Focus in the search keeps the collapsed menu open
        if (!this.searchFocused)
            this.hovering = false;
    }

    @listener("reset-filter")
    private _resetFilter() {
        this.filter = "";
    }

    // The tree's rows render the item regions, which may follow this state
    @observer("collapsed", "hovering", "filter", "activeProgramUnit", { allowUndefined: true })
    private _stateChanged() {
        if (hasItemExtensions())
            menuExtensionEvents.dispatchEvent(new Event("state"));
    }

    private _searchFocusedChanged(searchFocused: boolean, wasFocused: boolean) {
        if (!this.collapsed)
            return;

        if (searchFocused)
            this.hovering = true;
        else if (wasFocused) {
            // Only a blur, not the initial value: give clicks time to complete, then check whether the mouse is still
            // over the menu, unless the search got the focus back meanwhile
            setTimeout(() => {
                if (!this.searchFocused && !this.matches(":hover"))
                    this.hovering = false;
            }, 100);
        }
    }

    private _filterChanged(filter: string) {
        clearTimeout(this._instantSearchTimeout);

        if (!filter) {
            this.instantSearchResults = null;
            return;
        }

        if (!this.instantSearchDelay)
            return;

        this._instantSearchTimeout = setTimeout(async () => {
            const results = await this.service.getInstantSearch(filter);
            if (filter !== this.filter)
                return;

            this.instantSearchResults = results.length > 0 ? results.map(r => ({ ...r, href: `${Path.routes.rootPath ?? ""}PersistentObject.${r.id}/${r.objectId}` })) : null;
        }, this.instantSearchDelay);
    }

    private _search() {
        if (this.collapsed && this.filter)
            Popup.closeAll();

        if (!this.filtering || !this.hasGlobalSearch)
            return;

        this.app.changePath((<App>this.app).getUrlForPersistentObject(this.service.application.globalSearchId, this.filter));
        this.filter = "";
    }

    private _toggleCollapse() {
        this.collapsed = !this.collapsed;
        Vidyano.cookie("menu-collapsed", String(this.collapsed));
    }

    private _resizerPointerdown(e: PointerEvent) {
        if (e.button !== 0)
            return;

        // Keeps the drag from selecting text
        e.preventDefault();

        (<HTMLElement>e.currentTarget).setPointerCapture(e.pointerId);

        this.app.isTracking = true;
        this._resizeStartX = e.clientX;
        this._resizeStartWidth = this._resizeWidth = Math.max(Menu._minResizeWidth, this.offsetWidth);
        this.style.setProperty("--vi-menu--expand-width", `${this._resizeWidth}px`);
        this.isResizing = true;
    }

    private _resizerPointermove(e: PointerEvent) {
        if (!this.isResizing)
            return;

        this._resizeWidth = Math.max(Menu._minResizeWidth, this._resizeStartWidth + e.clientX - this._resizeStartX);
        this.style.setProperty("--vi-menu--expand-width", `${this._resizeWidth}px`);
    }

    private _resizerPointerup() {
        if (!this.isResizing)
            return;

        Vidyano.cookie("menu-width", String(this._resizeWidth));

        this.isResizing = false;
        this.app.isTracking = false;
    }

    private _labelSlotchange(e: Event) {
        const slot = e.target as HTMLSlotElement;
        this.hasCustomLabel = slot.assignedElements({ flatten: true }).length > 0;
    }

    private _isFirstRunProgramUnit(application: Vidyano.Application, programUnit: Vidyano.ProgramUnit): boolean {
        if (application && application.programUnits.length === 2) {
            if (application.programUnits[0] === programUnit && programUnit.name === "Home" && programUnit.items.length === 0)
                return application.programUnits[1].path.contains("e683de37-2b39-45e9-9522-ef69c3f0287f");
        }

        return false;
    }

    private async _add() {
        const query = await this.service.getQuery("5a4ed5c7-b843-4a1b-88f7-14bd1747458b");
        if (!query)
            return;

        if (query.items.length === 0) {
            this.app.showMessageDialog({
                title: "Add menu item",
                message: "Your application contains no persistent objects.\n\nFor more information [Getting Started](https://vidyano.com/gettingstarted)",
                actions: [this.translateMessage("OK")],
                actionTypes: ["Danger"],
                rich: true
            });

            return;
        }

        await this.app.showDialog(new SelectReferenceDialog(query));
        if (!query.selectedItems || query.selectedItems.length === 0)
            return;

        try {
            await this.service.executeAction("System.AddQueriesToProgramUnit", null, query, query.selectedItems, { Id: this.service.application.programUnits[0].id });
            document.location.reload();
        }
        catch (e) {
            this.app.showMessageDialog({
                title: "Add menu item",
                message: e,
                actions: [this.translateMessage("OK")],
                actionTypes: ["Danger"]
            });
        }
    }

    private _instantSearchResultMouseenter(e: MouseEvent, result: InstantSearchResult) {
        const anchor = <HTMLAnchorElement>e.currentTarget;
        const div = anchor.querySelector("div");
        anchor.setAttribute("title", div.offsetWidth < div.scrollWidth ? result.breadcrumb : "");
    }

    private _renderBreadcrumb(breadcrumb: string) {
        const escaped = this.filter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const parts = breadcrumb.split(new RegExp(`(${escaped})`, "gi"));
        return parts.map((part, index) => index % 2 === 1 ? html`<span class="match">${part}</span>` : part);
    }

    private _renderInstantSearch() {
        if (!this.instantSearchResults)
            return nothing;

        return html`
            <div class="instantSearch">
                ${this.instantSearchResults.map(result => html`
                    <a href=${result.href} @mouseenter=${(e: MouseEvent) => this._instantSearchResultMouseenter(e, result)}><div>${this._renderBreadcrumb(result.breadcrumb)}</div><span class="label">${result.label}</span></a>
                `)}
            </div>
        `;
    }

    render() {
        const application = this.service?.application;

        return html`
            <div class="container">
                <header>
                    <div class="background">
                        ${renderRegion("header", this, () => html`
                            <div class="label">
                                <span ?hidden=${this.hasCustomLabel}>${this.label}</span>
                                <slot name="label" @slotchange=${this._labelSlotchange}></slot>
                            </div>
                        `)}
                    </div>
                    ${renderRegion("search", this, () => html`
                        <vi-input-search
                            .value=${this.filter}
                            @value-changed=${(e: CustomEvent) => this.filter = e.detail.value}
                            .focused=${this.searchFocused}
                            @focused-changed=${(e: CustomEvent) => this.searchFocused = e.detail.value}
                            @search=${this._search}></vi-input-search>
                    `)}
                </header>
                <main>
                    <vi-scroller class="program-units" no-horizontal>
                        ${this._renderInstantSearch()}
                        ${renderRegion("before-items", this, () => nothing)}
                        ${repeat(this.programUnits ?? [], unit => unit, unit => html`
                            <vi-menu-program-unit .item=${unit} .filter=${this.filter} .activeProgramUnit=${this.activeProgramUnit} .collapsed=${this.collapsed} .hovering=${this.hovering}></vi-menu-program-unit>
                            ${this._isFirstRunProgramUnit(application, unit) ? html`<div id="add" @click=${this._add}>+ Add menu item</div>` : nothing}
                        `)}
                        ${renderRegion("after-items", this, () => nothing)}
                    </vi-scroller>
                </main>
                <footer>
                    ${renderRegion("footer", this, () => html`<slot name="footer"></slot>`)}
                    ${renderRegion("user", this, () => html`<vi-user></vi-user>`)}
                </footer>
            </div>

            <div id="toggle">${renderRegion("toggle", this, () => html`<vi-button id="toggleCollapse" icon="Menu_Collapse" @click=${this._toggleCollapse}></vi-button>`)}</div>
            <div id="resizer" @pointerdown=${this._resizerPointerdown} @pointermove=${this._resizerPointermove} @pointerup=${this._resizerPointerup} @pointercancel=${this._resizerPointerup}></div>
        `;
    }
}

customElements.define("vi-menu", Menu);
