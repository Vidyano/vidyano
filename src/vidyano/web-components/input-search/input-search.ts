import { html, unsafeCSS } from "lit";
import { property } from "lit/decorators.js";
import { notify, WebComponent } from "components/web-component/web-component";
import styles from "./input-search.css";

export class InputSearch extends WebComponent {
    static styles = unsafeCSS(styles);

    @property({ type: String })
    @notify()
    value: string = "";

    @property({ type: Boolean, reflect: true })
    @notify()
    focused: boolean = false;

    @property({ type: Boolean, reflect: true })
    autofocus: boolean = false;

    get hasValue(): boolean {
        return !!this.value;
    }

    render() {
        return html`
            <form autocomplete="off" class="form-container" @submit=${this._catchOnSumbit}>
                <input
                    name="search"
                    class="input"
                    placeholder=${this.translations["FilterSearchHint"]}
                    .value=${this.value}
                    @input=${this._handleInput}
                    @keypress=${this._searchKeypressed}
                    @focus=${this._input_focused}
                    @blur=${this._input_blurred}
                    ?autofocus=${this.autofocus}
                    role="search"
                    part="input">
            </form>
            <button
                class="reset"
                @click=${this._resetClick}
                ?hidden=${!this.hasValue}
                part="reset">
                <vi-icon source="SearchReset"></vi-icon>
            </button>
            <button
                class="search"
                @click=${this._searchClick}
                ?hidden=${this.hasValue}
                part="search">
                <vi-icon source="Search"></vi-icon>
            </button>
        `;
    }

    firstUpdated(changedProperties: Map<PropertyKey, unknown>) {
        super.firstUpdated(changedProperties);

        if (this.autofocus) {
            const input = this.shadowRoot?.querySelector("input");
            if (input) input.focus();
        }
    }

    private _handleInput(e: Event) {
        const input = e.target as HTMLInputElement;
        this.value = input.value;
    }

    private _searchKeypressed(e: KeyboardEvent) {
        if (e.keyCode === 13)
            this._searchClick();
    }

    private _searchClick(e?: MouseEvent) {
        this.dispatchEvent(new CustomEvent("search", {
            detail: this.value,
            bubbles: true,
            composed: true
        }));

        if (e && !this.value)
            e.stopPropagation();
    }

    private _resetClick(e?: MouseEvent) {
        this.value = "";
        this.dispatchEvent(new CustomEvent("search", {
            detail: this.value,
            bubbles: true,
            composed: true
        }));

        if (e && !this.value)
            e.stopPropagation();
    }

    private _input_focused() {
        this.focused = true;
    }

    private _input_blurred() {
        this.focused = false;
    }

    private _catchOnSumbit(e: Event) {
        e.preventDefault();
    }

    focus() {
        const input = this.shadowRoot?.querySelector("input");
        if (input) input.focus();
    }
}

customElements.define("vi-input-search", InputSearch);
