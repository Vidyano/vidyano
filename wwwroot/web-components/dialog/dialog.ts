import * as Polymer from "../../libs/polymer/polymer.js"
import "../size-tracker/size-tracker.js"
import { WebComponent } from "../web-component/web-component.js"

@WebComponent.register({
    properties: {
        noCancelOnOutsideClick: {
            type: Boolean,
            value: true,
        },
        noCancelOnEscKey: Boolean,
        noHeader: {
            type: Boolean,
            reflectToAttribute: true
        }
    },
    keybindings: {
        "esc": "_esc"
    },
    mediaQueryAttributes: true
})
export abstract class Dialog extends WebComponent {
    static dialogTemplate(innerTemplate: HTMLTemplateElement) {
        const outerTemplate = Polymer.html`<link rel="import" href="dialog.html">`;
        const dialog = outerTemplate.content.querySelector("dialog") as HTMLDialogElement;
        dialog.appendChild(innerTemplate.content.cloneNode(true));

        return outerTemplate;
    }

    private _resolve: Function;
    noHeader: boolean;
    noCancelOnOutsideClick: boolean;
    noCancelOnEscKey: boolean;

    private get dialog(): HTMLDialogElement {
        return this.shadowRoot.querySelector("dialog") as HTMLDialogElement;
    }

    async open(): Promise<any> {
        this.dialog.showModal();

        return new Promise<any>(resolve => {
            this._resolve = resolve;
        });
    }

    private _esc(e: KeyboardEvent) {
        if (!this.noCancelOnEscKey)
            this.cancel();
    }

    close(result?: any) {
        this.dialog.close(result);
    }

    cancel() {
        this.dialog.close();
    }

    private _onClose() {
        this._resolve(this.dialog.returnValue);
    }

    private _onCancel(e: Event) {
        if (this.noCancelOnEscKey)
            e.preventDefault();
    }

    private _onClick(e: MouseEvent) {
        if (this.noCancelOnOutsideClick)
            return;

        const rect = this.dialog.getBoundingClientRect();
        const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
            rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
        
        if (!isInDialog)
            this.dialog.close();
    }
}