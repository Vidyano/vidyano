import { html, nothing, unsafeCSS } from "lit";
import { property } from "lit/decorators.js";
import { computed, keybinding, listener, notify, WebComponent } from "components/web-component/web-component";
import styles from "./toggle.css";

export class Toggle extends WebComponent {
    static styles = unsafeCSS(styles);

    @property({ type: Boolean, reflect: true })
    @notify()
    toggled: boolean;

    @property({ type: String })
    label: string;

    @property({ type: Boolean })
    @computed(function(this: Toggle, toggled: boolean): boolean {
        return toggled !== false && toggled !== true;
    }, "toggled")
    declare readonly isNull: boolean;

    @property({ type: Boolean, reflect: true })
    disabled: boolean;

    connectedCallback() {
        super.connectedCallback();

        this.setAttribute("tabindex", "0");
    }

    render() {
        return html`
            <div id="box" part="box">
                <div id="switch" part="switch"></div>
            </div>
            ${!String.isNullOrEmpty(this.label) ? html`<span part="label">${this.label}</span>` : nothing}
        `;
    }

    @listener("click")
    toggle() {
        if (this.disabled)
            return;

        this.toggled = !this.toggled;
    }

    @keybinding("space")
    private _keyToggle(e: KeyboardEvent) {
        if (this.app.activeElement !== this)
            return true;

        this.toggle();
    }
}

customElements.define("vi-toggle", Toggle);
