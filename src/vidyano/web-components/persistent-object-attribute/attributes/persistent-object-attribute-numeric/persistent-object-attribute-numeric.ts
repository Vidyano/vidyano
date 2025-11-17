import * as Polymer from "polymer"
import BigNumber from 'bignumber.js';
import * as Vidyano from "vidyano"
import * as Keyboard from "components/utils/keyboard"
import * as PersistentObjectAttributeRegister from "components/persistent-object-attribute/persistent-object-attribute-register"

@Polymer.WebComponent.register({
    properties: {
        inputtype: {
            type: String,
            readOnly: true
        },
        unitBefore: {
            type: String,
            reflectToAttribute: true,
            value: null
        },
        unitAfter: {
            type: String,
            reflectToAttribute: true,
            value: null
        },
        focused: {
            type: Boolean,
            reflectToAttribute: true,
            readOnly: true
        }
    }    
}, "vi-persistent-object-attribute-numeric")
export class PersistentObjectAttributeNumeric extends Polymer.PersistentObjectAttribute {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-numeric.html">`; }

    private _allowDecimal: boolean;
    private _isNullable: boolean;
    private _decimalSeparator: string;
    readonly focused: boolean; private _setFocused: (val: boolean) => void;
    readonly inputtype: string; private _setInputtype: (inputtype: string) => void;
    unitBefore: string;
    unitAfter: string;

    private static _decimalTypes = ["NullableDecimal", "Decimal", "NullableSingle", "Single", "NullableDouble", "Double"];
    private static _unsignedTypes = ["Byte", "NullableByte", "UInt16", "NullableUInt16", "UInt32", "NullableUInt32", "UInt64", "NullableUInt64"];

    _attributeChanged() {
        super._attributeChanged();

        if (this.attribute) {
            this._allowDecimal = PersistentObjectAttributeNumeric._decimalTypes.indexOf(numericSynonyms[this.attribute.type] || this.attribute.type) >= 0;
            this._isNullable = (numericSynonyms[this.attribute.type] || this.attribute.type).startsWith("Nullable") && !this.attribute.parent.isBulkEdit;
            this._decimalSeparator = Vidyano.CultureInfo.currentCulture.numberFormat.numberDecimalSeparator;

            const displayFormat = this.attribute.getTypeHint("displayformat", null, null);
            if (displayFormat) {
                const groups = /^([^{]*)({.+?})(.*)$/.exec(displayFormat);
                this.unitBefore = groups[1];
                this.unitAfter = groups[3];
            }

            const inputtype = this.attribute.getTypeHint("inputtype", null, null);
            if (inputtype)
                this._setInputtype(inputtype);
        }
    }

    protected _attributeValueChanged() {
        if (this.attribute.value == null) {
            this.value = "";
            return;
        }

        const attributeValue = this.attribute.value.toString();
        let myValue = this.value;
        if (this.value && this._decimalSeparator !== ".")
            myValue = this.value.replace(this._decimalSeparator, ".");

        if (this.focused) {
            if (myValue === "" || myValue === "-")
                myValue = this.attribute.isRequired && !this._isNullable ? "0" : "";
            else if (myValue.endsWith("."))
                myValue = myValue.trimEnd(".");
        }

        if (!!myValue && this._canParse(myValue) && new BigNumber(myValue).eq(this.attribute.value))
            return;

        if (this._decimalSeparator !== ".")
            this.value = attributeValue.replace(".", this._decimalSeparator);
        else
            this.value = attributeValue;
    }

    protected async _valueChanged(newValue: string, oldValue: string) {
        if (!this.attribute)
            return;

        if (newValue === undefined)
            return;

        if (newValue != null && this._decimalSeparator !== ".")
            newValue = newValue.replace(this._decimalSeparator, ".");

        try {
            if (this.focused) {
                if (newValue === "" || newValue === "-")
                    newValue = this.attribute.isRequired && !this._isNullable ? "0" : "";
                else if (newValue.endsWith("."))
                    newValue = newValue.trimEnd(".");
            }

            if (!this._canParse(newValue)) {
                this.value = oldValue;
                return;
            }

            const bigNumberValue = !String.isNullOrEmpty(newValue) ? new BigNumber(newValue) : null;
            if (this.attribute.value instanceof BigNumber && bigNumberValue != null && bigNumberValue.eq(this.attribute.value))
                return;

            await this.attribute.setValue(bigNumberValue, false).catch(Vidyano.noop);
        } catch (e) {
            this.notifyPath("value", this.attribute.value);
        }
    }

    private _editInputBlur(e: Event) {
        this._setFocused(false);

        if (!this.attribute)
            return;

        if (this.attribute.isValueChanged && this.attribute.triggersRefresh) {
            let newValue = this.value;
            if (newValue != null && this._decimalSeparator !== ".")
                newValue = newValue.replace(this._decimalSeparator, ".");

            this.attribute.value = newValue;
        }

        let attributeValue = this.attribute.value ? this.attribute.value.toString() : ((this.attribute.isRequired && !this._isNullable) || this.value ? "0" : "");
        if (attributeValue !== this.value) {
            if (this._decimalSeparator !== ".")
                this.value = attributeValue.replace(".", this._decimalSeparator);
            else
                this.value = attributeValue;
        }
    }

    private _editInputFocus(e: Event) {
        this._setFocused(true);

        const input = <HTMLInputElement>e.target;
        if (!input.value || !this.attribute.getTypeHint("SelectAllOnFocus"))
            return;

        input.selectionStart = 0;
        input.selectionEnd = input.value.length;
    }

    private _canParse(value: string): boolean {
        if (!value && this._isNullable)
            return true;

        if (value && value.startsWith(this._decimalSeparator))
            value = `0${value}`;

        switch (numericSynonyms[this.attribute.type] || this.attribute.type) {
            case "Byte":
            case "NullableByte":
                return this._between(parseInt(value, 10), 0, 255);
            case "SByte":
            case "NullableSByte":
                return this._between(parseInt(value, 10), -128, 127);
            case "Int16":
            case "NullableInt16":
                return this._between(parseInt(value, 10), -32768, 32767);
            case "UInt16":
            case "NullableUInt16":
                return this._between(parseInt(value, 10), 0, 65535);
            case "Int32":
            case "NullableInt32":
                return this._between(parseInt(value, 10), -2147483648, 2147483647);
            case "UInt32":
            case "NullableUInt32":
                return this._between(parseFloat(value), 0, 4294967295);
            case "Int64":
            case "NullableInt64":
                return this._between(parseFloat(value), -9223372036854775808, 9223372036854775807);
            case "UInt64":
            case "NullableUInt64":
                return this._between(parseFloat(value), 0, 18446744073709551615);
            case "Decimal":
            case "NullableDecimal":
                return this._between(parseFloat(value), -79228162514264337593543950335, 79228162514264337593543950335);
            case "Single":
            case "NullableSingle":
                return this._between(parseFloat(value), -3.40282347E+38, 3.40282347E+38);
            case "Double":
            case "NullableDouble":
                return this._between(parseFloat(value), -1.7976931348623157E+308, 1.7976931348623157E+308);
            default:
                return false;
        }
    }

    private _between(value: number, minValue: number, maxValue: number): boolean {
        return !isNaN(value) && value >= minValue && value <= maxValue;
    }

    private _setCarretIndex(input: HTMLInputElement, carretIndex: number): void {
        input.selectionEnd = carretIndex;
        input.selectionStart = carretIndex;
    }

    private _keypress(e: KeyboardEvent): void {
        const keyCode = e.key;

        if (e.key === Keyboard.Keys.Tab || e.key === Keyboard.Keys.Shift || e.key === Keyboard.Keys.Control || e.key === Keyboard.Keys.Alt || e.key === Keyboard.Keys.ArrowLeft || e.key === Keyboard.Keys.ArrowRight || e.key === Keyboard.Keys.ArrowUp || e.key === Keyboard.Keys.ArrowDown || e.key === Keyboard.Keys.Backspace)
            return;

        const input = <HTMLInputElement>e.target;
        let value = input.value;
        const carretIndex = input.selectionStart;
        if (input.selectionEnd !== carretIndex)
            value = value.slice(0, Math.min(input.selectionEnd, carretIndex)) + value.slice(Math.max(input.selectionEnd, carretIndex));

        if (e.key.length === 1 && /^\d+$/.test(e.key)) {
            if (!this._canParse(value.insert(e.key, carretIndex)))
                e.preventDefault();
        }
        else {
            if ((e.key === Keyboard.Keys.Comma || e.key === Keyboard.Keys.Period) && !value.contains(this._decimalSeparator) && this._allowDecimal) {
                this.value = input.value = value.insert(this._decimalSeparator, carretIndex);
                this._setCarretIndex(input, carretIndex + 1);
            }
            else if (e.key === Keyboard.Keys.Subtract && !value.contains("-") && carretIndex === 0 && PersistentObjectAttributeNumeric._unsignedTypes.indexOf(numericSynonyms[this.attribute.type] || this.attribute.type) === -1) {
                this.value = input.value = value.insert("-", carretIndex);
                this._setCarretIndex(input, carretIndex + 1);
            }

            e.preventDefault();
        }
    }

    private _onPaste(e: ClipboardEvent): void {
        if (!this.attribute || !e.clipboardData)
            return;

        // Get pasted data
        let pastedText = e.clipboardData.getData('text');
        if (!pastedText)
            return;

        // Get only digits, decimal and thousand separator from pasted text
        const regex = new RegExp(`[^0-9.,]`, 'g');
        pastedText = pastedText.replace(regex, '');

        // Get the current number format from culture
        const nf = Vidyano.CultureInfo.currentCulture.numberFormat;
        const thousandSeparator = nf.numberGroupSeparator;
        const decimalSeparator = nf.numberDecimalSeparator;

        // Remove thousand separators but preserve decimal separator
        let cleanedText = pastedText.replace(new RegExp(`\\${thousandSeparator}`, 'g'), '');
        
        // Replace any potential decimal separator that isn't matching the current culture with the correct one
        if (decimalSeparator !== "." && cleanedText.includes("."))
            cleanedText = cleanedText.replace(/\./g, decimalSeparator);

        if (decimalSeparator !== "," && cleanedText.includes(","))
            cleanedText = cleanedText.replace(/,/g, decimalSeparator);

        // Allow only one decimal separator
        const parts = cleanedText.split(decimalSeparator);
        if (parts.length > 2)
            cleanedText = parts[0] + decimalSeparator + parts.slice(1).join('');

        // Only replace clipboard data if resulting value would be valid
        const input = <HTMLInputElement>e.target;
        const selStart = input.selectionStart || 0;
        const selEnd = input.selectionEnd || 0;
        const currentValue = input.value;
        const newValue = currentValue.substring(0, selStart) + cleanedText + currentValue.substring(selEnd);
        
        if (this._canParse(newValue)) {
            e.preventDefault();
            
            // Update the input value
            input.value = newValue;
            
            // Set the cursor position after inserted text
            const newPosition = selStart + cleanedText.length;
            input.setSelectionRange(newPosition, newPosition);
            
            // Trigger input event to ensure value changes are processed
            input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        }
    }

    private _computeDisplayValueWithUnit(value: number, displayValue: string, unit: string, unitPosition: string): string {
        let result = value != null && unit && unitPosition && unitPosition.toLowerCase() === "before" ? unit + " " : "";

        result += displayValue;
        result += value != null && unit && unitPosition && unitPosition.toLowerCase() === "after" ? " " + unit : "";

        return result;
    }

    private _computeBeforeUnit(unit: string, position: string, value: number, hideOnNoValue?: boolean): string {
        if (!unit || !position)
            return unit;

        if (hideOnNoValue && !value)
            return "";

        return position === "before" ? unit : "";
    }

    private _computeAfterUnit(unit: string, position: string): string {
        if (!unit || !position)
            return unit;

        return position === "after" ? unit : "";
    }

    static registerNumericAttributeType(attributeType: string, numericType: string): void {
        numericSynonyms[attributeType] = numericType;
    }
}

PersistentObjectAttributeRegister.add("Numeric", PersistentObjectAttributeNumeric);

const numericSynonyms: { [type: string]: string } = {};
