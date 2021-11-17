import * as Polymer from "../../libs/@polymer/polymer.js"
import { WebComponent, WebComponentListener } from "../web-component/web-component.js"

@WebComponent.register({
    properties: {
        checked: {
            type: Boolean,
            reflectToAttribute: true,
            notify: true
        },
        label: {
            type: String,
            value: null
        },
        noLabel: {
            type: Boolean,
            computed: "_computeNoLabel(label)"
        },
        isNull: {
            type: Boolean,
            value: true,
            computed: "_computeIsNull(checked)"
        },
        disabled: {
            type: Boolean,
            reflectToAttribute: true
        },
        radio: {
            type: Boolean,
            reflectToAttribute: true,
            value: false
        },
        icon: {
            type: String,
            computed: "_computeIcon(radio)"
        }
    },
    listeners: {
        "tap": "toggle"
    },
    keybindings: {
        "space": "_keyToggle",
        "enter": "_keyToggle"
    }
})
export class Checkbox extends WebComponentListener(WebComponent) {
    static get template() { return Polymer.html`<link rel="import" href="checkbox.html">`; }

    checked: boolean;
    label: string;
    disabled: boolean;
    radio: boolean;

    connectedCallback() {
        super.connectedCallback();

        this.setAttribute("tabindex", "0");
    }

    toggle() {
        if (this.disabled)
            return;

        if (!this.radio)
            this.checked = !this.checked;
        else
            this.fire("changed", null);
    }

    private _keyToggle(e: KeyboardEvent) {
        if (document.activeElement !== this)
            return true;

        this.toggle();
    }

    private _computeIsNull(checked: boolean): boolean {
        return checked !== false && checked !== true;
    }

    private _computeIcon(radio: boolean): string {
        return !radio ? "Selected" : "SelectedRadio";
    }

    private _computeNoLabel(label: string): boolean {
        return !label;
    }
}