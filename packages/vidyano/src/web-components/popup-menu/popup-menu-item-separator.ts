import { unsafeCSS } from "lit";
import { WebComponent } from "components/web-component/web-component";
import styles from "./popup-menu-item-separator.css";

export class PopupMenuItemSeparator extends WebComponent {
    static styles = unsafeCSS(styles);
}

customElements.define("vi-popup-menu-item-separator", PopupMenuItemSeparator);
