import { html, PropertyValues, unsafeCSS } from "lit";
import { property, query } from "lit/decorators.js";
import { notify, WebComponent } from "components/web-component/web-component";
import styles from "./masked-input.css";

export interface MaskedInputEventDetail {
    value: string;
    originalEvent?: Event;
}

export class MaskedInput extends WebComponent {
    static styles = [unsafeCSS(styles)];

    // We must track selection state manually because InputEvent fires AFTER the DOM changes,
    // at which point we"ve lost the information about what range was selected/replaced.
    #cachedSelection = { start: 0, end: 0 };

    @property({ type: String })
    format: string = "";
    
    @property({ type: String })
    separator: string = "/:- ()";
    
    @property({ type: String })
    allowed: string = "0123456789";
    
    @property({ type: String })
    open: string = "_YMDhms#";
    
    @property({ type: String, reflect: true })
    @notify()
    value: string = "";
    
    @property({ type: Boolean })
    insertMode: boolean = false;
    
    @property({ type: Boolean, reflect: true })
    invalid: boolean = false;

    @property({ type: Boolean, reflect: true })
    disabled: boolean = false;

    @query("input")
    inputElement!: HTMLInputElement;

    #getDataSlots(): number[] {
        return [...this.format].map((c, i) => this.open.includes(c) ? i : -1).filter(i => i !== -1);
    }

    protected firstUpdated(changedProperties: PropertyValues): void {
        super.firstUpdated(changedProperties);

        if (!this.value && this.format)
            this.value = this.format;
    }

    protected updated(changedProperties: PropertyValues): void {
        super.updated(changedProperties);

        // When format changes, reinitialize the value
        if (changedProperties.has("format") && changedProperties.get("format") !== undefined)
            this.value = this.format;
    }

    #dispatchChange(originalEvent?: Event) {
        this.dispatchEvent(new CustomEvent<MaskedInputEventDetail>("value-changed", {
            bubbles: true,
            composed: true,
            detail: { value: this.value, originalEvent }
        }));
    }

    #checkFilled() {
        const hasEmptySlot = [...this.format].some((formatChar, i) =>
            this.open.includes(formatChar) && this.value[i] === formatChar
        );

        if (hasEmptySlot)
            return;

        this.dispatchEvent(new CustomEvent<MaskedInputEventDetail>("filled", {
            bubbles: true,
            composed: true,
            detail: { value: this.value }
        }));
    }

    #replaceAt(str: string, index: number, replacement: string) {
        return `${str.slice(0, index)}${replacement}${str.slice(index + 1)}`;
    }

    #shiftCharactersLeft(value: string, fromIndex: number): string {
        let result = value;
        const dataSlots = this.#getDataSlots();

        // Find the index in dataSlots array where we start shifting
        const startSlotIndex = dataSlots.findIndex(slot => slot >= fromIndex);
        if (startSlotIndex === -1)
            return result;

        // Shift all characters from this position onwards
        for (let i = startSlotIndex; i < dataSlots.length - 1; i++) {
            const currentSlot = dataSlots[i];
            const nextSlot = dataSlots[i + 1];
            result = this.#replaceAt(result, currentSlot, result[nextSlot]);
        }

        // Clear the last data slot
        const lastSlot = dataSlots[dataSlots.length - 1];
        result = this.#replaceAt(result, lastSlot, this.format[lastSlot]);

        return result;
    }

    #shiftCharactersRight(value: string, fromIndex: number, charToInsert: string): { value: string; success: boolean } {
        let result = value;
        const dataSlots = this.#getDataSlots();

        // Find the index in dataSlots array where we start shifting
        const startSlotIndex = dataSlots.findIndex(slot => slot >= fromIndex);
        if (startSlotIndex === -1)
            return { value: result, success: false };

        // Check if last slot is empty (to prevent overflow)
        const lastSlot = dataSlots[dataSlots.length - 1];
        const isLastSlotEmpty = result[lastSlot] === this.format[lastSlot];
        if (!isLastSlotEmpty)
            return { value: result, success: false }; // Would overflow

        // Shift all characters from the end backwards
        for (let i = dataSlots.length - 1; i > startSlotIndex; i--) {
            const currentSlot = dataSlots[i];
            const prevSlot = dataSlots[i - 1];
            result = this.#replaceAt(result, currentSlot, result[prevSlot]);
        }

        // Insert the new character at the start position
        result = this.#replaceAt(result, fromIndex, charToInsert);

        return { value: result, success: true };
    }

    /**
     * Updates our internal cache of where the cursor/selection is.
     * We call this on keydown/click/select to ensure we have the state BEFORE input changes.
     */
    #updateSelectionCache() {
        if (this.inputElement) {
            this.#cachedSelection = {
                start: this.inputElement.selectionStart || 0,
                end: this.inputElement.selectionEnd || 0
            };
        }
    }

    #signalInvalidInput() {
        const input = this.inputElement;
        input.classList.remove("invalid");
        // Force reflow to restart animation
        void input.offsetWidth;
        input.classList.add("invalid");
    }

    #findNextDataSlot(fromIndex: number): number {
        for (let i = fromIndex; i < this.format.length; i++) {
            if (this.open.includes(this.format[i]))
                return i;
        }
        return -1;
    }

    #clearSelection(value: string, start: number, end: number): string {
        return value.substring(0, start) + this.format.substring(start, end) + value.substring(end);
    }

    #skipSeparators(fromIndex: number): number {
        let pos = fromIndex;
        while (pos < this.format.length && !this.open.includes(this.format[pos]))
            pos++;

        return pos;
    }

    #handleDeletion(inputType: string, oldValue: string, start: number, end: number ): { value: string; cursorPos: number } {
        const isSelection = start !== end;

        if (isSelection)
            return { value: this.#clearSelection(oldValue, start, end), cursorPos: start };

        // Single character delete
        if (inputType === "deleteContentBackward") {
            const targetIndex = start - 1;
            if (targetIndex < 0)
                return { value: oldValue, cursorPos: start };

            const isSeparator = !this.open.includes(this.format[targetIndex]);

            if (isSeparator) {
                // Jump over separator, delete previous valid slot
                let scan = targetIndex - 1;
                while (scan >= 0 && !this.open.includes(this.format[scan]))
                    scan--;

                if (scan >= 0) {
                    const newValue = this.insertMode
                        ? this.#shiftCharactersLeft(oldValue, scan)
                        : this.#replaceAt(oldValue, scan, this.format[scan]);
                    return { value: newValue, cursorPos: scan };
                }

                return { value: oldValue, cursorPos: targetIndex };
            }

            // Standard data delete
            const newValue = this.insertMode
                ? this.#shiftCharactersLeft(oldValue, targetIndex)
                : this.#replaceAt(oldValue, targetIndex, this.format[targetIndex]);
            return { value: newValue, cursorPos: targetIndex };
        }

        // Delete key forward
        const targetIndex = start;
        if (targetIndex >= this.format.length)
            return { value: oldValue, cursorPos: start };

        const isSeparator = !this.open.includes(this.format[targetIndex]);

        if (isSeparator) {
            // Jump over separator, delete next valid slot
            let scan = targetIndex + 1;
            while (scan < this.format.length && !this.open.includes(this.format[scan]))
                scan++;

            if (scan < this.format.length) {
                const newValue = this.insertMode
                    ? this.#shiftCharactersLeft(oldValue, scan)
                    : this.#replaceAt(oldValue, scan, this.format[scan]);
                return { value: newValue, cursorPos: start };
            }

            return { value: oldValue, cursorPos: start };
        }

        // Standard data delete
        const newValue = this.insertMode
            ? this.#shiftCharactersLeft(oldValue, targetIndex)
            : this.#replaceAt(oldValue, targetIndex, this.format[targetIndex]);
        return { value: newValue, cursorPos: start };
    }

    #handleInsertion(char: string, oldValue: string, start: number,end: number): { value: string; cursorPos: number; valid: boolean } {
        const isSelection = start !== end;
        let value = isSelection ? this.#clearSelection(oldValue, start, end) : oldValue;
        let cursorPos = start;

        if (!this.allowed.includes(char))
            return { value: oldValue, cursorPos: start, valid: false };

        const targetSlot = this.#findNextDataSlot(cursorPos);
        if (targetSlot === -1)
            return { value, cursorPos, valid: false };

        if (this.insertMode) {
            const result = this.#shiftCharactersRight(value, targetSlot, char);
            if (result.success) {
                value = result.value;
                cursorPos = this.#skipSeparators(targetSlot + 1);
            }
        } else {
            value = this.#replaceAt(value, targetSlot, char);
            cursorPos = this.#skipSeparators(targetSlot + 1);
        }

        return { value, cursorPos, valid: true };
    }

    #handlePaste(data: string, oldValue: string, start: number, end: number): { value: string; cursorPos: number } {
        const isSelection = start !== end;
        let value = isSelection ? this.#clearSelection(oldValue, start, end) : oldValue;
        let cursorPos = start;

        const pastedChars = [...data].filter(c => this.allowed.includes(c));

        for (let i = cursorPos; i < this.format.length && pastedChars.length > 0; i++) {
            if (this.open.includes(this.format[i])) {
                value = this.#replaceAt(value, i, pastedChars.shift()!);
                cursorPos = i + 1;
            }
        }

        return { value, cursorPos: this.#skipSeparators(cursorPos) };
    }

    private _handleInput(e: InputEvent) {
        const input = this.inputElement;
        const oldValue = this.value;
        const { start, end } = this.#cachedSelection;

        let result: { value: string; cursorPos: number };

        if (e.inputType === "deleteContentBackward" || e.inputType === "deleteContentForward")
            result = this.#handleDeletion(e.inputType, oldValue, start, end);
        else if (e.inputType === "insertText" && e.data) {
            const insertion = this.#handleInsertion(e.data, oldValue, start, end);
            if (!insertion.valid)
                this.#signalInvalidInput();

            result = insertion;
        }
        else if (e.inputType === "insertFromPaste" && e.data)
            result = this.#handlePaste(e.data, oldValue, start, end);
        else
            result = { value: oldValue, cursorPos: start };

        // Apply changes
        this.value = result.value;
        input.value = result.value;
        input.setSelectionRange(result.cursorPos, result.cursorPos);

        // Update cache immediately to the new state
        this.#cachedSelection = { start: result.cursorPos, end: result.cursorPos };

        this.#dispatchChange(e);
        this.#checkFilled();
    }

    private _handleKeyDown(e: KeyboardEvent) {
        // Capture selection before the action takes place
        this.#updateSelectionCache();

        if (e.key === "Backspace") {
            const { start, end } = this.#cachedSelection;

            // If we are doing a single backspace (no selection)
            // and we are standing right after a separator, jump back.
            if (start === end && start > 0) {
                const prevCharIsSeparator = !this.open.includes(this.format[start - 1]);
                if (prevCharIsSeparator) {
                    let scan = start - 1;
                    while (scan > 0 && !this.open.includes(this.format[scan - 1])) {
                        scan--;
                    }
                    // Move cursor there, so the "input" event (deleteContentBackward)
                    // sees the cursor at the number, not the separator.
                    this.inputElement.setSelectionRange(scan, scan);
                    this.#cachedSelection = { start: scan, end: scan };
                }
            }
        }
    }

    // Hook into other events that change selection
    private _handleSelectionChange() {
        this.#updateSelectionCache();
    }

    private _handleMouseDown(e: MouseEvent) {
        // If the value equals the format (nothing entered yet), position caret at first editable slot
        if (this.value === this.format) {
            e.preventDefault(); // Prevent default browser caret placement
            this.inputElement.focus();
            const firstOpenSlot = [...this.format].findIndex(char => this.open.includes(char));
            if (firstOpenSlot !== -1) {
                this.inputElement.setSelectionRange(firstOpenSlot, firstOpenSlot);
                this.#cachedSelection = { start: firstOpenSlot, end: firstOpenSlot };
            }
        }
    }

    render() {
        return html`
            <input
                type="text"
                part="input"
                .value=${this.value}
                aria-label=${this.format}
                autocomplete="off"
                ?disabled=${this.disabled}
                @input=${this._handleInput}
                @keydown=${this._handleKeyDown}
                @mouseup=${this._handleSelectionChange}
                @focus=${this._handleSelectionChange}
                @select=${this._handleSelectionChange}
                @mousedown=${this._handleMouseDown}
            />
        `;
    }
}

customElements.define("vi-masked-input", MaskedInput);