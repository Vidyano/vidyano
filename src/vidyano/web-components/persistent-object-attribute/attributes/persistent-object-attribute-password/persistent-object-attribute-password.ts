import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
import * as PersistentObjectAttributeRegister from "components/persistent-object-attribute/persistent-object-attribute-register"

@Polymer.WebComponent.register({
    properties: {
        autocomplete: {
            type: String,
            readOnly: true
        }
    }
}, "vi-persistent-object-attribute-password")
export class PersistentObjectAttributePassword extends Polymer.PersistentObjectAttribute {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-password.html">`; }

    readonly autocomplete: string; private _setAutocomplete: (maxlength: string) => void;

    protected _attributeChanged() {
        super._attributeChanged();

        if (this.attribute instanceof Vidyano.PersistentObjectAttribute) {
            // Sets the autocomplete attribute on the input (https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete)
            this._setAutocomplete(this.attribute.getTypeHint("Autocomplete"));
        }
    }

    private _editInputBlur() {
        if (this.attribute && this.attribute.isValueChanged && this.attribute.triggersRefresh)
            this.attribute.setValue(this.value = this.attribute.value, true).catch(Vidyano.noop);
    }
}

PersistentObjectAttributeRegister.add("Password", PersistentObjectAttributePassword);
