import { html, nothing, unsafeCSS } from "lit";
import { property } from "lit/decorators.js";
import * as Vidyano from "vidyano";
import { computed } from "components/web-component/web-component";
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute";
import * as PersistentObjectAttributeRegister from "components/persistent-object-attribute/persistent-object-attribute-register";
import "components/select/select";
import "components/checkbox/checkbox";
import styles from "./persistent-object-attribute-key-value-list.css";

export class PersistentObjectAttributeKeyValueList extends PersistentObjectAttribute {
    static styles = [super.styles, unsafeCSS(styles)];

    @computed(function(this: PersistentObjectAttributeKeyValueList): string {
        return this.attribute?.getTypeHint("inputtype", "select")?.toLowerCase() || "select";
    }, "attribute.typeHints")
    declare readonly inputtype: string;

    @computed(function(this: PersistentObjectAttributeKeyValueList): string {
        return this.attribute?.getTypeHint("orientation", "vertical") || "vertical";
    }, "attribute.typeHints")
    declare readonly orientation: string;

    @computed(function(this: PersistentObjectAttributeKeyValueList): string | null {
        return this.attribute?.getTypeHint("groupseparator", null) || null;
    }, "attribute.typeHints")
    declare readonly groupSeparator: string | null;

    @computed(function(this: PersistentObjectAttributeKeyValueList): boolean {
        const hint = this.attribute?.getTypeHint("disablefiltering", null);
        return hint != null;
    }, "attribute.typeHints")
    declare readonly disableFiltering: boolean;

    @property({ type: Array })
    @computed("attribute.options")
    private declare _options: Vidyano.PersistentObjectAttributeOption[];

    @computed(function(this: PersistentObjectAttributeKeyValueList, readOnly: boolean, isRequired: boolean, value: any): boolean {
        return !readOnly && !isRequired && value != null;
    }, "readOnly", "attribute.isRequired", "value")
    declare readonly canClear: boolean;

    get showEditable(): boolean {
        return this.editing && !this.sensitive;
    }

    protected override _valueChanged(newValue: any) {
        if (this.attribute && newValue !== this.attribute.value)
            this.attribute.setValue(newValue, true).catch(Vidyano.noop);
    }

    private _clear() {
        this.attribute.setValue(null, true).catch(Vidyano.noop);
    }

    #optionLabel(option: Vidyano.PersistentObjectAttributeOption): string {
        return option?.value || "—";
    }

    #isChecked(option: Vidyano.PersistentObjectAttributeOption): boolean {
        return (option == null && this.value == null) || (option && option.key === this.value);
    }

    #isUnchecked(option: Vidyano.PersistentObjectAttributeOption): boolean {
        return !this.#isChecked(option);
    }

    private _select(e: Event) {
        e.stopPropagation();

        const target = e.currentTarget as any;
        const option = target.option as Vidyano.PersistentObjectAttributeOption;
        this.attribute.setValue(option?.key ?? null, true).catch(Vidyano.noop);
    }

    protected override renderDisplay() {
        return super.renderDisplay(html`<span>${this.attribute?.displayValue}</span>`);
    }

    protected override renderEdit() {
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
                placeholder=${this.placeholder || nothing}
                group-separator=${this.groupSeparator || nothing}
                ?disable-filtering=${this.disableFiltering}
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
        const options = this.required ? this._options : [null, ...(this._options || [])];
        return html`
            <div id="radiobuttons" orientation=${this.orientation}>
                ${options?.map(option => html`
                    <vi-checkbox
                        label=${this.#optionLabel(option)}
                        .checked=${this.#isChecked(option)}
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
        const options = this.required ? this._options : [null, ...(this._options || [])];
        return html`
            <div id="chips" orientation=${this.orientation}>
                ${options?.map(option => html`
                    <vi-button
                        label=${this.#optionLabel(option)}
                        .option=${option}
                        ?inverse=${this.#isUnchecked(option)}
                        @tap=${this._select}
                        part="chip"
                        ?disabled=${this.frozen}>
                    </vi-button>
                `)}
            </div>
        `;
    }
}

customElements.define("vi-persistent-object-attribute-key-value-list", PersistentObjectAttributeKeyValueList);

PersistentObjectAttributeRegister.add("KeyValueList", PersistentObjectAttributeKeyValueList);
