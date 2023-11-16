import * as Vidyano from "../../libs/vidyano/vidyano.js"
import * as Polymer from "../../libs/polymer/polymer.js"
import "../../web-components/action-bar/action-bar.js"
import { WebComponent } from "../../web-components/web-component/web-component.js"

@WebComponent.register({
    properties: {
        accent: {
            type: Boolean,
            value: false,
            observer: "_accentChanged"
        },
        objectWithActions: Object
    }
})
export class ActionBarTest extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="action-bar-test.html">`; }

    objectWithActions: Vidyano.ServiceObjectWithActions;

    async connectedCallback() {
        super.connectedCallback();

        await this.app.initialize;

        this.objectWithActions = await this.app.service.getPersistentObject(null, "ActionBarTest");
    }

    private _accentChanged(accent: boolean) {       
        this.style.setProperty("--color", `var(--theme-${accent ? "accent-" : ""}color)`);
        this.style.setProperty("--color-light", `var(--theme-${accent ? "accent-" : ""}color-light)`);
        this.style.setProperty("--color-lighter", `var(--theme-${accent ? "accent-" : ""}color-lighter)`);
        this.style.setProperty("--color-dark", `var(--theme-${accent ? "accent-" : ""}color-dark)`);
        this.style.setProperty("--color-darker", `var(--theme-${accent ? "accent-" : ""}color-darker)`);
        this.style.setProperty("--color-faint", `var(--theme-${accent ? "accent-" : ""}color-faint)`);
        this.style.setProperty("--color-semi-faint", `var(--theme-${accent ? "accent-" : ""}color-semi-faint)`);
        this.style.setProperty("--color-rgb", `var(--theme-${accent ? "accent-" : ""}color-rgb)`);
    }
}