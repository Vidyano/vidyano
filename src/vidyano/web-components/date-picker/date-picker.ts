import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
import { Button } from "components/button/button"
import { Popup } from "components/popup/popup"

export interface IDatePickerCell {
    type: string;
    content?: string;
    date?: Date;
    monthOffset?: number;
    blocked?: boolean;
}

@Polymer.WebComponent.register({
    properties: {
        zoom: {
            type: String,
            reflectToAttribute: true,
            observer: "_zoomChanged"
        },
        canFast: {
            type: Boolean,
            readOnly: true
        },
        currentDate: {
            type: Object,
            readOnly: true
        },
        selectedDate: {
            type: Object,
            notify: true
        },
        today: {
            type: Object,
            readOnly: true
        },
        monthMode: {
            type: Boolean,
            reflectToAttribute: true,
            value: false
        },
        cells: {
            type: Array,
            readOnly: true
        },
        header: {
            type: String,
            readOnly: true
        },
        deferredCellsUpdate: {
            type: Boolean,
            readOnly: true,
            value: true
        },
        minDate: {
            type: Object,
            value: null
        },
        maxDate: {
            type: Object,
            value: null
        },
        newTime: String
    },
    observers: [
        "_render(cells, currentDate, minDate, maxDate, deferredCellsUpdate)"
    ],
    listeners: {
        "tap": "_catchTap"
    }
}, "vi-date-picker")
export class DatePicker extends Polymer.WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="date-picker.html">`; }

    readonly cells: IDatePickerCell[]; private _setCells: (cells: IDatePickerCell[]) => void;
    readonly canFast: boolean; private _setCanFast: (canFast: boolean) => void;
    readonly currentDate: Date; private _setCurrentDate: (date: Date) => void;
    readonly today: Date; private _setToday: (date: Date) => void;
    readonly header: string; private _setHeader: (header: string) => void;
    readonly deferredCellsUpdate: boolean; private _setDeferredCellsUpdate: (defer: boolean) => void;
    zoom: "days" | "months" | "years";
    selectedDate: Date;
    monthMode: boolean;
    minDate: Date;
    maxDate: Date;
    newTime: string;

    connectedCallback() {
        super.connectedCallback();

        this.zoom = this.monthMode ? "months" : "days";
        this._setToday(new Date());
        this._setCurrentDate(new Date());
    }

    get isOpen(): boolean {
        return (<Popup>this.$.popup).open;
    }

    private _cloneDate(date: Date): Date | null {
        return date ? new Date(date.getTime()) : null;
    }

    private _startOfMonth(date: Date): Date {
        const newDate = this._cloneDate(date);
        newDate.setDate(1);
        newDate.setHours(0, 0, 0, 0);
        return newDate;
    }

    private _startOfYear(date: Date): Date {
        const newDate = this._cloneDate(date);
        newDate.setMonth(0, 1); // Month is 0-indexed, day is 1-indexed
        newDate.setHours(0, 0, 0, 0);
        return newDate;
    }

    private _startOfWeek(date: Date, firstDayOfWeek: number): Date {
        const newDate = this._cloneDate(date);
        const day = newDate.getDay(); // 0 (Sunday) to 6 (Saturday)
        let diff = day - firstDayOfWeek;
        if (diff < 0) {
            diff += 7;
        }
        newDate.setDate(newDate.getDate() - diff);
        newDate.setHours(0, 0, 0, 0);
        return newDate;
    }

    private _addDays(date: Date, days: number): Date {
        const newDate = this._cloneDate(date);
        newDate.setDate(newDate.getDate() + days);
        return newDate;
    }

    private _addMonths(date: Date, months: number): Date {
        const newDate = this._cloneDate(date);
        newDate.setMonth(newDate.getMonth() + months);
        return newDate;
    }

    private _addYears(date: Date, years: number): Date {
        const newDate = this._cloneDate(date);
        newDate.setFullYear(newDate.getFullYear() + years);
        return newDate;
    }

    private _isSameDay(date1: Date, date2: Date): boolean {
        if (!date1 || !date2) return false;
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    }

    private _isSameMonth(date1: Date, date2: Date): boolean {
        if (!date1 || !date2) return false;
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth();
    }

    private _isSameYear(date1: Date, date2: Date): boolean {
        if (!date1 || !date2) return false;
        return date1.getFullYear() === date2.getFullYear();
    }
    
    private _normalizeDateByGranularity(date: Date, granularity: "day" | "month" | "year"): Date {
        const d = new Date(date.getFullYear(), granularity === "year" ? 0 : date.getMonth(), granularity === "day" ? date.getDate() : 1);
        d.setHours(0,0,0,0); // Normalize time part for comparisons
        return d;
    }

    private _isBefore(date1: Date, date2: Date, granularity: "day" | "month" | "year"): boolean {
        if (!date1 || !date2) return false;
        const d1 = this._normalizeDateByGranularity(date1, granularity);
        const d2 = this._normalizeDateByGranularity(date2, granularity);
        return d1.getTime() < d2.getTime();
    }

    private _isAfter(date1: Date, date2: Date, granularity: "day" | "month" | "year"): boolean {
        if (!date1 || !date2) return false;
        const d1 = this._normalizeDateByGranularity(date1, granularity);
        const d2 = this._normalizeDateByGranularity(date2, granularity);
        return d1.getTime() > d2.getTime();
    }

    private _getMonthOffset(dateForCell: Date, currentDisplayMonthDate: Date): number {
        if (dateForCell.getFullYear() < currentDisplayMonthDate.getFullYear()) return -1;
        if (dateForCell.getFullYear() > currentDisplayMonthDate.getFullYear()) return 1;
        // Same year, compare month
        if (dateForCell.getMonth() < currentDisplayMonthDate.getMonth()) return -1;
        if (dateForCell.getMonth() > currentDisplayMonthDate.getMonth()) return 1;
        return 0; // Same month and year
    }

    private _zoomChanged(zoom: string) {
        if (zoom === "days") {
            let dayNames = Vidyano.CultureInfo.currentCulture.dateFormat.shortDayNames.slice();
            if (Vidyano.CultureInfo.currentCulture.dateFormat.firstDayOfWeek > 0)
                dayNames = dayNames.slice(Vidyano.CultureInfo.currentCulture.dateFormat.firstDayOfWeek).concat(dayNames.slice(0, Vidyano.CultureInfo.currentCulture.dateFormat.firstDayOfWeek));

            const cells: IDatePickerCell[] = dayNames.map(d => {
                return {
                    type: "weekday",
                    content: d
                };
            });

            cells.push(...Array.range(1, 42).map(() => {
                return { type: "day" };
            }));

            this._setCells(cells);
            this._setCanFast(true);
        }
        else {
            this._setCells(Array.range(1, 12).map(() => {
                return { type: zoom.substr(0, zoom.length - 1) };
            }));
            this._setCanFast(false);
        }
    }

    private _render(cells: IDatePickerCell[], currentDate: Date, minDate: Date, maxDate: Date, deferredCellsUpdate: boolean) {
        if (deferredCellsUpdate || !currentDate)
            return;

        const currentDateLocal = this._cloneDate(currentDate);

        if (this.zoom === "days") {
            if (cells.length !== 42 + 7)
                return;

            this._setHeader(`${Vidyano.CultureInfo.currentCulture.dateFormat.monthNames[currentDateLocal.getMonth()]} ${currentDateLocal.getFullYear()}`);

            let loop = this._startOfMonth(currentDateLocal);
            loop = this._startOfWeek(loop, Vidyano.CultureInfo.currentCulture.dateFormat.firstDayOfWeek);
            
            const end = this._addDays(this._cloneDate(loop), 42); // 6 weeks * 7 days

            let index = 7; // Skip weekday cells
            do {
                this.set(`cells.${index}.date`, this._cloneDate(loop));
                this.set(`cells.${index}.content`, loop.getDate().toString());
                this.set(`cells.${index}.monthOffset`, this._getMonthOffset(loop, currentDate));
                this.set(`cells.${index}.blocked`, this._isBlocked(cells[index], minDate, maxDate));

                index++;
                loop.setDate(loop.getDate() + 1);
            }
            while (loop.getTime() < end.getTime());
        }
        else if (this.zoom === "months") {
            this._setHeader(`${currentDateLocal.getFullYear()}`);

            const loop = this._startOfYear(currentDateLocal);
            const end = this._addYears(this._cloneDate(loop), 1); // 12 months

            let index = 0;
            do {
                this.set(`cells.${index}.date`, this._cloneDate(loop));
                this.set(`cells.${index}.content`, Vidyano.CultureInfo.currentCulture.dateFormat.shortMonthNames[loop.getMonth()]);
                this.set(`cells.${index}.blocked`, this._isBlocked(cells[index], minDate, maxDate));

                index++;
                loop.setMonth(loop.getMonth() + 1);
            }
            while (loop.getTime() < end.getTime());
        }
        else if (this.zoom === "years") {
            const loop = this._startOfYear(currentDateLocal);
            loop.setFullYear(loop.getFullYear() - 6); // Start 6 years back

            const end = this._addYears(this._cloneDate(loop), 12); // 12 years total

            let index = 0;
            do {
                this.set(`cells.${index}.date`, this._cloneDate(loop));
                this.set(`cells.${index}.content`, loop.getFullYear().toString());
                this.set(`cells.${index}.blocked`, this._isBlocked(cells[index], minDate, maxDate));

                index++;
                loop.setFullYear(loop.getFullYear() + 1);
            }
            while (loop.getTime() < end.getTime());

            if (cells && cells.length > 0 && cells[0].date && cells[cells.length - 1].date) {
                 this._setHeader(`${cells[0].date.getFullYear()} - ${cells[cells.length - 1].date.getFullYear()}`);
            }
        }
    }

    private _isDateSelected(zoom: string, date: Date, selectedDate: Date): boolean {
        if (!this.ensureArgumentValues(arguments) || !date || !selectedDate)
            return false;

        if (zoom === "days")
            return this._isSameDay(date, selectedDate);
        else if (zoom === "months" && this.monthMode)
            return this._isSameMonth(date, selectedDate);

        return false;
    }

    private _isDateToday(zoom: string, date: Date, today: Date): boolean {
        if (!this.ensureArgumentValues(arguments) || !date || !today)
            return false;

        if (zoom === "days")
            return this._isSameDay(date, today);
        else if (zoom === "months")
            return this._isSameMonth(date, today);

        return this._isSameYear(date, today);
    }

    private _isOtherMonth(monthOffset: number): boolean {
        return !!monthOffset;
    }

    private _isBlocked(cell: IDatePickerCell, minDate: Date, maxDate: Date): boolean {
        const date = cell.date;
        if (!date || (!minDate && !maxDate))
            return false;

        const granularity = this.zoom === "days" ? "day" : (this.zoom === "months" ? "month" : "year");
        return (minDate && this._isBefore(date, minDate, granularity)) || (maxDate && this._isAfter(date, maxDate, granularity));
    }

    private _slow(e: Event) {
        const amount = parseInt((<Button>e.currentTarget).getAttribute("n"));
        const newCurrentDate = this._cloneDate(this.currentDate);

        if (this.zoom === "days")
            newCurrentDate.setMonth(newCurrentDate.getMonth() + amount);
        else if(this.zoom === "months")
            newCurrentDate.setFullYear(newCurrentDate.getFullYear() + amount);
        else
            newCurrentDate.setFullYear(newCurrentDate.getFullYear() + amount * 12);

        this._setCurrentDate(newCurrentDate);
        e.stopPropagation();
    }

    private _fast(e: Event) {
        const amount = parseInt((<Button>e.currentTarget).getAttribute("n"));
        const newCurrentDate = this._cloneDate(this.currentDate);
        newCurrentDate.setFullYear(newCurrentDate.getFullYear() + amount);
        this._setCurrentDate(newCurrentDate);

        e.stopPropagation();
    }

    private _zoomOut(e: Event) {
        if (this.zoom === "days")
            this.zoom = "months";
        else if (this.zoom === "months")
            this.zoom = "years";

        e.stopPropagation();
    }

    private _select(e: Polymer.Gestures.TapEvent) {
        const cell = <IDatePickerCell>e.model.cell;
        if (!cell?.date)
            return;

        if (cell.blocked) {
            e.stopPropagation();
            return;
        }

        if (this.zoom === "days") {
            const newSelectedDate = this.selectedDate ? this._cloneDate(this.selectedDate) : new Date();
            if (!this.selectedDate && this.newTime) {
                const newTimeParts = /(\d\d):(\d\d)(:(\d\d))?/.exec(this.newTime);
                if (newTimeParts && newTimeParts[1] != null && newTimeParts[2] != null) {
                    newSelectedDate.setHours(parseInt(newTimeParts[1], 10));
                    newSelectedDate.setMinutes(parseInt(newTimeParts[2], 10));
                    newSelectedDate.setSeconds(parseInt(newTimeParts[4] || "0", 10));
                }
            }

            newSelectedDate.setFullYear(cell.date.getFullYear());
            newSelectedDate.setMonth(cell.date.getMonth());
            newSelectedDate.setDate(cell.date.getDate());

            this.selectedDate = newSelectedDate;

            if (cell.monthOffset !== 0) {
                const newCurrentDate = this._cloneDate(this.currentDate);
                newCurrentDate.setMonth(newCurrentDate.getMonth() + cell.monthOffset);
                this._setCurrentDate(newCurrentDate);
            }
        }
        else if (this.zoom === "months") {
            const newCurrentDate = this._cloneDate(this.currentDate);
            newCurrentDate.setMonth(cell.date.getMonth());
            newCurrentDate.setFullYear(cell.date.getFullYear());
            this._setCurrentDate(newCurrentDate);

            if (!this.monthMode)
                this.zoom = "days";
            else {
                const newSelectedDate = this.selectedDate ? this._cloneDate(this.selectedDate) : new Date();
                newSelectedDate.setDate(1);
                newSelectedDate.setMonth(cell.date.getMonth());
                newSelectedDate.setFullYear(cell.date.getFullYear());

                this.selectedDate = newSelectedDate;
            }
        }
        else if (this.zoom === "years") {
            const newCurrentDate = this._cloneDate(this.currentDate);
            newCurrentDate.setFullYear(cell.date.getFullYear());
            this._setCurrentDate(newCurrentDate);
            this.zoom = "months";
        }

        e.stopPropagation();
    }

    private _opening() {
        this._setCurrentDate(this.selectedDate ? this._cloneDate(this.selectedDate) : new Date());
        this.zoom = this.monthMode ? "months" : "days";

        this._setDeferredCellsUpdate(false);
    }

    private _catchTap(e: MouseEvent) {
        e.stopPropagation();
    }
}
