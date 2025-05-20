import * as Vidyano from "vidyano"
import { TemplateConfig } from "./template-config.js"
import { WebComponent } from "components/web-component/web-component.js"

@WebComponent.register({
    properties: {
        name: String
    }
})
export class ProgramUnitConfig extends TemplateConfig<Vidyano.ProgramUnit> {
    name: string;
}