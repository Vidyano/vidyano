import * as Polymer from "../../../../libs/polymer/polymer.js"
import * as Vidyano from "../../../../libs/vidyano/vidyano.js"
import { WebComponent } from "../../../web-component/web-component.js"
import { PersistentObjectAttribute } from "../../persistent-object-attribute.js"
import "../../../select/select.js"
import "../../../checkbox/checkbox.js"

@WebComponent.register({
    properties: {
        radio: {
            type: Boolean,
            computed: "_computeRadio(attribute)"
        },
        orientation: {
            type: String,
            computed: "_computeOrientation(attribute)"
        },
        groupSeparator: {
            type: String,
            computed: "_computeGroupSeparator(attribute)"
        }
    }
})
export class PersistentObjectAttributeDropDown extends PersistentObjectAttribute {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-drop-down.html">`; }

    protected _valueChanged(newValue: any) {
        if (this.attribute && newValue !== this.attribute.value)
            this.attribute.setValue(newValue, true).catch(Vidyano.noop);
    }

    private _computeRadio(attribute: Vidyano.PersistentObjectAttribute): boolean {
        return attribute && attribute.getTypeHint("inputtype", undefined, undefined, true) === "radio";
    }

    private _computeOrientation(attribute: Vidyano.PersistentObjectAttribute): string {
        return attribute && attribute.getTypeHint("orientation", "vertical", undefined, true);
    }

    private _computeGroupSeparator(attribute: Vidyano.PersistentObjectAttribute): string {
        return attribute && attribute.getTypeHint("groupseparator", null, undefined, true);
    }

    private _radioLabel(option: string): string {
        return option != null ? option : "—";
    }

    private _isRadioChecked(option: string, value: string): boolean {
        return option === value || (!option && !value);
    }

    private _radioChanged(e: CustomEvent) {
        e.stopPropagation();

        this.attribute.setValue((<any>e).model.option, true).catch(Vidyano.noop);
    }
}

PersistentObjectAttribute.registerAttributeType("DropDown", PersistentObjectAttributeDropDown);