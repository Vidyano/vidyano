import * as Vidyano from "../../../libs/vidyano/vidyano"
import { TemplateConfig } from "./template-config"
import { WebComponent } from "../../web-component/web-component"

@WebComponent.register({
    properties: {
        name: String
    }
})
export class ProgramUnitConfig extends TemplateConfig<Vidyano.ProgramUnit> {
    name: string;
}