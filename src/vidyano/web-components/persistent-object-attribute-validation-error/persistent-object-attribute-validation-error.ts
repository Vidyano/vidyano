import { html } from "@polymer/polymer"
import * as Gestures from "@polymer/polymer/lib/utils/gestures"
import { WebComponent } from "components/web-component/polymer/web-component"
import * as Vidyano from "vidyano"
import "components/popup/popup"

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
}, "vi-persistent-object-attribute-validation-error")
export class PersistentObjectAttributeValidationError extends WebComponent {
    static get template() { return html`<link rel="import" href="persistent-object-attribute-validation-error.html">` }

    attribute: Vidyano.PersistentObjectAttribute;

    private _computeHidden(validationError: string, isReadOnly: boolean): boolean {
        return !validationError || isReadOnly;
    }

    private _showError(e: Gestures.TapEvent) {
        e.stopPropagation();

        this.app.showMessageDialog({
            title: this.app.translateMessage(<Vidyano.NotificationType>"Error"),
            titleIcon: "Notification_Error",
            actions: [this.translations.OK],
            message: this.attribute.validationError
        });
    }
}
