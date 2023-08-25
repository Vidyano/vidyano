import * as Polymer from "../../libs/polymer/polymer.js"
import "../size-tracker/size-tracker.js"
import { IPosition, WebComponent } from "../web-component/web-component.js"

@WebComponent.register({
    properties: {
        dragging: {
            type: Boolean,
            readOnly: true,
            reflectToAttribute: true
        },
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

    #result: any;
    private _resolve: Function;
    private _translatePosition: IPosition; 
    readonly dragging: boolean; private _setDragging: (value: boolean) => void;
    noHeader: boolean;
    noCancelOnOutsideClick: boolean;
    noCancelOnEscKey: boolean;

    private get dialog(): HTMLDialogElement {
        return this.shadowRoot.querySelector("dialog") as HTMLDialogElement;
    }

    async open(): Promise<any> {
        this.dialog.showModal();

        const promise = new Promise<any>(resolve => {
            this._resolve = resolve;
        });

        const header = <HTMLElement>this.shadowRoot.querySelector("header");
        if (header) {
            const _track = this._track.bind(this);
            Polymer.Gestures.addListener(header, "track", _track);

            promise.finally(() => {
                Polymer.Gestures.removeListener(header, "track", _track);
            });
        }

        return promise;
    }

    private _track(e: Polymer.Gestures.TrackEvent) {
        if (e.detail.state === "track" && this._translatePosition && this.dragging) {
            const rect = this.dialog.getBoundingClientRect();

            // Factor 2 is to align the speed of the dialog with the mouse
            let x = this._translatePosition.x + e.detail.ddx * 2;
            let y = this._translatePosition.y + e.detail.ddy * 2;

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

            this._setDragging(true);
            if (!this._translatePosition)
                this._translate({ x: 0, y: 0 });
        }
        else if (e.detail.state === "end")
            this._setDragging(false);
    } 

    private _translate(position: IPosition) { 
        const { x, y } = this._translatePosition = position;

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
        this._resolve(this.#result);
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
}