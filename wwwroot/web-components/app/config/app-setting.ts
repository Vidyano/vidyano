import { WebComponent } from "../../web-component/web-component.js"

@WebComponent.register({
    properties: {
        key: String,
        value: String
    }
})
export class AppSetting extends WebComponent {
    key: string;
    value: string;

    connectedCallback() {
        super.connectedCallback();

        this.setAttribute("slot", "vi-app-config");
    }
}