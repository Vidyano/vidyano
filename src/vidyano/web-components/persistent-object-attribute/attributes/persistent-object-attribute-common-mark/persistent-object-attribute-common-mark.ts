import { html, nothing, unsafeCSS, type TemplateResult } from "lit";
import * as Vidyano from "vidyano";
import "components/marked/marked";
import { computed } from "components/web-component/web-component";
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute";
import * as PersistentObjectAttributeRegister from "components/persistent-object-attribute/persistent-object-attribute-register";
import styles from "./persistent-object-attribute-common-mark.css";

export class PersistentObjectAttributeCommonMark extends PersistentObjectAttribute {
    static styles = [super.styles, unsafeCSS(styles)];

    @computed(function(this: PersistentObjectAttributeCommonMark): number | null {
        const maxlength = parseInt(this.attribute?.getTypeHint("MaxLength", "0") || "0", 10);
        return maxlength > 0 ? maxlength : null;
    }, "attribute.typeHints")
    declare readonly maxlength: number | null;

    private _editTextAreaBlur() {
        if (this.attribute && this.attribute.isValueChanged && this.attribute.triggersRefresh)
            this.attribute.setValue(this.value = this.attribute.value, true).catch(Vidyano.noop);
    }

    protected override renderDisplay() {
        return super.renderDisplay(html`
            <vi-scroller allow-native>
                <vi-marked markdown=${this.attribute?.displayValue || nothing}></vi-marked>
            </vi-scroller>
        `);
    }

    protected override renderEdit(innerTemplate?: TemplateResult) {
        return super.renderEdit(html`
            <vi-sensitive ?disabled=${!this.sensitive}>
                <textarea
                    .value=${this.value || ""}
                    @input=${(e: InputEvent) => this.value = (e.target as HTMLTextAreaElement).value}
                    @blur=${this._editTextAreaBlur}
                    maxlength=${this.maxlength || nothing}
                    ?readonly=${this.readOnly}
                    tabindex=${this.readOnlyTabIndex || nothing}
                    ?disabled=${this.frozen}>
                </textarea>
            </vi-sensitive>
        `);
    }
}

customElements.define("vi-persistent-object-attribute-common-mark", PersistentObjectAttributeCommonMark);

PersistentObjectAttributeRegister.add("CommonMark", PersistentObjectAttributeCommonMark);
