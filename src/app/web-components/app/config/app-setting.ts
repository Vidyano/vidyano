import { WebComponent } from "components/web-component/web-component"

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