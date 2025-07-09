import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
import { WebComponent } from "components/web-component/web-component"

@WebComponent.register({
    properties: {
        attribute: Object,
        editing: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeEditing(attribute.parent.isEditing, nonEdit)"
        },
        nonEdit: {
            type: Boolean,
            reflectToAttribute: true,
            value: false
        },
        hasToolTip: {
            type: Boolean,
            computed: "_computeHasToolTip(attribute.toolTip)"
        },
        required: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeRequired(attribute, attribute.isRequired, attribute.value)"
        },
        disabled: {
            type: Boolean,
            reflectToAttribute: true,
            value: false
        },
        readOnly: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeReadOnly(attribute.isReadOnly, disabled)"
        },
        bulkEdit: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "attribute.parent.isBulkEdit"
        },
        hasError: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeHasError(attribute.validationError)"
        }
    },
    forwardObservers: [
        "attribute.parent.isEditing",
        "attribute.isRequired",
        "attribute.isReadOnly",
        "attribute.value",
        "attribute.validationError",
        "attribute.parent.isBulkEdit",
        "attribute.label",
        "attribute.toolTip",
    ]
}, "vi-persistent-object-attribute-label")
export class PersistentObjectAttributeLabel extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-label.html">`; }

    attribute: Vidyano.PersistentObjectAttribute;

    private _computeRequired(attribute: Vidyano.PersistentObjectAttribute, required: boolean, value: any): boolean {
        return required && (value == null || (attribute && attribute.rules && attribute.rules.contains("NotEmpty") && value === ""));
    }

    private _computeReadOnly(isReadOnly: boolean, disabled: boolean): boolean {
        return isReadOnly || disabled;
    }

    private _computeEditing(isEditing: boolean, nonEdit: boolean): boolean {
        return !nonEdit && isEditing;
    }

    private _computeHasError(validationError: string): boolean {
        return !String.isNullOrEmpty(validationError);
    }

    private _computeHasToolTip(toolTip: string): boolean {
        return !!toolTip;
    }

    private _showTooltip(e: Polymer.Gestures.TapEvent) {
        this.app.showMessageDialog({
            title: this.attribute.label,
            titleIcon: "Info",
            rich: true,
            message: this.attribute.toolTip,
            actions: [this.translateMessage("OK")]
        });
    }
}