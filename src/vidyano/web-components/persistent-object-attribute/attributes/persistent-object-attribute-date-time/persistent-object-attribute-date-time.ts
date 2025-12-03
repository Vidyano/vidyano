import { html, nothing, unsafeCSS, type TemplateResult } from "lit";
import { property, query, state } from "lit/decorators.js";
import * as Vidyano from "vidyano";
import "components/masked-input/masked-input";
import { computed, observer } from "components/web-component/web-component";
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute";
import * as PersistentObjectAttributeRegister from "components/persistent-object-attribute/persistent-object-attribute-register";
import type { TimePicker } from "../../../time-picker/time-picker.js";
import "../../../time-picker/time-picker.js";
import type { DatePicker } from "../../../date-picker/date-picker.js";
import "../../../date-picker/date-picker.js";
import type { MaskedInput } from "../../../masked-input/masked-input.js";
import styles from "./persistent-object-attribute-date-time.css";

export class PersistentObjectAttributeDateTime extends PersistentObjectAttribute {
    static styles = [super.styles, unsafeCSS(styles)];

    private _valueChangedBlock: boolean;
    private _pendingRefresh: boolean;
    private _latestSetValue: Date | string | null = null;

    @state()
    selectedDate: Date;

    @state()
    selectedTime: Date;

    @state()
    private _dateInvalid: boolean = false;

    @state()
    private _timeInvalid: boolean = false;

    @property({ type: Boolean, reflect: true })
    @computed(function(this: PersistentObjectAttributeDateTime): boolean {
        return this._dateInvalid || this._timeInvalid;
    }, "_dateInvalid", "_timeInvalid")
    declare readonly isInvalid: boolean;

    @property({ type: Boolean })
    @computed(function(this: PersistentObjectAttributeDateTime): boolean {
        return this.attribute?.type?.contains("Date") ?? false;
    }, "attribute.type")
    declare readonly hasDateComponent: boolean;

    @property({ type: Boolean })
    @computed(function(this: PersistentObjectAttributeDateTime): boolean {
        return this.attribute?.type?.contains("Time") ?? false;
    }, "attribute.type")
    declare readonly hasTimeComponent: boolean;

    get #culture(): Vidyano.CultureInfo {
        return Vidyano.CultureInfo.currentCulture || Vidyano.CultureInfo.invariantCulture;
    }

    get dateFormat(): string {
        return this.#culture.dateFormat.shortDatePattern.toLowerCase().replace(/[ymd]/g, "_");
    }

    get dateSeparator(): string {
        return this.#culture.dateFormat.dateSeparator;
    }

    get timeFormat(): string {
        return "__" + this.#culture.dateFormat.timeSeparator + "__";
    }

    get timeSeparator(): string {
        return this.#culture.dateFormat.timeSeparator;
    }

    get #dateDisplayValue(): string {
        const pattern = this.#culture.dateFormat.shortDatePattern;

        if (this.selectedDate)
            return this.#formatDate(this.selectedDate, pattern);

        return this.readOnly ? "—" : this.dateFormat;
    }

    get #timeDisplayValue(): string {
        if (this.selectedTime)
            return String.format(`{0:D2}${this.timeSeparator}{1:D2}`, this.selectedTime.getHours(), this.selectedTime.getMinutes());

        return this.readOnly ? (this.hasDateComponent ? "" : "—") : this.timeFormat;
    }

    @property({ type: Boolean })
    @computed(function(this: PersistentObjectAttributeDateTime): boolean {
        return this.attribute?.value != null && !this.attribute?.isRequired;
    }, "attribute.value", "attribute.isRequired")
    declare readonly canClear: boolean;

    @property({ type: Boolean })
    @computed(function(this: PersistentObjectAttributeDateTime): boolean {
        return this.attribute?.getTypeHint("displayformat", "").toLowerCase() === "{0:y}";
    }, "attribute.typeHints")
    declare readonly monthMode: boolean;

    @property({ type: Object })
    @computed(function(this: PersistentObjectAttributeDateTime): Date | null {
        return this.#parseMinMaxDate(this.attribute?.getTypeHint("mindate"));
    }, "attribute.typeHints")
    declare readonly minDate: Date | null;

    @property({ type: Object })
    @computed(function(this: PersistentObjectAttributeDateTime): Date | null {
        return this.#parseMinMaxDate(this.attribute?.getTypeHint("maxdate"));
    }, "attribute.typeHints")
    declare readonly maxDate: Date | null;

    @query("vi-masked-input.date")
    private declare readonly dateInput: MaskedInput;

    @query("vi-masked-input.time")
    private declare readonly timeInput: MaskedInput;

    @query("#datepicker")
    private declare readonly datePicker: DatePicker;

    @query("#timepicker")
    private declare readonly timePicker: TimePicker;

    override focus() {
        if (this.app.activeElement instanceof HTMLInputElement) {
            const input = this.app.activeElement as HTMLInputElement;
            if (input.getRootNode() instanceof ShadowRoot && (input.getRootNode() as ShadowRoot).host === this.timeInput)
                return;
        }

        (this.dateInput || this.timeInput)?.focus();
    }

    protected override _editingChanged() {
        super._editingChanged();

        this._latestSetValue = null;
        if (this.editing) {
            this._dateInvalid = false;
            this._timeInvalid = false;
        }
    }

    protected override _valueChanged(value: Date, oldValue: any) {
        // Skip stale callbacks from out-of-order async setValue responses
        if (this._latestSetValue !== null && this.editing && !this.readOnly) {
            const latestTime = this._latestSetValue instanceof Date ? this._latestSetValue.getTime() : null;
            const valueTime = value instanceof Date ? value.getTime() : null;

            if (latestTime !== valueTime)
                return;
        }

        super._valueChanged(value, oldValue);

        try {
            this._valueChangedBlock = true;
            if (this.attribute && value instanceof Date) {
                this.selectedDate = this.attribute.type.contains("Date") ? new Date(value.getTime()) : null;

                if (this.attribute.type === "Time" || this.attribute.type === "NullableTime")
                    this.selectedTime = this.#parseTime(this.value);
                else {
                    this.selectedTime = this.attribute.type.contains("Time") ? new Date(value.getTime()) : null;
                }
            }
            else {
                this.selectedDate = this.selectedTime = null;
            }
        }
        finally {
            // Only reset invalid states when not in editing mode.
            // In editing mode, the fill handlers manage invalid states.
            // Resetting here would cause race conditions with async server responses.
            if (!this.editing) {
                this._dateInvalid = false;
                this._timeInvalid = false;
            }
            this._valueChangedBlock = false;
        }
    }

    @observer("selectedDate", "hasDateComponent", "hasTimeComponent")
    private _selectedDateChanged(selectedDate: Date, hasDateComponent: boolean, hasTimeComponent: boolean) {
        if (!this.editing || this.readOnly || !hasDateComponent || this._valueChangedBlock)
            return;

        // Don't update attribute value if time component is invalid
        if (hasTimeComponent && this._timeInvalid)
            return;

        if (selectedDate) {
            const newValue = new Date(selectedDate.getTime());
            if (this.hasTimeComponent) {
                if (this.selectedTime) {
                    newValue.setHours(this.selectedTime.getHours(), this.selectedTime.getMinutes(), this.selectedTime.getSeconds(), this.selectedTime.getMilliseconds());
                } else if (typeof this.attribute.typeHints.newtime === "string") {
                    const time = this.attribute.typeHints.newtime.split(/[:.]/);

                    while (time.length < 4)
                        time.push("0");

                    newValue.setHours(parseInt(time[0], 10), parseInt(time[1], 10), parseInt(time[2], 10), parseInt(time[3].substring(0, 3), 10));
                } else
                    newValue.setHours(0, 0, 0, 0);
            } else
                newValue.setHours(0, 0, 0, 0);

            this.#updateAttributeValue(newValue);
        } else {
            this.#updateAttributeValue(null);
        }
    }

    @observer("selectedTime", "hasDateComponent", "hasTimeComponent")
    private _selectedTimeChanged(selectedTime: Date, hasDateComponent: boolean, hasTimeComponent: boolean) {
        if (!this.editing || this.readOnly || !hasTimeComponent || this._valueChangedBlock)
            return;

        // Don't update attribute value if date component is invalid
        if (hasDateComponent && this._dateInvalid)
            return;

        if (hasDateComponent) {
            if (selectedTime) {
                const baseDate = this.selectedDate || new Date();
                const newValue = new Date(baseDate.getTime());
                newValue.setHours(selectedTime.getHours(), selectedTime.getMinutes(), selectedTime.getSeconds(), selectedTime.getMilliseconds());
                this.#updateAttributeValue(newValue);
            } else if (this.selectedDate) {
                const newValue = new Date(this.selectedDate.getTime());
                newValue.setHours(0, 0, 0, 0);
                this.#updateAttributeValue(newValue);
            } else {
                this.#updateAttributeValue(null);
            }
        } else if (selectedTime) {
            // Format as .NET TimeSpan: "d:HH:MM:SS.fff0000" (days=0, padded trailing zeros for ticks)
            const newTimeValue = String.format("0:{0:D2}:{1:D2}:{2:D2}.{3:D3}0000", selectedTime.getHours(), selectedTime.getMinutes(), selectedTime.getSeconds(), selectedTime.getMilliseconds());
            // Compare excluding trailing precision digits to avoid unnecessary updates
            if (!this.value || (this.value as string).substring(0, newTimeValue.length - 4) !== newTimeValue.substring(0, newTimeValue.length - 4))
                this.#updateAttributeValue(newTimeValue);
        } else {
            this.#updateAttributeValue(null);
        }
    }

    #normalizeForComparison(date: Date, useTime: boolean, isMaxBound: boolean = false): Date {
        if (useTime)
            return new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());

        // For date-only comparisons, max bounds use end-of-day
        if (isMaxBound)
            return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

        return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    }

    #isDateInRange(date: Date): boolean {
        const normalized = this.#normalizeForComparison(date, this.hasTimeComponent);

        if (this.minDate) {
            const min = this.#normalizeForComparison(this.minDate, this.hasTimeComponent);
            if (normalized < min)
                return false;
        }

        if (this.maxDate) {
            const max = this.#normalizeForComparison(this.maxDate, this.hasTimeComponent, true);
            if (normalized > max)
                return false;
        }

        return true;
    }

    /**
     * Determines if we should trigger an immediate server refresh when setting a value.
     *
     * We want immediate refresh when:
     * - monthMode: Navigation buttons change the value discretely, so refresh immediately
     * - First value: Setting a value when none existed indicates a completed selection
     * - Picker open: User is actively selecting from the date/time picker popup
     *
     * We defer refresh when the user is actively typing in the masked input fields
     * to avoid disruptive server round-trips mid-edit. The _focusout handler will
     * trigger pending refresh when the user leaves the inputs.
     */
    #shouldTriggerImmediateRefresh(newValue: Date | string | null): boolean {
        // Month mode always refreshes immediately - uses discrete navigation buttons
        if (this.monthMode)
            return true;

        // Setting a value when none existed - user completed initial selection
        if (newValue != null && this.value == null)
            return true;

        // Picker popup is open - user is actively selecting
        if ((this.hasTimeComponent && this.timePicker?.isOpen) || (this.hasDateComponent && this.datePicker?.isOpen))
            return true;

        // Defer refresh - _focusout will trigger pending refresh when user leaves
        return false;
    }

    #updateAttributeValue(value: Date | string | null) {
        if (value instanceof Date) {
            if (!this.#isDateInRange(value)) {
                this._dateInvalid = true;
                return;
            }

            if (this.value instanceof Date) {
                const valueNorm = this.#normalizeForComparison(value, this.hasTimeComponent);
                const currentNorm = this.#normalizeForComparison(this.value, this.hasTimeComponent);
                if (valueNorm.getTime() === currentNorm.getTime())
                    return;
            }
        }

        this._dateInvalid = false;

        const allowRefresh = this.#shouldTriggerImmediateRefresh(value);
        this._pendingRefresh = this.attribute.triggersRefresh && !allowRefresh;
        this._latestSetValue = value;
        this.attribute.setValue(value, allowRefresh);
    }

    #formatDate(date: Date, pattern: string): string {
        let p = pattern;
        p = p.replace(/yyyy/g, date.getFullYear().toString());
        p = p.replace(/yy/g, (date.getFullYear() % 100).toString().padStart(2, "0"));
        p = p.replace(/MM/g, (date.getMonth() + 1).toString().padStart(2, "0"));
        p = p.replace(/M/g, (date.getMonth() + 1).toString());
        p = p.replace(/dd/g, date.getDate().toString().padStart(2, "0"));
        p = p.replace(/d/g, date.getDate().toString());

        return p;
    }

    #parseDate(dateString: string, pattern: string, separator: string): Date | null {
        const patternParts = pattern.split(separator);
        const dateParts = dateString.split(separator);

        if (patternParts.length !== dateParts.length)
            return null;

        let day = -1, month = -1, year = -1;
        let parsedDay = false, parsedMonth = false, parsedYear = false;

        for (let i = 0; i < patternParts.length; i++) {
            const pPart = patternParts[i];
            const val = parseInt(dateParts[i], 10);

            if (isNaN(val))
                return null;

            const pPartLower = pPart.toLowerCase();
            if (pPartLower.includes("d")) {
                if (parsedDay)
                    return null;

                day = val;
                parsedDay = true;
            } else if (pPartLower.includes("m")) {
                if (parsedMonth)
                    return null;

                month = val - 1;
                parsedMonth = true;
            } else if (pPartLower.includes("y")) {
                if (parsedYear)
                    return null;

                // Only accept 4-digit years to avoid ambiguity
                if (val < 1 || val > 9999)
                    return null;

                year = val;
                parsedYear = true;
            }
        }

        if (!parsedDay || !parsedMonth || !parsedYear)
            return null;

        if (month < 0 || month > 11)
            return null;

        const tempDate = new Date(year, month, day);
        if (tempDate.getFullYear() !== year || tempDate.getMonth() !== month || tempDate.getDate() !== day)
            return null;

        return tempDate;
    }

    #parseTime(value: Date | string): Date | null {
        if (typeof value === "string") {
            // Parse .NET TimeSpan string format: "d:HH:MM:SS.fffffff" (e.g., "0:14:30:00.0000000")
            // Split on both ':' and '.' to get [days, hours, minutes, seconds, fractional]
            const parts = value.split(/[:.]/);
            if (parts.length < 4)
                return null;

            // Take last 4 parts to get hours, minutes, seconds, milliseconds
            const startIndex = parts.length - 4;
            const time = new Date();
            time.setHours(
                parseInt(parts[startIndex], 10),      // hours
                parseInt(parts[startIndex + 1], 10),  // minutes
                parseInt(parts[startIndex + 2], 10),  // seconds
                parseInt(parts[startIndex + 3].substring(0, 3), 10)  // milliseconds (first 3 digits)
            );
            return time;
        }

        // For Date objects, copy the time but use today's date
        const today = new Date();
        const time = new Date(value.getTime());
        time.setFullYear(today.getFullYear(), today.getMonth(), today.getDate());
        return time;
    }

    #parseMinMaxDate(dateStr: string | undefined): Date | null {
        if (!dateStr)
            return null;

        const parts = dateStr.split("-");
        if (parts.length === 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            if (!isNaN(year) && !isNaN(month) && month >= 0 && month <= 11 && !isNaN(day) && day >= 1 && day <= 31) {
                const d = new Date(year, month, day);

                if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day)
                    return d;
            }
        }

        return null;
    }

    private _clear() {
        this.attribute.setValue(null, true).catch(Vidyano.noop);
    }

    private _dateFilled() {
        if (!this.dateInput)
            return;

        const dateFormat = this.#culture.dateFormat;
        const parsedDate = this.#parseDate(this.dateInput.value, dateFormat.shortDatePattern, dateFormat.dateSeparator);

        if (!parsedDate) {
            this._dateInvalid = true;
            return;
        }

        // Apply current time component if available for range validation
        const dateWithTime = new Date(parsedDate.getTime());
        if (this.hasTimeComponent && this.selectedTime)
            dateWithTime.setHours(this.selectedTime.getHours(), this.selectedTime.getMinutes(), 0, 0);

        if (!this.#isDateInRange(dateWithTime)) {
            this._dateInvalid = true;
            return;
        }

        this._dateInvalid = false;
        this.selectedDate = parsedDate;

        if (this.hasTimeComponent && this.timeInput) {
            this.timeInput.focus();
            this.timeInput.inputElement.selectionStart = 0;
            this.timeInput.inputElement.selectionEnd = this.timeInput.value?.length || 0;
        }
    }

    private _timeFilled() {
        if (!this.timeInput)
            return;

        const timeParts = this.timeInput.value.split(Vidyano.CultureInfo.currentCulture.dateFormat.timeSeparator);
        if (timeParts.length === 2) {
            const hours = parseInt(timeParts[0], 10);
            const minutes = parseInt(timeParts[1], 10);

            if (!isNaN(hours) && hours >= 0 && hours <= 23 && !isNaN(minutes) && minutes >= 0 && minutes <= 59) {
                const newTime = new Date();
                newTime.setHours(hours, minutes, 0, 0);

                this._timeInvalid = false;
                this.selectedTime = newTime;
            } else {
                this._timeInvalid = true;
            }
        } else {
            this._timeInvalid = true;
        }
    }

    private _focusout(e: FocusEvent) {
        if (!this.editing || this.readOnly)
            return;

        const related = e.relatedTarget as Node;

        if (related && (this.datePicker?.contains(related) || this.timePicker?.contains(related) || related === this.dateInput || related === this.timeInput))
            return;

        // Force re-render to sync displayed values with selectedDate/selectedTime
        this.requestUpdate();

        const dateValue = this.dateInput?.value;
        const timeValue = this.timeInput?.value;
        const dateIsMask = this.hasDateComponent && dateValue === this.dateFormat;
        const timeIsMask = this.hasTimeComponent && timeValue === this.timeFormat;

        if ((!this.hasDateComponent || dateIsMask || dateValue === "") && (!this.hasTimeComponent || timeIsMask || timeValue === "")) {
            if (!this.attribute.isRequired) {
                this._dateInvalid = false;
                this._timeInvalid = false;
            }
        }

        if (this._pendingRefresh) {
            this._pendingRefresh = false;
            this.attribute.setValue(this.value, true);
        }
    }

    #navigateMonth(delta: -1 | 1) {
        const today = new Date();
        const current = this.selectedDate ? new Date(this.selectedDate.getTime()) : new Date(today.getFullYear(), today.getMonth(), 1);
        const originalDay = current.getDate();

        current.setDate(1);
        current.setMonth(current.getMonth() + delta);

        const daysInTargetMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
        current.setDate(Math.min(originalDay, daysInTargetMonth));

        if (delta === -1 && this.minDate) {
            const minCheck = new Date(this.minDate.getFullYear(), this.minDate.getMonth(), this.minDate.getDate());
            if (current < minCheck)
                return;
        }

        if (delta === 1 && this.maxDate) {
            const maxCheck = new Date(this.maxDate.getFullYear(), this.maxDate.getMonth(), this.maxDate.getDate(), 23, 59, 59, 999);
            if (current > maxCheck)
                return;
        }

        this.selectedDate = current;
    }

    private _previousMonth() {
        this.#navigateMonth(-1);
    }

    private _nextMonth() {
        this.#navigateMonth(1);
    }

    protected override renderDisplay() {
        return super.renderDisplay(html`<span>${this.attribute?.displayValue}</span>`);
    }

    protected override renderEdit(innerTemplate?: TemplateResult) {
        return super.renderEdit(html`
            <vi-sensitive ?disabled=${!this.sensitive}>
                ${!this.monthMode ? html`
                    ${this.hasDateComponent ? html`
                        <vi-masked-input class="date"
                            .format=${this.dateFormat}
                            .separator=${this.dateSeparator}
                            .value=${this.#dateDisplayValue}
                            ?disabled=${this.readOnly || this.frozen}
                            ?invalid=${this._dateInvalid}
                            tabindex=${this.readOnlyTabIndex || nothing}
                            ?flex=${!this.hasTimeComponent}
                            @filled=${this._dateFilled}
                            @focusout=${this._focusout}>
                        </vi-masked-input>
                    ` : nothing}
                    ${this.hasTimeComponent ? html`
                        <vi-masked-input class="time"
                            .format=${this.timeFormat}
                            .separator=${this.timeSeparator}
                            .value=${this.#timeDisplayValue}
                            ?disabled=${this.readOnly || this.frozen}
                            ?invalid=${this._timeInvalid}
                            tabindex=${this.readOnlyTabIndex || nothing}
                            @filled=${this._timeFilled}
                            @focusout=${this._focusout}>
                        </vi-masked-input>
                    ` : nothing}
                ` : html`
                    <vi-sensitive ?hidden=${!this.hasDateComponent} ?disabled=${!this.sensitive}>
                        <span id="monthMode">${this.attribute?.displayValue}</span>
                    </vi-sensitive>
                `}
            </vi-sensitive>
            ${!this.readOnly ? html`
                ${this.hasDateComponent ? html`
                    ${this.monthMode && this.selectedDate ? html`
                        <vi-button slot="right" @click=${this._previousMonth}>
                            <vi-icon source="ChevronLeft"></vi-icon>
                        </vi-button>
                        <vi-button slot="right" @click=${this._nextMonth}>
                            <vi-icon source="ChevronRight"></vi-icon>
                        </vi-button>
                    ` : nothing}
                    <vi-date-picker slot="right" id="datepicker"
                        .selectedDate=${this.selectedDate}
                        @selected-date-changed=${(e: CustomEvent) => this.selectedDate = e.detail.value}
                        ?month-mode=${this.monthMode}
                        .minDate=${this.minDate}
                        .maxDate=${this.maxDate}>
                    </vi-date-picker>
                ` : nothing}
                ${this.hasTimeComponent ? html`
                    <vi-time-picker slot="right" id="timepicker"
                        .time=${this.selectedTime}
                        @time-changed=${(e: CustomEvent) => this.selectedTime = e.detail.value}>
                    </vi-time-picker>
                ` : nothing}
                ${this.canClear ? html`
                    <vi-button id="clearButton" slot="right" @click=${this._clear} tabindex="-1">
                        <vi-icon source="Remove"></vi-icon>
                    </vi-button>
                ` : nothing}
            ` : nothing}
        `);
    }
}

customElements.define("vi-persistent-object-attribute-date-time", PersistentObjectAttributeDateTime);

PersistentObjectAttributeRegister.add("DateTime", PersistentObjectAttributeDateTime);
