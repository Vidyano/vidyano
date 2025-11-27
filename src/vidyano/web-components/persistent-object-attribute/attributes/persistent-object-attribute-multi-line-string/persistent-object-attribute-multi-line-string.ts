import { html, nothing, unsafeCSS } from "lit";
import * as Vidyano from "vidyano";
import { computed } from "components/web-component/web-component";
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute";
import * as PersistentObjectAttributeRegister from "components/persistent-object-attribute/persistent-object-attribute-register";
import styles from "./persistent-object-attribute-multi-line-string.css";

export class PersistentObjectAttributeMultiLineString extends PersistentObjectAttribute {
    static styles = [super.styles, unsafeCSS(styles)];

    @computed(function(this: PersistentObjectAttributeMultiLineString): number | null {
        const maxlength = parseInt(this.attribute?.getTypeHint("MaxLength", "0") || "0", 10);
        return maxlength > 0 ? maxlength : null;
    }, "attribute.typeHints")
    declare readonly maxlength: number | null;

    private _onInput(e: InputEvent) {
        this.value = (e.target as HTMLTextAreaElement).value;
    }

    private _editTextAreaBlur() {
        if (this.attribute && this.attribute.isValueChanged && this.attribute.triggersRefresh)
            this.attribute.setValue(this.value = this.attribute.value, true).catch(Vidyano.noop);
    }

    protected override renderDisplay() {
        return super.renderDisplay(html`
            <vi-scroller no-horizontal allow-native>
                <pre>${this.attribute?.displayValue}</pre>
            </vi-scroller>
        `);
    }

    protected override renderEdit() {
        return super.renderEdit(html`
            <vi-sensitive ?disabled=${!this.sensitive}>
                <textarea
                    .value=${this.value || ""}
                    @input=${this._onInput}
                    @blur=${this._editTextAreaBlur}
                    maxlength=${this.maxlength || nothing}
                    ?readonly=${this.readOnly}
                    tabindex=${this.readOnlyTabIndex || nothing}
                    placeholder=${this.placeholder || nothing}
                    ?disabled=${this.frozen}>
                </textarea>
            </vi-sensitive>
        `);
    }
}

customElements.define("vi-persistent-object-attribute-multi-line-string", PersistentObjectAttributeMultiLineString);

PersistentObjectAttributeRegister.add("MultiLineString", PersistentObjectAttributeMultiLineString);
