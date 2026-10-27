import { html, unsafeCSS } from "lit";
import { MenuNode } from "./menu-node";
import styles from "./menu-separator.css";

/**
 * A line between program unit items. It never matches the menu's filter, so it hides while filtering.
 */
export class MenuSeparator extends MenuNode {
    static styles = unsafeCSS(styles);

    render() {
        return html`<div class="line"></div>`;
    }
}

customElements.define("vi-menu-separator", MenuSeparator);
