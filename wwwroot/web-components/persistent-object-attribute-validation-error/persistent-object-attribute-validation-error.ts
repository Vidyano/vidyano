import * as Polymer from "../../libs/polymer/polymer"
import * as Vidyano from "../../libs/vidyano/vidyano"
import "../popup/popup"
import { WebComponent, WebComponentListener } from "../web-component/web-component"

@WebComponent.register({
    properties: {
        attribute: Object,
        hidden: {
            type: Boolean,
            computed: "_computeHidden(attribute.validationError, attribute.isReadOnly)",
            reflectToAttribute: true,
            value: true
        }
    },
    listeners: {
        "tap": "_showError"
    },
    forwardObservers: [
        "attribute.validationError",
        "attribute.isReadOnly"
    ]
})
export class PersistentObjectAttributeValidationError extends WebComponentListener(WebComponent) {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-validation-error.html">` }

    attribute: Vidyano.PersistentObjectAttribute;

    private _computeHidden(validationError: string, isReadOnly: boolean): boolean {
        return !validationError || isReadOnly;
    }

    private _showError(e: Polymer.Gestures.TapEvent) {
        e.stopPropagation();

        this.app.showMessageDialog({
            title: this.app.translateMessage(<Vidyano.NotificationType>"Error"),
            titleIcon: "Notification_Error",
            actions: [this.translations.OK],
            message: this.attribute.validationError
        });
    }
}