import * as Polymer from "../../libs/polymer/polymer.js"
import * as Vidyano from "../../libs/vidyano/vidyano.js"
import { WebComponent } from "../web-component/web-component.js"

@WebComponent.register({
    properties: {
        session: {
            type: Object,
            computed: "service.application.session"
        }
    },
    forwardObservers: [
        "service.application.session"
    ],
    observers: [
        "_stamp(session, isConnected)"
    ]
})
export class SessionPresenter extends WebComponent {
    static get template() { return Polymer.html`<slot></slot>` }

    private _stampedTemplate: Polymer.Templatize.TemplateInstanceBase;

    private _stamp(session: Vidyano.PersistentObject, isConnected: boolean) {
        if (!isConnected)
            return;

        const template = this.querySelector("template");
        if (!template) {
            console.error("SessionPresenter expects a template child");
            return;
        }

        if (!this._stampedTemplate) {
            const templateClass = Polymer.Templatize.templatize(template);
            this._stampedTemplate = new templateClass({
                "session": session
            });

            this.appendChild(this._stampedTemplate.root);
        }
        else
            this._stampedTemplate.set("session", session);
    }
}