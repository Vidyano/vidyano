import { html, nothing, unsafeCSS } from "lit";
import { WebComponentLit, property, listener } from "components/web-component/web-component-lit.js";
import styles from "./button.css";

export class Button extends WebComponentLit {
    static styles = unsafeCSS(styles);

    @property({ type: Boolean, reflect: true })
    accent: boolean = false;

    @property({ type: Boolean, reflect: true })
    disabled: boolean = false;

    @property({ type: Boolean, reflect: true })
    inverse: boolean = false;

    @property({ type: Boolean, reflect: true })
    customLayout: boolean = false;

    @property({ type: Number, reflect: true })
    elevation: number;

    @property({ type: String })
    icon: string;

    @property({ type: String })
    label: string;

    @property({ type: Boolean, reflect: true })
    busy: boolean = false;

    connectedCallback() {
        super.connectedCallback();

        if (!this.getAttribute("tabindex"))
            this.setAttribute("tabindex", "0");

        // Set customLayout before first render to prevent flicker
        this.customLayout = this.children.length > 0;
    }

    render() {
        return html`
            <paper-ripple></paper-ripple>
            <div class="highlight"></div>
            <slot @slotchange=${this._onSlotChange}></slot>
            ${!this.customLayout ? html`
                <vi-icon source="${this.icon}" part="icon"></vi-icon>
                ${this.label ? html`<span part="label">${this.label}</span>` : nothing}
                ${this.busy ? html`<vi-spinner></vi-spinner>` : nothing}
            ` : nothing}
        `;
    }

    private _onSlotChange(e: Event) {
        const slot = e.target as HTMLSlotElement;
        this.customLayout = slot.assignedElements().length > 0;
    }

    @listener("keydown")
    private _keydown(e: KeyboardEvent) {
        // Only handle Space and Enter when the button itself has focus
        if ((e.key === " " || e.key === "Enter") && e.target === this) {
            e.preventDefault(); // Prevent scrolling for Space
            this.click();
        }
    }

    @listener("click")
    private _click(e: MouseEvent) {
        if (this.disabled) {
            e.stopImmediatePropagation();
            e.preventDefault();
        }
    }
}

customElements.define("vi-button", Button);