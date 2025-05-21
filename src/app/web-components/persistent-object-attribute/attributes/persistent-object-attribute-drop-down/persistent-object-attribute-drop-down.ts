import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
import { WebComponent } from "components/web-component/web-component"
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute"
import "components/select/select"
import "components/checkbox/checkbox"

@WebComponent.register({
    properties: {
        inputtype: {
            type: String,
            computed: "_computeInputType(attribute)"
        },
        orientation: {
            type: String,
            computed: "_computeOrientation(attribute)"
        },
        groupSeparator: {
            type: String,
            computed: "_computeGroupSeparator(attribute)"
        },
        showEditable: {
            type: Boolean,
            computed: "_computeShowEditable(editing, sensitive)"
        },
    }
})
export class PersistentObjectAttributeDropDown extends PersistentObjectAttribute {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-drop-down.html">`; }

    protected _valueChanged(newValue: any) {
        if (this.attribute && newValue !== this.attribute.value)
            this.attribute.setValue(newValue, true).catch(Vidyano.noop);
    }

    private _computeShowEditable(editing: boolean, sensitive: boolean): boolean {
        return editing && !sensitive;
    }

    private _computeInputType(attribute: Vidyano.PersistentObjectAttribute): string {
        return attribute && attribute.getTypeHint("inputtype", "select", undefined, true)?.toLowerCase();
    }

    private _computeOrientation(attribute: Vidyano.PersistentObjectAttribute): string {
        return attribute && attribute.getTypeHint("orientation", "vertical", undefined, true);
    }

    private _computeGroupSeparator(attribute: Vidyano.PersistentObjectAttribute): string {
        return attribute && attribute.getTypeHint("groupseparator", null, undefined, true);
    }

    private _optionLabel(option: string): string {
        return option != null ? option : "—";
    }

    private _isChecked(option: string, value: string): boolean {
        return option === value || (!option && !value);
    }

    private _isUnchecked(option: string, value: string): boolean {
        return !this._isChecked(option, value);
    }

    private _select(e: CustomEvent) {
        e.stopPropagation();

        this.attribute.setValue((<any>e).model.option, true).catch(Vidyano.noop);
    }
}

PersistentObjectAttribute.registerAttributeType("DropDown", PersistentObjectAttributeDropDown);