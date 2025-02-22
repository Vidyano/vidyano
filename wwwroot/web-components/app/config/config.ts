import { WebComponent } from "../../web-component/web-component.js"

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
})
export class Config extends WebComponent {
    key: string;

    value: string;
}