import * as Polymer from "../../libs/polymer/polymer.js"
import { App } from "../app/app.js"
import { WebComponent } from "../web-component/web-component.js"

class SidePaneCore extends Polymer.mixinBehaviors(Polymer.IronOverlayBehavior, Polymer.PolymerElement) {
    static get template() { return Polymer.html`<link rel="import" href="side-pane-core.html">`; }

    private async _openedChanged(value: boolean, oldValue: boolean) {
        if (typeof oldValue === "boolean") {
            if (value) {
                this.animate([
                    { transform: "translateX(0)" }
                ], {
                    duration: 300,
                    fill: "forwards",
                    easing: "cubic-bezier(0.215, 0.610, 0.355, 1.000)"
                });
            }
            else {
                await new Promise(done => {
                    requestAnimationFrame(() => {
                        this.animate([
                            { transform: "translateX(calc(100% + 10px))" }
                        ], {
                            duration: 300,
                            fill: "forwards",
                            easing: "cubic-bezier(0.190, 1.000, 0.220, 1.000)"
                        }).finished.then(done);
                    });
                });
            }
        }

        Polymer.IronOverlayBehaviorImpl["_openedChanged"].apply(this, arguments);
    }
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
        "iron-overlay-closed": "_onClosed",
        "iron-overlay-canceled": "cancel"
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

    private get sidePaneCore() {
        return this.shadowRoot.querySelector("vi-side-pane-core") as (Polymer.IronOverlayBehavior & Polymer.PolymerElement);
    }

    async open() {
        document.body.style.setProperty("--iron-overlay-backdrop-opacity", ".3");
        this.sidePaneCore.open();

        return new Promise(resolve => {
            this._resolve = resolve;
        });
    }

    close(result?: any) {
        this._resolve(result);
    }

    cancel() {
        this.sidePaneCore.close();
    }

    private _onClosed() {
        this._resolve();
    }

    private _computeWithBackdrop(withBackdrop: boolean, isPhone: boolean) {
        return withBackdrop && !isPhone;
    }
}