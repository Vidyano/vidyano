import { html, unsafeCSS } from "lit";
import { property } from "lit/decorators.js";
import { WebComponentLit, listener, notify } from "components/web-component/web-component-lit";
import styles from "./checkbox.css";

export class Checkbox extends WebComponentLit {
    static styles = unsafeCSS(styles);

    @property({ type: Boolean, reflect: true })
    @notify()
    checked: boolean = false;

    @property({ type: String })
    label: string | null = null;

    @property({ type: Boolean, reflect: true })
    disabled: boolean = false;

    @property({ type: Boolean, reflect: true })
    radio: boolean = false;

    connectedCallback() {
        super.connectedCallback();

        this.setAttribute("tabindex", "0");
    }

    render() {
        return html`
            <vi-icon
                ?disabled=${this.disabled}
                source=${!this.radio ? "Selected" : "SelectedRadio"}
                ?is-selected=${this.checked}
                part="icon">
            </vi-icon>
            <span ?hidden=${!this.label} part="label">${this.label}</span>
        `;
    }

    @listener("click")
    toggle() {
        if (this.disabled)
            return;

        if (!this.radio) {
            this.checked = !this.checked;
            // Note: checked-changed event is now automatically dispatched by @notify decorator
        }
        else {
            this.dispatchEvent(new CustomEvent("changed", {
                bubbles: true,
                composed: true
            }));
        }
    }

    @listener("keydown")
    private _keyToggle(e: KeyboardEvent) {
        if (e.key !== " " && e.key !== "Enter")
            return;

        e.preventDefault();
        this.toggle();
    }
}

customElements.define("vi-checkbox", Checkbox);
