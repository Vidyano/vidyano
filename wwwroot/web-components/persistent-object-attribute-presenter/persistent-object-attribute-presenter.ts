import * as Polymer from '../../libs/@polymer/polymer.js';
import * as Vidyano from "../../libs/vidyano/vidyano.js"
import { Observable, ISubjectDisposer } from "../../libs/vidyano/common/observable.js"
import { PersistentObjectAttribute } from "../persistent-object-attribute/persistent-object-attribute.js"
import { PersistentObjectAttributeString } from "../persistent-object-attribute/attributes/persistent-object-attribute-string/persistent-object-attribute-string.js"
import { PersistentObjectAttributeConfig } from '../app/config/persistent-object-attribute-config.js'
import "../persistent-object-attribute-label/persistent-object-attribute-label.js"
import { WebComponent, ConfigurableWebComponent, WebComponentListener } from "../web-component/web-component.js"

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

const _attributeImports: { [key: string]: Promise<any>; } = {
    "AsDetail": undefined,
    "BinaryFile": undefined,
    "Boolean": undefined,
    "ComboBox": undefined,
    "CommonMark": undefined,
    "DateTime": undefined,
    "DropDown": undefined,
    "FlagsEnum": undefined,
    "Image": undefined,
    "KeyValueList": undefined,
    "MultiLineString": undefined,
    "MultiString": undefined,
    "Numeric": undefined,
    "Password": undefined,
    "Reference": undefined,
    "String": undefined,
    "TranslatedString": undefined,
    "User": undefined
};

@WebComponent.register({
    properties: {
        attribute: Object,
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
            value: false,
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
            reflectToAttribute: true
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
        developer: {
            type: Boolean,
            reflectToAttribute: true
        }
    },
    listeners: {
        "vi:configure": "_configure"
    },
    observers: [
        "_attributeChanged(attribute, isConnected)"
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
})
export class PersistentObjectAttributePresenter extends ConfigurableWebComponent(WebComponentListener(WebComponent)) {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-presenter.html">`; }

    private _developerToggleDisposer: ISubjectDisposer;
    private _renderedAttribute: Vidyano.PersistentObjectAttribute;
    private _renderedAttributeElement: PersistentObjectAttribute;
    private _focusQueued: boolean;
    private _customTemplate: new (p0?: object) => Polymer.Templatize.TemplateInstanceBase;
    readonly loading: boolean; private _setLoading: (loading: boolean) => void;
    attribute: Vidyano.PersistentObjectAttribute;
    nonEdit: boolean;
    noLabel: boolean;
    height: number;
    disabled: boolean;
    readOnly: boolean;

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
        if (this._renderedAttribute) {
            Array.from(this.children).forEach(c => this.removeChild(c));
            this._renderedAttributeElement = this._renderedAttribute = null;
        }

        if (!attribute || !isConnected)
            return;

        this._setLoading(true);

        if (!this.getAttribute("height"))
            this.height = this.app.configuration.getAttributeConfig(attribute).calculateHeight(attribute);

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
        await _attributeImports[attributeType];
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
                    const fullAttributeFileName = `persistent-object-attribute-${attributeType.toKebabCase()}`;
                    let type: ObjectConstructor;
                    try {
                        const attributeModule = await import(`../persistent-object-attribute/attributes/${fullAttributeFileName}/${fullAttributeFileName}.js`);
                        type = attributeModule["PersistentObjectAttribute" + attributeType];
                    }
                    catch {
                        // Fallback to string
                    }

                    this._renderedAttributeElement = <PersistentObjectAttribute>new (type ?? PersistentObjectAttributeString)();
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

    private _computeEditing(isEditing: boolean, nonEdit: boolean): boolean {
        return !nonEdit && isEditing;
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

    private _loadingChanged(loading: boolean) {
        if (loading)
            this.fire("attribute-loading", { attribute: this.attribute }, { bubbles: true });
        else {
            Polymer.flush();
            this.fire("attribute-loaded", { attribute: this.attribute }, { bubbles: true });
        }
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
}