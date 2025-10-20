import { html, nothing, unsafeCSS } from "lit";
import { property, state } from "lit/decorators.js";
import { computed, notify, observer, WebComponent } from "components/web-component/web-component";
import * as Vidyano from "vidyano"
import styles from "./notification.css";

const findUriLabel = /\[url:([^|]+)\|((https?:\/\/[-\w]+(\.[-\w]+)*(:\d+)?(\/#?!?[^\.\s]*(\.[^\.\s]+)*)?)|(#!\/)?[^\]]+)]/g;
const findUri = /(https?:\/\/[-\w]+(\.[-\w]+)*(:\d+)?(\/#?!?[^\.\s]*(\.[^\.\s]+)*)?)/g;
const findNewLine = /\r?\n|\r/g;

export class Notification extends WebComponent {
    static styles = unsafeCSS(styles);

    @property({ type: Object })
    serviceObject: Vidyano.ServiceObjectWithActions;

    @property({ type: Number, reflect: true })
    @computed(function(this: Notification): Vidyano.NotificationType {
        return this.serviceObject?.notificationType;
    }, "serviceObject.notificationType")
    declare readonly type: Vidyano.NotificationType;

    @property({ type: String })
    @notify()
    @observer(function(this: Notification) {
        this._setTextOverflow();
    })
    @computed(function(this: Notification, notification: string): string {
        if (!notification)
            return null;

        const html = this._escapeHTML(notification).replace(findUriLabel, "<a href=\"$2\" title=\"\" target=\"_blank\">$1</a>");
        if (notification === html)
            return notification.replace(findUri, "<a href=\"$1\" title=\"\" target=\"_blank\">$1</a>");

        return html;
    }, "serviceObject.notification")
    declare readonly text: string;

    @property({ type: String })
    @computed(function(this: Notification, text: string): string {
        return text && text.replace(/<br>/g, " ");
    }, "text")
    declare readonly inlineText: string;

    @property({ type: Boolean, reflect: true })
    @computed(function(this: Notification, text: string, duration: number): boolean {
        return text == null || duration > 0;
    }, "text", "serviceObject.notificationDuration")
    declare readonly hidden: boolean;

    @property({ type: String })
    @computed(function(this: Notification, type: Vidyano.NotificationType): string {
        return `Notification_${type}`;
    }, "type")
    declare readonly icon: string;

    @state()
    isOverflowing: boolean = false;

    @property({ type: Boolean, reflect: true })
    noClose: boolean = false;

    render() {
        return html`
            <div id="icon">
                <vi-icon source=${this.icon}></vi-icon>
            </div>
            <div id="textHost" class="text-container" @click=${this._moreInfo}>
                ${!this.hidden ? html`
                    <vi-size-tracker @sizechanged=${this._trackerSizeChanged}></vi-size-tracker>
                ` : nothing}
                <span id="text" .innerHTML=${this.inlineText || ""}></span>
            </div>
            <vi-button id="close" @click=${this._close} icon="Notification_Close" ?hidden=${this.noClose}></vi-button>

            <vi-icon name="Notification_Close">
                <svg viewBox="0 0 32 32">
                    <path d="M19.587 16.001l6.096 6.096c0.396 0.396 0.396 1.039 0 1.435l-2.151 2.151c-0.396 0.396-1.038 0.396-1.435 0l-6.097-6.096-6.097 6.096c-0.396 0.396-1.038 0.396-1.434 0l-2.152-2.151c-0.396-0.396-0.396-1.038 0-1.435l6.097-6.096-6.097-6.097c-0.396-0.396-0.396-1.039 0-1.435l2.153-2.151c0.396-0.396 1.038-0.396 1.434 0l6.096 6.097 6.097-6.097c0.396-0.396 1.038-0.396 1.435 0l2.151 2.152c0.396 0.396 0.396 1.038 0 1.435l-6.096 6.096z"></path>
                </svg>
            </vi-icon>
        `;
    }

    private _close() {
        this.serviceObject.setNotification(null);
    }

    private _moreInfo(e: Event) {
        if (!this.isOverflowing || e.target instanceof HTMLAnchorElement)
            return;

        this.app.showMessageDialog({
            title: this.app.translateMessage(this.type),
            titleIcon: `Notification_${this.type}`,
            message: this.text.replace(findNewLine, "<br />"),
            rich: true,
            actions: [this.translations.OK]
        });
    }

    private _trackerSizeChanged(e: Event) {
        this._setTextOverflow();

        e.stopPropagation();
    }

    private _setTextOverflow() {
        if (!this.text)
            return;

        const text = <HTMLSpanElement>this.shadowRoot!.getElementById("text");
        if (!text)
            return;

        if (this.text.contains("<br>"))
            this.isOverflowing = true;
        else {
            text.innerHTML = this.text;
            this.isOverflowing = text.offsetWidth < text.scrollWidth;
        }

        text.style.cursor = this.isOverflowing ? "pointer" : "auto";
    }

    private _escapeHTML(val: string): string {
        const span = document.createElement("span");
        span.innerText = val;
        return span.innerHTML;
    }
}

customElements.define("vi-notification", Notification);
