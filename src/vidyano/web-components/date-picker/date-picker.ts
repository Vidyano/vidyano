import { html, nothing, unsafeCSS } from "lit";
import { property, state } from "lit/decorators.js";
import { WebComponent, observer, notify, listener } from "components/web-component/web-component.js";
import * as Vidyano from "vidyano";
import { Button } from "components/button/button.js";
import { Popup } from "components/popup/popup.js";
import styles from "./date-picker.css";

/**
 * Represents a single cell in the date picker grid.
 */
interface IDatePickerCell {
    type: string;
    content?: string;
    date?: Date;
    monthOffset?: number;
    blocked?: boolean;
}

export class DatePicker extends WebComponent {
    static styles = unsafeCSS(styles);

    @property({ type: String, reflect: true })
    @observer(DatePicker.prototype._zoomChanged)
    zoom: "days" | "months" | "years" = "days";

    @state()
    canFast: boolean = false;

    @state()
    currentDate: Date;

    @property({ type: Object })
    @notify()
    selectedDate: Date;

    @state()
    today: Date;

    @property({ type: Boolean, reflect: true })
    monthMode: boolean = false;

    @state()
    cells: IDatePickerCell[] = [];

    @state()
    header: string = "";

    @state()
    deferredCellsUpdate: boolean = true;

    @property({ type: Object })
    minDate: Date = null;

    @property({ type: Object })
    maxDate: Date = null;

    @property({ type: String })
    newTime: string;

    connectedCallback() {
        super.connectedCallback();

        this.zoom = this.monthMode ? "months" : "days";
        this.today = new Date();
        this.currentDate = new Date();
    }

    render() {
        return html`
            <vi-popup id="popup" placement="bottom-end" @popup-opening=${this._opening}>
                <vi-icon slot="header" part="icon" source="Calendar"></vi-icon>
                <div class="calendar">
                    <header class="header">
                        <vi-button n="-1" @click=${this._fast} ?hidden=${!this.canFast}><vi-icon source="FastBackward"></vi-icon></vi-button>
                        <vi-button n="-1" @click=${this._slow}><vi-icon source="Backward"></vi-icon></vi-button>
                        <vi-button class="header-label" @click=${this._zoomOut} label=${this.header}></vi-button>
                        <vi-button n="1" @click=${this._slow}><vi-icon source="Forward"></vi-icon></vi-button>
                        <vi-button n="1" @click=${this._fast} ?hidden=${!this.canFast}><vi-icon source="FastForward"></vi-icon></vi-button>
                    </header>
                    <main class="main" zoom=${this.zoom} @wheel=${this._onWheel}>
                        ${!this.deferredCellsUpdate ? html`
                            ${this.cells?.map(cell => html`
                                <div
                                    class="cell"
                                    type=${cell.type}
                                    ?is-selected=${this.#isDateSelected(this.zoom, cell.date, this.selectedDate)}
                                    ?is-today=${this.#isDateToday(this.zoom, cell.date, this.today)}
                                    ?is-other=${this.#isOtherMonth(cell.monthOffset)}
                                    ?blocked=${cell.blocked}
                                    @click=${(e: MouseEvent) => this._select(e, cell)}
                                >${cell.content}</div>
                            `)}
                        ` : nothing}
                    </main>
                </div>
            </vi-popup>
        `;
    }

    @observer("currentDate", "minDate", "maxDate", "deferredCellsUpdate", "zoom")
    private _render(currentDate: Date, minDate: Date, maxDate: Date, deferredCellsUpdate: boolean) {
        if (deferredCellsUpdate || !currentDate)
            return;

        const currentDateLocal = cloneDate(currentDate);
        const cells = this.cells;

        if (this.zoom === "days") {
            if (!cells || cells.length !== 42 + 7)
                return;

            this.header = `${Vidyano.CultureInfo.currentCulture.dateFormat.monthNames[currentDateLocal.getMonth()]} ${currentDateLocal.getFullYear()}`;

            let loop = startOfMonth(currentDateLocal);
            loop = startOfWeek(loop, Vidyano.CultureInfo.currentCulture.dateFormat.firstDayOfWeek);
            const end = addDays(cloneDate(loop), 42);

            this.#updateCells(cells, 7, loop, end, minDate, maxDate, (date: Date) => {
                return {
                    content: date.getDate().toString(),
                    monthOffset: getMonthOffset(date, currentDate),
                    increment: () => date.setDate(date.getDate() + 1)
                };
            });
        }
        else if (this.zoom === "months") {
            this.header = `${currentDateLocal.getFullYear()}`;

            const loop = startOfYear(currentDateLocal);
            const end = addYears(cloneDate(loop), 1);

            this.#updateCells(cells, 0, loop, end, minDate, maxDate, (date: Date) => {
                return {
                    content: Vidyano.CultureInfo.currentCulture.dateFormat.shortMonthNames[date.getMonth()],
                    increment: () => date.setMonth(date.getMonth() + 1)
                };
            });
        }
        else if (this.zoom === "years") {
            const loop = startOfYear(currentDateLocal);
            loop.setFullYear(loop.getFullYear() - 6);
            const end = addYears(cloneDate(loop), 12);

            this.#updateCells(cells, 0, loop, end, minDate, maxDate, (date: Date) => {
                return {
                    content: date.getFullYear().toString(),
                    increment: () => date.setFullYear(date.getFullYear() + 1)
                };
            });

            if (cells.length > 0 && cells[0].date && cells[cells.length - 1].date) {
                this.header = `${cells[0].date.getFullYear()} - ${cells[cells.length - 1].date.getFullYear()}`;
            }
        }
    }

    #updateCells(
        cells: IDatePickerCell[],
        startIndex: number,
        loop: Date,
        end: Date,
        minDate: Date,
        maxDate: Date,
        cellConfig: (date: Date) => { content: string; monthOffset?: number; increment: () => void }
    ) {
        let index = startIndex;
        do {
            cells[index].date = cloneDate(loop);
            const config = cellConfig(loop);
            cells[index].content = config.content;
            if (config.monthOffset !== undefined) {
                cells[index].monthOffset = config.monthOffset;
            }
            cells[index].blocked = this.#isBlocked(cells[index], minDate, maxDate);

            index++;
            config.increment();
        }
        while (loop.getTime() < end.getTime());

        this.cells = [...cells]; // Trigger reactivity
    }

    @listener("click")
    private _catchTap(e: MouseEvent) {
        e.stopPropagation();
    }

    get isOpen(): boolean {
        return (<Popup>this.$.popup).open;
    }

    private _zoomChanged(zoom: string) {
        if (zoom === "days") {
            const { shortDayNames, firstDayOfWeek } = Vidyano.CultureInfo.currentCulture.dateFormat;
            const dayNames = firstDayOfWeek > 0
                ? [...shortDayNames.slice(firstDayOfWeek), ...shortDayNames.slice(0, firstDayOfWeek)]
                : shortDayNames.slice();

            const cells: IDatePickerCell[] = [
                ...dayNames.map(d => ({ type: "weekday", content: d })),
                ...Array.range(1, 42).map(() => ({ type: "day" }))
            ];

            this.cells = cells;
            this.canFast = true;
        }
        else {
            const cellType = zoom.slice(0, -1); // Remove trailing 's' from 'months' or 'years'
            this.cells = Array.range(1, 12).map(() => ({ type: cellType }));
            this.canFast = false;
        }
    }

    #isDateSelected(zoom: string, date: Date, selectedDate: Date): boolean {
        if (!date || !selectedDate)
            return false;

        if (zoom === "days")
            return isSameDate(date, selectedDate, "day");
        else if (zoom === "months" && this.monthMode)
            return isSameDate(date, selectedDate, "month");

        return false;
    }

    #isDateToday(zoom: string, date: Date, today: Date): boolean {
        if (!date || !today)
            return false;

        if (zoom === "days")
            return isSameDate(date, today, "day");
        else if (zoom === "months")
            return isSameDate(date, today, "month");

        return isSameDate(date, today, "year");
    }

    #isOtherMonth(monthOffset: number): boolean {
        return !!monthOffset;
    }

    #isBlocked(cell: IDatePickerCell, minDate: Date, maxDate: Date): boolean {
        const date = cell.date;
        if (!date || (!minDate && !maxDate))
            return false;

        const granularity = this.zoom === "days" ? "day" : (this.zoom === "months" ? "month" : "year");
        return (minDate && compareDate(date, minDate, granularity) < 0) || (maxDate && compareDate(date, maxDate, granularity) > 0);
    }

    #navigate(amount: number, unit: "month" | "year") {
        const newCurrentDate = cloneDate(this.currentDate);

        if (unit === "month") {
            newCurrentDate.setMonth(newCurrentDate.getMonth() + amount);
        } else {
            newCurrentDate.setFullYear(newCurrentDate.getFullYear() + amount);
        }

        this.currentDate = newCurrentDate;
    }

    private _slow(e: Event) {
        const amount = parseInt((<Button>e.currentTarget).getAttribute("n"));

        if (this.zoom === "days")
            this.#navigate(amount, "month");
        else if(this.zoom === "months")
            this.#navigate(amount, "year");
        else
            this.#navigate(amount * 12, "year");

        e.stopPropagation();
    }

    private _fast(e: Event) {
        const amount = parseInt((<Button>e.currentTarget).getAttribute("n"));
        this.#navigate(amount, "year");
        e.stopPropagation();
    }

    private _zoomOut(e: Event) {
        if (this.zoom === "days")
            this.zoom = "months";
        else if (this.zoom === "months")
            this.zoom = "years";

        e.stopPropagation();
    }

    private _onWheel(e: WheelEvent) {
        e.preventDefault();
        e.stopPropagation();

        const direction = Math.sign(e.deltaY);
        switch (this.zoom) {
            case "days":
                this.#navigate(direction, "month");
                break;
            case "months":
                this.#navigate(direction, "year");
                break;
            case "years":
                this.#navigate(direction * 12, "year");
                break;
        }
    }

    #applyTimeToDate(date: Date): void {
        if (!this.selectedDate && this.newTime) {
            const timeParts = /(\d\d):(\d\d)(:(\d\d))?/.exec(this.newTime);
            if (timeParts?.[1] && timeParts?.[2]) {
                date.setHours(parseInt(timeParts[1], 10));
                date.setMinutes(parseInt(timeParts[2], 10));
                date.setSeconds(parseInt(timeParts[4] || "0", 10));
            }
        }
    }

    #selectDay(cell: IDatePickerCell) {
        const newSelectedDate = this.selectedDate ? cloneDate(this.selectedDate) : new Date();
        this.#applyTimeToDate(newSelectedDate);

        newSelectedDate.setFullYear(cell.date.getFullYear());
        newSelectedDate.setMonth(cell.date.getMonth());
        newSelectedDate.setDate(cell.date.getDate());

        this.selectedDate = newSelectedDate;

        if (cell.monthOffset !== 0) {
            this.#navigate(cell.monthOffset, "month");
        }
    }

    #selectMonth(cell: IDatePickerCell) {
        const newCurrentDate = cloneDate(this.currentDate);
        newCurrentDate.setMonth(cell.date.getMonth());
        newCurrentDate.setFullYear(cell.date.getFullYear());
        this.currentDate = newCurrentDate;

        if (!this.monthMode) {
            this.zoom = "days";
        } else {
            const newSelectedDate = this.selectedDate ? cloneDate(this.selectedDate) : new Date();
            newSelectedDate.setDate(1);
            newSelectedDate.setMonth(cell.date.getMonth());
            newSelectedDate.setFullYear(cell.date.getFullYear());
            this.selectedDate = newSelectedDate;
        }
    }

    #selectYear(cell: IDatePickerCell) {
        const newCurrentDate = cloneDate(this.currentDate);
        newCurrentDate.setFullYear(cell.date.getFullYear());
        this.currentDate = newCurrentDate;
        this.zoom = "months";
    }

    private _select(e: MouseEvent, cell: IDatePickerCell) {
        if (!cell?.date || cell.blocked) {
            e.stopPropagation();
            return;
        }

        if (this.zoom === "days") {
            this.#selectDay(cell);
        }
        else if (this.zoom === "months") {
            this.#selectMonth(cell);
        }
        else if (this.zoom === "years") {
            this.#selectYear(cell);
        }

        e.stopPropagation();
    }

    private _opening() {
        this.currentDate = this.selectedDate ? cloneDate(this.selectedDate) : new Date();
        this.zoom = this.monthMode ? "months" : "days";

        this.deferredCellsUpdate = false;
    }
}

customElements.define("vi-date-picker", DatePicker);

/**************************************
 * Date Manipulation Utilities
 **************************************/

/**
 * Creates a new Date object with the same time value.
 * @param date - The date to clone
 * @returns A new Date instance or null if input is falsy
 */
function cloneDate(date: Date): Date | null {
    return date ? new Date(date.getTime()) : null;
}

/**
 * Normalizes a date to midnight (00:00:00.000).
 * @param date - The date to normalize
 * @returns A new Date instance set to midnight
 */
function normalizeDate(date: Date): Date {
    const newDate = cloneDate(date);
    newDate.setHours(0, 0, 0, 0);
    return newDate;
}

/**
 * Returns the start of the month for a given date.
 * @param date - The date to get the start of month for
 * @returns A new Date instance representing the first day of the month at midnight
 */
function startOfMonth(date: Date): Date {
    const newDate = normalizeDate(date);
    newDate.setDate(1);
    return newDate;
}

/**
 * Returns the start of the year for a given date.
 * @param date - The date to get the start of year for
 * @returns A new Date instance representing January 1st at midnight
 */
function startOfYear(date: Date): Date {
    const newDate = normalizeDate(date);
    newDate.setMonth(0, 1);
    return newDate;
}

/**
 * Returns the start of the week for a given date.
 * @param date - The date to get the start of week for
 * @param firstDayOfWeek - The first day of the week (0 = Sunday, 1 = Monday, etc.)
 * @returns A new Date instance representing the first day of the week at midnight
 */
function startOfWeek(date: Date, firstDayOfWeek: number): Date {
    const newDate = normalizeDate(date);
    const diff = (newDate.getDay() - firstDayOfWeek + 7) % 7;
    newDate.setDate(newDate.getDate() - diff);
    return newDate;
}

/**
 * Adds a specified number of days to a date.
 * @param date - The starting date
 * @param days - Number of days to add (can be negative)
 * @returns A new Date instance with the days added
 */
function addDays(date: Date, days: number): Date {
    const newDate = cloneDate(date);
    newDate.setDate(newDate.getDate() + days);
    return newDate;
}

/**
 * Adds a specified number of years to a date.
 * @param date - The starting date
 * @param years - Number of years to add (can be negative)
 * @returns A new Date instance with the years added
 */
function addYears(date: Date, years: number): Date {
    const newDate = cloneDate(date);
    newDate.setFullYear(newDate.getFullYear() + years);
    return newDate;
}

/**************************************
 * Date Comparison Utilities
 **************************************/

/**
 * Checks if two dates are the same at a given granularity level.
 * @param date1 - First date to compare
 * @param date2 - Second date to compare
 * @param granularity - Level of comparison: "day", "month", or "year"
 * @returns True if dates match at the specified granularity
 */
function isSameDate(date1: Date, date2: Date, granularity: "day" | "month" | "year"): boolean {
    if (!date1 || !date2) return false;

    if (date1.getFullYear() !== date2.getFullYear()) return false;
    if (granularity === "year") return true;

    if (date1.getMonth() !== date2.getMonth()) return false;
    if (granularity === "month") return true;

    return date1.getDate() === date2.getDate();
}

/**
 * Normalizes a date to a specific granularity by zeroing out finer units.
 * @param date - The date to normalize
 * @param granularity - The granularity level: "day", "month", or "year"
 * @returns A new Date instance normalized to the specified granularity
 */
function normalizeDateByGranularity(date: Date, granularity: "day" | "month" | "year"): Date {
    const year = date.getFullYear();
    const month = granularity === "year" ? 0 : date.getMonth();
    const day = granularity === "day" ? date.getDate() : 1;
    return new Date(year, month, day, 0, 0, 0, 0);
}

/**
 * Compares two dates at a given granularity level.
 * @param date1 - First date to compare
 * @param date2 - Second date to compare
 * @param granularity - Level of comparison: "day", "month", or "year"
 * @returns Negative if date1 < date2, positive if date1 > date2, 0 if equal
 */
function compareDate(date1: Date, date2: Date, granularity: "day" | "month" | "year"): number {
    if (!date1 || !date2) return 0;
    const d1 = normalizeDateByGranularity(date1, granularity);
    const d2 = normalizeDateByGranularity(date2, granularity);
    return d1.getTime() - d2.getTime();
}

/**
 * Calculates the month offset between two dates.
 * @param dateForCell - The cell's date
 * @param currentDisplayMonthDate - The currently displayed month's date
 * @returns -1 if cell is before, 1 if after, 0 if same month
 */
function getMonthOffset(dateForCell: Date, currentDisplayMonthDate: Date): number {
    const yearDiff = dateForCell.getFullYear() - currentDisplayMonthDate.getFullYear();
    if (yearDiff !== 0) return Math.sign(yearDiff);

    const monthDiff = dateForCell.getMonth() - currentDisplayMonthDate.getMonth();
    return Math.sign(monthDiff);
}
