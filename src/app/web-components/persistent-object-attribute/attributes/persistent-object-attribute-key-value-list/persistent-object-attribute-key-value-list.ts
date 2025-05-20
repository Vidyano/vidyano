import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
import { WebComponent } from "components/web-component/web-component.js"
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute.js"
import "components/select/select.js"
import "components/checkbox/checkbox.js"

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
        disableFiltering: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeDisableFiltering(attribute)"
        },
        showEditable: {
            type: Boolean,
            computed: "_computeShowEditable(editing, sensitive)"
        },
    }    
})
export class PersistentObjectAttributeKeyValueList extends PersistentObjectAttribute {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-key-value-list.html">`; }

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

    private _computeOrientation(attribute: Vidyano.PersistentObjectAttributeWithReference): string {
        return attribute && attribute.getTypeHint("orientation", "vertical", undefined, true);
    }

    private _computeGroupSeparator(attribute: Vidyano.PersistentObjectAttribute): string {
        return attribute && attribute.getTypeHint("groupseparator", null, undefined, true);
    }

    private _computeDisableFiltering(attribute: Vidyano.PersistentObjectAttribute): string {
        return attribute && attribute.getTypeHint("disablefiltering", null, undefined, true);
    }

    private _optionLabel(option: Vidyano.PersistentObjectAttributeOption): string {
        return option?.value || "—";
    }

    private _isChecked(option: Vidyano.PersistentObjectAttributeOption, value: string): boolean {
        return option == null && value == null || (option && option.key === value);
    }

    private _isUnchecked(option: Vidyano.PersistentObjectAttributeOption, value: string): boolean {
        return !this._isChecked(option, value);
    }

    private _select(e: CustomEvent) {
        e.stopPropagation();

        this.attribute.setValue((<any>e).model.option.key, true).catch(Vidyano.noop);
    }
}

PersistentObjectAttribute.registerAttributeType("KeyValueList", PersistentObjectAttributeKeyValueList);