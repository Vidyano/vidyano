import { html, nothing, unsafeCSS } from "lit";
import { property, state } from "lit/decorators.js";
import * as Vidyano from "vidyano";
import { computed, observer } from "components/web-component/web-component";
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute";
import * as PersistentObjectAttributeRegister from "components/persistent-object-attribute/persistent-object-attribute-register";
import styles from "./persistent-object-attribute-string.css";

export class PersistentObjectAttributeString extends PersistentObjectAttribute {
    static styles = [super.styles, unsafeCSS(styles)];

    private _suggestionsSeparator: string;

    @state()
    @observer(PersistentObjectAttributeString.prototype._characterCasingChanged)
    characterCasing: string;

    @state()
    editInputStyle: string;

    @state()
    suggestions: string[];

    get filteredSuggestions(): string[] {
        return this._computeFilteredSuggestions(this.suggestions, this.value);
    }

    get hasSuggestions(): boolean {
        return this._computeHasSuggestions(this.filteredSuggestions, this.readOnly);
    }

    @state()
    inputtype: string;

    @state()
    maxlength: number;

    @state()
    autocomplete: string;

    @property({ type: String })
    @computed(PersistentObjectAttributeString.prototype._computeLink, "attribute", "attribute.value")
    declare readonly link: string;

    @property({ type: String })
    @computed(PersistentObjectAttributeString.prototype._computeLinkTitle, "attribute.displayValue", "sensitive")
    declare readonly linkTitle: string;

    protected _attributeChanged() {
        super._attributeChanged();

        if (this.attribute instanceof Vidyano.PersistentObjectAttribute) {
            this.characterCasing = this.attribute.getTypeHint("CharacterCasing", "Normal");
            this.inputtype = this.attribute.getTypeHint("InputType", "text");
            const maxlength = parseInt(this.attribute.getTypeHint("MaxLength", "0"), 10);
            this.maxlength = maxlength > 0 ? maxlength : null;

            // Sets the autocomplete attribute on the input (https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete)
            this.autocomplete = this.attribute.getTypeHint("Autocomplete");

            this._suggestionsSeparator = this.attribute.getTypeHint("SuggestionsSeparator");
            if (this._suggestionsSeparator != null && this.attribute.options != null && this.attribute.options.length > 0) {
                const value = <string>this.attribute.value;
                this.suggestions = (<string[]>this.attribute.options).filter(o => !String.isNullOrEmpty(o) && (value == null || !value.contains(o)));
            }
        }
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

    @observer("value")
    protected _valueChanged(value: any, oldValue: any) {
        let selection: number[];
        let input: HTMLInputElement;

        if (this.editing && value && this.characterCasing !== "Normal") {
            value = this.characterCasing === "Upper" ? value.toUpperCase() : value.toLowerCase();
            if (value !== this.value) {
                input = <HTMLInputElement>this.shadowRoot.querySelector("input");
                if (input != null)
                    selection = [input.selectionStart, input.selectionEnd];
            }
        }

        if (value === this.value) {
            // Value observer from base class will handle this
            if (this.attribute && value !== this.attribute.value)
                this.attribute.setValue(value, false).catch(Vidyano.noop);
        }
        else {
            this.attribute.setValue(value, false).catch(Vidyano.noop);
        }

        if (selection != null) {
            input.selectionStart = selection[0];
            input.selectionEnd = selection[1];
        }
    }

    private _characterCasingChanged(casing: string) {
        if (casing === "Upper")
            this.editInputStyle = "text-transform: uppercase;";
        else if (casing === "Lower")
            this.editInputStyle = "text-transform: lowercase;";
        else
            this.editInputStyle = undefined;
    }

    private _addSuggestion(e: MouseEvent) {
        const suggestion = (e.currentTarget as HTMLElement).textContent;
        this.attribute.setValue(String.isNullOrEmpty(this.value) ? suggestion : (this.value.endsWith(this._suggestionsSeparator) ? this.value + suggestion : this.value + this._suggestionsSeparator + suggestion)).catch(Vidyano.noop);
    }

    private _computeFilteredSuggestions(suggestions: string[], value: string): string[] {
        if (!suggestions || suggestions.length === 0)
            return [];

        if (String.isNullOrEmpty(value))
            return suggestions;

        return suggestions.filter(s => value.indexOf(s) < 0);
    }

    private _computeHasSuggestions(suggestions: string[], readOnly: boolean): boolean {
        return !readOnly && suggestions && suggestions.length > 0;
    }

    private _computeLink(attribute: Vidyano.PersistentObjectAttribute, value: string): string {
        const link = attribute.getTypeHint("Link", "").toLowerCase();
        if (!link)
            return null;

        return link === "email" ? `mailto:${value}` : (!!value ? value : null);
    }

    private _computeLinkTitle(displayValue: string, sensitive: boolean): string {
        return !sensitive ? displayValue : "";
    }

    protected renderDisplay() {
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

    protected renderEdit() {
        return super.renderEdit(html`
            <vi-sensitive disabled=${!this.sensitive}>
                <input
                    .value=${this.value || ""}
                    @input=${(e: InputEvent) => this.value = (e.target as HTMLInputElement).value}
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
