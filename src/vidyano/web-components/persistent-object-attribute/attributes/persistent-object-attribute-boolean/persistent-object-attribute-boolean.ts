import { html, nothing, unsafeCSS } from "lit";
import { property, state } from "lit/decorators.js";
import * as Vidyano from "vidyano";
import "components/checkbox/checkbox";
import "components/toggle/toggle";
import { computed, observer } from "components/web-component/web-component";
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute";
import * as PersistentObjectAttributeRegister from "components/persistent-object-attribute/persistent-object-attribute-register";
import styles from "./persistent-object-attribute-boolean.css";

export class PersistentObjectAttributeBoolean extends PersistentObjectAttribute {
    static styles = [super.styles, unsafeCSS(styles)];

    @state()
    inputtype: string;

    @property({ type: Boolean })
    @computed(function(this: PersistentObjectAttributeBoolean, inputtype: string): boolean {
        return inputtype === "checkbox";
    }, "inputtype")
    declare readonly isCheckbox: boolean;

    protected _attributeChanged() {
        super._attributeChanged();

        if (this.attribute instanceof Vidyano.PersistentObjectAttribute) {
            const defaultInputtype = this.app.configuration.getSetting("vi-persistent-object-attribute-boolean.inputtype", "toggle").toLowerCase();
            this.inputtype = this.attribute.getTypeHint("inputtype", defaultInputtype, undefined);
        }
    }

    @observer("value")
    protected _valueChanged(newValue: any) {
        if (this.attribute && newValue !== this.attribute.value)
            this.attribute.setValue(newValue, true).catch(Vidyano.noop);
    }

    protected renderDisplay() {
        return super.renderDisplay(html`<span>${this.attribute?.displayValue}</span>`);
    }

    protected renderEdit() {
        if (this.sensitive)
            return this.renderDisplay();

        return this.isCheckbox ? html`
            <vi-checkbox
                .checked=${this.value}
                @checked-changed=${(e: CustomEvent) => this.value = e.detail.value}
                label=${this.attribute?.displayValue || nothing}
                ?disabled=${this.readOnly || this.frozen}>
            </vi-checkbox>
        ` : html`
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
