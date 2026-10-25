import { html, unsafeCSS } from "lit"
import { property, state } from "lit/decorators.js"
import * as Vidyano from "@vidyano/core"
import { WebComponent, computed } from "components/web-component/web-component"
import * as IconRegister from "components/icon/icon-register"
import "components/popup-menu/popup-menu"
import { Popup } from "components/popup/popup"
import styles from "./query-grid-grouping.css"

IconRegister.add("QueryGrid_Group_Collapse", `
    <svg viewBox="0 0 32 32">
        <g>
            <path d="M 10,3 H 22 L 16,9 Z" />
            <path d="m 6,11.666666 h 20 v 3 H 6 Z" />
            <path d="m 6,17.333333 h 20 v 3 H 6 Z" />
            <path d="m 16,23 -6,6 h 12 z" />
        </g>
    </svg>`);

IconRegister.add("QueryGrid_Group_Expand", `
    <svg viewBox="0 0 32 32">
        <g>
            <path d="M 10,9 H 22 L 16,3 Z" />
            <path d="m 6,11.666666 h 20 v 3 H 6 Z" />
            <path d="m 6,17.333333 h 20 v 3 H 6 Z" />
            <path d="M 16,29 10,23 H 22 Z" />
        </g>
    </svg>`);

export class QueryGridGrouping extends WebComponent {
    static styles = unsafeCSS(styles);

    @property({ type: Object })
    query: Vidyano.Query;

    @state()
    @computed("query.isBusy")
    private declare readonly _isBusy: boolean;

    render() {
        return html`
            <vi-popup-menu ?disabled=${this._isBusy}>
                <vi-button slot="header" icon="QueryGrid_Group" inverse ?disabled=${this._isBusy}></vi-button>
                <vi-popup-menu-item icon="QueryGrid_Group_Collapse" label="Collapse all" @click=${() => this._setCollapsed(true)}></vi-popup-menu-item>
                <vi-popup-menu-item icon="QueryGrid_Group_Expand" label="Expand all" @click=${() => this._setCollapsed(false)}></vi-popup-menu-item>
                <vi-popup-menu-item-separator></vi-popup-menu-item-separator>
                <vi-popup-menu-item icon="Remove" label="Remove grouping" @click=${this._remove}></vi-popup-menu-item>
            </vi-popup-menu>
        `;
    }

    private _setCollapsed(collapse: boolean) {
        this.query.groupingInfo.groups.forEach(g => g.isCollapsed = collapse);

        Popup.closeAll();

        this.dispatchEvent(new CustomEvent("scroll-top", {
            bubbles: true,
            composed: true
        }));
    }

    private _remove() {
        Popup.closeAll();
        this.query.group("");
    }
}

customElements.define("vi-query-grid-grouping", QueryGridGrouping);
