import * as Polymer from "../../libs/polymer/polymer.js"
import * as Vidyano from "../../libs/vidyano/vidyano.js"
import * as IconRegister from "../icon/icon-register.js"
import { WebComponent } from "../web-component/web-component.js"

const findUriLabel = /\[url:([^|]+)\|((https?:\/\/[-\w]+(\.[-\w]+)*(:\d+)?(\/#?!?[^\.\s]*(\.[^\.\s]+)*)?)|(#!\/)?[^\]]+)]/g;
const findUri = /(https?:\/\/[-\w]+(\.[-\w]+)*(:\d+)?(\/#?!?[^\.\s]*(\.[^\.\s]+)*)?)/g;
const findNewLine = /\r?\n|\r/g;

@WebComponent.register({
    properties: {
        serviceObject: Object,
        type: {
            type: Number,
            reflectToAttribute: true,
            computed: "serviceObject.notificationType"
        },
        text: {
            type: String,
            notify: true,
            observer: "_textChanged",
            computed: "_computeText(serviceObject.notification)",
            value: null
        },
        inlineText: {
            type: String,
            computed: "_computeInlineText(text)"
        },
        hidden: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeHidden(text, serviceObject.notificationDuration)",
            value: true
        },
        icon: {
            type: String,
            computed: "_computeIcon(type)"
        },
        isOverflowing: {
            type: Boolean,
            readOnly: true
        },
        noClose: {
            type: Boolean,
            reflectToAttribute: true
        }
    },
    forwardObservers: [
        "serviceObject.notification",
        "serviceObject.notificationType",
        "serviceObject.notificationDuration"
    ]
})
export class Notification extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="notification.html">` }

    readonly isOverflowing: boolean; private _setIsOverflowing: (val: boolean) => void;
    serviceObject: Vidyano.ServiceObjectWithActions;
    type: Vidyano.NotificationType;
    text: string;

    private _close() {
        this.serviceObject.setNotification(null);
    }

    private _moreInfo(e: Event) {
        if (!this.isOverflowing || e.target instanceof HTMLAnchorElement)
            return;

        this.app.showMessageDialog({
            title: this.app.translateMessage(this.type),
            titleIcon: this._computeIcon(this.type),
            message: this.text.replace(findNewLine, "<br />"),
            rich: true,
            actions: [this.translations.OK]
        });
    }

    private _trackerSizeChanged(e: Event) {
        this._setTextOverflow();

        e.stopPropagation();
    }

    private _textChanged() {
        this._setTextOverflow();
    }

    private _setTextOverflow() {
        if (!this.text)
            return;

        const text = <HTMLSpanElement>this.$.text;

        if (this.text.contains("<br>"))
            this._setIsOverflowing(true);
        else {
            text.innerHTML = this.text;
            this._setIsOverflowing(text.offsetWidth < text.scrollWidth);
        }

        text.style.cursor = this.isOverflowing ? "pointer" : "auto";
    }

    private _computeText(notification: string): string {
        if (!notification)
            return null;

        const html = this._escapeHTML(notification).replace(findUriLabel, "<a href=\"$2\" title=\"\" target=\"_blank\">$1</a>");
        if (notification === html)
            return notification.replace(findUri, "<a href=\"$1\" title=\"\" target=\"_blank\">$1</a>");

        return html;
    }

    private _computeInlineText(text: string): string {
        return text && text.replace(/<br>/g, " ");
    }

    private _computeHidden(text: string, duration: number): boolean {
        return text == null || duration > 0;
    }

    private _computeIcon(type: Vidyano.NotificationType): string {
        return `Notification_${type}`;
    }
}