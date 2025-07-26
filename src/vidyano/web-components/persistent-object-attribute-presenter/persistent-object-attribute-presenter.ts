import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
import { Observable, ISubjectDisposer } from "vidyano"
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute"
import "components/persistent-object-attribute/attributes/persistent-object-attribute-as-detail/persistent-object-attribute-as-detail"
import "components/persistent-object-attribute/attributes/persistent-object-attribute-binary-file/persistent-object-attribute-binary-file"
import "components/persistent-object-attribute/attributes/persistent-object-attribute-boolean/persistent-object-attribute-boolean"
import "components/persistent-object-attribute/attributes/persistent-object-attribute-combo-box/persistent-object-attribute-combo-box"
import "components/persistent-object-attribute/attributes/persistent-object-attribute-common-mark/persistent-object-attribute-common-mark"
import "components/persistent-object-attribute/attributes/persistent-object-attribute-date-time/persistent-object-attribute-date-time"
import "components/persistent-object-attribute/attributes/persistent-object-attribute-drop-down/persistent-object-attribute-drop-down"
import "components/persistent-object-attribute/attributes/persistent-object-attribute-flags-enum/persistent-object-attribute-flags-enum"
import "components/persistent-object-attribute/attributes/persistent-object-attribute-icon/persistent-object-attribute-icon"
import "components/persistent-object-attribute/attributes/persistent-object-attribute-image/persistent-object-attribute-image"
import "components/persistent-object-attribute/attributes/persistent-object-attribute-key-value-list/persistent-object-attribute-key-value-list"
import "components/persistent-object-attribute/attributes/persistent-object-attribute-multi-line-string/persistent-object-attribute-multi-line-string"
import "components/persistent-object-attribute/attributes/persistent-object-attribute-multi-string/persistent-object-attribute-multi-string"
import "components/persistent-object-attribute/attributes/persistent-object-attribute-nullable-boolean/persistent-object-attribute-nullable-boolean"
import "components/persistent-object-attribute/attributes/persistent-object-attribute-numeric/persistent-object-attribute-numeric"
import "components/persistent-object-attribute/attributes/persistent-object-attribute-password/persistent-object-attribute-password"
import "components/persistent-object-attribute/attributes/persistent-object-attribute-reference/persistent-object-attribute-reference"
import { PersistentObjectAttributeString } from "components/persistent-object-attribute/attributes/persistent-object-attribute-string/persistent-object-attribute-string"
import "components/persistent-object-attribute/attributes/persistent-object-attribute-translated-string/persistent-object-attribute-translated-string"
import "components/persistent-object-attribute/attributes/persistent-object-attribute-user/persistent-object-attribute-user"
import { PersistentObjectAttributeConfig } from '../app/config/persistent-object-attribute-config.js'
import "components/persistent-object-attribute-label/persistent-object-attribute-label"
import { ConfigurableWebComponent } from "components/web-component/web-component-configurable"

class DeveloperShortcut extends Observable<DeveloperShortcut> {
    private _state: boolean = false;

    get state(): boolean {
        return this._state;
    }

    set state(state: boolean) {
        if (state === this._state)
            return;

        const oldState = this._state;
        this.notifyPropertyChanged("state", this._state = state, oldState);
    }
}

const developerShortcut = new DeveloperShortcut();
document.addEventListener("keydown", e => {
    developerShortcut.state = e.ctrlKey && e.altKey;
});

document.addEventListener("keyup", e => {
    developerShortcut.state = e.ctrlKey && e.altKey;
});

@ConfigurableWebComponent.register({
    properties: {
        attribute: Object,
        name: {
            type: String,
            computed: "attribute.name",
            reflectToAttribute: true
        },
        type: {
            type: String,
            computed: "attribute.type",
            reflectToAttribute: true
        },
        noLabel: {
            type: Boolean,
            reflectToAttribute: true,
            value: false
        },
        editing: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeEditing(attribute.parent.isEditing, nonEdit)"
        },
        nonEdit: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeNonEdit(attribute)",
            observer: "_nonEditChanged"
        },
        required: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeRequired(attribute, attribute.isRequired, attribute.value)"
        },
        disabled: {
            type: Boolean,
            reflectToAttribute: true,
            value: false,
            observer: "_disabledChanged"
        },
        readOnly: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeReadOnly(attribute.isReadOnly, attribute.parent.isFrozen, disabled)"
        },
        bulkEdit: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "attribute.parent.isBulkEdit"
        },
        loading: {
            type: Boolean,
            reflectToAttribute: true,
            readOnly: true,
            value: true,
            observer: "_loadingChanged"
        },
        height: {
            type: Number,
            reflectToAttribute: true,
            value: null
        },
        hidden: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "!attribute.isVisible"
        },
        hasError: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeHasError(attribute.validationError)"
        },
        hasValue: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeHasValue(attribute.value)"
        },
        developer: {
            type: Boolean,
            reflectToAttribute: true
        },
        gridArea: {
            type: String,
            reflectToAttribute: true,
            observer: "_gridAreaChanged"
        }
    },
    listeners: {
        "tap": "_onTap",
        "vi:configure": "_configure"
    },
    observers: [
        "_attributeChanged(attribute, isConnected)",
        "_updateRowSpan(attribute, height, isConnected)"
    ],
    forwardObservers: [
        "attribute.parent.isEditing",
        "attribute.parent.isFrozen",
        "attribute.isRequired",
        "attribute.isReadOnly",
        "attribute.isVisible",
        "attribute.value",
        "attribute.isValueChanged",
        "attribute.validationError",
        "attribute.parent.isBulkEdit"
    ]
}, "vi-persistent-object-attribute-presenter")
export class PersistentObjectAttributePresenter extends ConfigurableWebComponent {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-presenter.html">`; }

    private _developerToggleDisposer: ISubjectDisposer;
    private _renderedAttribute: Vidyano.PersistentObjectAttribute;
    private _renderedAttributeElement: PersistentObjectAttribute;
    private _focusQueued: boolean;
    private _customTemplate: new (p0?: object) => Polymer.Templatize.TemplateInstanceBase;
    readonly loading: boolean; private _setLoading: (loading: boolean) => void;
    attribute: Vidyano.PersistentObjectAttribute;
    editing: boolean;
    nonEdit: boolean;
    noLabel: boolean;
    disabled: boolean;
    readOnly: boolean;
    readonly name: string;
    readonly type: string;

    async connectedCallback() {
        super.connectedCallback();

        const customTemplate = <HTMLTemplateElement><any>this.querySelector("template");
        if (customTemplate) {
            this._customTemplate = Polymer.Templatize.templatize(customTemplate);
        }

        if (this.service && this.service.application && this.service.application.hasManagement)
            this._developerToggleDisposer = developerShortcut.propertyChanged.attach(this._devToggle.bind(this));
    }

    disconnectedCallback() {
        if (this._developerToggleDisposer) {
            this._developerToggleDisposer();
            this._developerToggleDisposer = null;
        }

        super.disconnectedCallback();
    }

    private _onTap(e: Polymer.Gestures.TapEvent) {
        if (this.editing && typeof this._renderedAttributeElement?.focus === "function") {
            const currentActiveElement = this.app.activeElement;
            this._renderedAttributeElement.focus();

            if (currentActiveElement !== this.app.activeElement) {
                e.preventDefault();
                e.stopPropagation();
            }
        }
    }

    private _devToggle() {
        this.set("developer", !this.attribute.parent.isSystem && developerShortcut.state);
    }

    queueFocus() {
        const activeElement = document.activeElement;
        this._focusElement(this);

        if (activeElement !== document.activeElement)
            this._focusQueued = true;
    }

    private _attributeChanged(attribute: Vidyano.PersistentObjectAttribute, isConnected: boolean) {
        if (this._renderedAttribute === attribute)
            return;

        if (this._renderedAttribute) {
            Array.from(this.children).forEach(c => this.removeChild(c));
            this._renderedAttributeElement = this._renderedAttribute = null;
        }

        if (!attribute || !isConnected)
            return;

        this._setLoading(true);

        const nolabel = attribute.getTypeHint("nolabel", undefined, undefined);
        if (nolabel !== undefined)
            this.noLabel = nolabel === "true";

        let attributeType: string;
        if (Vidyano.DataType.isNumericType(attribute.type))
            attributeType = "Numeric";
        else if (Vidyano.DataType.isDateTimeType(attribute.type))
            attributeType = "DateTime";
        else if (attribute.parent.isBulkEdit && (attribute.type === "YesNo" || attribute.type === "Boolean"))
            attributeType = "NullableBoolean";
        else {
            switch (attribute.type) {
                case "YesNo":
                    attributeType = "Boolean";
                    break;

                case "Enum":
                    attributeType = "DropDown";
                    break;

                case "Guid":
                case "NullableGuid":
                    attributeType = "String";
                    break;

                case "NullableUser":
                    attributeType = "User";
                    break;

                default:
                    attributeType = attribute.type;
            }
        }

        this._renderAttribute(attribute, attributeType);
    }

    private async _renderAttribute(attribute: Vidyano.PersistentObjectAttribute, attributeType: string) {
        if (!this.isConnected || attribute !== this.attribute || this._renderedAttribute === attribute)
            return;

        let focusTarget: HTMLElement;
        try {
            if (this._customTemplate) {
                const templateInstance = new this._customTemplate({ attribute: attribute });
                (focusTarget = this.$.content).appendChild(templateInstance.root);
            }
            else {
                const config = <PersistentObjectAttributeConfig>this.app.configuration.getAttributeConfig(attribute);
                this.noLabel = this.noLabel || (config && !!config.noLabel);

                if (!!config && config.hasTemplate)
                    this.appendChild(config.stamp(attribute, config.as || "attribute"));
                else {
                    this._renderedAttributeElement = <PersistentObjectAttribute>new (PersistentObjectAttribute.getAttributeConstructor(attributeType) ?? PersistentObjectAttributeString)();
                    this._renderedAttributeElement.classList.add("attribute");
                    this._renderedAttributeElement.attribute = attribute;
                    this._renderedAttributeElement.nonEdit = this.nonEdit;
                    this._renderedAttributeElement.disabled = this.disabled;

                    this.appendChild(focusTarget = this._renderedAttributeElement);
                }
            }

            this._renderedAttribute = attribute;
        }
        finally {
            this._setLoading(false);

            if (this._focusQueued) {
                Polymer.flush();

                this._focusElement(focusTarget);
                this._focusQueued = false;
            }
        }
    }

    private _updateRowSpan(attribute: Vidyano.PersistentObjectAttribute, height: number, isConnected: boolean) {
        if (!isConnected)
            return;

        height = height || this.app.configuration.getAttributeConfig(attribute).calculateHeight(attribute);
        if (height > 0)
            this.style.setProperty("--vi-persistent-object-attribute-presenter--row-span", `${height}`);
        else
            this.style.removeProperty("--vi-persistent-object-attribute-presenter--row-span");
    }

    private _computeEditing(isEditing: boolean, nonEdit: boolean): boolean {
        return !nonEdit && isEditing;
    }

    private _computeNonEdit(attribute: Vidyano.PersistentObjectAttribute) {
        return attribute?.getTypeHint("nonedit", "false", undefined) === "true";
    }

    private _nonEditChanged(nonEdit: boolean) {
        if (this._renderedAttributeElement)
            this._renderedAttributeElement.nonEdit = nonEdit;
    }

    private _disabledChanged(disabled: boolean) {
        if (!this._renderedAttributeElement)
            return;

        this._renderedAttributeElement.disabled = disabled;
    }

    private _computeRequired(attribute: Vidyano.PersistentObjectAttribute, required: boolean, value: any): boolean {
        return required && (value == null || (attribute && attribute.rules && attribute.rules.contains("NotEmpty") && value === ""));
    }

    private _computeReadOnly(isReadOnly: boolean, isFrozen: boolean, disabled: boolean): boolean {
        return isReadOnly || disabled || isFrozen;
    }

    private _computeHasError(validationError: string): boolean {
        return !String.isNullOrEmpty(validationError);
    }

    private _computeHasValue(value: any): boolean {
        return value != null && value !== "";
    }

    private _loadingChanged(loading: boolean) {
        this.fire(loading ? "attribute-loading" : "attribute-loaded", { attribute: this.attribute }, { bubbles: true });
    }

    private _openAttributeManagement() {
        this.app.changePath(`Management/PersistentObject.1456569d-e02b-44b3-9d1a-a1e417061c77/${this.attribute.id}`);
    }

    private _configure(e: CustomEvent) {
        if (this.attribute.parent.isSystem)
            return;

        e.detail.push({
            label: `Attribute: ${this.attribute.name}`,
            icon: "viConfigure",
            action: this._openAttributeManagement.bind(this)
        });
    }

    private _gridAreaChanged(gridArea: string) {
        this.style.gridArea = gridArea;
    }
}