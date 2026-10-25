import { html, nothing, unsafeCSS, type TemplateResult } from "lit";
import { property } from "lit/decorators.js";
import BigNumber from 'bignumber.js';
import * as Vidyano from "@vidyano/core"
import * as Keyboard from "components/utils/keyboard"
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute";
import * as PersistentObjectAttributeRegister from "components/persistent-object-attribute/persistent-object-attribute-register"
import { computed, observer } from "components/web-component/web-component";
import styles from "./persistent-object-attribute-numeric.css";

export class PersistentObjectAttributeNumeric extends PersistentObjectAttribute {
    static styles = [super.styles, unsafeCSS(styles)];

    #allowDecimal: boolean;
    #isNullable: boolean;
    #decimalSeparator: string;
    #attributeValueChangedBlock: boolean = false;

    @computed(function(this: PersistentObjectAttributeNumeric): string {
        return this._computeInputtype();
    }, "attribute.typeHints")
    declare readonly inputtype: string;

    @property({ type: String, reflect: true })
    unitBefore: string = null;

    @property({ type: String, reflect: true })
    unitAfter: string = null;

    @property({ type: Boolean, reflect: true })
    focused: boolean = false;

    // @observer resolves observers by method name, so this cannot be a # private.
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

    static #decimalTypes = ["NullableDecimal", "Decimal", "NullableSingle", "Single", "NullableDouble", "Double"];
    static #unsignedTypes = ["Byte", "NullableByte", "UInt16", "NullableUInt16", "UInt32", "NullableUInt32", "UInt64", "NullableUInt64"];

    protected override _attributeChanged() {
        super._attributeChanged();

        if (!(this.attribute instanceof Vidyano.PersistentObjectAttribute))
            return;

        this.#allowDecimal = this._allowsDecimal();
        this.#isNullable = (numericSynonyms[this.attribute.type] || this.attribute.type).startsWith("Nullable") && !this.attribute.parent.isBulkEdit;
        this.#decimalSeparator = Vidyano.CultureInfo.currentCulture.numberFormat.numberDecimalSeparator;
    }

    protected override _attributeValueChanged() {
        // Block flag prevents circular updates: attribute.value → this.value → _valueChanged → attribute.value
        if (this.#attributeValueChangedBlock)
            return;

        try {
            this.#attributeValueChangedBlock = true;

            if (this.attribute.value == null) {
                if (this.value !== "")
                    this.value = "";

                return;
            }

            const attributeValue = this.attribute.value.toString();
            let newDisplayValue = this.#unNormalize(attributeValue);

            // If focused and input has trailing separator or trailing zeros, preserve them in the display value
            // This allows users to type decimal numbers like "123.45" or "150.10" without formatting being applied mid-typing
            const input = this.shadowRoot?.querySelector("input") as HTMLInputElement;
            if (this.focused && input) {
                const inputValue = input.value;

                // Preserve input if user is typing just a decimal separator (e.g., "." or ",")
                if (inputValue === this.#decimalSeparator || inputValue === ".") {
                    newDisplayValue = inputValue;
                } else {
                    // Normalize both values to compare numeric equality
                    const inputNormalized = this.#normalize(inputValue);
                    const newDisplayNormalized = this.#normalize(newDisplayValue);

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
            this.#attributeValueChangedBlock = false;
        }
    }

    protected override async _valueChanged(newValue: string, oldValue: string) {
        if (!(this.attribute instanceof Vidyano.PersistentObjectAttribute))
            return;

        if (newValue === undefined)
            return;

        // Block flag prevents circular updates: this.value → attribute.value → _attributeValueChanged → this.value
        if (this.#attributeValueChangedBlock)
            return;

        if (newValue != null)
            newValue = this.#normalize(newValue);

        try {
            // While focused, allow trailing decimal separator so users can type decimal numbers like "123.45"
            // Normalize empty values and single minus sign
            if (this.focused && (newValue === "" || newValue === "-")) {
                newValue = this.attribute.isRequired && !this.#isNullable ? "0" : "";
            }

            // Allow trailing decimal separator while focused, but validate the number without it
            const valueToValidate = (this.focused && newValue.endsWith(".")) ? newValue.substring(0, newValue.length - 1) : newValue;

            // While focused, allow empty string (user typing just a decimal separator like ".")
            // Don't update the attribute value - just keep it in the display until blur
            if (this.focused && valueToValidate === "") {
                return;
            }

            if (!this.#canParse(valueToValidate)) {
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

    protected _computeInputtype(): string {
        // type="number" is incompatible with this component's text-based caret/value handling.
        const inputtype = this.attribute?.getTypeHint("inputtype", undefined, undefined);
        return inputtype?.toLowerCase() === "number" ? "text" : inputtype;
    }

    // Resolved from attribute.type so it is valid before _attributeChanged runs.
    protected _allowsDecimal(): boolean {
        if (!(this.attribute instanceof Vidyano.PersistentObjectAttribute))
            return false;

        const type = numericSynonyms[this.attribute.type] || this.attribute.type;
        return PersistentObjectAttributeNumeric.#decimalTypes.indexOf(type) >= 0;
    }

    protected _computeInputmode(): string {
        return this.attribute?.getTypeHint("inputmode", this._allowsDecimal() ? "decimal" : "numeric");
    }

    #editInputBlur() {
        if (!(this.attribute instanceof Vidyano.PersistentObjectAttribute))
            return;

        // Normalize value before blur: remove trailing decimal point
        let normalizedValue = this.value;

        if (normalizedValue != null)
            normalizedValue = this.#normalize(normalizedValue);

        if (normalizedValue === "" || normalizedValue === "-")
            normalizedValue = this.attribute.isRequired && !this.#isNullable ? "0" : "";
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
                this.#attributeValueChangedBlock = true;

                const attributeValue = this.attribute.value ? this.attribute.value.toString() : ((this.attribute.isRequired && !this.#isNullable) || this.value ? "0" : "");
                const newDisplayValue = this.#unNormalize(attributeValue);

                if (this.value !== newDisplayValue)
                    this.value = newDisplayValue;
            }
            finally {
                this.#attributeValueChangedBlock = false;
            }
        }
    }

    #editInputFocus(e: Event) {
        this.focused = true;

        const input = <HTMLInputElement>e.target;
        if (!input.value || !this.attribute.getTypeHint("SelectAllOnFocus"))
            return;

        input.selectionStart = 0;
        input.selectionEnd = input.value.length;
    }

    #normalize(value: string): string {
        if (!value || this.#decimalSeparator === ".")
            return value;

        return value.replace(this.#decimalSeparator, ".");
    }

    #unNormalize(value: string): string {
        if (!value || this.#decimalSeparator === ".")
            return value;

        return value.replace(".", this.#decimalSeparator);
    }

    #canParse(value: string): boolean {
        if (!value && this.#isNullable)
            return true;

        if (value && value.startsWith(this.#decimalSeparator))
            value = `0${value}`;

        switch (numericSynonyms[this.attribute.type] || this.attribute.type) {
            case "Byte":
            case "NullableByte":
                return this.#between(parseInt(value, 10), 0, 255);
            case "SByte":
            case "NullableSByte":
                return this.#between(parseInt(value, 10), -128, 127);
            case "Int16":
            case "NullableInt16":
                return this.#between(parseInt(value, 10), -32768, 32767);
            case "UInt16":
            case "NullableUInt16":
                return this.#between(parseInt(value, 10), 0, 65535);
            case "Int32":
            case "NullableInt32":
                return this.#between(parseInt(value, 10), -2147483648, 2147483647);
            case "UInt32":
            case "NullableUInt32":
                return this.#between(parseFloat(value), 0, 4294967295);
            case "Int64":
            case "NullableInt64":
                return this.#between(parseFloat(value), -9223372036854775808, 9223372036854775807);
            case "UInt64":
            case "NullableUInt64":
                return this.#between(parseFloat(value), 0, 18446744073709551615);
            case "Decimal":
            case "NullableDecimal":
                return this.#between(parseFloat(value), -79228162514264337593543950335, 79228162514264337593543950335);
            case "Single":
            case "NullableSingle":
                return this.#between(parseFloat(value), -3.40282347E+38, 3.40282347E+38);
            case "Double":
            case "NullableDouble":
                return this.#between(parseFloat(value), -1.7976931348623157E+308, 1.7976931348623157E+308);
            default:
                return false;
        }
    }

    #between(value: number, minValue: number, maxValue: number): boolean {
        return !isNaN(value) && value >= minValue && value <= maxValue;
    }

    #setCarretIndex(input: HTMLInputElement, carretIndex: number): void {
        input.selectionEnd = carretIndex;
        input.selectionStart = carretIndex;
    }

    #keypress(e: KeyboardEvent): void {
        if (e.key === Keyboard.Keys.Tab || e.key === Keyboard.Keys.Shift || e.key === Keyboard.Keys.Control || e.key === Keyboard.Keys.Alt || e.key === Keyboard.Keys.ArrowLeft || e.key === Keyboard.Keys.ArrowRight || e.key === Keyboard.Keys.ArrowUp || e.key === Keyboard.Keys.ArrowDown || e.key === Keyboard.Keys.Backspace)
            return;

        const input = <HTMLInputElement>e.target;
        let value = input.value;
        const carretIndex = input.selectionStart;
        if (input.selectionEnd !== carretIndex)
            value = value.slice(0, Math.min(input.selectionEnd, carretIndex)) + value.slice(Math.max(input.selectionEnd, carretIndex));

        if (e.key.length === 1 && /^\d+$/.test(e.key)) {
            if (!this.#canParse(value.insert(e.key, carretIndex)))
                e.preventDefault();
        }
        else {
            if ((e.key === Keyboard.Keys.Comma || e.key === Keyboard.Keys.Period) && !value.contains(this.#decimalSeparator) && this.#allowDecimal) {
                this.value = input.value = value.insert(this.#decimalSeparator, carretIndex);
                this.#setCarretIndex(input, carretIndex + 1);
            }
            else if (e.key === Keyboard.Keys.Subtract && !value.contains("-") && carretIndex === 0 && PersistentObjectAttributeNumeric.#unsignedTypes.indexOf(numericSynonyms[this.attribute.type] || this.attribute.type) === -1) {
                this.value = input.value = value.insert("-", carretIndex);
                this.#setCarretIndex(input, carretIndex + 1);
            }

            e.preventDefault();
        }
    }

    #onPaste(e: ClipboardEvent): void {
        if (!(this.attribute instanceof Vidyano.PersistentObjectAttribute) || !e.clipboardData)
            return;

        // Get pasted data
        let pastedText = e.clipboardData.getData('text');
        if (!pastedText)
            return;

        // Get only sign, digits, decimal and thousand separator from pasted text
        const regex = new RegExp(`[^-0-9.,]`, 'g');
        pastedText = pastedText.replace(regex, '');

        const cleanedText = this.#normalizePastedNumber(pastedText);

        // Only replace clipboard data if resulting value would be valid
        const input = <HTMLInputElement>e.target;
        const selStart = input.selectionStart || 0;
        const selEnd = input.selectionEnd || 0;
        const currentValue = input.value;
        const newValue = currentValue.substring(0, selStart) + cleanedText + currentValue.substring(selEnd);

        if (this.#canParse(newValue)) {
            e.preventDefault();

            input.value = newValue;

            // Set the cursor position after inserted text
            const newPosition = selStart + cleanedText.length;
            input.setSelectionRange(newPosition, newPosition);

            // Trigger input event to ensure value changes are processed
            input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        }
    }

    #normalizePastedNumber(value: string): string {
        const decimalSeparator = this.#decimalSeparator;
        const groupSeparator = Vidyano.CultureInfo.currentCulture.numberFormat.numberGroupSeparator;
        const pastedDecimalSeparator = this.#getPastedDecimalSeparator(value, decimalSeparator, groupSeparator);
        let normalizedValue = value.startsWith("-") ? "-" : "";

        for (const char of value) {
            if (/^\d$/.test(char))
                normalizedValue += char;
            else if (char === pastedDecimalSeparator)
                normalizedValue += decimalSeparator;
        }

        const parts = normalizedValue.split(decimalSeparator);
        if (parts.length > 2)
            normalizedValue = parts[0] + decimalSeparator + parts.slice(1).join('');

        return normalizedValue;
    }

    // With both separators the rightmost one is decimal; with one separator, valid culture grouping wins.
    #getPastedDecimalSeparator(value: string, decimalSeparator: string, groupSeparator: string): string | null {
        const lastPeriod = value.lastIndexOf(".");
        const lastComma = value.lastIndexOf(",");

        if (lastPeriod >= 0 && lastComma >= 0)
            return lastPeriod > lastComma ? "." : ",";

        const separator = lastPeriod >= 0 ? "." : lastComma >= 0 ? "," : null;
        if (!separator)
            return null;

        if (separator === decimalSeparator)
            return separator;

        return separator === groupSeparator && this.#hasValidGrouping(value, separator) ? null : separator;
    }

    #hasValidGrouping(value: string, groupSeparator: string): boolean {
        const digits = value.startsWith("-") ? value.substring(1) : value;
        const groups = digits.split(groupSeparator);
        if (groups.length < 2 || groups[0].length === 0 || groups[0].length > 3)
            return false;

        return groups.slice(1).every(group => group.length === 3);
    }

    protected override renderDisplay() {
        return super.renderDisplay(html`<span>${this.attribute?.displayValue}</span>`);
    }

    #onInput(e: InputEvent) {
        const input = e.target as HTMLInputElement;

        // _keypress only covers physical keyboards; normalize soft-keyboard / IME / paste input here.
        if (this.#allowDecimal)
            this.#normalizeInputSeparators(input);

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

    // Normalizes separators in the input value, keeping the caret/selection aligned.
    #normalizeInputSeparators(input: HTMLInputElement): void {
        const value = input.value;

        // A value already containing the decimal separator is locale-formatted (e.g. dropped
        // "1,234.56"), so the alternative separator is grouping; otherwise it is a mistyped decimal.
        const dropGrouping = value.includes(this.#decimalSeparator);

        const normalizedValue = this.#normalizeSeparators(value, dropGrouping);
        if (normalizedValue === value)
            return;

        const selectionStart = input.selectionStart ?? normalizedValue.length;
        const selectionEnd = input.selectionEnd ?? selectionStart;

        input.value = normalizedValue;
        input.setSelectionRange(
            this.#normalizeSeparators(value.substring(0, selectionStart), dropGrouping).length,
            this.#normalizeSeparators(value.substring(0, selectionEnd), dropGrouping).length);
    }

    // Drops the alternative separator as grouping or converts it to the decimal separator, then collapses extra decimal separators.
    #normalizeSeparators(value: string, dropGrouping: boolean): string {
        const alternativeSeparator = this.#decimalSeparator === "." ? "," : ".";
        let normalizedValue = dropGrouping
            ? value.replaceAll(alternativeSeparator, "")
            : value.replaceAll(alternativeSeparator, this.#decimalSeparator);

        const separatorIndex = normalizedValue.indexOf(this.#decimalSeparator);
        if (separatorIndex >= 0) {
            normalizedValue = normalizedValue.substring(0, separatorIndex + 1)
                + normalizedValue.substring(separatorIndex + 1).replaceAll(this.#decimalSeparator, "");
        }

        return normalizedValue;
    }

    protected override renderEdit(innerTemplate?: TemplateResult) {
        return super.renderEdit(html`
            <slot name="left" slot="left"></slot>
            <div class="input-container">
                ${this.unitBefore ? html`<span class="before">${this.unitBefore}</span>` : nothing}
                <vi-sensitive ?disabled=${!this.sensitive}>
                    <input
                        .value=${this.value || ""}
                        @input=${this.#onInput}
                        type=${this.inputtype}
                        inputmode=${this._computeInputmode()}
                        @keypress=${this.#keypress}
                        @paste=${this.#onPaste}
                        @focus=${this.#editInputFocus}
                        @blur=${this.#editInputBlur}
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
