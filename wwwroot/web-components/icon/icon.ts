import * as Polymer from "../../libs/polymer/polymer.js"
import { WebComponent } from "../web-component/web-component.js"
import * as IconRegister from "./icon-register.js"

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

    connectedCallback() {
        super.connectedCallback();

        if (this.name && !IconRegister.exists(this.name))
            IconRegister.add(this);
    }

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

        const resource = IconRegister.load(this._source = source);
        this._setUnresolved(!resource);
        if (this.unresolved)
            return;

        Array.from(resource.children).forEach((child: HTMLElement) => {
            this.$.svgHost.appendChild(child.cloneNode(true));
        });

        this.$.svgHost.querySelectorAll("svg").forEach(svg => svg.setAttribute("part", "svg"));
    }
}

IconRegister.add(Polymer.html`<link rel="import" href="icons.html">`);