import { html, unsafeCSS } from "lit"
import { property } from "lit/decorators.js"
import * as Vidyano from "@vidyano/core"
import { WebComponent, listener, observer } from "components/web-component/web-component"
import * as IconRegister from "components/icon/icon-register"
import styles from "./query-grid-row-group.css"

IconRegister.add("QueryGrid_Group_Row", `
    <svg viewBox="0 0 32 32">
        <g>
            <path d="M 24 8 L 8 24 L 24 24 L 24 8 z "></path>
        </g>
    </svg>`);

export class QueryGridRowGroup extends WebComponent {
    static styles = unsafeCSS(styles);

    // Rendered per group row, so isCollapsed is followed with one plain subscription instead of a deep-path forwarder
    #groupDisposer: () => void;

    @property({ type: Object })
    group: Vidyano.QueryResultItemGroup;

    @property({ type: Boolean, reflect: true })
    first: boolean = false;

    @property({ type: Boolean, reflect: true })
    collapsed: boolean = false;

    connectedCallback() {
        super.connectedCallback();

        this._subscribe();
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        this._unsubscribe();
    }

    render() {
        return html`
            <div class="header">
                <vi-icon source="QueryGrid_Group_Row"></vi-icon>
                <label>${this.group?.name} (${this.group?.items.length})</label>
            </div>
        `;
    }

    @observer("group", { allowUndefined: true })
    private _groupChanged(group: Vidyano.QueryResultItemGroup) {
        this.first = !!group && group.start === 0;
        this.collapsed = !!group?.isCollapsed;

        if (this.isConnected)
            this._subscribe();
    }

    private _subscribe() {
        this._unsubscribe();

        const group = this.group;
        if (!group)
            return;

        this.collapsed = group.isCollapsed;
        this.#groupDisposer = group.propertyChanged.attach((_, args) => {
            if (args.propertyName === "isCollapsed")
                this.collapsed = group.isCollapsed;
        });
    }

    private _unsubscribe() {
        this.#groupDisposer?.();
        this.#groupDisposer = null;
    }

    @listener("click")
    private _tap() {
        this.group.isCollapsed = !this.group.isCollapsed;
    }
}

customElements.define("vi-query-grid-row-group", QueryGridRowGroup);
