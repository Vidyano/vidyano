import * as Vidyano from "../../../libs/vidyano/vidyano.js"
import { TemplateConfig } from "./template-config.js"
import { WebComponent } from "../../web-component/web-component.js"

@WebComponent.register({
    properties: {
        name: {
            type: String,
            reflectToAttribute: true
        },
        id: {
            type: String,
            reflectToAttribute: true
        },
        type: {
            type: String,
            reflectToAttribute: true
        },
        defaultChart: {
            type: String,
            reflectToAttribute: true
        },
        fileDropAttribute: {
            type: String,
            reflectToAttribute: true
        },
        fileDropAction: {
            type: String,
            reflectToAttribute: true,
            value: "New"
        },
        hideHeader: {
            type: Boolean,
            reflectToAttribute: true
        },
        selectAll: {
            type: Boolean,
            reflectToAttribute: true
        },
        rowHeight: {
            type: Number,
            reflectToAttribute: true
        }
    }
})
export class QueryConfig extends TemplateConfig<Vidyano.Query> {
    name: string;
    id: string;
    type: string;
    defaultChart: string;
    fileDropAction: string;
    fileDropAttribute: string;
    hideHeader: boolean;
    selectAll: boolean;
    rowHeight: number;
}