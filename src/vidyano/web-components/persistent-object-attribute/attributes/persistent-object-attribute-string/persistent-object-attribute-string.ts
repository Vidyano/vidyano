import { html, nothing, unsafeCSS } from "lit";
import { property, state } from "lit/decorators.js";
import * as Vidyano from "vidyano";
import { computed } from "components/web-component/web-component";
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute";
import * as PersistentObjectAttributeRegister from "components/persistent-object-attribute/persistent-object-attribute-register";
import styles from "./persistent-object-attribute-string.css";

export class PersistentObjectAttributeString extends PersistentObjectAttribute {
    static styles = [super.styles, unsafeCSS(styles)];

    private _suggestionsSeparator: string;

    @state()
    suggestions: string[];

    @computed(function(this: PersistentObjectAttributeString): string {
        return this.attribute?.getTypeHint("CharacterCasing", "Normal") || "Normal";
    }, "attribute.typeHints")
    declare readonly characterCasing: string;

    @computed(function(this: PersistentObjectAttributeString): string {
        return this.attribute?.getTypeHint("InputType", "text") || "text";
    }, "attribute.typeHints")
    declare readonly inputtype: string;

    @computed(function(this: PersistentObjectAttributeString): number | null {
        const maxlength = parseInt(this.attribute?.getTypeHint("MaxLength", "0") || "0", 10);
        return maxlength > 0 ? maxlength : null;
    }, "attribute.typeHints")
    declare readonly maxlength: number | null;

    @computed(function(this: PersistentObjectAttributeString): string | undefined {
        return this.attribute?.getTypeHint("Autocomplete");
    }, "attribute.typeHints")
    declare readonly autocomplete: string | undefined;

    @property({ type: String })
    @computed(function(this: PersistentObjectAttributeString, attribute: Vidyano.PersistentObjectAttribute, value: string): string {
        const link = attribute.getTypeHint("Link", "").toLowerCase();
        if (!link)
            return null;

        return link === "email" ? `mailto:${value}` : (!!value ? value : null);
    }, "attribute", "attribute.value")
    declare readonly link: string;

    @property({ type: String })
    @computed(function(this: PersistentObjectAttributeString, displayValue: string, sensitive: boolean): string {
        return !sensitive ? displayValue : "";
    }, "attribute.displayValue", "sensitive")
    declare readonly linkTitle: string;

    get editInputStyle(): string | undefined {
        if (this.characterCasing === "Upper")
            return "text-transform: uppercase;";
        if (this.characterCasing === "Lower")
            return "text-transform: lowercase;";

        return undefined;
    }

    get filteredSuggestions(): string[] {
        if (!this.suggestions || this.suggestions.length === 0)
            return [];

        if (String.isNullOrEmpty(this.value))
            return this.suggestions;

        return this.suggestions.filter(s => this.value.indexOf(s) < 0);
    }

    get hasSuggestions(): boolean {
        return !this.readOnly && this.filteredSuggestions?.length > 0;
    }

    protected override _attributeChanged() {
        super._attributeChanged();

        if (this.attribute instanceof Vidyano.PersistentObjectAttribute) {
            this._suggestionsSeparator = this.attribute.getTypeHint("SuggestionsSeparator");
            if (this._suggestionsSeparator != null && this.attribute.options != null && this.attribute.options.length > 0) {
                const value = <string>this.attribute.value;
                this.suggestions = (<string[]>this.attribute.options).filter(o => !String.isNullOrEmpty(o) && (value == null || !value.contains(o)));
            }
        }
    }

    private _onInput(e: InputEvent) {
        const input = e.target as HTMLInputElement;
        let value = input.value;

        // Transform based on character casing
        if (this.editing && this.characterCasing !== "Normal") {
            const transformed = this.characterCasing === "Upper" ? value.toUpperCase() : value.toLowerCase();
            if (transformed !== value) {
                const start = input.selectionStart;
                const end = input.selectionEnd;
                input.value = transformed;
                input.selectionStart = start;
                input.selectionEnd = end;
                value = transformed;
            }
        }

        this.value = value;
    }

    private _editInputBlur() {
        if (this.attribute && this.attribute.isValueChanged && this.attribute.triggersRefresh)
            this.attribute.setValue(this.value = this.attribute.value, true).catch(Vidyano.noop);
    }

    private _editInputFocus(e: FocusEvent) {
        const input = <HTMLInputElement>e.target;
        if (!input.value || !this.attribute.getTypeHint("SelectAllOnFocus"))
            return;

        input.selectionStart = 0;
        input.selectionEnd = input.value.length;
    }

    private _editInputPaste(e: ClipboardEvent) {
        e.preventDefault();
        
        const pastedText = e.clipboardData.getData('text')
            .replace(/[\u200B\u200C\u200D\uFEFF]/g, '') // Remove zero-width spaces
            .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ') // Non-breaking and other spaces to regular space
            .trim();
        const input = e.target as HTMLInputElement;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        
        const currentValue = this.value || "";
        const newValue = currentValue.substring(0, start) + pastedText + currentValue.substring(end);
        
        this.value = newValue;
        
        setTimeout(() => {
            input.selectionStart = input.selectionEnd = start + pastedText.length;
        });
    }

    private _addSuggestion(e: MouseEvent) {
        const suggestion = (e.currentTarget as HTMLElement).textContent;
        this.attribute.setValue(String.isNullOrEmpty(this.value) ? suggestion : (this.value.endsWith(this._suggestionsSeparator) ? this.value + suggestion : this.value + this._suggestionsSeparator + suggestion)).catch(Vidyano.noop);
    }

    protected override renderDisplay() {
        if (!this.link)
            return super.renderDisplay(html`<span>${this.attribute?.displayValue}</span>`);

        return html`
            <a href=${this.link} title=${this.linkTitle} rel="external noopener" target="_blank">
                <vi-sensitive disabled=${!this.sensitive}>
                    <span>${this.attribute?.displayValue}</span>
                </vi-sensitive>
                ${this.attribute?.value ? html`
                    <vi-icon source="ArrowUpRight" class="size-h4"></vi-icon>
                ` : nothing}
                <div class="spacer"></div>
            </a>
        `;
    }

    protected override renderEdit() {
        return super.renderEdit(html`
            <vi-sensitive disabled=${!this.sensitive}>
                <input
                    .value=${this.value || ""}
                    @input=${this._onInput}
                    type=${this.inputtype}
                    maxlength=${this.maxlength || nothing}
                    autocomplete=${this.autocomplete || nothing}
                    style=${this.editInputStyle || nothing}
                    @focus=${this._editInputFocus}
                    @blur=${this._editInputBlur}
                    @paste=${this._editInputPaste}
                    ?readonly=${this.readOnly}
                    tabindex=${this.readOnlyTabIndex || nothing}
                    placeholder=${this.placeholder || nothing}
                    ?disabled=${this.frozen}>
            </vi-sensitive>
            ${this.link ? html`
                <a class="button" href=${this.link} title=${this.linkTitle} tabindex="-1" rel="external noopener" target="_blank">
                    <vi-icon source="ArrowUpRight"></vi-icon>
                </a>
            ` : nothing}
            <slot name="button" slot="right"></slot>
            ${this.hasSuggestions ? html`
                <vi-popup slot="right" id="suggestions" placement="bottom-end">
                    <vi-icon source="Add" slot="header"></vi-icon>
                    <vi-scroller>
                        <ul>
                            ${this.filteredSuggestions?.map(suggestion => html`
                                <li @click=${this._addSuggestion}>${suggestion}</li>
                            `)}
                        </ul>
                    </vi-scroller>
                </vi-popup>
            ` : nothing}
        `);
    }
}

customElements.define("vi-persistent-object-attribute-string", PersistentObjectAttributeString);

PersistentObjectAttributeRegister.add("String", PersistentObjectAttributeString);
