import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
import * as Keyboard from "components/utils/keyboard"
import "components/masked-input/masked-input"
import { PersistentObjectAttribute } from "polymer"
import type { TimePicker } from '../../../time-picker/time-picker.js'
import '../../../time-picker/time-picker.js'
import type { DatePicker } from '../../../date-picker/date-picker.js'
import '../../../date-picker/date-picker.js'

@Polymer.WebComponent.register({
    properties: {
        selectedDate: Object,
        selectedTime: Object,
        hasDateComponent: {
            type: Boolean,
            computed: "_computeHasComponent(attribute, 'Date', isConnected)"
        },
        hasTimeComponent: {
            type: Boolean,
            computed: "_computeHasComponent(attribute, 'Time', isConnected)"
        },
        dateFormat: {
            type: String,
            computed: "_computeDateFormat(isConnected)"
        },
        dateSeparator: {
            type: String,
            computed: "_computeDateSeparator(isConnected)"
        },
        timeFormat: {
            type: String,
            computed: "_computeTimeFormat(isConnected)"
        },
        timeSeparator: {
            type: String,
            computed: "_computeTimeSeparator(isConnected)"
        },
        isInvalid: {
            type: Boolean,
            readOnly: true,
            reflectToAttribute: true
        },
        canClear: {
            type: Boolean,
            computed: "_computeCanClear(attribute.value, attribute.isRequired)"
        },
        monthMode: {
            type: Boolean,
            computed: "_computeMonthMode(attribute)"
        },
        minDate: {
            type: Object,
            computed: "_computeMinMaxDate(attribute, 'mindate')"
        },
        maxDate: {
            type: Object,
            computed: "_computeMinMaxDate(attribute, 'maxdate')"
        }
    },
    observers: [
        "_selectedDateChanged(selectedDate, hasDateComponent, hasTimeComponent)",
        "_selectedTimeChanged(selectedTime, hasDateComponent, hasTimeComponent)",
        "_renderDate(selectedDate, hasDateComponent, readOnly, editing, isConnected)",
        "_renderTime(selectedTime, hasDateComponent, hasTimeComponent, readOnly, editing, isConnected)"
    ],
    forwardObservers: [
        "attribute.typeHints"
    ]
}, "vi-persistent-object-attribute-date-time")
export class PersistentObjectAttributeDateTime extends PersistentObjectAttribute {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-date-time.html">`; }

    private _valueChangedBlock: boolean;
    private _dateInput: HTMLInputElement;
    private _timeInput: HTMLInputElement;
    private _pendingRefresh: boolean;
    readonly isInvalid: boolean; private _setIsInvalid: (invalid: boolean) => void;
    readonly hasTimeComponent: boolean;
    readonly hasDateComponent: boolean;
    readonly monthMode: boolean;
    readonly dateFormat: string;
    readonly dateSeparator: string;
    readonly timeFormat: string;
    readonly timeSeparator: string;
    readonly minDate: Date;
    readonly maxDate: Date;
    selectedDate: Date;
    selectedTime: Date;

    private _formatDate(date: Date, pattern: string): string {
        let p = pattern;
        p = p.replace(/yyyy/g, date.getFullYear().toString());
        p = p.replace(/yy/g, (date.getFullYear() % 100).toString().padStart(2, '0'));
        p = p.replace(/MM/g, (date.getMonth() + 1).toString().padStart(2, '0'));
        p = p.replace(/M/g, (date.getMonth() + 1).toString());
        p = p.replace(/dd/g, date.getDate().toString().padStart(2, '0'));
        p = p.replace(/d/g, date.getDate().toString());
        
        return p;
    }

    private _parseDate(dateString: string, pattern: string, separator: string): Date | null {
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

                year = val;
                if ((pPart === "yy" || pPart === "y") && val >= 0 && val <= 99) {
                    const currentFullYear = new Date().getFullYear();
                    const currentCentury = Math.floor(currentFullYear / 100) * 100;
                    year = currentCentury + val;
                    if (year > currentFullYear + 10) {
                        year -= 100;
                    }
                } else if (pPart === "yyyy" && (val < 100 || val > 9999))
                    return null;

                parsedYear = true;
            }
        }

        if (!parsedDay || !parsedMonth || !parsedYear)
            return null;

        if (month < 0 || month > 11)
            return null;

        const tempDate = new Date(year, month, day);
        if (tempDate.getFullYear() !== year || tempDate.getMonth() !== month || tempDate.getDate() !== day) {
            return null;
        }

        return tempDate;
    }

    get dateInput(): HTMLInputElement {
        if (!this._dateInput) {
            Polymer.flush();
            this._dateInput = <HTMLInputElement>this.shadowRoot.querySelector("vi-masked-input.date");
        }

        return this._dateInput;
    }

    get timeInput(): HTMLInputElement {
        if (!this._timeInput) {
            Polymer.flush();
            this._timeInput = <HTMLInputElement>this.shadowRoot.querySelector("vi-masked-input.time");
        }

        return this._timeInput;
    }

    focus() {
        if (this.app.activeElement instanceof HTMLInputElement) {
            const input = <HTMLInputElement>this.app.activeElement;
            if (input.getRootNode() instanceof ShadowRoot && (input.getRootNode() as ShadowRoot).host === this._timeInput)
                return;
        }

        (this._dateInput || this._timeInput)?.focus();
    }

    protected _editingChanged() {
        super._editingChanged();
        
        Polymer.flush();
        if (this.editing)
            this._setIsInvalid(false);
    }

    protected _valueChanged(value: Date, oldValue: any) {
        super._valueChanged(value, oldValue);

        try {
            this._valueChangedBlock = true;
            if (this.attribute && value instanceof Date) {
                this.selectedDate = this.attribute.type.contains("Date") ? new Date(value.getTime()) : null;

                if (this.attribute.type === "Time" || this.attribute.type === "NullableTime") {
                    if (typeof this.value === "string") {
                        const parts = (<string>this.value).split(/[:.]/);
                        if (parts.length >= 4) {
                             const startIndex = parts.length - 4;
                             const time = new Date();
                             time.setHours(parseInt(parts[startIndex], 10), parseInt(parts[startIndex + 1], 10), parseInt(parts[startIndex + 2], 10), parseInt(parts[startIndex + 3].substr(0, 3), 10));
                             this.selectedTime = time;
                        } else {
                            this.selectedTime = null;
                        }
                    } else {
                         this.selectedTime = new Date(value.getTime());
                         this.selectedTime.setDate(new Date().getDate());
                    }
                }
                else
                    this.selectedTime = this.attribute.type.contains("Time") ? new Date(value.getTime()) : null;
            }
            else
                this.selectedDate = this.selectedTime = null;
        }
        finally {
            this._setIsInvalid(false);
            this._valueChangedBlock = false;
        }
    }

    private _selectedDateChanged(selectedDate: Date, hasDateComponent: boolean, hasTimeComponent: boolean) {
        if (!this.editing || this.readOnly || !hasDateComponent || this._valueChangedBlock)
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
                    
                    newValue.setHours(parseInt(time[0], 10), parseInt(time[1], 10), parseInt(time[2], 10), parseInt(time[3].substr(0, 3), 10));
                } else
                    newValue.setHours(0, 0, 0, 0);
            } else
                newValue.setHours(0, 0, 0, 0);

            this._guardedSetValue(newValue);
        } else
            this._guardedSetValue(null);
    }

    private _selectedTimeChanged(selectedTime: Date, hasDateComponent: boolean, hasTimeComponent: boolean) {
        if (!this.editing || this.readOnly || !hasTimeComponent || this._valueChangedBlock)
            return;

        if (hasDateComponent) {
            if (selectedTime) {
                const baseDate = this.selectedDate || new Date(); 
                const newValue = new Date(baseDate.getTime());
                newValue.setHours(selectedTime.getHours(), selectedTime.getMinutes(), selectedTime.getSeconds(), selectedTime.getMilliseconds());
                this._guardedSetValue(newValue);
            } else if (this.selectedDate) {
                const newValue = new Date(this.selectedDate.getTime());
                newValue.setHours(0,0,0,0);
                this._guardedSetValue(newValue);
            } else {
                this._guardedSetValue(null);
            }
        } else if (selectedTime) {
            const newTimeValue = String.format("0:{0:D2}:{1:D2}:{2:D2}.{3:D3}0000", selectedTime.getHours(), selectedTime.getMinutes(), selectedTime.getSeconds(), selectedTime.getMilliseconds());
            if (!this.value || (<string>this.value).substr(0, newTimeValue.length - 4) !== newTimeValue.substr(0, newTimeValue.length - 4))
                this._guardedSetValue(newTimeValue);
        } else {
            this._guardedSetValue(null);
        }
    }

    private _guardedSetValue(value: Date | string) {
        if (value instanceof Date) {
            const valueForCompare = new Date(value.getFullYear(), value.getMonth(), value.getDate(), this.hasTimeComponent ? value.getHours() : 0, this.hasTimeComponent ? value.getMinutes() : 0, this.hasTimeComponent ? value.getSeconds() : 0, this.hasTimeComponent ? value.getMilliseconds() : 0);
            
            if (this.minDate) {
                const min = new Date(this.minDate.getFullYear(), this.minDate.getMonth(), this.minDate.getDate(), this.hasTimeComponent ? this.minDate.getHours() : 0, this.hasTimeComponent ? this.minDate.getMinutes() : 0, this.hasTimeComponent ? this.minDate.getSeconds() : 0, this.hasTimeComponent ? this.minDate.getMilliseconds() : 0);
                if (valueForCompare < min)
                    return this._setIsInvalid(true);
            }

            if (this.maxDate) {
                const max = new Date(this.maxDate.getFullYear(), this.maxDate.getMonth(), this.maxDate.getDate(), this.hasTimeComponent ? this.maxDate.getHours() : 23, this.hasTimeComponent ? this.maxDate.getMinutes() : 59, this.hasTimeComponent ? this.maxDate.getSeconds() : 59, this.hasTimeComponent ? this.maxDate.getMilliseconds() : 999);
                if (valueForCompare > max)
                    return this._setIsInvalid(true);
            }
            
            if (this.value instanceof Date) {
                const currentValueForCompare = new Date(this.value.getFullYear(), this.value.getMonth(), this.value.getDate(), this.hasTimeComponent ? this.value.getHours() : 0, this.hasTimeComponent ? this.value.getMinutes() : 0, this.hasTimeComponent ? this.value.getSeconds() : 0, this.hasTimeComponent ? this.value.getMilliseconds() : 0);
                if (valueForCompare.getTime() === currentValueForCompare.getTime())
                    return;
            }
        }
        this._setIsInvalid(false);

        let allowRefresh = this.monthMode;
        if (!allowRefresh && !this.isInvalid) {
            allowRefresh = value != null && this.value == null;
            if (!allowRefresh && value != null && this.value != null) {
                allowRefresh = (this.hasTimeComponent && (<TimePicker>this.shadowRoot.querySelector("#timepicker"))?.isOpen) || (this.hasDateComponent && (<DatePicker>this.shadowRoot.querySelector("#datepicker"))?.isOpen);
                if (!allowRefresh)
                    allowRefresh = document.activeElement !== this.dateInput && document.activeElement !== this.timeInput;
            }
        }

        this._pendingRefresh = this.attribute.triggersRefresh && !allowRefresh;
        this.attribute.setValue(value, allowRefresh);
    }

    private _renderDate(selectedDate: Date, hasDateComponent: boolean, readOnly: boolean, editing: boolean, isConnected: boolean) {
        if (!isConnected || !this.dateInput)
            return;

        if (!editing && hasDateComponent && !this.monthMode) {
            this._setInputValue(this.dateInput, selectedDate ? this._formatDate(selectedDate, Vidyano.CultureInfo.currentCulture.dateFormat.shortDatePattern) : "—");
            return;
        }

        if (!editing && this.monthMode && selectedDate) {
            this._setInputValue(this.dateInput, this._formatDate(selectedDate, "MM/yyyy"));
            return;
        }

        if (!editing || !hasDateComponent || this.monthMode)
            return;

        let newDate: string;
        if (selectedDate)
            newDate = this._formatDate(selectedDate, Vidyano.CultureInfo.currentCulture.dateFormat.shortDatePattern);
        else if (!readOnly)
            newDate = this.dateFormat;
        else
            newDate = "—";

        this._setInputValue(this.dateInput, newDate);
    }

    private _renderTime(selectedTime: Date, hasDateComponent: boolean, hasTimeComponent: boolean, readOnly: boolean, editing: boolean, isConnected: boolean) {
        if (!isConnected || !this.timeInput) return;

        if (!editing && hasTimeComponent) {
            let timeStr = "—";
            
            if (selectedTime)
                timeStr = String.format(`{0:D2}${Vidyano.CultureInfo.currentCulture.dateFormat.timeSeparator}{1:D2}`, selectedTime.getHours(), selectedTime.getMinutes());
            else if (hasDateComponent)
                timeStr = "";

            this._setInputValue(this.timeInput, timeStr);
            return;
        }
        
        if (!editing || !hasTimeComponent)
            return;

        let newTime: string;
        if (selectedTime)
            newTime = String.format(`{0:D2}${Vidyano.CultureInfo.currentCulture.dateFormat.timeSeparator}{1:D2}`, selectedTime.getHours(), selectedTime.getMinutes());
        else if (!readOnly)
            newTime = this.timeFormat;
        else
            newTime = hasDateComponent ? "" : "—";

        this._setInputValue(this.timeInput, newTime);
    }

    private _setInputValue(input: HTMLInputElement, value: string) {
        if (!input || input.value === value)
            return;

        const selection = document.activeElement === input ? { start: input.selectionStart, end: input.selectionEnd } : null;
        input.value = value;
        if (selection != null) {
            input.selectionStart = Math.min(selection.start ?? 0, value.length);
            input.selectionEnd = Math.min(selection.end ?? 0, value.length);
        }
    }

    private _clear() {
        this.attribute.setValue(null, true).catch(Vidyano.noop);
    }

    private _dateFilled() {
        if (!this.dateInput) return;
        const culture = Vidyano.CultureInfo.currentCulture.dateFormat;
        const parsedDate = this._parseDate(this.dateInput.value, culture.shortDatePattern, culture.dateSeparator);

        if (parsedDate) {
            const valueForCompare = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), this.hasTimeComponent && this.selectedTime ? this.selectedTime.getHours() : 0, this.hasTimeComponent && this.selectedTime ? this.selectedTime.getMinutes() : 0, 0, 0);
            if (this.minDate) {
                const min = new Date(this.minDate.getFullYear(), this.minDate.getMonth(), this.minDate.getDate(), this.hasTimeComponent ? this.minDate.getHours() : 0, this.hasTimeComponent ? this.minDate.getMinutes() : 0, 0, 0);
                
                if (valueForCompare < min)
                    return this._setIsInvalid(true);
            }

            if (this.maxDate) {
                const max = new Date(this.maxDate.getFullYear(), this.maxDate.getMonth(), this.maxDate.getDate(), this.hasTimeComponent ? this.maxDate.getHours() : 23, this.hasTimeComponent ? this.maxDate.getMinutes() : 59, 59, 999);
                
                if (valueForCompare > max)
                    return this._setIsInvalid(true);
            }

            this._setIsInvalid(false);
            this.selectedDate = parsedDate;

            if (this.hasTimeComponent && this.timeInput) {
                this._focusElement(this.timeInput);
                this.timeInput.selectionStart = 0;
                this.timeInput.selectionEnd = this.timeInput.value?.length || 0;
            }
        } else
            this._setIsInvalid(true);
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

                this._setIsInvalid(false);
                this.selectedTime = newTime;
            } else
                this._setIsInvalid(true);
        } else
            this._setIsInvalid(true);
    }

    private _keydown(e: KeyboardEvent) {
        if (!this.editing || this.readOnly)
            return;

        const input = <HTMLInputElement>e.target;        
        if (!input.value)
            return;

        if (input === this.timeInput && (e.key === Keyboard.Keys.Backspace || e.key === Keyboard.Keys.ArrowLeft)) {
            if (input.selectionStart === 0 && input.selectionEnd === 0 && this.hasDateComponent && this.dateInput) {
                this._focusElement(this.dateInput);
                this.dateInput.selectionStart = this.dateInput.selectionEnd = this.dateInput.value?.length || 0;
                e.stopImmediatePropagation(); e.preventDefault(); return;
            }
        }

        if (input === this.dateInput && input.value && e.key === Keyboard.Keys.ArrowRight) {
            if (input.selectionStart === input.value.length && input.selectionEnd === input.value.length && this.hasTimeComponent && this.timeInput) {
                this._focusElement(this.timeInput);
                this.timeInput.selectionStart = this.timeInput.selectionEnd = 0;
                e.stopImmediatePropagation(); e.preventDefault(); return;
            }
        }

        if (e.key === Keyboard.Keys.Backspace && input.selectionStart === 0 && input.selectionEnd === input.value.length) {
            input.value = input === this.dateInput ? this.dateFormat : this.timeFormat;
            input.selectionStart = input.selectionEnd = 0;
        }
    }

    private _keyup(e: KeyboardEvent) {
        if (e.key === Keyboard.Keys.Backspace && this.attribute.type.startsWith("Nullable")) {
            const dateInputEmpty = !this.hasDateComponent || (this.dateInput && (this.dateInput.value === this.dateFormat || this.dateInput.value === ""));
            const timeInputEmpty = !this.hasTimeComponent || (this.timeInput && (this.timeInput.value === this.timeFormat || this.timeInput.value === ""));
            
            if (dateInputEmpty && timeInputEmpty)
                this._guardedSetValue(null);
        }
    }

    private _blur(e: FocusEvent) {
        if (!this.editing || this.readOnly)
            return;

        const related = e.relatedTarget as Node;
        const datePicker = this.shadowRoot.querySelector("#datepicker") as DatePicker;
        const timePicker = this.shadowRoot.querySelector("#timepicker") as TimePicker;
        
        if (related && (datePicker?.contains(related) || timePicker?.contains(related) || related === this.dateInput || related === this.timeInput))
            return;
        
        this._renderDate(this.selectedDate, this.hasDateComponent, this.readOnly, this.editing, this.isConnected);
        this._renderTime(this.selectedTime, this.hasDateComponent, this.hasTimeComponent, this.readOnly, this.editing, this.isConnected);

        const dateValue = this.dateInput?.value;
        const timeValue = this.timeInput?.value;
        const dateIsMask = this.hasDateComponent && dateValue === this.dateFormat;
        const timeIsMask = this.hasTimeComponent && timeValue === this.timeFormat;

        if ((!this.hasDateComponent || dateIsMask || dateValue === "") &&  (!this.hasTimeComponent || timeIsMask || timeValue === "")) {
            if (!this.attribute.isRequired)
                this._setIsInvalid(false);
        }


        if (this._pendingRefresh) {
            this._pendingRefresh = false;
            this.attribute.setValue(this.value, true);
        }
    }

    private _computeHasComponent(target: Vidyano.PersistentObjectAttribute, component: string, isConnected: boolean): boolean {
        if (!isConnected)
            return false;

        Polymer.flush();
        return target && target.type.contains(component);
    }

    private _computeDateFormat(isConnected: boolean): string {
        if (!isConnected)
            return "__/__/____";

        return Vidyano.CultureInfo.currentCulture.dateFormat.shortDatePattern.toLowerCase().replace(/[ymd]/g, "_");
    }

    private _computeDateSeparator(isConnected: boolean): string {
        if (!isConnected)
            return "/";

        return Vidyano.CultureInfo.currentCulture.dateFormat.dateSeparator;
    }

    private _computeTimeFormat(isConnected: boolean): string {
        if (!isConnected)
            return "__:__";

        return "__" + Vidyano.CultureInfo.currentCulture.dateFormat.timeSeparator + "__";
    }

    private _computeTimeSeparator(isConnected: boolean): string {
        if (!isConnected)
            return ":";

        return Vidyano.CultureInfo.currentCulture.dateFormat.timeSeparator;
    }

    private _computeCanClear(value: Date, required: boolean): boolean {
        return value != null && !required;
    }

    private _computeMonthMode(attribute: Vidyano.PersistentObjectAttribute): boolean {
        return attribute?.getTypeHint("displayformat", "").toLowerCase() === "{0:y}";
    }

    private _computeMinMaxDate(attribute: Vidyano.PersistentObjectAttribute, hint: string): Date | null {
        const dateStr = attribute?.getTypeHint(hint);
        if (!dateStr)
            return null;

        const parts = dateStr.split('-');
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

    private _previousMonth() {
        const today = new Date();
        const current = this.selectedDate ? new Date(this.selectedDate.getTime()) : new Date(today.getFullYear(), today.getMonth(), 1);
        const originalDay = current.getDate();
        
        current.setDate(1);
        current.setMonth(current.getMonth() - 1);
        
        const daysInTargetMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
        current.setDate(Math.min(originalDay, daysInTargetMonth));

        if (this.minDate) {
            const minCheck = new Date(this.minDate.getFullYear(), this.minDate.getMonth(), this.minDate.getDate());
            
            if (current < minCheck)
                return;
        }

        this.selectedDate = current;
    }

    private _nextMonth() {
        const today = new Date();
        const current = this.selectedDate ? new Date(this.selectedDate.getTime()) : new Date(today.getFullYear(), today.getMonth(), 1);
        const originalDay = current.getDate();
        
        current.setDate(1);
        current.setMonth(current.getMonth() + 1);
        
        const daysInTargetMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
        current.setDate(Math.min(originalDay, daysInTargetMonth));

        if (this.maxDate) {
            const maxCheck = new Date(this.maxDate.getFullYear(), this.maxDate.getMonth(), this.maxDate.getDate(), 23, 59, 59, 999);
            
            if (current > maxCheck)
                return;
        }

        this.selectedDate = current;
    }
}

PersistentObjectAttribute.registerAttributeType("DateTime", PersistentObjectAttributeDateTime);
