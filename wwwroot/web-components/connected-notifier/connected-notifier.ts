import { WebComponent } from "../web-component/web-component";

@WebComponent.register({
    properties: {
        oneTime: {
            type: Boolean,
            reflectToAttribute: true
        }
    }
})
export class ConnectedNotifier extends WebComponent {
    private _wasAttached;
    oneTime: boolean;

    connectedCallback() {
        super.connectedCallback();

        if (this._wasAttached && this.oneTime)
            return;

        this._wasAttached = true;
        this.fire("connected", { id: this.id }, {
            node: this,
            bubbles: false
        });
    }
}