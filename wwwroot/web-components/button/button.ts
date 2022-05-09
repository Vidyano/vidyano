import * as Polymer from "../../libs/polymer/polymer.js"
import { WebComponent } from "../web-component/web-component.js"

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
    keybindings: {
        "space": "_fireTap",
        "enter": "_fireTap"
    },
    listeners: {
        "tap": "_tap"
    }
})
export class Button extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="button.html">`; }

    readonly customLayout: boolean; private _setCustomLayout: (custom: boolean) => void;
    disabled: boolean;
    icon: string;
    label: string;

    connectedCallback() {
        super.connectedCallback();

        if (!this.getAttribute("tabindex"))
            this.setAttribute("tabindex", "0");

        this._setCustomLayout(this.children.length > 0);
    }

    private _fireTap() {
        this.click();
    }

    private _tap(e: Polymer.Gestures.TapEvent) {
        if (this.disabled) {
            e.stopImmediatePropagation();
            e.preventDefault();
        }
    }
}