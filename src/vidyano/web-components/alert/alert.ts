import { unsafeCSS } from "lit";
import { WebComponent } from "components/web-component/web-component";
import * as Vidyano from "vidyano";
import styles from "./alert.css";

export class Alert extends WebComponent {
    static styles = unsafeCSS(styles);

    /**
     * Displays a toast notification message with an animated slide-in/slide-out effect.
     * The notification appears from the right side of the screen, stays visible for the specified duration,
     * and then slides out automatically.
     *
     * @param message The message text to display in the notification.
     * @param type The notification type that determines the visual styling (Error, Warning, Notice, or OK).
     * @param wait The duration in milliseconds to display the notification before it slides out.
     * @returns A promise that resolves when the notification has been removed from the DOM.
     */
    async log(message: string, type: Vidyano.NotificationType, wait: number) {
        const log = document.createElement("article");
        log.className = `log-${type.toLowerCase()}`;
        log.innerText = message;

        this.shadowRoot.appendChild(log);

        await log.animate([
            { right: "-300px", opacity: 0 },
            { right: 0, opacity: 1 },
        ], {
            duration: 500,
            fill: "forwards",
            easing: "cubic-bezier(0.175, 0.885, 0.320, 1.275)"
        }).finished;

        await this.sleep(wait);

        await log.animate([
            { right: 0, opacity: 1 },
            { right: "-300px", opacity: 0 },
        ], {
            duration: 250,
            fill: "forwards",
            easing: "cubic-bezier(0.600, -0.280, 0.735, 0.045)"
        }).finished;

        this.shadowRoot.removeChild(log);
    }
}

customElements.define("vi-alert", Alert);
