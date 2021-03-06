import * as Polymer from "../../libs/polymer/polymer.js"
import { WebComponent } from "../web-component/web-component.js"

@WebComponent.register({
    properties: {
        toggled: {
            type: Boolean,
            reflectToAttribute: true,
            notify: true
        },
        label: {
            type: String,
            value: null
        },
        isNull: {
            type: Boolean,
            value: true,
            computed: "_computeIsNull(toggled)"
        },
        disabled: {
            type: Boolean,
            reflectToAttribute: true
        }
    },
    listeners: {
        "tap": "toggle"
    },
    keybindings: {
        "space": "_keyToggle"
    }
})
export class Toggle extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="toggle.html">`; }

    toggled: boolean;
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

        this.toggled = !this.toggled;
    }

    private _keyToggle(e: KeyboardEvent) {
        if (this.app.activeElement !== this)
            return true;

        this.toggle();
    }

    private _computeIsNull(toggled: boolean): boolean {
        return toggled !== false && toggled !== true;
    }
}