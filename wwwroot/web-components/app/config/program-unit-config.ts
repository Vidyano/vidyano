import * as Vidyano from "../../../libs/vidyano/vidyano.js"
import { TemplateConfig } from "./template-config.js"
import { WebComponent } from "../../web-component/web-component.js"

@WebComponent.register({
    properties: {
        name: String
    }
})
export class ProgramUnitConfig extends TemplateConfig<Vidyano.ProgramUnit> {
    name: string;
}