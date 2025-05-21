import * as Vidyano from "vidyano"
import { TemplateConfig } from "./template-config"
import { WebComponent } from "components/web-component/web-component"

@WebComponent.register({
    properties: {
        name: String
    }
})
export class ProgramUnitConfig extends TemplateConfig<Vidyano.ProgramUnit> {
    name: string;
}