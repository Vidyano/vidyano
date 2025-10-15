import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
import { TemplateConfig } from "./template-config"

@Polymer.WebComponent.register({
    properties: {
        type: String
    }
}, "vi-query-chart-config")
export class QueryChartConfig extends TemplateConfig<Vidyano.QueryChart> {
    type: string;
}
