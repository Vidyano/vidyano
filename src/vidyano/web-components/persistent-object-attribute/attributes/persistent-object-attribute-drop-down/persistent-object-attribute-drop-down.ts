import { html, nothing, unsafeCSS, type TemplateResult } from "lit";
import { property } from "lit/decorators.js";
import * as Vidyano from "vidyano";
import { computed } from "components/web-component/web-component";
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute";
import * as PersistentObjectAttributeRegister from "components/persistent-object-attribute/persistent-object-attribute-register";
import "components/select/select";
import "components/checkbox/checkbox";
import styles from "./persistent-object-attribute-drop-down.css";

export class PersistentObjectAttributeDropDown extends PersistentObjectAttribute {
    static styles = [super.styles, unsafeCSS(styles)];

    @computed(function(this: PersistentObjectAttributeDropDown): string {
        return this.attribute?.getTypeHint("inputtype", "select") || "select";
    }, "attribute.typeHints")
    declare readonly inputtype: string;

    @computed(function(this: PersistentObjectAttributeDropDown): string {
        return this.attribute?.getTypeHint("orientation", "vertical") || "vertical";
    }, "attribute.typeHints")
    declare readonly orientation: string;

    @computed(function(this: PersistentObjectAttributeDropDown): string | null {
        return this.attribute?.getTypeHint("groupseparator", null) || null;
    }, "attribute.typeHints")
    declare readonly groupSeparator: string | null;

    @property({ type: Array })
    @computed("attribute.options")
    private declare _options: (string | Vidyano.PersistentObjectAttributeOption)[];

    @computed(function(this: PersistentObjectAttributeDropDown, readOnly: boolean, isRequired: boolean, value: string): boolean {
        return !readOnly && !isRequired && !String.isNullOrEmpty(value);
    }, "readOnly", "attribute.isRequired", "value")
    declare readonly canClear: boolean;

    get showEditable(): boolean {
        return this.editing && !this.sensitive;
    }

    protected override _valueChanged(newValue: any, oldValue: any) {
        if (this.attribute && newValue !== this.attribute.value)
            this.attribute.setValue(newValue, true).catch(Vidyano.noop);
    }

    private _clear() {
        this.attribute.setValue(null, true).catch(Vidyano.noop);
    }

    #optionLabel(option: string | Vidyano.PersistentObjectAttributeOption): string {
        if (!option)
            return "—";
        return typeof option === "string" ? option : option.value;
    }

    #isChecked(option: string | Vidyano.PersistentObjectAttributeOption, value: string): boolean {
        const optionValue = typeof option === "string" ? option : option?.value;
        return optionValue === value || (!optionValue && !value);
    }

    #isUnchecked(option: string | Vidyano.PersistentObjectAttributeOption, value: string): boolean {
        return !this.#isChecked(option, value);
    }

    private _select(e: Event) {
        e.stopPropagation();

        const target = e.currentTarget as HTMLElement;
        const option = (target as any).option || (target as any).label;
        this.attribute.setValue(option, true).catch(Vidyano.noop);
    }

    protected override renderDisplay() {
        return super.renderDisplay(html`<span>${this.attribute?.displayValue}</span>`);
    }

    protected override renderEdit(innerTemplate?: TemplateResult) {
        if (!this.showEditable)
            return this.renderDisplay();

        // Select input type
        if (this.inputtype === "select")
            return this.#renderSelect();

        // Radio input type
        if (this.inputtype === "radio")
            return this.#renderRadio();

        // Chip input type
        if (this.inputtype === "chip")
            return this.#renderChip();

        return nothing;
    }

    #renderSelect() {
        return super.renderEdit(html`
            <vi-select
                .options=${this._options}
                .selectedOption=${this.value}
                @selected-option-changed=${(e: CustomEvent) => this.value = e.detail.value}
                ?readonly=${this.readOnly}
                ?disabled=${this.frozen}
                placeholder=${this.placeholder || "—"}
                group-separator=${this.groupSeparator || nothing}
                ?sensitive=${this.sensitive}>
            </vi-select>
            ${this.canClear ? html`
                <vi-button slot="right" @click=${this._clear} tabindex="-1" ?disabled=${this.frozen}>
                    <vi-icon source="Remove"></vi-icon>
                </vi-button>
            ` : nothing}
        `);
    }

    #renderRadio() {
        const options = this.required ? this._options : ["", ...(this._options || [])];
        return html`
            <div id="radiobuttons" orientation=${this.orientation}>
                ${options?.map(option => html`
                    <vi-checkbox
                        label=${this.#optionLabel(option)}
                        .checked=${this.#isChecked(option, this.value)}
                        @changed=${this._select}
                        .option=${option}
                        radio
                        part="radio"
                        ?disabled=${this.frozen}>
                    </vi-checkbox>
                `)}
            </div>
        `;
    }

    #renderChip() {
        const options = this.required ? this._options : ["", ...(this._options || [])];
        return html`
            <div id="chips" orientation=${this.orientation}>
                ${options?.map(option => html`
                    <vi-button
                        label=${this.#optionLabel(option)}
                        .option=${option}
                        ?inverse=${this.#isUnchecked(option, this.value)}
                        @tap=${this._select}
                        part="chip"
                        ?disabled=${this.frozen}>
                    </vi-button>
                `)}
            </div>
        `;
    }
}

customElements.define("vi-persistent-object-attribute-drop-down", PersistentObjectAttributeDropDown);

PersistentObjectAttributeRegister.add("DropDown", PersistentObjectAttributeDropDown);
