import * as Polymer from "polymer"
@Polymer.WebComponent.register({
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
export class Config extends Polymer.WebComponent {
    key: string;

    value: string;
}
