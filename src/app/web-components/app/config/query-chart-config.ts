import * as Vidyano from "vidyano"
import { TemplateConfig } from "./template-config.js"
import { WebComponent } from "components/web-component/web-component.js"

@WebComponent.register({
    properties: {
        type: String
    }
})
export class QueryChartConfig extends TemplateConfig<Vidyano.QueryChart> {
    type: string;
}