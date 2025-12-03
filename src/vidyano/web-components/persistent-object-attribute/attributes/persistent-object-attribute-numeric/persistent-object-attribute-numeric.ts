import { html, nothing, unsafeCSS, type TemplateResult } from "lit";
import { property } from "lit/decorators.js";
import BigNumber from 'bignumber.js';
import * as Vidyano from "vidyano"
import * as Keyboard from "components/utils/keyboard"
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute";
import * as PersistentObjectAttributeRegister from "components/persistent-object-attribute/persistent-object-attribute-register"
import { computed, observer } from "components/web-component/web-component";
import styles from "./persistent-object-attribute-numeric.css";

export class PersistentObjectAttributeNumeric extends PersistentObjectAttribute {
    static styles = [super.styles, unsafeCSS(styles)];

    private _allowDecimal: boolean;
    private _isNullable: boolean;
    private _decimalSeparator: string;
    private _attributeValueChangedBlock: boolean = false;

    @computed(function(this: PersistentObjectAttributeNumeric): string {
        return this.attribute?.getTypeHint("inputtype", "numeric", undefined);
    }, "attribute.typeHints")
    declare readonly inputtype: string;

    @property({ type: String, reflect: true })
    unitBefore: string = null;

    @property({ type: String, reflect: true })
    unitAfter: string = null;

    @property({ type: Boolean, reflect: true })
    focused: boolean = false;

    @observer("attribute.typeHints")
    private _updateDisplayFormat() {
        if (!(this.attribute instanceof Vidyano.PersistentObjectAttribute))
            return;

        const displayFormat = this.attribute.getTypeHint("displayformat", null, null);
        if (displayFormat) {
            const groups = /^([^{]*)({.+?})(.*)$/.exec(displayFormat);
            this.unitBefore = groups[1];
            this.unitAfter = groups[3];
        }
        else {
            this.unitBefore = null;
            this.unitAfter = null;
        }
    }

    private static _decimalTypes = ["NullableDecimal", "Decimal", "NullableSingle", "Single", "NullableDouble", "Double"];
    private static _unsignedTypes = ["Byte", "NullableByte", "UInt16", "NullableUInt16", "UInt32", "NullableUInt32", "UInt64", "NullableUInt64"];

    protected override _attributeChanged() {
        super._attributeChanged();

        if (!(this.attribute instanceof Vidyano.PersistentObjectAttribute))
            return;

        this._allowDecimal = PersistentObjectAttributeNumeric._decimalTypes.indexOf(numericSynonyms[this.attribute.type] || this.attribute.type) >= 0;
        this._isNullable = (numericSynonyms[this.attribute.type] || this.attribute.type).startsWith("Nullable") && !this.attribute.parent.isBulkEdit;
        this._decimalSeparator = Vidyano.CultureInfo.currentCulture.numberFormat.numberDecimalSeparator;
    }

    protected override _attributeValueChanged() {
        // Block flag prevents circular updates: attribute.value → this.value → _valueChanged → attribute.value
        if (this._attributeValueChangedBlock)
            return;

        try {
            this._attributeValueChangedBlock = true;

            if (this.attribute.value == null) {
                if (this.value !== "")
                    this.value = "";

                return;
            }

            const attributeValue = this.attribute.value.toString();
            let newDisplayValue = this._unNormalize(attributeValue);

            // If focused and input has trailing separator or trailing zeros, preserve them in the display value
            // This allows users to type decimal numbers like "123.45" or "150.10" without formatting being applied mid-typing
            const input = this.shadowRoot?.querySelector("input") as HTMLInputElement;
            if (this.focused && input) {
                const inputValue = input.value;

                // Preserve input if user is typing just a decimal separator (e.g., "." or ",")
                if (inputValue === this._decimalSeparator || inputValue === ".") {
                    newDisplayValue = inputValue;
                } else {
                    // Normalize both values to compare numeric equality
                    const inputNormalized = this._normalize(inputValue);
                    const newDisplayNormalized = this._normalize(newDisplayValue);

                    // Parse to numbers for comparison (handles trailing zeros: 150.10 === 150.1)
                    const inputNumeric = parseFloat(inputNormalized);
                    const newDisplayNumeric = parseFloat(newDisplayNormalized);

                    // If the numeric values are equal, keep the user's input (preserves trailing separators and zeros)
                    if (!isNaN(inputNumeric) && !isNaN(newDisplayNumeric) && inputNumeric === newDisplayNumeric) {
                        newDisplayValue = inputValue;
                    }
                }
            }

            // Only update if the value is actually different
            if (this.value !== newDisplayValue) {
                this.value = newDisplayValue;

                // Manually update input element because Lit doesn't update controlled inputs after blur
                if (input && input.value !== newDisplayValue)
                    input.value = newDisplayValue;
            }
        }
        finally {
            this._attributeValueChangedBlock = false;
        }
    }

    protected override async _valueChanged(newValue: string, oldValue: string) {
        if (!(this.attribute instanceof Vidyano.PersistentObjectAttribute))
            return;

        if (newValue === undefined)
            return;

        // Block flag prevents circular updates: this.value → attribute.value → _attributeValueChanged → this.value
        if (this._attributeValueChangedBlock)
            return;

        if (newValue != null)
            newValue = this._normalize(newValue);

        try {
            // While focused, allow trailing decimal separator so users can type decimal numbers like "123.45"
            // Normalize empty values and single minus sign
            if (this.focused && (newValue === "" || newValue === "-")) {
                newValue = this.attribute.isRequired && !this._isNullable ? "0" : "";
            }

            // Allow trailing decimal separator while focused, but validate the number without it
            const valueToValidate = (this.focused && newValue.endsWith(".")) ? newValue.substring(0, newValue.length - 1) : newValue;

            // While focused, allow empty string (user typing just a decimal separator like ".")
            // Don't update the attribute value - just keep it in the display until blur
            if (this.focused && valueToValidate === "") {
                return;
            }

            if (!this._canParse(valueToValidate)) {
                this.value = oldValue;
                // Manually update the input element's value to reflect the revert
                const input = this.shadowRoot?.querySelector("input");
                if (input && input.value !== (oldValue || ""))
                    input.value = oldValue || "";

                return;
            }

            // When creating BigNumber, use validated value (without trailing separator if focused)
            const bigNumberValue = !String.isNullOrEmpty(valueToValidate) ? new BigNumber(valueToValidate) : null;

            // Only update attribute if the actual numeric value changed
            // This prevents overwriting trailing decimal separators when the number itself hasn't changed
            const currentAttributeValue = this.attribute.value;
            const valuesAreDifferent = (bigNumberValue === null && currentAttributeValue !== null) ||
                                       (bigNumberValue !== null && (currentAttributeValue === null || !bigNumberValue.isEqualTo(currentAttributeValue)));

            if (valuesAreDifferent) {
                await this.attribute.setValue(bigNumberValue, false).catch(Vidyano.noop);
            }
        } catch {
            this.value = this.attribute.value;
        }
    }

    private _editInputBlur() {
        if (!(this.attribute instanceof Vidyano.PersistentObjectAttribute))
            return;

        // Normalize value before blur: remove trailing decimal point
        let normalizedValue = this.value;

        if (normalizedValue != null)
            normalizedValue = this._normalize(normalizedValue);

        if (normalizedValue === "" || normalizedValue === "-")
            normalizedValue = this.attribute.isRequired && !this._isNullable ? "0" : "";
        else if (normalizedValue && normalizedValue.endsWith("."))
            normalizedValue = normalizedValue.substring(0, normalizedValue.length - 1);

        this.focused = false;

        // If the value has changed and triggers refresh, we need to refresh on blur
        if (this.attribute.isValueChanged && this.attribute.triggersRefresh) {
            // Parse to BigNumber for proper setValue call
            const bigNumberValue = !String.isNullOrEmpty(normalizedValue) ? new BigNumber(normalizedValue) : null;

            // Use setValue with allowRefresh=true to trigger server refresh
            // This will cause _attributeValueChanged to be called, which will sync back
            this.attribute.setValue(bigNumberValue, true).catch(Vidyano.noop);
        } else {
            // Just ensure display is synced with model (handles formatting)
            // Use block flag to prevent _valueChanged from triggering circular update
            try {
                this._attributeValueChangedBlock = true;

                const attributeValue = this.attribute.value ? this.attribute.value.toString() : ((this.attribute.isRequired && !this._isNullable) || this.value ? "0" : "");
                const newDisplayValue = this._unNormalize(attributeValue);

                if (this.value !== newDisplayValue)
                    this.value = newDisplayValue;
            }
            finally {
                this._attributeValueChangedBlock = false;
            }
        }
    }

    private _editInputFocus(e: Event) {
        this.focused = true;

        const input = <HTMLInputElement>e.target;
        if (!input.value || !this.attribute.getTypeHint("SelectAllOnFocus"))
            return;

        input.selectionStart = 0;
        input.selectionEnd = input.value.length;
    }

    private _normalize(value: string): string {
        if (!value || this._decimalSeparator === ".")
            return value;

        return value.replace(this._decimalSeparator, ".");
    }

    private _unNormalize(value: string): string {
        if (!value || this._decimalSeparator === ".")
            return value;

        return value.replace(".", this._decimalSeparator);
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
        if (!(this.attribute instanceof Vidyano.PersistentObjectAttribute) || !e.clipboardData)
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

            input.value = newValue;

            // Set the cursor position after inserted text
            const newPosition = selStart + cleanedText.length;
            input.setSelectionRange(newPosition, newPosition);

            // Trigger input event to ensure value changes are processed
            input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        }
    }

    protected override renderDisplay() {
        return super.renderDisplay(html`<span>${this.attribute?.displayValue}</span>`);
    }

    private _onInput(e: InputEvent) {
        const input = e.target as HTMLInputElement;
        const newValue = input.value;
        const oldValue = this.value;

        this.value = newValue;

        // If validation fails, revert the input element's value immediately
        setTimeout(() => {
            if (this.value !== newValue && this.value === oldValue) {
                input.value = oldValue || "";
            }
        }, 0);
    }

    protected override renderEdit(innerTemplate?: TemplateResult) {
        return super.renderEdit(html`
            <slot name="left" slot="left"></slot>
            <div class="input-container">
                ${this.unitBefore ? html`<span class="before">${this.unitBefore}</span>` : nothing}
                <vi-sensitive ?disabled=${!this.sensitive}>
                    <input
                        .value=${this.value || ""}
                        @input=${this._onInput}
                        type=${this.inputtype}
                        @keypress=${this._keypress}
                        @paste=${this._onPaste}
                        @focus=${this._editInputFocus}
                        @blur=${this._editInputBlur}
                        ?readonly=${this.readOnly}
                        tabindex=${this.readOnlyTabIndex || nothing}
                        placeholder=${this.placeholder || nothing}
                        ?disabled=${this.frozen}>
                </vi-sensitive>
                ${this.unitAfter ? html`<span class="after">${this.unitAfter}</span>` : nothing}
            </div>
            <slot name="right" slot="right"></slot>
        `);
    }

    static registerNumericAttributeType(attributeType: string, numericType: string): void {
        numericSynonyms[attributeType] = numericType;
    }
}

customElements.define("vi-persistent-object-attribute-numeric", PersistentObjectAttributeNumeric);

PersistentObjectAttributeRegister.add("Numeric", PersistentObjectAttributeNumeric);

const numericSynonyms: { [type: string]: string } = {};
