import { html, unsafeCSS } from "lit";
import { ifDefined } from "lit/directives/if-defined.js";
import type * as Vidyano from "@vidyano/core";
import { IConfigurableAction, WebComponentConfigurationController } from "components/web-component/web-component-configuration-controller";
import { extendMenuNode, MenuNodeRegion, MenuNodeRender } from "./menu-extensions";
import { isModifiedClick, MenuNode } from "./menu-node";
import styles from "./menu-item.css";

/**
 * A menu leaf that navigates: a query, persistent object or url program unit item.
 */
export class MenuItem extends MenuNode {
    static styles = unsafeCSS(styles);

    /**
     * Adds content to a region of every item row of every vi-menu: start, before its icon, or end, after its title.
     * The render function gets the menu and the row's item.
     * @returns A function that removes the content again.
     */
    static extend(region: MenuNodeRegion, render: MenuNodeRender<Vidyano.ProgramUnitItem>): () => void {
        return extendMenuNode("item", region, render);
    }

    readonly #configurable = new WebComponentConfigurationController(this, (actions: IConfigurableAction[]) => {
        if (!this.item?.path || this.item.path.startsWith("Management/"))
            return;

        actions.push({
            label: `Program unit item: ${this.item.name}`,
            icon: "viConfigure",
            action: () => this.app.changePath(`Management/PersistentObject.68f7b99e-ce10-4d43-80fb-191b6742d53c/${this.item.name}`)
        });
    });

    render() {
        const link = this.linkFor(this.item);

        return html`
            <div class="item" part="item">
                ${this.renderRegion("item", "start")}
                <a class="link" href=${ifDefined(link.href)} target=${ifDefined(link.target)} rel=${ifDefined(link.rel)} @click=${this._onClick}>
                    <paper-ripple></paper-ripple>
                    ${this.renderIcon("item-icon")}
                    ${this.renderTitle("item")}
                </a>
                ${this.renderRegion("item", "end")}
            </div>
        `;
    }

    // The click keeps bubbling: the app follows the link from its own click listener. A Ctrl, Shift, Alt or middle
    // click opens it elsewhere and leaves this tab's filter and cache as they are.
    private _onClick(e: MouseEvent) {
        if (!isModifiedClick(e))
            this.navigating(this.item);
    }
}

customElements.define("vi-menu-item", MenuItem);
