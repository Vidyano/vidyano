import * as Polymer from "../../libs/polymer/polymer"
import * as Vidyano from "../../libs/vidyano/vidyano"
import { WebComponent, WebComponentListener } from "../web-component/web-component"

@WebComponent.register()
export class Alert extends WebComponentListener(WebComponent) {
    static get template() { return Polymer.html`<link rel="import" href="alert.html">`; }

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