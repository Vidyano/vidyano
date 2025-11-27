import { html, nothing, unsafeCSS } from "lit";
import * as Vidyano from "vidyano";
import "components/select/select";
import { computed } from "components/web-component/web-component";
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute";
import * as PersistentObjectAttributeRegister from "components/persistent-object-attribute/persistent-object-attribute-register";
import styles from "./persistent-object-attribute-nullable-boolean.css";

export class PersistentObjectAttributeNullableBoolean extends PersistentObjectAttribute {
    static styles = [super.styles, unsafeCSS(styles)];

    @computed(function(this: PersistentObjectAttributeNullableBoolean, attribute: Vidyano.PersistentObjectAttribute): Vidyano.KeyValuePair<boolean, string>[] {
        if (!attribute)
            return [];

        const options = attribute.type.startsWith("Nullable") ? [
            {
                key: null,
                value: ""
            }
        ] : [];

        return options.concat([
            {
                key: true,
                value: this.translations[attribute.getTypeHint("TrueKey", "Yes")]
            },
            {
                key: false,
                value: this.translations[attribute.getTypeHint("FalseKey", "No")]
            }
        ]);
    }, "attribute", "attribute.typeHints", "translations")
    declare readonly booleanOptions: Vidyano.KeyValuePair<boolean, string>[];

    protected override _valueChanged(newValue: any, _oldValue: any) {
        if (this.attribute && newValue !== this.attribute.value)
            this.attribute.setValue(newValue, true).catch(Vidyano.noop);
    }

    protected override renderDisplay() {
        return super.renderDisplay(html`<span>${this.attribute?.displayValue}</span>`);
    }

    protected override renderEdit() {
        return super.renderEdit(html`
            <vi-select
                .options=${this.booleanOptions}
                .selectedOption=${this.value}
                @selected-option-changed=${(e: CustomEvent) => this.value = e.detail.value}
                ?sensitive=${this.sensitive}
                disable-filtering
                ?readonly=${this.readOnly}
                ?disabled=${this.readOnly || this.frozen}
                placeholder=${this.placeholder || nothing}>
            </vi-select>
        `);
    }
}

customElements.define("vi-persistent-object-attribute-nullable-boolean", PersistentObjectAttributeNullableBoolean);

PersistentObjectAttributeRegister.add("NullableBoolean", PersistentObjectAttributeNullableBoolean);
