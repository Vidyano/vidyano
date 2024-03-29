﻿import * as Polymer from "../../libs/polymer/polymer.js"
import * as Vidyano from "../../libs/vidyano/vidyano.js"
import moment from "moment"
import { Button } from "../button/button.js"
import { Popup } from "../popup/popup.js"
import { WebComponent } from "../web-component/web-component.js"

export interface IDatePickerCell {
    type: string;
    content?: string;
    date?: moment.Moment;
    monthOffset?: number;
    blocked?: boolean;
}

@WebComponent.register({
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
        selectedDateMoment: {
            type: Object,
            computed: "_computeMoment(selectedDate)"
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
})
export class DatePicker extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="date-picker.html">`; }

    readonly cells: IDatePickerCell[]; private _setCells: (cells: IDatePickerCell[]) => void;
    readonly canFast: boolean; private _setCanFast: (canFast: boolean) => void;
    readonly currentDate: moment.Moment; private _setCurrentDate: (date: moment.Moment) => void;
    readonly today: moment.Moment; private _setToday: (date: moment.Moment) => void;
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
        this._setToday(moment(new Date()));
        this._setCurrentDate(moment(new Date()));
    }

    get isOpen(): boolean {
        return (<Popup>this.$.popup).open;
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

            cells.push(...Array.range(1, 42).map(d => {
                return { type: "day" };
            }));

            this._setCells(cells);
            this._setCanFast(true);
        }
        else {
            this._setCells(Array.range(1, 12).map(d => {
                return { type: zoom.substr(0, zoom.length - 1) };
            }));
            this._setCanFast(false);
        }
    }

    private _render(cells: IDatePickerCell[], currentDate: moment.Moment, minDate: Date, maxDate: Date, deferredCellsUpdate: boolean) {
        if (deferredCellsUpdate)
            return;

        const currentDateMoment = currentDate.clone();

        if (this.zoom === "days") {
            if (cells.length !== 42 + 7)
                return;

            this._setHeader(`${Vidyano.CultureInfo.currentCulture.dateFormat.shortMonthNames[currentDateMoment.month()]} ${currentDateMoment.year()}`);

            const loop = currentDateMoment.startOf("month").startOf(Vidyano.CultureInfo.currentCulture.dateFormat.firstDayOfWeek > 0 ? "isoWeek" : "week");
            const end = loop.clone().add(6, "weeks");

            let index = 7; // Skip weekday cells
            do {
                this.set(`cells.${index}.date`, loop.clone());
                this.set(`cells.${index}.content`, loop.format("D"));
                this.set(`cells.${index}.monthOffset`, loop.isSame(currentDate, "month") ? 0 : (loop.isBefore(currentDate) ? -1 : 1));
                this.set(`cells.${index}.blocked`, this._isBlocked(cells[index], minDate, maxDate));

                index++;
                loop.add(1, "days");
            }
            while (loop.isBefore(end));
        }
        else if (this.zoom === "months") {
            this._setHeader(`${currentDateMoment.year()}`);

            const loop = currentDateMoment.startOf("year");
            const end = loop.clone().add(12, "months");

            let index = 0;
            do {
                this.set(`cells.${index}.date`, loop.clone());
                this.set(`cells.${index}.content`, Vidyano.CultureInfo.currentCulture.dateFormat.shortMonthNames[index]);
                this.set(`cells.${index}.blocked`, this._isBlocked(cells[index], minDate, maxDate));

                index++;
                loop.add(1, "months");
            }
            while (loop.isBefore(end));
        }
        else if (this.zoom === "years") {
            const loop = currentDateMoment.startOf("year").subtract(6, "years");
            const end = loop.clone().add(12, "years");

            let index = 0;
            do {
                this.set(`cells.${index}.date`, loop.clone());
                this.set(`cells.${index}.content`, loop.year());
                this.set(`cells.${index}.blocked`, this._isBlocked(cells[index], minDate, maxDate));

                index++;
                loop.add(1, "years");
            }
            while (loop.isBefore(end));

            this._setHeader(`${cells[0].date.year()} - ${cells[cells.length - 1].date.year()}`);
        }
    }

    private _isDateSelected(zoom: string, date: moment.Moment, selectedDate: moment.Moment): boolean {
        if (!this.ensureArgumentValues(arguments))
            return undefined;

        if (zoom === "days")
            return date.isSame(selectedDate, "day");
        else if (zoom === "months" && this.monthMode)
            return date.isSame(selectedDate, "month");

        return false;
    }

    private _isDateToday(zoom: string, date: moment.Moment, today: moment.Moment): boolean {
        if (!this.ensureArgumentValues(arguments))
            return undefined;

        if (zoom === "days")
            return date.isSame(today, "day");
        else if (zoom === "months")
            return date.isSame(today, "month");

        return date.isSame(today, "year");
    }

    private _isOtherMonth(monthOffset: number): boolean {
        return !!monthOffset;
    }

    private _isBlocked(cell: IDatePickerCell, minDate: Date, maxDate: Date): boolean {
        const date = cell.date;
        if (!date || (!minDate && !maxDate))
            return false;

        const granularity = this.zoom === "days" ? "day" : (this.zoom === "months" ? "month" : "year");
        return (minDate && date.isBefore(minDate, granularity)) || (maxDate && date.isAfter(maxDate, granularity));
    }

    private _computeMoment(date: Date): moment.Moment {
        return moment(date);
    }

    private _slow(e: Event) {
        const amount = parseInt((<Button>e.currentTarget).getAttribute("n"));

        if (this.zoom === "days")
            this.currentDate.add(amount, "months");
        else if(this.zoom === "months")
            this.currentDate.add(amount, "years");
        else
            this.currentDate.add(amount * 12, "years");

        this._setCurrentDate(this.currentDate.clone());

        e.stopPropagation();
    }

    private _fast(e: Event) {
        const amount = parseInt((<Button>e.currentTarget).getAttribute("n"));
        this._setCurrentDate(this.currentDate.add(amount, "years").clone());

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
            const newSelectedDate = moment(this.selectedDate || new Date());
            if (!this.selectedDate && this.newTime) {
                const newTime = /(\d\d):(\d\d)(:(\d\d))?/.exec(this.newTime);
                if (newTime[1] != null && newTime[2] != null) {
                    newSelectedDate.hours(parseInt(newTime[1]));
                    newSelectedDate.minutes(parseInt(newTime[2]));
                    newSelectedDate.seconds(parseInt(newTime[4] || "0"));
                }
            }

            newSelectedDate.year(cell.date.year());
            newSelectedDate.month(cell.date.month());
            newSelectedDate.date(cell.date.date());

            this.selectedDate = newSelectedDate.clone().toDate();

            if (cell.monthOffset !== 0)
                this._setCurrentDate(this.currentDate.add(cell.monthOffset, "months").clone());
        }
        else if (this.zoom === "months") {
            this._setCurrentDate(this.currentDate.clone().month(cell.date.month()));

            if (!this.monthMode)
                this.zoom = "days";
            else {
                const newSelectedDate = moment(this.selectedDate || new Date());
                newSelectedDate.date(1);
                newSelectedDate.month(cell.date.month());
                newSelectedDate.year(cell.date.year());

                this.selectedDate = newSelectedDate.clone().toDate();
            }
        }
        else if (this.zoom === "years") {
            this._setCurrentDate(this.currentDate.year(cell.date.year()).clone());
            this.zoom = "months";
        }

        e.stopPropagation();
    }

    private _opening() {
        this._setCurrentDate(this.selectedDate ? moment(this.selectedDate) : moment(new Date()));
        this.zoom = this.monthMode ? "months" : "days";

        this._setDeferredCellsUpdate(false);
    }

    private _catchTap(e: MouseEvent) {
        e.stopPropagation();
    }
}