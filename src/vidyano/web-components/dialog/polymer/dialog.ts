import * as Polymer from "polymer"
import { PopupMenu } from "components/popup-menu/popup-menu";
import "components/size-tracker/size-tracker"

interface IPosition {
    x: number;
    y: number;
}

export interface IDialogOptions {
    omitStyle?: boolean
}

@Polymer.WebComponent.register({
    properties: {
        anchorTag: {
            type: String,
            value: "header"
        },
        isDragging: {
            type: Boolean,
            readOnly: true,
            reflectToAttribute: true
        },
        noCancelOnOutsideClick: {
            type: Boolean,
            value: true,
        },
        noCancelOnEscKey: Boolean
    },
    keybindings: {
        "esc": "_esc"
    },
    mediaQueryAttributes: true
}, "vi-dialog")
export abstract class Dialog extends Polymer.WebComponent {
    static dialogTemplate(innerTemplate: HTMLTemplateElement, options?: IDialogOptions) {
        const outerTemplate = Polymer.html`<link rel="import" href="dialog.html">`;
        if (options?.omitStyle)
            outerTemplate.content.querySelector("style").remove();

        const dialog = outerTemplate.content.querySelector("dialog") as HTMLDialogElement;
        dialog.appendChild(innerTemplate.content.cloneNode(true));

        return outerTemplate;
    }

    #result: any;
    #resolve: Function;
    #translatePosition: IPosition;
    readonly isDragging: boolean; private _setIsDragging: (isDragging: boolean) => void;

    anchorTag: string;
    noCancelOnOutsideClick: boolean;
    noCancelOnEscKey: boolean;

    private get dialog(): HTMLDialogElement {
        return this.shadowRoot.querySelector("dialog") as HTMLDialogElement;
    }

    async open(): Promise<any> {
        this.dialog.showModal();

        const promise = new Promise<any>(resolve => {
            this.#resolve = resolve;
        });

        const anchor = !!this.anchorTag ? <HTMLElement>this.shadowRoot.querySelector(this.anchorTag) : null;
        if (anchor) {
            const _track = this._track.bind(this);
            Polymer.Gestures.addListener(anchor, "track", _track);

            promise.finally(() => {
                Polymer.Gestures.removeListener(anchor, "track", _track);
            });
        }

        return promise;
    }

    private _track(e: Polymer.Gestures.TrackEvent) {
        if (e.detail.state === "track" && this.#translatePosition && this.isDragging) {
            const rect = this.dialog.getBoundingClientRect();

            // Factor 2 is to align the speed of the dialog with the mouse
            let x = this.#translatePosition.x + e.detail.ddx * 2;
            let y = this.#translatePosition.y + e.detail.ddy * 2;

             // Prevent dialog from going outside the screen
            if (x < 0)
                x = Math.max(x, (window.innerWidth - rect.width) * -1);
            else if (x > 0)
                x = Math.min(x, window.innerWidth - rect.width);

            if (y < 0)
                y = Math.max(y, (window.innerHeight - rect.height) * -1);
            else if (y > 0)
                y = Math.min(y, window.innerHeight - rect.height);

            this._translate({ x, y });
        }
        else if (e.detail.state === "start") {
            const path = e.composedPath();
            if (path[0] instanceof HTMLInputElement) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            if (!(<HTMLElement>(e.currentTarget)).tagName.startsWith("H")) {
                e.stopPropagation();
                e.preventDefault();

                return;
            }

            this._setIsDragging(true);
            if (!this.#translatePosition)
                this._translate({ x: 0, y: 0 });
        }
        else if (e.detail.state === "end")
            this._setIsDragging(false);
    } 

    private _translate(position: IPosition) {
        const { x, y } = this.#translatePosition = position;

        this.dialog.style.left = `${x}px`;
        this.dialog.style.top = `${y}px`;
    }

    private _esc(e: KeyboardEvent) {
        if (!this.noCancelOnEscKey)
            this.cancel();
    }

    close(result?: any) {
        this.#result = result;
        this.dialog.close();
    }

    cancel() {
        this.close();
    }

    private _onClose() {
        this.#resolve(this.#result);
    }

    private _onCancel(e: Event) {
        if (this.noCancelOnEscKey)
            e.preventDefault();

        this.#result = undefined;
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

    private async _configureContextMenu(e: MouseEvent) {
        if (!this.service || !this.service.application)
            return;

        const configureItems: Polymer.WebComponent[] = e["vi:configure"];
        if (!this.service.application.hasManagement || !configureItems?.length || window.getSelection().toString()) {
            e.stopImmediatePropagation();
            return;
        }

        e.stopPropagation();
        e.preventDefault();

        const popupMenu = new PopupMenu();
        popupMenu.contextMenuOnly = true;

        Array.from(popupMenu.children).forEach(item => popupMenu.removeChild(item));
        configureItems.forEach(item => popupMenu.appendChild(item));

        this.dialog.appendChild(popupMenu);

        try {
            popupMenu.$.popup.style.left = e.pageX + "px";
            popupMenu.$.popup.style.top = e.pageY + "px";

            await popupMenu.popup();
        }
        finally {
            this.dialog.removeChild(popupMenu);
        }
    }
}
