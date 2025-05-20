import * as Vidyano from "vidyano"
import * as Polymer from "polymer"
import { Path } from "libs/pathjs/pathjs.js"
import "@polymer/iron-collapse"
import { App } from "components/app/app.js"
import { AppCacheEntryPersistentObject } from "components/app-cache/app-cache-entry-persistent-object.js"
import { AppCacheEntryQuery } from "components/app-cache/app-cache-entry-query.js"
import * as IconRegister from "components/icon/icon-register.js"
import { Menu } from "./menu.js"
import { SelectReferenceDialog } from "components/select-reference-dialog/select-reference-dialog.js"
import "components/scroller/scroller.js"
import { ConfigurableWebComponent } from "components/web-component/web-component-configurable.js"

@ConfigurableWebComponent.register({
    properties: {
        item: Object,
        items: Array,
        level: {
            type: Number,
            value: 0
        },
        subLevel: {
            type: Number,
            computed: "_computeSubLevel(level)"
        },
        collapsed: {
            type: Boolean,
            reflectToAttribute: true,
            value: false
        },
        programUnit: {
            type: Object,
            observer: "_programUnitChanged"
        },
        hasItems: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computedHasItems(item)"
        },
        isSeparator: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computedIsSeparator(item)"
        },
        icon: {
            type: String,
            computed: "_computeIcon(item)"
        },
        expand: {
            type: Boolean,
            readOnly: true,
            reflectToAttribute: true,
            observer: "_expandChanged",
            value: false
        },
        filtering: {
            type: Boolean,
            reflectToAttribute: true,
            value: false
        },
        filter: {
            type: String,
            observer: "_filterChanged",
            value: ""
        },
        filterParent: Object,
        hidden: {
            type: Boolean,
            reflectToAttribute: true
        },
        href: {
            type: String,
            computed: "_computedHref(item, app)"
        },
        target: {
            type: String,
            computed: "_computedTarget(href)"
        },
        rel: {
            type: String,
            computed: "_computedRel(item, href)"
        },
        collapseGroupsOnTap: {
            type: Boolean,
            reflectToAttribute: true
        }
    },
    observers: [
        "_updateItemTitle(item, filter, filtering, collapsed)",
        "_updateIndentVariable(level)",
        "_updateOpened(filtering, item, expand)"
    ],
    listeners: {
        "tap": "_tap",
        "vi:configure": "_configure"
    },
    serviceBusObservers: {
        "vi-menu-item:select": "_onServiceBusSelect"
    }
})
export class MenuItem extends ConfigurableWebComponent {
    static get template() { return Polymer.html`<link rel="import" href="menu-item.html">`; }

    readonly expand: boolean; private _setExpand: (val: boolean) => void;
    collapseGroupsOnTap: boolean;
    item: Vidyano.ProgramUnitItem;
    programUnit: Vidyano.ProgramUnit;
    collapsed: boolean;
    filter: string;
    filtering: boolean;
    hidden: boolean;
    filterParent: Vidyano.ProgramUnitItem;

    private _updateIndentVariable(level: number) {
        this.style.setProperty("--vi-menu-item-indent-level", level.toString());
    }

    private _computeSubLevel(level: number): number {
        return level + 1;
    }

    private _collapseRecursive() {
        if (!this.collapseGroupsOnTap)
            this._setExpand(false);

        Array.prototype.forEach.call(this.shadowRoot.querySelectorAll("vi-menu-item[has-items]"), (item: MenuItem) => item._collapseRecursive());
    }

    private _tap(e: Event) {
        if (!this.filtering && this.collapseGroupsOnTap)
            this._collapseRecursive();

        if (!this.item || !this.item.path) {
            e.preventDefault();
            this._setExpand(!this.expand);
        }
        else {
            let item = this.item;
            if (item instanceof Vidyano.ProgramUnit && item.openFirst && item.items)
                item = (<Vidyano.ProgramUnit>item).items[0];

            if (item instanceof Vidyano.ProgramUnitItemQuery)
                (<App>this.app).cacheRemove(new AppCacheEntryQuery((<Vidyano.ProgramUnitItemQuery>item).queryId));
            else if (item instanceof Vidyano.ProgramUnitItemPersistentObject)
                (<App>this.app).cacheRemove(new AppCacheEntryPersistentObject((<Vidyano.ProgramUnitItemPersistentObject>item).persistentObjectId, (<Vidyano.ProgramUnitItemPersistentObject>item).persistentObjectObjectId));

            if (this.filtering && this.app.configuration.getSetting("vi-menu.sticky-search", "false").toLowerCase() !== "true")
                this.fire("reset-filter", null);
        }

        e.stopPropagation();
    }

    private _expandChanged(expand: boolean) {
        (<any>this.$.subItems).opened = expand;
    }

    private _filterChanged() {
        this.filtering = !String.isNullOrEmpty(this.filter);
        this.hidden = this.filtering && !this._hasMatch(<Vidyano.ProgramUnitItem><any>this.item, this.filter.toUpperCase());
    }

    private _updateOpened(filtering: boolean, item: Vidyano.ProgramUnitItem, expand: boolean) {
        (<any>this.$.subItems).opened = filtering || item === this.programUnit || expand;
    }

    private _hasMatch(item: Vidyano.ProgramUnitItem, search: string): boolean {
        if (!item)
            return false;

        if (item.title.toUpperCase().contains(search))
            return true;

        const items = (<any>item).items;
        if (items != null && items.filter(i => this._hasMatch(i, search)).length > 0)
            return true;

        return this.filterParent instanceof Vidyano.ProgramUnitItemGroup && this.filterParent.title.toUpperCase().contains(search);
    }

    private _programUnitChanged() {
        if (!this.classList.contains("program-unit"))
            return;

        this._setExpand(this.item && (this.item === this.programUnit || this.collapsed));
    }

    private _updateItemTitle(item: Vidyano.ProgramUnitItem, filter: string, filtering: boolean, collapsed: boolean) {
        if (item instanceof Vidyano.ProgramUnit && collapsed)
            this.$.title.textContent = item.title[0];
        else if (filtering && this._hasMatch(item, this.filter.toUpperCase())) {
            const exp = new RegExp(`(${filter})`, "gi");
            this.$.title.innerHTML = item.title.replace(exp, "<span class='style-scope vi-menu-item match'>$1</span>");
        }
        else
            this.$.title.textContent = item.title;
    }

    private _computeIcon(item: Vidyano.ProgramUnitItem): string {
        let prefix: string;

        if (item instanceof Vidyano.ProgramUnitItemGroup)
            return "ProgramUnitGroup";

        if (item instanceof Vidyano.ProgramUnit) {
            if (item.offset === 2147483647)
                return "ProgramUnit_Vidyano";
            else
                prefix = "ProgramUnit_";
        }
        else if (item instanceof Vidyano.ProgramUnitItemQuery)
            prefix = "ProgramUnitItem_Query_";
        else if (item instanceof Vidyano.ProgramUnitItemPersistentObject)
            prefix = "ProgramUnitItem_PersistentObject_";
        else if (item instanceof Vidyano.ProgramUnitItemUrl)
            prefix = "ProgramUnitItem_Url_";

        if (IconRegister.exists(prefix + item.name))
             return prefix + item.name;

        return null;
    }

    private _computedHasItems(item: Vidyano.ProgramUnitItem): boolean {
        return (item instanceof Vidyano.ProgramUnit || item instanceof Vidyano.ProgramUnitItemGroup) && item.items.length > 0;
    }

    private _computedIsSeparator(item: Vidyano.ProgramUnitItem): boolean {
        return item instanceof Vidyano.ProgramUnitItemSeparator;
    }

    private _computedHref(item: Vidyano.ProgramUnitItem, app: App): string {
        if (!item || !app)
            return undefined;

        if (item instanceof Vidyano.ProgramUnitItemUrl)
            return item.path;

        return (this.item && !(item instanceof Vidyano.ProgramUnitItemGroup)) ? Path.routes.rootPath + this.item.path : undefined;
    }

    private _computedTarget(href: string) {
        return href?.startsWith("http") ? null : "_blank";
    }

    private _computedRel(item: Vidyano.ProgramUnitItemUrl, href: string): string {
        if (item instanceof Vidyano.ProgramUnitItemUrl && href?.startsWith("http"))
            return "external noopener";

        return null;
    }

    private _titleMouseenter() {
        this.$.title.setAttribute("title", (<HTMLElement>this.$.title).offsetWidth < this.$.title.scrollWidth ? this.item.title : "");
    }

    private _onServiceBusSelect(sender: any, message: string, { name }: { name: string; }) {
        if (this.item.name === name) {
            this.findParent(e => {
                if (e instanceof Menu)
                    return true;

                if (e instanceof MenuItem && !e.expand)
                    e._setExpand(true);
            });
        }
    }

    private _configure(e: CustomEvent) {
        if (!this.item.path || this.item.path.startsWith("Management/"))
            return;

        if (this.item instanceof Vidyano.ProgramUnit) {
            e.detail.push({
                label: `Program unit: ${this.item.name}`,
                icon: "viConfigure",
                action: () => this.app.changePath(`Management/PersistentObject.b53ec1cd-e0b3-480f-b16d-bf33b133c05c/${this.item.name}`),
                subActions: [
                    {
                        label: "Add Query",
                        icon: "Add",
                        action: async () => {
                            const query = await this.service.getQuery("5a4ed5c7-b843-4a1b-88f7-14bd1747458b");
                            if (!query)
                                return;

                            await this.app.showDialog(new SelectReferenceDialog(query));
                            if (!query.selectedItems || query.selectedItems.length === 0)
                                return;

                            await this.service.executeAction("System.AddQueriesToProgramUnit", null, query, query.selectedItems, { Id: this.item.id });
                            document.location.reload();
                        }
                    }
                ]
            });

            e.detail.push();
        }
        else if (this.item instanceof Vidyano.ProgramUnitItem) {
            e.detail.push({
                label: `Program unit item: ${this.item.name}`,
                icon: "viConfigure",
                action: () => this.app.changePath(`Management/PersistentObject.68f7b99e-ce10-4d43-80fb-191b6742d53c/${this.item.name}`)
            });
        }
    }
}