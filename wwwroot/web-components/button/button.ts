import * as Polymer from "../../libs/@polymer/polymer.js"
import { WebComponent, WebComponentListener } from "../web-component/web-component.js";

@WebComponent.register({
    properties: {
        disabled: {
            type: Boolean,
            reflectToAttribute: true
        },
        inverse: {
            type: String,
            reflectToAttribute: true
        },
        customLayout: {
            type: Boolean,
            readOnly: true,
            reflectToAttribute: true
        },
        elevation: {
            type: Number,
            reflectToAttribute: true
        },
        icon: String,
        label: String,
        busy: {
            type: Boolean,
            reflectToAttribute: true
        }
    },
    listeners: {
        "tap": "_tap"
    }
})
export class Button extends WebComponentListener(WebComponent) {
    static get template() { return Polymer.html`<link rel="import" href="button.html">`; }

    readonly customLayout: boolean; private _setCustomLayout: (custom: boolean) => void;
    disabled: boolean;

    connectedCallback() {
        super.connectedCallback();

        this._setCustomLayout(this.children.length > 0);
    }

    private _tap(e: Polymer.Gestures.TapEvent) {
        if (this.disabled) {
            e.stopImmediatePropagation();
            e.preventDefault();
        }
    }
}