import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
import * as IconRegister from "components/icon/icon-register.js"
import "components/persistent-object-attribute-validation-error/persistent-object-attribute-validation-error.js"
import { WebComponent } from "components/web-component/web-component.js"

@WebComponent.register({
    properties: {
        attribute: Object,
        focus: {
            type: Boolean,
            readOnly: true,
            reflectToAttribute: true
        },
        hasError: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeHasError(attribute.validationError)"
        },
        reverse: {
            type: Boolean,
            reflectToAttribute: true
        },
        sensitive: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeSensitive(attribute.isSensitive, isAppSensitive)"
        },
        readOnly: {
            type: Boolean,
            computed: "attribute.isReadOnly",
            reflectToAttribute: true
        },
        hasValidationError: {
            type: Boolean,
            computed: "_computeHasValidationError(attribute.validationError, attribute.isReadOnly)"
        }
    },
    listeners: {
        "focusin": "_focus",
        "focusout": "_blur",
    },
    forwardObservers: [
        "attribute.actions",
        "attribute.isSensitive",
        "attribute.validationError",
        "attribute.parent.isFrozen",
        "attribute.isReadOnly",
        "attribute.validationError"
    ],
    sensitive: true
})
export class PersistentObjectAttributeEdit extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-edit.html">`; }

    private _setFocus: (val: boolean) => void;
    attribute: Vidyano.PersistentObjectAttribute;

    private _focus(e: Event) {
        this._setFocus(true);
    }

    private _blur(e: Event) {
        this._setFocus(false);
    }

    private _computeHasError(validationError: string): boolean {
        return !!validationError;
    }

    private _computeSensitive(isSensitive: boolean, isAppSensitive: boolean): boolean {
        return isSensitive && isAppSensitive;
    }

    private _computeHasValidationError(validationError: string, isReadOnly: boolean) {
        return validationError && !isReadOnly;
    }

    private _computeActionIcon(action: Vidyano.Action): string {
        if (!action)
            return "";

        return !IconRegister.exists(action.definition.icon) ? "Action_Default$" : action.definition.icon;
    }

    private _onActionTap(e: Polymer.Gestures.TapEvent) {
        const action = e.model.action as Vidyano.Action;
        action?.execute({
            parameters: {
                "AttributeName": this.attribute.name
            }
        });
    }
}