import { html, nothing, unsafeCSS } from "lit";
import { property } from "lit/decorators.js";
import * as Vidyano from "vidyano";
import { computed } from "components/web-component/web-component";
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute";
import * as PersistentObjectAttributeRegister from "components/persistent-object-attribute/persistent-object-attribute-register";
import type { Select } from "components/select/select";
import "components/select/select";
import styles from "./persistent-object-attribute-combo-box.css";

export class PersistentObjectAttributeComboBox extends PersistentObjectAttribute {
    static styles = [super.styles, unsafeCSS(styles)];

    @property({ type: Array })
    @computed("attribute.options")
    private declare _options: string[];

    protected override _valueChanged(newValue: any, _oldValue: any) {
        if (this.attribute && newValue !== this.attribute.value)
            this.attribute.setValue(newValue, true).catch(Vidyano.noop);
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
                    .options=${this._options}
                    .selectedOption=${this.value}
                    @selected-option-changed=${(e: CustomEvent) => this.value = e.detail.value}
                    allow-free-text
                    ?readonly=${this.readOnly}
                    ?disabled=${this.frozen}
                    placeholder=${this.placeholder || nothing}
                    ?sensitive=${this.sensitive}>
                </vi-select>
            </div>
        `);
    }
}

customElements.define("vi-persistent-object-attribute-combo-box", PersistentObjectAttributeComboBox);

PersistentObjectAttributeRegister.add("ComboBox", PersistentObjectAttributeComboBox);
