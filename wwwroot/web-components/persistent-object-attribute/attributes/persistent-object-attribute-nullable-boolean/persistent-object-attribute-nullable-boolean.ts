import * as Polymer from "../../../../libs/polymer/polymer.js"
import * as Vidyano from "../../../../libs/vidyano/vidyano.js"
import { WebComponent } from "../../../web-component/web-component.js"
import { PersistentObjectAttribute } from "../../persistent-object-attribute.js"
import "../../../select/select.js"

@WebComponent.register({
    properties: {
        booleanOptions: {
            type: Array,
            computed: "_computeBooleanOptions(attribute, translations)"
        }
    }
})
export class PersistentObjectAttributeNullableBoolean extends PersistentObjectAttribute {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-nullable-boolean.html">`; }

    private _computeBooleanOptions(attribute: Vidyano.PersistentObjectAttribute): Vidyano.KeyValuePair<boolean, string>[] {
        const options = attribute.type.startsWith("Nullable") ? [
            {
                key: null,
                value: ""
            }
        ] : [];

        return options.concat([
            {
                key: true,
                value: this.translations[this.attribute.getTypeHint("TrueKey", "Yes")]
            },
            {
                key: false,
                value: this.translations[this.attribute.getTypeHint("FalseKey", "No")]
            }
        ]);
    }

    protected _valueChanged(newValue: any) {
        if (this.attribute && newValue !== this.attribute.value)
            this.attribute.setValue(newValue, true).catch(Vidyano.noop);
    }

    private _notNull(value: any): boolean {
        return value != null;
    }

    private _isDisabled(isReadOnly: boolean, isFrozen: boolean): boolean {
        return isReadOnly || isFrozen;
    }
}

PersistentObjectAttribute.registerAttributeType("NullableBoolean", PersistentObjectAttributeNullableBoolean);