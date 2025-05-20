import * as Vidyano from "vidyano"
import { TemplateConfig } from "./template-config.js"
import { WebComponent } from "components/web-component/web-component.js"

@WebComponent.register({
    properties: {
        id: String,
        name: String,
        type: String,
        objectId: String,
        hideActionBar: {
            type: Boolean,
            reflectToAttribute: true
        }
    }
})
export class PersistentObjectTabConfig extends TemplateConfig<Vidyano.PersistentObjectTab> {
    id: string;
    name: string;
    type: string;
    objectId: string;
    hideActionBar: boolean;
}