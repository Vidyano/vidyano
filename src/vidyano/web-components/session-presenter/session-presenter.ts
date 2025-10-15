import * as Polymer from "polymer"
import * as Vidyano from "vidyano"

@Polymer.WebComponent.register({
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
}, "vi-session-presenter")
export class SessionPresenter extends Polymer.WebComponent {
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
