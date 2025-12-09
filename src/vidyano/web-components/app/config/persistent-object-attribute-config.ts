import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
import { TemplateConfig } from "./template-config"

@Polymer.WebComponent.register({
    properties: {
        type: String,
        name: String,
        noLabel: Boolean,
        parentId: String,
        parentObjectId: String,
        height: {
            type: Number,
            value: 1
        }
    }
}, "vi-persistent-object-attribute-config")
export class PersistentObjectAttributeConfig extends TemplateConfig<Vidyano.PersistentObjectAttribute> {
    height: number;
    type: string;
    name: string;
    noLabel: boolean;
    parentId: string;
    parentObjectId: string;
}
