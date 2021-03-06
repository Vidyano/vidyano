import * as Polymer from "../../libs/polymer/polymer.js"
import { mixinBehaviors } from "@polymer/polymer/lib/legacy/class.js"
import { IronOverlayBehavior } from "@polymer/iron-overlay-behavior"
import { SizeTrackerEvent } from "../size-tracker/size-tracker.js"
import "../size-tracker/size-tracker.js"
import { IPosition, WebComponent } from "../web-component/web-component.js"

export class DialogCore extends mixinBehaviors(IronOverlayBehavior, Polymer.PolymerElement) {
    static get template() { return Polymer.html`<link rel="import" href="dialog-core.html">`; }
}

customElements.define("vi-dialog-core", <CustomElementConstructor><any>DialogCore);

@WebComponent.register({
    properties: {
        noHeader: {
            type: Boolean,
            reflectToAttribute: true
        }
    },
    listeners: {
        "iron-overlay-closed": "_onClosed",
        "iron-overlay-canceled": "cancel"
    },
    keybindings: {
        "esc": "_esc"
    },
    mediaQueryAttributes: true
})
export abstract class Dialog extends WebComponent {
    static dialogTemplate(dialog: HTMLTemplateElement) {
        const template = Polymer.html`<link rel="import" href="dialog.html">`;
        const dialogCore = template.content.querySelector("vi-dialog-core") as DialogCore;
        dialogCore.appendChild(dialog.content.cloneNode(true));

        return template;
    }

    private _translatePosition: IPosition;
    private _resolve: Function;
    noHeader: boolean;

    connectedCallback() {
        super.connectedCallback();

        // By default, don't cancel dialog on outside click.
        this.noCancelOnOutsideClick = true;
    }

    get noCancelOnOutsideClick() {
        return this.dialogCore.noCancelOnOutsideClick;
    }

    set noCancelOnOutsideClick(noCancelOnOutsideClick: boolean) {
        this.dialogCore.noCancelOnOutsideClick = noCancelOnOutsideClick;
    }

    get noCancelOnEscKey() {
        return this.dialogCore.noCancelOnEscKey;
    }

    set noCancelOnEscKey(noCancelOnEscKey: boolean) {
        this.dialogCore.noCancelOnEscKey = noCancelOnEscKey;
    }

    private get dialogCore() {
        return this.shadowRoot.querySelector("vi-dialog-core") as (IronOverlayBehavior & Polymer.PolymerElement);
    }

    async open(): Promise<any> {
        this.dialogCore.open();

        const header = <HTMLElement>this.shadowRoot.querySelector("header");
        if (header)
            Polymer.Gestures.addListener(header, "track", (e: Polymer.Gestures.TrackEvent) => this._track(e));

        return new Promise(resolve => {
            this._resolve = resolve;
        });
    }

    private _esc(e: KeyboardEvent) {
        if (!this.noCancelOnEscKey)
            this.cancel();
    }

    close(result?: any) {
        this._resolve(result);
    }

    cancel() {
        this.dialogCore.close();
    }

    private _onClosed() {
        this._resolve();
    }

    private _sizechanged(e: SizeTrackerEvent) {
        this.dialogCore.notifyResize();

        e.stopPropagation();
    }

    private _track(e: Polymer.Gestures.TrackEvent) {
        if (e.detail.state === "track" && this._translatePosition && this.app.isTracking) {
            this._translate({
                x: this._translatePosition.x + e.detail.ddx,
                y: this._translatePosition.y + e.detail.ddy
            });
        }
        else if (e.detail.state === "start") {
            if (!(<HTMLElement>(e.currentTarget)).tagName.startsWith("H")) {
                e.stopPropagation();
                e.preventDefault();

                return;
            }

            this.app.isTracking = true;
            if (!this._translatePosition)
                this._translate({ x: 0, y: 0 });

            this.setAttribute("dragging", "");
        }
        else if (e.detail.state === "end") {
            this.removeAttribute("dragging");
            this.app.isTracking = false;
        }
    }

    private _translate(position: IPosition) {
        this._translatePosition = position;
        this.dialogCore.style.transform = `translate(${position.x}px, ${position.y}px)`;
    }
}