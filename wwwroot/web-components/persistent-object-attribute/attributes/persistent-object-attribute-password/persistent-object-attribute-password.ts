import * as Polymer from "../../../../libs/polymer/polymer.js"
import * as Vidyano from "../../../../libs/vidyano/vidyano.js"
import { WebComponent } from "../../../web-component/web-component.js"
import { PersistentObjectAttribute } from "../../persistent-object-attribute.js"

@WebComponent.register({
    properties: {
        autocomplete: {
            type: String,
            readOnly: true
        }
    }
})
export class PersistentObjectAttributePassword extends PersistentObjectAttribute {
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

PersistentObjectAttribute.registerAttributeType("Password", PersistentObjectAttributePassword);