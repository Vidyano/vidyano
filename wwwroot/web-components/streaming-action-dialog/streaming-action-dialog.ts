import * as Polymer from "../../libs/polymer/polymer.js"
import * as Vidyano from "../../libs/vidyano/vidyano.js"
import { Dialog } from "../dialog/dialog.js"
import { Scroller } from "../scroller/scroller.js";
import { WebComponent } from "../web-component/web-component.js"

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
        title: {
            type: String,
            readOnly: true
        }
    }
})
export class StreamingActionDialog extends Dialog {
    static get template() { return Dialog.dialogTemplate(Polymer.html`<link rel="import" href="streaming-action-dialog.html">`); }

    readonly content: string; private _setContent: (content: string) => void;
    readonly icon: string; private _setIcon: (icon: string) => void;
    readonly title: string; private _setTitle: (title: string) => void;

    #hasScrolled = false;

    constructor(private readonly _actionDefinition: Vidyano.ActionDefinition, private readonly _abort: () => void) {
        super();

        this._setIcon(_actionDefinition.icon);
        this._setTitle(_actionDefinition.displayName);
    }

    appendMessage(message: string) {
        const data = JSON.parse(message) as { type: string; value: string; };

        if (data.type === "title")
            this._setTitle(data.value);
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

    close(result?: any) {
        this._abort();
        super.close(result);
    }
}