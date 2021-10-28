import * as Polymer from "../../libs/@polymer/polymer.js"
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
            reflectToAttribute: true
        }
    },
    observers: [
        "_load(source, isConnected)"
    ]
})
export class Icon extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="icon.html">`; }

    private _iconStyle: HTMLStyleElement;
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

        if (isConnected) {
            if (!source && this._iconStyle !== undefined) {
                Array.from(this.$.svgHost.children).forEach(c => {
                    if (c === this._iconStyle)
                        return;

                    this.$.svgHost.removeChild(c);
                });
            }

            if (this._source === source)
                return;
        }

        const resource = Icon.Load(this._source = source);
        this._setUnresolved(!resource);
        if (this.unresolved)
            return;

        if (!this._iconStyle)
            this._iconStyle = this.shadowRoot.querySelector("style");

        Array.from(resource.children).forEach((child: HTMLElement) => {
            this.$.svgHost.appendChild(child.cloneNode(true));
        });
    }

    static Load(name: string): Icon {
        return icons[name] || icons[Object.keys(icons).find(key => !!icons[key].aliases && icons[key].aliases.some(a => a === name))];
    }

    static Exists(name: string): boolean {
        return !!Icon.Load(name);
    }

    static Add(template: HTMLTemplateElement) {
        Array.from(template.content.querySelectorAll("vi-icon")).forEach((icon: Icon) => {
            document.body.appendChild(icon);
            icons[icon.name] = icon;
            document.body.removeChild(icon);
        });
    }
}

Icon.Add(Polymer.html`<link rel="import" href="icons.html">`);