import * as Vidyano from "../../../libs/vidyano/vidyano.js"
import { TemplateConfig } from "./template-config.js"
import { WebComponent } from "../../web-component/web-component.js"

@WebComponent.register({
    properties: {
        id: {
            type: String,
            reflectToAttribute: true
        },
        type: {
            type: String,
            reflectToAttribute: true
        },
        objectId: {
            type: String,
            reflectToAttribute: true
        }
    }
})
export class PersistentObjectConfig extends TemplateConfig<Vidyano.PersistentObject> {
    id: string;
    type: string;
    objectId: string;
}