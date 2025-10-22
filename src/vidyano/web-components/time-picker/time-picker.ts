import { html, unsafeCSS } from "lit";
import { property, query, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { notify, observer, WebComponent } from "components/web-component/web-component";
import { Popup } from "components/popup/popup";
import "components/icon/icon";
import styles from "./time-picker.css";

export class TimePicker extends WebComponent {
    static styles = unsafeCSS(styles);

    /** Hours displayed on the outer ring of the clock (0, 13-23) */
    private static readonly OUTER_HOURS = [0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

    /** Hours displayed on the inner ring of the clock (12, 1-11) */
    private static readonly INNER_HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

    /** Minutes displayed on the clock face (in 5-minute intervals) */
    private static readonly MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

    /**
     * The selected time value. When changed, automatically updates the hours and minutes display.
     * Fires a `time-changed` event when modified.
     */
    @property({ type: Date })
    @notify()
    @observer(function(this: TimePicker) {
        this._hours = this.time ? this.time.getHours() : 0;
        this._minutes = this.time ? this.time.getMinutes() : 0;
    })
    time: Date;

    /**
     * Current selection state: either "hours" or "minutes".
     * This attribute is reflected to the DOM for CSS styling (e.g., `[state="hours"]`).
     * @default "hours"
     */
    @property({ type: String, reflect: true })
    state: "hours" | "minutes" = "hours";

    /**
     * Currently selected hour (0-23). Internal state that updates when time changes.
     */
    @state()
    private _hours: number = 0;

    /**
     * Currently selected minutes (0-59). Internal state that updates when time changes.
     */
    @state()
    private _minutes: number = 0;

    /**
     * Reference to the popup element
     */
    @query("#popup")
    private popup!: Popup;

    /**
     * Returns whether the time picker popup is currently open.
     * @returns True if the popup is open, false otherwise
     */
    get isOpen(): boolean {
        return !!this.popup?.open;
    }

    render() {
        return html`
            <vi-popup id="popup" vertical-align="bottom" placement="bottom-end" part="popup">
                <vi-icon slot="header" part="icon" source="Clock"></vi-icon>
                <div class="clock" @click=${this._stopPropagation}>
                    <div id="current">
                        <span class="hours" @click=${this._switch}>${this._hours.toString().padStart(2, '0')}</span>
                        <span>:</span>
                        <span class="minutes" @click=${this._switch}>${this._minutes.toString().padStart(2, '0')}</span>
                    </div>
                    <div id="clockHost" @click=${this._click}>
                        <div class="face">
                            <div class="list">
                                ${TimePicker.OUTER_HOURS.map(hour => html`
                                    <div class=${classMap({ item: true, active: hour === this._hours })} data-hours="${hour}">
                                        <span>${hour.toString().padStart(2, '0')}</span>
                                    </div>
                                `)}
                            </div>
                            <div class="list">
                                ${TimePicker.INNER_HOURS.map(hour => html`
                                    <div class=${classMap({ item: true, active: hour === this._hours })} data-hours="${hour}">
                                        <span>${hour}</span>
                                    </div>
                                `)}
                            </div>
                            <div class="list">
                                ${TimePicker.MINUTES.map(minute => html`
                                    <div class=${classMap({ item: true, active: minute === this._minutes })} data-minutes="${minute}">
                                        <span>${minute.toString().padStart(2, '0')}</span>
                                    </div>
                                `)}
                            </div>
                        </div>
                    </div>
                </div>
            </vi-popup>
        `;
    }

    /**
     * Handles click events on hour or minute items in the clock face.
     * Updates the time based on which item was clicked and switches between hours/minutes state.
     * @param e - The click event
     */
    private _click(e: Event) {
        const source = (e.target as HTMLElement).closest(".item") as HTMLElement;
        if (!source) return;

        const newTime = new Date();

        if (this.time) {
            // Preserve .NET metadata for proper server serialization
            newTime.netOffset(this.time.netOffset());
            newTime.netType(this.time.netType());

            // Copy the date portion
            newTime.setFullYear(this.time.getFullYear(), this.time.getMonth(), this.time.getDate());
            newTime.setHours(this.time.getHours(), this.time.getMinutes(), 0, 0);
        }
        else {
            newTime.setHours(0, 0, 0, 0);
        }

        if (this.state === "hours") {
            this._hours = parseInt(source.getAttribute("data-hours"), 10);
            newTime.setHours(this._hours);
            this.state = "minutes";
        }
        else if (this.state === "minutes") {
            this._minutes = parseInt(source.getAttribute("data-minutes"), 10);
            newTime.setMinutes(this._minutes);
        }

        this.time = newTime;

        e.stopPropagation();
    }

    /**
     * Handles click events on the hours or minutes display to switch between selection modes.
     * @param e - The click event
     */
    private _switch(e: Event) {
        const target = e.target as HTMLElement;
        if (target.classList.contains("hours")) {
            this.state = "hours";
        }
        else if (target.classList.contains("minutes")) {
            this.state = "minutes";
        }

        e.stopPropagation();
    }

    /**
     * Stops event propagation to prevent clicks inside the clock from closing the popup.
     * @param e - The click event
     */
    private _stopPropagation(e: Event) {
        e.stopPropagation();
    }
}

customElements.define("vi-time-picker", TimePicker);
