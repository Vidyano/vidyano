import * as Vidyano from "../../../libs/vidyano/vidyano.js"
import { TemplateConfig } from "./template-config.js"
import { WebComponent } from "../../web-component/web-component.js"

@WebComponent.register({
    properties: {
        type: String
    }
})
export class QueryChartConfig extends TemplateConfig<Vidyano.QueryChart> {
    type: string;
}