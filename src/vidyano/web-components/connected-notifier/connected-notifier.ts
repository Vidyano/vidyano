import { WebComponent } from "components/web-component/web-component"

@WebComponent.register({
    properties: {
        oneTime: {
            type: Boolean,
            reflectToAttribute: true
        }
    }
}, "vi-connected-notifier")
export class ConnectedNotifier extends WebComponent {
    private _wasAttached;
    oneTime: boolean;

    connectedCallback() {
        super.connectedCallback();

        if (this._wasAttached && this.oneTime)
            return;

        this._wasAttached = true;
        this.dispatchEvent(new CustomEvent("connected", {
            detail: { id: this.id },
            bubbles: false,
            composed: true
        }));
    }
}