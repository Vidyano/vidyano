import * as Vidyano from "../../../libs/vidyano/vidyano"
import { TemplateConfig } from "./template-config"
import { WebComponent } from "../../web-component/web-component"

@WebComponent.register({
    properties: {
        type: String
    }
})
export class QueryChartConfig extends TemplateConfig<Vidyano.QueryChart> {
    type: string;
}