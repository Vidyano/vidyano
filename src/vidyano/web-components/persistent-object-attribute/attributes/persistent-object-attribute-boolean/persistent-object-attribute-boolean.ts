import { html, nothing, unsafeCSS, type TemplateResult } from "lit";
import { property } from "lit/decorators.js";
import * as Vidyano from "vidyano";
import "components/checkbox/checkbox";
import "components/toggle/toggle";
import { computed } from "components/web-component/web-component";
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute";
import * as PersistentObjectAttributeRegister from "components/persistent-object-attribute/persistent-object-attribute-register";
import styles from "./persistent-object-attribute-boolean.css";

export class PersistentObjectAttributeBoolean extends PersistentObjectAttribute {
    static styles = [super.styles, unsafeCSS(styles)];

    @property({ type: String })
    @computed(function(this: PersistentObjectAttributeBoolean): string {
        const defaultInputtype = this.app?.configuration.getSetting("vi-persistent-object-attribute-boolean.inputtype", "toggle").toLowerCase() || "toggle";
        return this.attribute?.getTypeHint("inputtype", defaultInputtype);
    }, "attribute.typeHints")
    declare readonly inputtype: string;

    protected override _valueChanged(newValue: any, oldValue: any) {
        if (this.attribute && newValue !== this.attribute.value)
            this.attribute.setValue(newValue, true).catch(Vidyano.noop);
    }

    protected override renderDisplay() {
        return super.renderDisplay(html`<span>${this.attribute?.displayValue}</span>`);
    }

    protected override renderEdit(innerTemplate?: TemplateResult) {
        if (this.sensitive)
            return this.renderDisplay();

        return this.inputtype === "checkbox" ? this.#renderCheckbox() : this.#renderToggle();
    }

    #renderCheckbox() {
        return html`
            <vi-checkbox
                .checked=${this.value}
                @checked-changed=${(e: CustomEvent) => this.value = e.detail.value}
                label=${this.attribute?.displayValue || nothing}
                ?disabled=${this.readOnly || this.frozen}>
            </vi-checkbox>
        `;
    }

    #renderToggle() {
        return html`
            <vi-toggle
                .toggled=${this.value}
                @toggled-changed=${(e: CustomEvent) => this.value = e.detail.value}
                label=${this.attribute?.displayValue || nothing}
                ?disabled=${this.readOnly || this.frozen}>
            </vi-toggle>
        `;
    }
}

customElements.define("vi-persistent-object-attribute-boolean", PersistentObjectAttributeBoolean);

PersistentObjectAttributeRegister.add("Boolean", PersistentObjectAttributeBoolean);
