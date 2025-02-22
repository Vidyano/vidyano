import * as Polymer from "../../../libs/polymer/polymer.js"
import { WebComponent } from "../../web-component/web-component.js"
import "./config.js"
import { Config } from "./config.js"

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
    #configs: Record<string, string> = {};
    #configObserver: MutationObserver;

    constructor() {
        super();

        this.setAttribute("slot", "vi-app-config");
    }

    connectedCallback() {
        super.connectedCallback();

        this.setAttribute("slot", "vi-app-config");
        this._setHasTemplate(!!(this.__template = <HTMLTemplateElement>this.querySelector("template")));

        // Get all the vi-config elements
        this.#configs = Array.from(this.querySelectorAll<Config>("vi-config")).reduce((configs, config) => {
            // Add the vi-config element to the configs object
            configs[config.key] = config.value;

            return configs;
        }, {});

        // Add a mutation observer to the vi-config elements
        this.#configObserver = new MutationObserver(mutations => {
            // For each mutation
            mutations.forEach(mutation => {
                // If the mutation is an attribute change
                if (mutation.type === "attributes") {
                    // Get the vi-config element
                    const config = mutation.target as Config;

                    // Update the config object
                    this.configs[config.key] = config.value;
                }
            });
        });
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();

        // Disconnect the mutation observer
        this.#configObserver.disconnect();
    }

    get configs() {
        return this.#configs;
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