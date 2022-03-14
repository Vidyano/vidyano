import * as Vidyano from "../../../libs/vidyano/vidyano"
import { TemplateConfig } from "./template-config"
import { WebComponent } from "../../web-component/web-component"

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