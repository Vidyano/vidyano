import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
import { TemplateConfig } from "./template-config"

@Polymer.WebComponent.register({
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
}, "vi-persistent-object-tab-config")
export class PersistentObjectTabConfig extends TemplateConfig<Vidyano.PersistentObjectTab> {
    id: string;
    name: string;
    type: string;
    objectId: string;
    hideActionBar: boolean;
}
