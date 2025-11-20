import { html, unsafeCSS } from "lit";
import { property } from "lit/decorators.js";
import { WebComponent, listener } from "components/web-component/web-component";
import * as Vidyano from "vidyano";
import styles from "./select-option-item.css";

export type SelectOption = Vidyano.KeyValuePair<string | number, string>;

export interface ISelectItem {
    displayValue: string;
    group: string;
    isGroupHeader: boolean;
    option: string | SelectOption;
    key: string | number;
}

export class SelectOptionItem extends WebComponent {
    static styles = unsafeCSS(styles);

    @property({ type: Boolean, reflect: true })
    suggested: boolean;

    @property({ type: Boolean, reflect: true })
    selected: boolean;

    @property({ type: Object })
    item: ISelectItem;

    render() {
        return html`<slot></slot>`;
    }

    @listener("click")
    private _onClick(e: Event) {
        e.stopPropagation();
        this.dispatchEvent(new CustomEvent("select-option", {
            detail: { option: this.item?.option },
            bubbles: true,
            composed: true
        }));
    }
}

customElements.define("vi-select-option-item", SelectOptionItem);
