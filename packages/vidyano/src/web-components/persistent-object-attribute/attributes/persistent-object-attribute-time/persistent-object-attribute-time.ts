import { html, nothing, unsafeCSS, type TemplateResult } from "lit";
import { query, state } from "lit/decorators.js";
import * as Vidyano from "@vidyano/core";
import "components/masked-input/masked-input";
import { computed } from "components/web-component/web-component";
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute";
import * as PersistentObjectAttributeRegister from "components/persistent-object-attribute/persistent-object-attribute-register";
import type { TimePicker } from "../../../time-picker/time-picker.js";
import "../../../time-picker/time-picker.js";
import type { MaskedInput } from "../../../masked-input/masked-input.js";
import styles from "./persistent-object-attribute-time.css";

export class PersistentObjectAttributeTime extends PersistentObjectAttribute {
    static styles = [super.styles, unsafeCSS(styles)];

    @state()
    selectedTime: Date;

    @state()
    private _timeInvalid: boolean = false;

    get #culture(): Vidyano.CultureInfo {
        return Vidyano.CultureInfo.currentCulture || Vidyano.CultureInfo.invariantCulture;
    }

    get timeFormat(): string {
        return "__" + this.#culture.dateFormat.timeSeparator + "__";
    }

    get timeSeparator(): string {
        return this.#culture.dateFormat.timeSeparator;
    }

    get #timeDisplayValue(): string {
        if (this.selectedTime)
            return String.format(`{0:D2}${this.timeSeparator}{1:D2}`, this.selectedTime.getHours(), this.selectedTime.getMinutes());

        return this.readOnly ? "—" : this.timeFormat;
    }

    @computed(function(this: PersistentObjectAttributeTime): boolean {
        return this.attribute?.value != null && !this.attribute?.isRequired;
    }, "attribute.value", "attribute.isRequired")
    declare readonly canClear: boolean;

    @query("vi-masked-input")
    private declare readonly timeInput: MaskedInput;

    @query("#timepicker")
    private declare readonly timePicker: TimePicker;

    override focus() {
        this.timeInput?.focus();
    }

    protected override _editingChanged() {
        super._editingChanged();

        if (this.editing)
            this._timeInvalid = false;
    }

    protected override _valueChanged(value: Date | string, oldValue: any) {
        super._valueChanged(value, oldValue);

        const parsed = this.#parseTime(value);
        if (this.#sameHM(this.selectedTime, parsed))
            return;

        this.selectedTime = parsed;
        if (!this.editing)
            this._timeInvalid = false;
    }

    #sameHM(a: Date | null, b: Date | null): boolean {
        if (a == null && b == null)
            return true;

        if (a == null || b == null)
            return false;

        return a.getHours() === b.getHours() && a.getMinutes() === b.getMinutes();
    }

    #parseTime(value: Date | string | null): Date | null {
        if (value == null)
            return null;

        if (value instanceof Date) {
            const time = new Date();
            time.setHours(value.getHours(), value.getMinutes(), value.getSeconds(), value.getMilliseconds());
            return time;
        }

        if (typeof value !== "string" || value.length === 0)
            return null;

        // Parse .NET TimeSpan string format: [d. or d:]HH:mm:ss[.fffffff]
        const match = /^(?:(\d+)[.:])?(\d{1,2}):(\d{1,2}):(\d{1,2})(?:\.(\d+))?$/.exec(value);
        if (!match)
            return null;

        const hours = parseInt(match[2], 10);
        const minutes = parseInt(match[3], 10);
        const seconds = parseInt(match[4], 10);
        let milliseconds = 0;
        if (match[5])
            milliseconds = parseInt(match[5].substring(0, 3).padEnd(3, "0"), 10);

        const time = new Date();
        time.setHours(hours, minutes, seconds, milliseconds);
        return time;
    }

    #toServiceValue(time: Date | null): string | null {
        if (!time)
            return null;

        return String.format("0:{0:D2}:{1:D2}:{2:D2}.{3:D3}0000", time.getHours(), time.getMinutes(), time.getSeconds(), time.getMilliseconds());
    }

    #updateAttributeValue(time: Date | null) {
        const serviceValue = this.#toServiceValue(time);
        if (serviceValue === this.value)
            return;

        this._timeInvalid = false;
        this.attribute.setValue(serviceValue, true).catch(Vidyano.noop);
    }

    private _timeChanged(e: CustomEvent) {
        const newTime = e.detail.value as Date | null;
        if (this.#sameHM(this.selectedTime, newTime))
            return;

        if (!newTime)
            return;

        const normalized = new Date();
        normalized.setHours(newTime.getHours(), newTime.getMinutes(), 0, 0);

        this.selectedTime = normalized;
        this.#updateAttributeValue(normalized);
    }

    private _timeFilled() {
        if (!this.timeInput)
            return;

        const timeParts = this.timeInput.value.split(this.timeSeparator);
        if (timeParts.length === 2) {
            const hours = parseInt(timeParts[0], 10);
            const minutes = parseInt(timeParts[1], 10);

            if (!isNaN(hours) && hours >= 0 && hours <= 23 && !isNaN(minutes) && minutes >= 0 && minutes <= 59) {
                const newTime = new Date();
                newTime.setHours(hours, minutes, 0, 0);

                this._timeInvalid = false;

                if (this.#sameHM(this.selectedTime, newTime))
                    return;

                this.selectedTime = newTime;
                this.#updateAttributeValue(newTime);
                return;
            }
        }

        this._timeInvalid = true;
    }

    private _focusout(e: FocusEvent) {
        if (!this.editing || this.readOnly)
            return;

        const related = e.relatedTarget as Node;
        if (related && (this.timePicker?.contains(related) || related === this.timeInput))
            return;

        const value = this.timeInput?.value;
        if ((value === this.timeFormat || value === "") && !this.attribute.isRequired)
            this._timeInvalid = false;
    }

    private _clear() {
        this.attribute.setValue(null, true).catch(Vidyano.noop);
    }

    protected override renderDisplay() {
        return super.renderDisplay(html`<span>${this.attribute?.displayValue}</span>`);
    }

    protected override renderEdit(innerTemplate?: TemplateResult) {
        return super.renderEdit(html`
            <vi-sensitive ?disabled=${!this.sensitive}>
                <vi-masked-input
                    .format=${this.timeFormat}
                    .separator=${this.timeSeparator}
                    .value=${this.#timeDisplayValue}
                    ?disabled=${this.readOnly || this.frozen}
                    ?invalid=${this._timeInvalid}
                    tabindex=${this.readOnlyTabIndex || nothing}
                    @filled=${this._timeFilled}
                    @focusout=${this._focusout}>
                </vi-masked-input>
            </vi-sensitive>
            ${!this.readOnly ? html`
                <vi-time-picker slot="right" id="timepicker"
                    .time=${this.selectedTime}
                    @time-changed=${this._timeChanged}>
                </vi-time-picker>
                ${this.canClear ? html`
                    <vi-button id="clearButton" slot="right" @click=${this._clear} tabindex="-1" ?disabled=${this.frozen}>
                        <vi-icon source="Remove"></vi-icon>
                    </vi-button>
                ` : nothing}
            ` : nothing}
        `);
    }
}

customElements.define("vi-persistent-object-attribute-time", PersistentObjectAttributeTime);

PersistentObjectAttributeRegister.add("Time", PersistentObjectAttributeTime);
PersistentObjectAttributeRegister.add("NullableTime", PersistentObjectAttributeTime);
