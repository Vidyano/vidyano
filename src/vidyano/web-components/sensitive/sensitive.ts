import * as Polymer from "polymer"
@Polymer.WebComponent.register({
    properties: {
        disabled: {
            type: Boolean,
            reflectToAttribute: true
        },
        show: {
            type: Boolean,
            readOnly: true,
            reflectToAttribute: true
        }
    },
    listeners: {
        "tap": "_onTap"
    },
    sensitive: true
}, "vi-sensitive")
export class Sensitive extends Polymer.WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="sensitive.html">` }

    readonly show: boolean; private _setShow: (show: boolean) => void;

    private _onTap() {
        this._setShow(!this.show);
    }
}
