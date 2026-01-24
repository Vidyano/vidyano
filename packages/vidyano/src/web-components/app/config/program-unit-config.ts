import * as Polymer from "polymer"
import * as Vidyano from "@vidyano/core"
import { TemplateConfig } from "./template-config"
@Polymer.WebComponent.register({
    properties: {
        name: String
    }
}, "vi-program-unit-config")
export class ProgramUnitConfig extends TemplateConfig<Vidyano.ProgramUnit> {
    name: string;
}
