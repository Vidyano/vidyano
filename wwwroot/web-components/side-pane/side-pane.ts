import * as Polymer from "../../libs/polymer/polymer.js"
import { App } from "../app/app.js"
import { WebComponent } from "../web-component/web-component.js"

class SidePaneCore extends Polymer.mixinBehaviors(Polymer.IronOverlayBehavior, Polymer.PolymerElement) {
    static get template() { return Polymer.html`<link rel="import" href="side-pane-core.html">`; }
}

customElements.define("vi-side-pane-core", <CustomElementConstructor><any>SidePaneCore);

@WebComponent.register({
    properties: {
        withBackdrop: {
            type: Boolean,
            reflectToAttribute: true,
            value: true
        }
    },
    listeners: {
        "iron-overlay-canceled": "_onCancel"
    },
    mediaQueryAttributes: true
})
export abstract class SidePane extends WebComponent {
    static sidePaneTemplate(sidePane: HTMLTemplateElement) {
        const template = Polymer.html`<link rel="import" href="side-pane.html">`;
        const sidePaneCore = template.content.querySelector("vi-side-pane-core") as SidePaneCore;
        sidePaneCore.appendChild(sidePane.content.cloneNode(true));

        return template;
    }

    private _resolve: Function;

    connectedCallback() {
        super.connectedCallback();

        this.sidePaneCore.positionTarget = this.app;
    }

    private get sidePaneCore() {
        return this.shadowRoot.querySelector("vi-side-pane-core") as (Polymer.IronOverlayBehavior & Polymer.PolymerElement);
    }

    async open() {
        document.body.style.setProperty("--iron-overlay-backdrop-opacity", ".3");
        this.sidePaneCore.open();
        this.sidePaneCore.animate([
            { transform: "translateX(0)" }
        ], {
            duration: 500,
            fill: "forwards",
            easing: "cubic-bezier(0.215, 0.610, 0.355, 1.000)"
        });

        return new Promise(resolve => {
            this._resolve = result => {
                requestAnimationFrame(() => {
                    this.sidePaneCore.animate([
                        { transform: "translateX(calc(100% + 10px))" }
                    ], {
                        duration: 500,
                        fill: "forwards",
                        easing: "cubic-bezier(0.190, 1.000, 0.220, 1.000)"
                    }).finished.then(() => {
                        if (this.sidePaneCore.opened)
                            this.sidePaneCore.close();

                        resolve(result);
                    });
                });
            };
        });
    }

    close(result?: any) {
        this._resolve(result);
    }

    private _onCancel() {
        this._resolve(undefined);
    }

    private _computeWithBackdrop(withBackdrop: boolean, isPhone: boolean) {
        return withBackdrop && !isPhone;
    }
}