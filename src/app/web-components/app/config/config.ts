import { WebComponent } from "components/web-component/web-component"

@WebComponent.register({
    properties: {
        key: {
            type: String,
            reflectToAttribute: true
        },
        value: {
            type: String,
            reflectToAttribute: true
        }
    }
}, "vi-config")
export class Config extends WebComponent {
    key: string;

    value: string;
}