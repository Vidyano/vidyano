import { html, nothing, TemplateResult } from "lit";
import { property } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import * as Vidyano from "@vidyano/core";
import { Path } from "libs/pathjs/pathjs";
import type { App } from "components/app/app";
import { AppCacheEntryPersistentObject } from "components/app-cache/app-cache-entry-persistent-object";
import { AppCacheEntryQuery } from "components/app-cache/app-cache-entry-query";
import * as IconRegister from "components/icon/icon-register";
import { computed, observer, serviceBusObserver, WebComponent } from "components/web-component/web-component";
import type { Menu } from "./menu";
import { MenuExtensionsController, MenuItemRegion, renderItemRegion } from "./menu-extensions";

/**
 * Shared base of the menu tree nodes: vi-menu-program-unit, vi-menu-group, vi-menu-item and vi-menu-separator.
 * It holds what every node does the same way: filtering, the highlighted title, the icon and
 * expanding its ancestors on the "vi-menu-item:select" ServiceBus message.
 */
export abstract class MenuNode extends WebComponent {
    private _menu: Menu;
    private _extensions = new MenuExtensionsController(this, true);

    /** The program unit item this node shows. */
    @property({ type: Object })
    item: Vidyano.ProgramUnitItem;

    /** The menu's search text; nodes that don't match it hide themselves. */
    @property({ type: String })
    filter: string = "";

    /** The node's parent item: a child of a group whose title matches the filter matches too. */
    @property({ type: Object })
    filterParent: Vidyano.ProgramUnitItem;

    /** Whether the children are shown. Only containers (program units and groups) use it. */
    @property({ type: Boolean, reflect: true })
    expanded: boolean = false;

    @property({ type: Boolean, reflect: true })
    @computed(function(this: MenuNode, filter: string): boolean {
        return !!filter;
    }, "filter")
    declare readonly filtering: boolean;

    @property({ type: String })
    @computed(function(this: MenuNode, item: Vidyano.ProgramUnitItem): string {
        return MenuNode.iconFor(item);
    }, "item")
    declare readonly icon: string;

    /**
     * Whether the item, one of its descendants or its parent group matches the search text.
     * @param search - The upper-cased search text.
     */
    static matches(item: Vidyano.ProgramUnitItem, search: string, filterParent?: Vidyano.ProgramUnitItem): boolean {
        if (!item)
            return false;

        if (item.title?.toUpperCase().includes(search))
            return true;

        const items = (item as Vidyano.ProgramUnitItemGroup).items as Vidyano.ProgramUnitItem[];
        if (items?.some(i => MenuNode.matches(i, search)))
            return true;

        return filterParent instanceof Vidyano.ProgramUnitItemGroup && filterParent.title.toUpperCase().includes(search);
    }

    /**
     * The icon name for an item, or null when it has none.
     */
    static iconFor(item: Vidyano.ProgramUnitItem): string {
        if (!item)
            return null;

        if (item instanceof Vidyano.ProgramUnitItemGroup)
            return "ProgramUnitGroup";

        if (item instanceof Vidyano.ProgramUnit) {
            if (item.icon)
                return item.icon;

            if (item.offset === 2147483647)
                return "ProgramUnit_Vidyano";

            const candidates = [`ProgramUnit_${item.name}`, item.nameKebab ? `ProgramUnit_${item.nameKebab}` : null].filter(Boolean) as string[];
            return candidates.find(icon => IconRegister.exists(icon)) ?? "ProgramUnit_Default$";
        }

        let prefix: string;
        if (item instanceof Vidyano.ProgramUnitItemQuery)
            prefix = "ProgramUnitItem_Query_";
        else if (item instanceof Vidyano.ProgramUnitItemPersistentObject)
            prefix = "ProgramUnitItem_PersistentObject_";
        else if (item instanceof Vidyano.ProgramUnitItemUrl)
            prefix = "ProgramUnitItem_Url_";

        return prefix && IconRegister.exists(prefix + item.name) ? prefix + item.name : null;
    }

    @observer("item", "filter", "filterParent", { allowUndefined: true })
    private _updateHidden(item: Vidyano.ProgramUnitItem, filter: string, filterParent: Vidyano.ProgramUnitItem) {
        this.hidden = !!filter && !MenuNode.matches(item, filter.toUpperCase(), filterParent);
    }

    @serviceBusObserver("vi-menu-item:select")
    private _onSelect(_sender: any, _message: string, detail: { name: string }) {
        if (!this.item || this.item.name !== detail?.name)
            return;

        // Expand every container up to the menu so the selected item shows
        this.findParent(e => {
            if (e instanceof HTMLElement && e.matches("vi-menu"))
                return true;

            if (e instanceof MenuNode)
                e.expanded = true;

            return false;
        });
    }

    /**
     * Renders the item's title with the filter's matches highlighted.
     */
    protected renderTitle(): TemplateResult {
        return html`<span id="title" class="flex" @mouseenter=${this._titleMouseenter}>${this.renderHighlighted(this.item?.title ?? "")}</span>`;
    }

    /**
     * Renders text with every match of the filter wrapped in a span.match.
     */
    protected renderHighlighted(text: string): TemplateResult | string {
        if (!this.filtering || !MenuNode.matches(this.item, this.filter.toUpperCase(), this.filterParent))
            return text;

        const escaped = this.filter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const parts = text.split(new RegExp(`(${escaped})`, "gi"));
        return html`${parts.map((part, index) => index % 2 === 1 ? html`<span class="match">${part}</span>` : part)}`;
    }

    /**
     * Renders the item's icon, if it has one.
     */
    protected renderIcon(): TemplateResult | typeof nothing {
        return this.icon ? html`<vi-icon source=${this.icon} part="icon"></vi-icon>` : nothing;
    }

    /**
     * Renders what Menu.extend adds to an item region of this row, for this node's item.
     */
    protected renderItemRegion(region: MenuItemRegion): TemplateResult | typeof nothing {
        if (!this.item)
            return nothing;

        // Nodes live in vi-menu's shadow tree; a node outside a menu gets null
        this._menu ??= this.findParent<Menu>(e => e instanceof HTMLElement && e.matches("vi-menu"));

        return renderItemRegion(region, this._menu, this.item);
    }

    /**
     * Renders the child items, each as the node element that fits its type.
     */
    protected renderChildren(items: Vidyano.ProgramUnitItem[]): TemplateResult {
        return html`${repeat(items ?? [], item => item, item => renderMenuNode(item, this.filter, this.item))}`;
    }

    /**
     * The link of an item that navigates: its href, target and rel. Groups and separators have none.
     */
    protected linkFor(item: Vidyano.ProgramUnitItem): { href: string; target: string; rel: string } {
        if (!item || item instanceof Vidyano.ProgramUnitItemGroup || item instanceof Vidyano.ProgramUnitItemSeparator || !item.path)
            return { href: undefined, target: undefined, rel: undefined };

        // Outside vi-app no root path is set, which leaves the link relative
        const href = item instanceof Vidyano.ProgramUnitItemUrl ? item.path : (Path.routes.rootPath ?? "") + item.path;
        const external = item instanceof Vidyano.ProgramUnitItemUrl && href.startsWith("http");

        // Only external links open in a new tab; vi-app routes the others in place
        return { href, target: external ? "_blank" : undefined, rel: external ? "external noopener" : undefined };
    }

    /**
     * Call when the user follows the item's link: drops the cached query or persistent object so it
     * loads fresh, and asks vi-menu to clear its search unless the vi-menu.sticky-search setting is on.
     */
    protected navigating(item: Vidyano.ProgramUnitItem) {
        if (item instanceof Vidyano.ProgramUnit && item.openFirst && item.items?.length)
            item = item.items[0];

        if (item instanceof Vidyano.ProgramUnitItemQuery)
            (this.app as App).cacheRemove(new AppCacheEntryQuery(item.queryId));
        else if (item instanceof Vidyano.ProgramUnitItemPersistentObject)
            (this.app as App).cacheRemove(new AppCacheEntryPersistentObject(item.persistentObjectId, item.persistentObjectObjectId));

        if (this.filtering && this.app.configuration.getSetting("vi-menu.sticky-search", "false").toLowerCase() !== "true")
            this.dispatchEvent(new CustomEvent("reset-filter", { bubbles: true, composed: true }));
    }

    private _titleMouseenter(e: MouseEvent) {
        const title = e.currentTarget as HTMLElement;
        title.setAttribute("title", title.offsetWidth < title.scrollWidth ? this.item.title : "");
    }
}

/**
 * Renders the node element that fits the item's type.
 * vi-menu renders program units itself as vi-menu-program-unit, because those take its collapsed and hovering state.
 */
export function renderMenuNode(item: Vidyano.ProgramUnitItem, filter: string, filterParent: Vidyano.ProgramUnitItem): TemplateResult {
    if (item instanceof Vidyano.ProgramUnitItemGroup)
        return html`<vi-menu-group .item=${item} .filter=${filter} .filterParent=${filterParent}></vi-menu-group>`;

    if (item instanceof Vidyano.ProgramUnitItemSeparator)
        return html`<vi-menu-separator .item=${item} .filter=${filter} .filterParent=${filterParent}></vi-menu-separator>`;

    return html`<vi-menu-item .item=${item} .filter=${filter} .filterParent=${filterParent}></vi-menu-item>`;
}
