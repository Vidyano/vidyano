import * as Polymer from "../../../libs/@polymer/polymer.js"
import { WebComponent } from "../../web-component/web-component.js"

@WebComponent.register({
    properties: {
        hasTemplate: {
            type: Boolean,
            readOnly: true
        },
        as: {
            type: String,
            reflectToAttribute: true
        }
    }
})
export abstract class TemplateConfig<T> extends WebComponent {
    private __template: HTMLTemplateElement;
    readonly hasTemplate: boolean; private _setHasTemplate: (val: boolean) => void;
    as: string;
    asModel: (model: T) => any;

    constructor() {
        super();

        this.setAttribute("slot", "vi-app-config");
    }

    connectedCallback() {
        super.connectedCallback();

        this.setAttribute("slot", "vi-app-config");
        this._setHasTemplate(!!(this.__template = <HTMLTemplateElement>this.querySelector("template")));
    }

    get template() {
        return this.__template;
    }

    stamp(obj: T, as: string = this.as, asModel: (model: T) => any = this.asModel): DocumentFragment {
        if (!this.hasTemplate)
            return document.createDocumentFragment();

        const model = {};
        model[as] = !!asModel ? asModel(obj) : obj;

        const templateClass = Polymer.Templatize.templatize(this.__template);
        return new templateClass(model).root;
    }
}