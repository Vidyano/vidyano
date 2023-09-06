import * as Polymer from "../../../../libs/polymer/polymer.js"
import * as Vidyano from "../../../../libs/vidyano/vidyano.js"
import { WebComponent } from "../../../web-component/web-component.js"
import { PersistentObjectAttribute } from "../../persistent-object-attribute.js"
import { Select } from '../../../select/select.js'
import "../../../select/select.js"

@WebComponent.register({
    properties: {
        newValue: {
            type: String,
            value: null,
            notify: true
        },
        comboBoxOptions: {
            type: Array,
            computed: "_computeComboBoxOptions(options, attribute.value, newValue)"
        },
        canAdd: {
            type: Boolean,
            computed: "_computeCanAdd(newValue, comboBoxOptions)"
        }
    }
})
export class PersistentObjectAttributeComboBox extends PersistentObjectAttribute {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-combo-box.html">`; }

    //readonly comboBoxOptions: string[]; private _setComboBoxOptions: (options: string[]) => void;
    newValue: string;

    protected _editingChanged() {
        super._editingChanged();

        if (this.newValue) {
            this.newValue = null;
            // this._optionsChanged();
            debugger;
        }
    }

    protected _valueChanged(newValue: any) {
        if (this.attribute && newValue !== this.attribute.value)
            this.attribute.setValue(newValue, true).catch(Vidyano.noop);
    }

    protected _computeComboBoxOptions(options: string[], value: string, newValue: string) {
        options = this.attribute.options?.slice() as string[] || [];

        // Add the current value after the first empty option if it's not in the list
        if (!!value && options.indexOf(value) < 0) {
            // Determine if the first option is empty
            const empty = options[0] === null || options[0] === "";

            // Add the current value after the first empty option
            options.splice(empty ? 1 : 0, 0, value);
        }

        // Add the new value to the beginning of the list if it's not in the list
        if (!!newValue && options.indexOf(newValue) < 0)
            options.unshift(newValue);

        return options;
    }

    private _add() {
        this.value = this.newValue;
    }

    private _computeCanAdd(newValue: string, options: string[]): boolean {
        return newValue != null && options && !options.some(o => o === newValue);
    }

    protected _onFocus(e: FocusEvent) {
        const select = <Select>this.shadowRoot.querySelector("vi-select");
        if (e.composedPath().some(e => e === select))
            return;

        this._focusElement(select);
    }
}

PersistentObjectAttribute.registerAttributeType("ComboBox", PersistentObjectAttributeComboBox);