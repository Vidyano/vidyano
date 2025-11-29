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

        return [
            {
                key: true,
                value: this.translations[attribute.getTypeHint("TrueKey", "Yes")]
            },
            {
                key: false,
                value: this.translations[attribute.getTypeHint("FalseKey", "No")]
            }
        ];
    }, "attribute", "attribute.typeHints", "translations")
    declare readonly booleanOptions: Vidyano.KeyValuePair<boolean, string>[];

    @computed(function(this: PersistentObjectAttributeNullableBoolean, readOnly: boolean, isRequired: boolean, value: boolean): boolean {
        return !readOnly && !isRequired && value != null;
    }, "readOnly", "attribute.isRequired", "value")
    declare readonly canClear: boolean;

    protected override _valueChanged(newValue: any, _oldValue: any) {
        if (this.attribute && newValue !== this.attribute.value)
            this.attribute.setValue(newValue, true).catch(Vidyano.noop);
    }

    private _clear() {
        this.attribute.setValue(null, true).catch(Vidyano.noop);
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
                placeholder=${this.placeholder || "—"}>
            </vi-select>
            ${this.canClear ? html`
                <vi-button slot="right" @click=${this._clear} tabindex="-1" ?disabled=${this.frozen}>
                    <vi-icon source="Remove"></vi-icon>
                </vi-button>
            ` : nothing}
        `);
    }
}

customElements.define("vi-persistent-object-attribute-nullable-boolean", PersistentObjectAttributeNullableBoolean);

PersistentObjectAttributeRegister.add("NullableBoolean", PersistentObjectAttributeNullableBoolean);
