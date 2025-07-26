import * as Polymer from "polymer"
import { WebComponent } from "components/web-component/web-component"
import * as IconRegister from "./icon-register"

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
}, "vi-icon")
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

    private async _load(source: string, isConnected: boolean) {
        if (isConnected === undefined || source === undefined)
            return;

        if (this._source === source)
            return;

        if (this.$.svgHost.children.length > 0)
            this.$.svgHost.innerHTML = "";

        this._source = source;
        
        let resource: Icon;
        if (!source || source.indexOf(":") < 0) {
            // For local icons, use the synchronous load.
            resource = IconRegister.load(source);
        } else {
            // For Iconify sources, use fetchIcon.
            resource = await IconRegister.fetchIcon(source);
        }

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