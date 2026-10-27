import { html, unsafeCSS } from "lit";
import { ifDefined } from "lit/directives/if-defined.js";
import { IConfigurableAction, WebComponentConfigurationController } from "components/web-component/web-component-configuration-controller";
import { isModifiedClick, MenuNode } from "./menu-node";
import styles from "./menu-item.css";

/**
 * A menu leaf that navigates: a query, persistent object or url program unit item.
 */
export class MenuItem extends MenuNode {
    static styles = unsafeCSS(styles);

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
            <div class="item">
                ${this.renderItemRegion("item-start")}
                <a class="link" href=${ifDefined(link.href)} target=${ifDefined(link.target)} rel=${ifDefined(link.rel)} @click=${this._onClick}>
                    <paper-ripple></paper-ripple>
                    ${this.renderIcon()}
                    ${this.renderTitle()}
                </a>
                ${this.renderItemRegion("item-end")}
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
