import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
import "components/checkbox/checkbox"
import "components/toggle/toggle"
import { WebComponent } from "components/web-component/web-component"
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute"

@WebComponent.register({
    properties: {
        canToggle: {
            type: Boolean,
            computed: "_computeCanToggle(editing, readOnly)"
        },
        defaultInputtype: {
            type: String,
            readOnly: true
        },
        isCheckbox: {
            type: Boolean,
            computed: "_computeIsCheckbox(attribute, defaultInputtype)"
        }
    }
}, "vi-persistent-object-attribute-boolean")
export class PersistentObjectAttributeBoolean extends PersistentObjectAttribute {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-boolean.html">`; }

    readonly defaultInputtype: string; private _setDefaultInputtype: (defaultInputtype: string) => void;

    connectedCallback() {
        super.connectedCallback();

        this._setDefaultInputtype(this.app.configuration.getSetting("vi-persistent-object-attribute-boolean.inputtype", "toggle").toLowerCase());
    }

    protected _valueChanged(newValue: any) {
        if (this.attribute && newValue !== this.attribute.value)
            this.attribute.setValue(newValue, true).catch(Vidyano.noop);
    }

    private _computeCanToggle(editing: boolean, isReadOnly: boolean): boolean {
        return editing && !isReadOnly;
    }

    private _computeIsDisabled(isReadOnly: boolean, isFrozen: boolean): boolean {
        return isReadOnly || isFrozen;
    }

    private _computeIsCheckbox(attribute: Vidyano.PersistentObjectAttribute, defaultInputtype: string): boolean {
        return attribute.getTypeHint("inputtype", defaultInputtype, undefined) === "checkbox";
    }
}

PersistentObjectAttribute.registerAttributeType("Boolean", PersistentObjectAttributeBoolean);