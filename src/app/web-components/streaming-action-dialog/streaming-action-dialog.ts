import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
import { Dialog } from "components/dialog/dialog.js"
import { Scroller } from "components/scroller/scroller.js";
import { WebComponent } from "components/web-component/web-component.js"

type StreamingActionDialogDetails = {
    backgroundColor: string;
    foregroundColor: string;
    height: string;
    notification: string;
    notificationType: Vidyano.NotificationType;
    title: string;
    width: string;
};

@WebComponent.register({
    properties: {
        content: {
            type: String,
            readOnly: true,
            value: ""
        },
        icon: {
            type: String,
            readOnly: true
        },
        isBusy: {
            type: Boolean,
            readOnly: true,
            value: true
        },
        title: {
            type: String,
            readOnly: true
        },
        notificationObject: {
            type: Object,
            readOnly: true
        }
    }
})
export class StreamingActionDialog extends Dialog {
    static get template() { return Dialog.dialogTemplate(Polymer.html`<link rel="import" href="streaming-action-dialog.html">`); }

    readonly content: string; private _setContent: (content: string) => void;
    readonly icon: string; private _setIcon: (icon: string) => void;
    readonly isBusy: boolean; private _setIsBusy: (isBusy: boolean) => void;
    readonly title: string; private _setTitle: (title: string) => void;
    readonly notificationObject: Vidyano.ServiceObjectWithActions; private _setNotificationObject: (notificationObject: Vidyano.ServiceObjectWithActions) => void;

    #hasScrolled = false;

    constructor(private readonly _actionDefinition: Vidyano.ActionDefinition, private readonly _abort: () => void) {
        super();

        this._setIcon(_actionDefinition.icon);
        this._setTitle(_actionDefinition.displayName);
    }

    appendMessage(message: string) {
        const data = JSON.parse(message) as { type: string; value: any; };

        if (data.type === "dialog") {
            const details = data.value as StreamingActionDialogDetails;
            if (details.title)
                this._setTitle(details.title);

            if (details.backgroundColor)
                this.style.setProperty("--vi-streaming-action-dialog-background-color", details.backgroundColor);
            
            if (details.foregroundColor)
                this.style.setProperty("--vi-streaming-action-dialog-foreground-color", details.foregroundColor);

            if (details.width)
                this.style.setProperty("--vi-streaming-action-dialog-width", details.width);

            if (details.height)
                this.style.setProperty("--vi-streaming-action-dialog-height", details.height);

            if (details.notification) {
                const svcObject = new Vidyano.ServiceObjectWithActions(this.service);
                svcObject.setNotification(details.notification, details.notificationType);

                this._setNotificationObject(svcObject);
            }
        }
        else if (data.type === "message")
            this._setContent(this.content + data.value + "\n");

        Polymer.Async.microTask.run(() => {
            const scroller = this.$.scroller as Scroller;
            if (scroller.atBottom || !this.#hasScrolled) {
                scroller.scrollToBottom();

                if (!this.#hasScrolled && scroller.atBottom)
                    this.#hasScrolled = true;
            }
        });
    }

    completed() {
        this._setIsBusy(false);
    }

    close(result?: any) {
        this._abort();
        super.close(result);
    }
}

@WebComponent.register()
export class StreamingActionDialogBusyIndicator extends WebComponent {
    #interval: number;

    connectedCallback(): void {
        super.connectedCallback();

        const values = ["◜", "◝", "◞", "◟"];
        this.#interval = setInterval(() => {
            const value = values.shift();
            this.innerText = value;
            values.push(value);
        }, 100);
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();

        clearInterval(this.#interval);
    }
}