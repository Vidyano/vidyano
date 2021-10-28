import { WebComponent } from "../../web-component/web-component.js"

@WebComponent.register({
    properties: {
        key: String,
        value: String
    },
    hostAttributes: {
        "slot": "vi-app-config"
    }
})
export class AppSetting extends WebComponent {
    key: string;
    value: string;
}