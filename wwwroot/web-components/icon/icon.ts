import * as Polymer from "../../libs/polymer/polymer.js"
import { WebComponent } from "../web-component/web-component.js"

const icons: { [key: string]: Icon } = {};

@WebComponent.register({
    properties: {
        name: {
            type: String,
            reflectToAttribute: true
        },
        source: {
            type: String,
            observer: "_load",
            reflectToAttribute: true
        },
        unresolved: {
            type: Boolean,
            readOnly: true,
            reflectToAttribute: true,
            value: true
        }
    },
    observers: [
        "_load(source, isConnected)"
    ]
})
export class Icon extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="icon.html">`; }

    private _source: string;
    private _aliases: string[] = [];
    name: string;
    source: string;
    readonly unresolved: boolean; private _setUnresolved: (unresolved: boolean) => void;

    get aliases(): string[] {
        return this._aliases;
    }

    addAlias(...alias: string[]) {
        this._aliases.push(...alias);
    }

    private _load(source: string, isConnected: boolean) {
        if (isConnected === undefined || source === undefined)
            return;

        if (this._source === source)
            return;

        if (this.$.svgHost.children.length > 0)
            this.$.svgHost.innerHTML = "";

        const resource = Icon.Load(this._source = source);
        this._setUnresolved(!resource);
        if (this.unresolved)
            return;

        Array.from(resource.children).forEach((child: HTMLElement) => {
            this.$.svgHost.appendChild(child.cloneNode(true));
        });

        this.$.svgHost.querySelectorAll("svg").forEach(svg => svg.setAttribute("part", "svg"));
    }

    static Load(name: string): Icon {
        return icons[name] || icons[Object.keys(icons).find(key => !!icons[key].aliases && icons[key].aliases.some(a => a === name))];
    }

    static Exists(name: string): boolean {
        return !!Icon.Load(name);
    }

    static Add(strings: TemplateStringsArray);
    static Add(template: HTMLTemplateElement);
    static Add(stringOrTemplate: HTMLTemplateElement | TemplateStringsArray) {
        if (Array.isArray(stringOrTemplate))
            stringOrTemplate = Polymer.html(<TemplateStringsArray>stringOrTemplate);

        Array.from((<HTMLTemplateElement>stringOrTemplate).content.querySelectorAll("vi-icon")).forEach((icon: Icon) => {
            document.body.appendChild(icon);
            icons[icon.name] = icon;
            document.body.removeChild(icon);
        });
    }
}

Icon.Add(Polymer.html`<link rel="import" href="icons.html">`);