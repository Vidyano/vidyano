import { html, unsafeCSS } from "lit";
import { property } from "lit/decorators.js";
import * as Vidyano from "@vidyano/core";
import "@polymer/paper-ripple";
import { computed, observer } from "components/web-component/web-component";
import { extendMenuNode, MenuNodeRegion, MenuNodeRender } from "./menu-extensions";
import { MenuNode } from "./menu-node";
import styles from "./menu-group.css";

/**
 * A group of program unit items in the menu. Its title toggles the children, which also show while filtering.
 */
export class MenuGroup extends MenuNode {
    static styles = unsafeCSS(styles);

    /**
     * Adds content to a region of every group row of every vi-menu: start, before its icon, or end, after its title.
     * The render function gets the menu and the row's ProgramUnitItemGroup.
     * @returns A function that removes the content again.
     */
    static extend(region: MenuNodeRegion, render: MenuNodeRender<Vidyano.ProgramUnitItemGroup>): () => void {
        return extendMenuNode("group", region, render);
    }

    /** Whether the children show: when the group is expanded or the menu is filtering. */
    @property({ type: Boolean, reflect: true })
    @computed(function(this: MenuGroup, expanded: boolean, filtering: boolean): boolean {
        return expanded || filtering;
    }, "expanded", "filtering")
    declare readonly open: boolean;

    /**
     * Collapses this group and every group below it.
     */
    collapseAll() {
        this.expanded = false;
        this.shadowRoot?.querySelectorAll<MenuGroup>("vi-menu-group").forEach(group => group.collapseAll());
    }

    render() {
        const group = this.item as Vidyano.ProgramUnitItemGroup;

        return html`
            <div class="item" part="group">
                ${this.renderRegion("group", "start")}
                <a class="link" @click=${this._toggle}>
                    <paper-ripple></paper-ripple>
                    ${this.renderTitle("group")}
                </a>
                ${this.renderRegion("group", "end")}
                ${this.renderIcon("group-toggle")}
            </div>
            <div class="children" part="group-children" ?inert=${!this.open}>
                <div class="content">${this.renderChildren(group?.items)}</div>
            </div>
        `;
    }

    @observer("open")
    private _openChanged(open: boolean) {
        if (open)
            return;

        // Blur a focused descendant before its content closes
        this.blurFocusedWithin(this.shadowRoot?.querySelector(".children"));
    }

    private _toggle(e: Event) {
        e.preventDefault();
        this.expanded = !this.expanded;
    }
}

customElements.define("vi-menu-group", MenuGroup);
