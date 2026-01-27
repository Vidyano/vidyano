import * as Polymer from "polymer"
@Polymer.WebComponent.register({
    properties: {
        key: String,
        value: String
    }
}, "vi-app-setting")
export class AppSetting extends Polymer.WebComponent {
    key: string;
    value: string;

    connectedCallback() {
        super.connectedCallback();

        this.setAttribute("slot", "vi-app-config");
    }
}
