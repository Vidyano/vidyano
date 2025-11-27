import { html, nothing, unsafeCSS } from "lit";
import { state } from "lit/decorators.js";
import * as Vidyano from "vidyano";
import { observer } from "components/web-component/web-component";
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute";
import * as PersistentObjectAttributeRegister from "components/persistent-object-attribute/persistent-object-attribute-register";
import type { Select } from "components/select/select";
import "components/select/select";
import styles from "./persistent-object-attribute-combo-box.css";

export class PersistentObjectAttributeComboBox extends PersistentObjectAttribute {
    static styles = [super.styles, unsafeCSS(styles)];

    @state()
    @observer(function(this: PersistentObjectAttributeComboBox) {
        this.requestUpdate();
    })
    private _newValue: string = null;

    @state()
    private _comboBoxOptions: string[] = [];

    get #canAdd(): boolean {
        return this._newValue != null && this._comboBoxOptions && !this._comboBoxOptions.some(o => o === this._newValue);
    }

    protected override _editingChanged() {
        super._editingChanged();

        if (this._newValue) {
            this._newValue = null;
            this._optionsChanged();
        }
    }

    protected override _valueChanged(newValue: any, _oldValue: any) {
        if (this.attribute && newValue !== this.attribute.value)
            this.attribute.setValue(newValue, true).catch(Vidyano.noop);
    }

    @observer("attribute.options")
    protected override _optionsChanged() {
        if (!this.attribute?.options) {
            this._comboBoxOptions = [];
            return;
        }

        const options = (this.attribute.options as string[]).slice();

        let empty = options.indexOf(null);
        if (empty < 0)
            empty = options.indexOf("");

        // Use this.value since attribute.value may not be updated yet
        const currentValue = this.value ?? this.attribute.value;
        if (options.indexOf(currentValue) < 0)
            options.splice(empty >= 0 ? empty + 1 : 0, 0, currentValue);

        this._comboBoxOptions = options;
    }

    private _add() {
        this.value = this._newValue;
        this._optionsChanged();
    }

    protected override _onFocus(e: FocusEvent) {
        const select = this.shadowRoot.querySelector<Select>("vi-select");
        if (e.composedPath().some(el => el === select))
            return;

        select?.focus();
    }

    protected override renderDisplay() {
        return super.renderDisplay(html`<span>${this.attribute?.displayValue}</span>`);
    }

    protected override renderEdit() {
        return super.renderEdit(html`
            <div class="relative">
                <vi-select
                    .options=${this._comboBoxOptions}
                    .selectedOption=${this.value}
                    @selected-option-changed=${(e: CustomEvent) => this.value = e.detail.value}
                    @input-value-changed=${(e: CustomEvent) => this._newValue = e.detail.value}
                    keep-unmatched
                    ?readonly=${this.readOnly}
                    ?disabled=${this.frozen}
                    placeholder=${this.placeholder || nothing}
                    ?sensitive=${this.sensitive}>
                </vi-select>
            </div>
            ${!this.readOnly && this.#canAdd ? html`
                <vi-button id="add" slot="right" @click=${this._add} tabindex="-1">
                    <vi-icon source="Add"></vi-icon>
                </vi-button>
            ` : nothing}
        `);
    }
}

customElements.define("vi-persistent-object-attribute-combo-box", PersistentObjectAttributeComboBox);

PersistentObjectAttributeRegister.add("ComboBox", PersistentObjectAttributeComboBox);
