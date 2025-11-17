import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
import * as PersistentObjectAttributeRegister from "components/persistent-object-attribute/persistent-object-attribute-register"

@Polymer.WebComponent.register({
    properties: {
        maxlength: Number
    }
}, "vi-persistent-object-attribute-multi-line-string")
export class PersistentObjectAttributeMultiLineString extends Polymer.PersistentObjectAttribute {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-multi-line-string.html">`; }

    maxlength: number;

    protected _attributeChanged() {
        super._attributeChanged();

        if (this.attribute) {
            const maxlength = parseInt(this.attribute.getTypeHint("MaxLength", "0"), 10);
            this.maxlength = maxlength > 0 ? maxlength : null;
        }
    }

    private _editTextAreaBlur() {
        if (this.attribute && this.attribute.isValueChanged && this.attribute.triggersRefresh)
            this.attribute.setValue(this.value = this.attribute.value, true).catch(Vidyano.noop);
    }
}

PersistentObjectAttributeRegister.add("MultiLineString", PersistentObjectAttributeMultiLineString);
