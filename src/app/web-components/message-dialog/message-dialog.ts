import * as Polymer from "polymer"
import { WebComponent } from "components/web-component/web-component"
import { Dialog } from "components/dialog/dialog"
import "components/marked/marked"

export interface IMessageDialogOptions {
    noClose?: boolean;
    title?: string;
    titleIcon?: string;
    actions?: string[];
    actionTypes?: string[];
    defaultAction?: number;
    cancelAction?: number;
    message: string;
    extraClasses?: string[];
    rich?: boolean;
}

@WebComponent.register({
    properties: {
        options: {
            type: Object,
            readOnly: true
        },
        activeAction: {
            type: Number,
            readOnly: true,
            value: 0,
            observer: "_activeActionChanged"
        },
        hasHeaderIcon: {
            type: Boolean,
            computed: "_computeHasHeaderIcon(options)"
        }
    },
    keybindings: {
        "tab": "_keyboardNextAction",
        "right": "_keyboardNextAction",
        "left": "_keyboardPreviousAction"
    }
}, "vi-message-dialog")
export class MessageDialog extends Dialog {
    static get template() { return Dialog.dialogTemplate(Polymer.html`<link rel="import" href="message-dialog.html">`) }

    readonly options: IMessageDialogOptions; private _setOptions: (options: IMessageDialogOptions) => void;
        readonly activeAction: number; private _setActiveAction: (activeAction: number) => void;

        constructor(options: IMessageDialogOptions) {
            super();

            this._setOptions(options);

            if (options.defaultAction)
                this._setActiveAction(options.defaultAction);
        }

        connectedCallback() {
            super.connectedCallback();

            this.noCancelOnEscKey = this.noCancelOnOutsideClick = this.options.noClose || this.options.cancelAction == null;
        }

        cancel() {
            if (this.options.cancelAction == null)
                super.cancel();
            else
                super.close(this.options.cancelAction);
        }

        async open(): Promise<any> {
            const focus = setInterval(() => {
                const button = <HTMLButtonElement>this.$.actions.querySelectorAll("vi-button")[this.activeAction];
                if (!button)
                    return;

                if (this.app.activeElement !== button)
                    this._focusElement(button);
                else
                    clearInterval(focus);
            }, 100);

            return super.open();
        }

        private _computeHasHeaderIcon(options: IMessageDialogOptions): boolean {
            return options && typeof options.titleIcon === "string";
        }

        private _actionType(options: IMessageDialogOptions, index: number): string {
            if (!options || !options.actionTypes)
                return undefined;

            return options.actionTypes[index];
        }

        private _onSelectAction(e: Polymer.Gestures.TapEvent) {
            this.close(e.model.index);

            e.stopPropagation();
        }

        private _isFirst(index: number): boolean {
            return index === 0;
        }

        private _activeActionChanged(activeAction: number) {
            const button = <HTMLButtonElement>this.$.actions.querySelector(`button:nth-child(${activeAction + 1})`);
            if (!button)
                return;

            this._focusElement(button);
        }

        private _keyboardNextAction() {
            this._setActiveAction((this.activeAction + 1) % this.options.actions.length);
        }

        private _keyboardPreviousAction() {
            this._setActiveAction((this.activeAction - 1 + this.options.actions.length) % this.options.actions.length);
        }
}