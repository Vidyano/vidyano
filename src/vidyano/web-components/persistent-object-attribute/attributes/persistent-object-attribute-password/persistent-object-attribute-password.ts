import { html, unsafeCSS } from "lit";
import { state } from "lit/decorators.js";
import * as Vidyano from "vidyano";
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute";
import * as PersistentObjectAttributeRegister from "components/persistent-object-attribute/persistent-object-attribute-register";
import styles from "./persistent-object-attribute-password.css";

export class PersistentObjectAttributePassword extends PersistentObjectAttribute {
    static styles = [super.styles, unsafeCSS(styles)];

    @state()
    private autocomplete: string;

    protected _attributeChanged() {
        super._attributeChanged();

        if (this.attribute instanceof Vidyano.PersistentObjectAttribute)
            this.autocomplete = this.attribute.getTypeHint("Autocomplete");
    }

    private async _editInputBlur() {
        if (this.attribute?.isValueChanged && this.attribute.triggersRefresh) {
            try {
                await this.attribute.setValue(this.value = this.attribute.value, true);
            }
            catch (e) {
                console.error(`Failed to set password value on blur for '${this.attribute.parent.fullTypeName}.${this.attribute.name}':`, e);
            }
        }
    }

    protected renderDisplay() {
        return html`●●●●●●`;
    }

    protected renderEdit() {
        return super.renderEdit(html`
            <vi-sensitive ?disabled=${!this.sensitive}>
                <input type="password"
                    .value=${this.value || ""}
                    autocomplete=${this.autocomplete || ""}
                    ?readonly=${this.readOnly}
                    tabindex=${this.readOnlyTabIndex}
                    placeholder=${this.placeholder || ""}
                    @input=${(e: InputEvent) => this.value = (e.target as HTMLInputElement).value}
                    @blur=${this._editInputBlur}>
            </vi-sensitive>
        `);
    }
}

customElements.define("vi-persistent-object-attribute-password", PersistentObjectAttributePassword);

PersistentObjectAttributeRegister.add("Password", PersistentObjectAttributePassword);
