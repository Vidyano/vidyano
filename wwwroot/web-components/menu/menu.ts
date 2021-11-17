import * as Vidyano from "../../libs/vidyano/vidyano.js"
import * as Polymer from "../../libs/@polymer/polymer.js"
import { Path } from "../../libs/pathjs/pathjs.js"
import { App } from "../app/app.js"
import "../button/button.js"
import "../input-search/input-search.js"
import type { InputSearch } from "../input-search/input-search.js"
import "./menu-item.js"
import { Popup } from "../popup/popup.js"
import { SelectReferenceDialog } from "../select-reference-dialog/select-reference-dialog.js"
import { WebComponent, WebComponentListener } from "../web-component/web-component.js"
import "../user/user.js"

@WebComponent.register({
    properties: {
        label: String,
        activeProgramUnit: Object,
        programUnits: Array,
        collapsed: {
            type: Boolean,
            reflectToAttribute: true
        },
        collapsedWithGlobalSearch: {
            type: Boolean,
            computed: "_computeCollapsedWithGlobalSearch(collapsed, hasGlobalSearch)"
        },
        hasGlobalSearch: {
            type: Boolean,
            computed: "_computeHasGlobalSearch(app.service.application.globalSearchId)"
        },
        instantSearchDelay: {
            type: Number,
            computed: "_computeInstantSearchDelay(app.service.application)"
        },
        instantSearchResults: {
            type: Array,
            readOnly: true,
            value: null
        },
        filter: {
            type: String,
            observer: "_filterChanged"
        },
        filtering: {
            type: Boolean,
            reflectToAttribute: true
        },
        currentProgramUnit: Object,
        isResizing: {
            type: Boolean,
            reflectToAttribute: true,
            readOnly: true
        },
        hideSearch: {
            type: Boolean,
            reflectToAttribute: true
        }
    },
    listeners: {
        "reset-filter": "_resetFilter"
    }
})
export class Menu extends WebComponentListener(WebComponent) {
    static get template() { return Polymer.html`<link rel="import" href="menu.html">`; }

    private static _minResizeWidth: number;
    private _resizeWidth: number;
    private _instantSearchDebouncer: Polymer.Debounce.Debouncer;
    readonly instantSearchDelay: number;
    readonly instantSearchResults: Vidyano.IInstantSearchResult[]; private _setInstantSearchResults: (results: Vidyano.IInstantSearchResult[]) => void;
    readonly isResizing: boolean; private _setIsResizing: (val: boolean) => void;
    filter: string;
    filtering: boolean;
    activeProgramUnit: Vidyano.ProgramUnit;
    collapsed: boolean;
    hasGlobalSearch: boolean;
    hideSearch: boolean;

    connectedCallback() {
        super.connectedCallback();

        this.hideSearch = this.app.configuration.getSetting("vi-menu.hide-search", "false").toLowerCase() === "true";

        // TODO
        // Array.from(Polymer.dom(this.app).querySelectorAll("[vi-menu-element~='footer']")).forEach(element => Polymer.dom(this.$.footerElements).appendChild(element));
        // Array.from(Polymer.dom(this.app).querySelectorAll("[vi-menu-element~='header']")).forEach(element => Polymer.dom(this.$.headerElements).appendChild(element));

        if (!Menu._minResizeWidth)
            Menu._minResizeWidth = this.offsetWidth;

        const menuWidth = parseInt(Vidyano.cookie("menu-width"));
        if (menuWidth)
            this.style.setProperty("--vi-menu--expand-width", `${menuWidth}px`);

        this.collapsed = Boolean.parse(Vidyano.cookie("menu-collapsed"));
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        // TODO
        // Array.from(Polymer.dom(this.$.footerElements).children).forEach(element => Polymer.dom(this.app).appendChild(element));
        // Array.from(Polymer.dom(this.$.headerElements).children).forEach(element => Polymer.dom(this.app).appendChild(element));
    }

    private _filterChanged() {
        this.filtering = !String.isNullOrEmpty(this.filter);

        if (this.filtering) {
            if (this.instantSearchDelay) {
                const filter = this.filter;
                this._instantSearchDebouncer = Polymer.Debounce.Debouncer.debounce(this._instantSearchDebouncer, Polymer.Async.timeOut.after(this.instantSearchDelay), async () => {
                    const results = await this.service.getInstantSearch(filter);
                    if (filter !== this.filter)
                        return;

                    const exp = new RegExp(`(${filter})`, "gi");
                    this._setInstantSearchResults(results.length > 0 ? results.map(r => {
                        r["match"] = r.breadcrumb.replace(exp, "<span class='style-scope vi-menu match'>$1</span>");
                        r["href"] = `${Path.routes.rootPath}PersistentObject.${r.id}/${r.objectId}`;

                        return r;
                    }) : null);
                });
            }
        }
        else if (this._instantSearchDebouncer) {
            this._instantSearchDebouncer.cancel();
            this._instantSearchDebouncer = null;
            this._setInstantSearchResults(null);
        }
    }

    private _search() {
        if (this.collapsed && this.filter)
            Popup.closeAll();

        if (!this.filtering || !this.hasGlobalSearch)
            return;

        this.app.changePath((<App>this.app).getUrlForPersistentObject(this.service.application.globalSearchId, this.filter));
        this.filter = "";
    }

    private _computeHasGlobalSearch(globalSearchId: string): boolean {
        return globalSearchId !== "00000000-0000-0000-0000-000000000000";
    }

    private _computeInstantSearchDelay(application: Vidyano.Application): number {
        return application.getAttributeValue("InstantSearchDelay");
    }

    private _computeCollapsedWithGlobalSearch(collapsed: boolean, hasGlobalSearch: boolean): boolean {
        return collapsed && hasGlobalSearch;
    }

    private _toggleCollapse() {
        this.collapsed = !this.collapsed;
        Vidyano.cookie("menu-collapsed", String(this.collapsed));
    }

    private _hasGroupItems(programUnitItems: Vidyano.ProgramUnitItemGroup[]): boolean {
        return !!programUnitItems && programUnitItems.some(item => item instanceof Vidyano.ProgramUnitItemGroup);
    }

    private _programUnitItemsCount(programUnitItems: any[]): number {
        return !!programUnitItems ? programUnitItems.length : 0;
    }

    private _focusSearch() {
        const inputSearch = <InputSearch>this.shadowRoot.querySelector("#collapsedInputSearch");
        this._focusElement(inputSearch);
    }

    private _catchInputSearchTap(e: CustomEvent) {
        e.stopPropagation();
    }

    private _resetFilter(e: CustomEvent) {
        this.filter = "";
    }

    private _onResize(e: Polymer.Gestures.TrackEvent) {
        if (e.detail.state === "start") {
            this.app.isTracking = true;
            this._resizeWidth = Math.max(Menu._minResizeWidth, this.offsetWidth);
            this.style.setProperty("--vi-menu--expand-width", `${this._resizeWidth}px`);
            this._setIsResizing(true);
        }
        else if (e.detail.state === "track") {
            this._resizeWidth = Math.max(Menu._minResizeWidth, this._resizeWidth + e.detail.ddx);
            this.style.setProperty("--vi-menu--expand-width", `${this._resizeWidth}px`);
        }
        else if (e.detail.state === "end") {
            Vidyano.cookie("menu-width", String(this._resizeWidth));
            this._setIsResizing(false);
            this.app.isTracking = false;
        }
    }

    private _isFirstRunProgramUnit(application: Vidyano.Application, programUnit: Vidyano.ProgramUnit): boolean {
        if (application && application.programUnits.length === 2) {
            if (application.programUnits[0] === programUnit && programUnit.name === "Home" && programUnit.items.length === 0)
                return application.programUnits[1].path.contains("e683de37-2b39-45e9-9522-ef69c3f0287f");
        }

        return false;
    }

    private async _add(e: CustomEvent) {
        const query = (await Promise.all([this.service.getQuery("5a4ed5c7-b843-4a1b-88f7-14bd1747458b"), this.app.importComponent("SelectReferenceDialog")]))[0] as Vidyano.Query;
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

        const dialog = new SelectReferenceDialog(query);
        this.app.showDialog(dialog).then(async () => {
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
        });
    }

    private _instantSearchResultMouseEnter(e: MouseEvent) {
        const anchor = <HTMLAnchorElement>e.target;
        const div = anchor.querySelector("div");
        anchor.setAttribute("title", div.offsetWidth < div.scrollWidth ? e["model"].item.breadcrumb : "");
    }
}