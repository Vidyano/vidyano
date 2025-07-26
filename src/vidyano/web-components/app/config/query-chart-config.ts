import * as Vidyano from "vidyano"
import { TemplateConfig } from "./template-config"
import { WebComponent } from "components/web-component/web-component"

@WebComponent.register({
    properties: {
        type: String
    }
}, "vi-query-chart-config")
export class QueryChartConfig extends TemplateConfig<Vidyano.QueryChart> {
    type: string;
}