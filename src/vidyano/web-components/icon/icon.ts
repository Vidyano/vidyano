import { html, unsafeCSS } from "lit";
import { property } from "lit/decorators.js";
import { WebComponent, observer } from "components/web-component/web-component.js";
import * as IconRegister from "./icon-register"
import styles from "./icon.css";
import { iconsTemplate } from "./icons";

export class Icon extends WebComponent {
    static styles = unsafeCSS(styles);

    @property({ type: String, reflect: true })
    name: string;

    @property({ type: String, reflect: true })
    source: string;

    @property({ type: Boolean, reflect: true })
    unresolved: boolean = true;

    #loadedSource: string;
    #aliases: string[] = [];

    connectedCallback() {
        super.connectedCallback();

        if (this.name && !IconRegister.exists(this.name))
            IconRegister.add(this);
    }

    get aliases(): string[] {
        return this.#aliases;
    }

    addAlias(...alias: string[]) {
        this.#aliases.push(...alias);
    }

    render() {
        return html`<div id="svgHost"></div>`;
    }

    @observer("source", "isConnected")
    private async _load(source: string, isConnected: boolean) {
        if (isConnected === undefined || source === undefined)
            return;

        if (this.#loadedSource === source)
            return;

        await this.updateComplete;

        const svgHost = this.shadowRoot?.getElementById("svgHost");
        if (!svgHost)
            return;

        if (svgHost.children.length > 0)
            svgHost.innerHTML = "";

        this.#loadedSource = source;

        let resource: Icon;
        if (!source || source.indexOf(":") < 0) {
            resource = IconRegister.load(source);
            this.unresolved = !resource;
        } else {
            this.unresolved = false;
            resource = await IconRegister.fetchIcon(source);
        }

        if (!resource)
            return;

        Array.from(resource.children).forEach((child: HTMLElement) => {
            svgHost.appendChild(child.cloneNode(true));
        });

        svgHost.querySelectorAll("svg").forEach(svg => svg.setAttribute("part", "svg"));
    }
}

customElements.define("vi-icon", Icon);

// Register all icon definitions from the template
IconRegister.add(iconsTemplate);
