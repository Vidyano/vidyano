import * as Vidyano from "vidyano"
import { Observable, ISubjectDisposer } from "vidyano"
import { html, nothing, unsafeCSS, TemplateResult } from "lit"
import { property, state } from "lit/decorators.js"
import { computed, listener, observer, WebComponent } from "components/web-component/web-component"
import { IConfigurableAction, WebComponentConfigurationController } from "components/web-component/web-component-configuration-controller"
import * as PersistentObjectAttributeRegister from "components/persistent-object-attribute/persistent-object-attribute-register"
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
import "components/persistent-object-attribute-label/persistent-object-attribute-label"
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute"
import styles from "./persistent-object-attribute-presenter.css"

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

export class PersistentObjectAttributePresenter extends WebComponent {
    static styles = unsafeCSS(styles);

    readonly #configurable = new WebComponentConfigurationController(this, (actions: IConfigurableAction[]) => {
        if (this.attribute?.parent?.isSystem)
            return;

        actions.push({
            label: `Attribute: ${this.attribute.name}`,
            icon: "viConfigure",
            action: this._openAttributeManagement.bind(this)
        });
    });

    private _developerToggleDisposer: ISubjectDisposer;
    private _renderedAttribute: Vidyano.PersistentObjectAttribute;
    private _renderedAttributeElement: PersistentObjectAttribute;
    private _focusQueued: boolean;

    @property({ type: Object })
    @observer(function(this: PersistentObjectAttributePresenter, attribute: Vidyano.PersistentObjectAttribute) {
        if (this._renderedAttribute === attribute)
            return;

        if (this._renderedAttribute) {
            Array.from(this.children).forEach(c => this.removeChild(c));
            this._renderedAttributeElement = this._renderedAttribute = null;
        }

        if (!attribute || !this.isConnected)
            return;

        this.loading = true;

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
    })
    attribute: Vidyano.PersistentObjectAttribute;

    @property({ type: String, reflect: true })
    @computed("attribute.name")
    declare readonly name: string;

    @property({ type: String, reflect: true })
    @computed("attribute.type")
    declare readonly type: string;

    @property({ type: Boolean, reflect: true })
    noLabel: boolean = false;

    @property({ type: Boolean, reflect: true })
    @computed(function(this: PersistentObjectAttributePresenter, isEditing: boolean): boolean {
        return this.computeEditing(isEditing);
    }, "attribute.parent.isEditing")
    declare readonly editing: boolean;

    @property({ type: Boolean, reflect: true })
    @computed(function(this: PersistentObjectAttributePresenter, attribute: Vidyano.PersistentObjectAttribute, required: boolean, value: any): boolean {
        return required && (value == null || (attribute && attribute.rules && attribute.rules.contains("NotEmpty") && value === ""));
    }, "attribute", "attribute.isRequired", "attribute.value")
    declare readonly required: boolean;

    @property({ type: Boolean, reflect: true })
    @observer(function(this: PersistentObjectAttributePresenter, disabled: boolean) {
        if (this._renderedAttributeElement)
            this._renderedAttributeElement.disabled = disabled;
    })
    disabled: boolean = false;

    @property({ type: Boolean, reflect: true })
    @computed(function(this: PersistentObjectAttributePresenter, isReadOnly: boolean, isFrozen: boolean, disabled: boolean): boolean {
        return isReadOnly || disabled || isFrozen;
    }, "attribute.isReadOnly", "attribute.parent.isFrozen", "disabled")
    declare readonly readOnly: boolean;

    @property({ type: Boolean, reflect: true })
    @computed(function(this: PersistentObjectAttributePresenter, isBulkEdit: boolean): boolean {
        return isBulkEdit;
    }, "attribute.parent.isBulkEdit")
    declare readonly bulkEdit: boolean;

    @state()
    @observer(function(this: PersistentObjectAttributePresenter, loading: boolean) {
        this.dispatchEvent(new CustomEvent(loading ? "attribute-loading" : "attribute-loaded", {
            detail: { attribute: this.attribute },
            bubbles: true,
            composed: true
        }));
    })
    loading: boolean = true;

    @property({ type: Number, reflect: true })
    @observer(function(this: PersistentObjectAttributePresenter) {
        this._updateRowSpan();
    })
    height: number = null;

    @property({ type: Boolean, reflect: true })
    @computed(function(this: PersistentObjectAttributePresenter, isVisible: boolean): boolean {
        return !isVisible;
    }, "attribute.isVisible")
    declare readonly hidden: boolean;

    @property({ type: Boolean, reflect: true })
    @computed(function(this: PersistentObjectAttributePresenter, validationError: string): boolean {
        return !String.isNullOrEmpty(validationError);
    }, "attribute.validationError")
    declare readonly hasError: boolean;

    @property({ type: Boolean, reflect: true })
    @computed(function(this: PersistentObjectAttributePresenter, value: any): boolean {
        return value != null && value !== "";
    }, "attribute.value")
    declare readonly hasValue: boolean;

    @property({ type: Boolean, reflect: true })
    developer: boolean = false;

    @property({ type: String, reflect: true })
    @observer(function(this: PersistentObjectAttributePresenter, gridArea: string) {
        this.style.gridArea = gridArea;
    })
    gridArea: string;

    async connectedCallback() {
        super.connectedCallback();

        if (this.service?.application?.hasManagement)
            this._developerToggleDisposer = developerShortcut.propertyChanged.attach(this._devToggle.bind(this));
    }

    disconnectedCallback() {
        if (this._developerToggleDisposer) {
            this._developerToggleDisposer();
            this._developerToggleDisposer = null;
        }

        super.disconnectedCallback();
    }

    render() {
        return html`
            ${this.renderLabel()}
            <div id="content" class="content">
                ${this.attribute?.parent?.isBulkEdit ? html`
                    <vi-checkbox .checked=${this.attribute.isValueChanged} @checked-changed=${this._onBulkEditCheckboxChanged} ?disabled=${this.readOnly}></vi-checkbox>
                ` : nothing}
                <slot></slot>
            </div>
            ${this.developer ? html`
                <div id="developer" @click=${this._openAttributeManagement}>
                    <label>${this.attribute?.name}</label>
                </div>
            ` : nothing}
        `;
    }

    protected computeEditing(isEditing: boolean): boolean {
        return isEditing;
    }

    protected renderLabel(): TemplateResult | typeof nothing {
        if (this.noLabel)
            return nothing;

        return html`<vi-persistent-object-attribute-label .attribute=${this.attribute} part="label"></vi-persistent-object-attribute-label>`;
    }

    @listener("click")
    private _onClick(e: MouseEvent) {
        if (this.editing && typeof this._renderedAttributeElement?.focus === "function") {
            const path = e.composedPath();
            const attributeIndex = path.indexOf(this._renderedAttributeElement);
            const presenterIndex = path.indexOf(this);
            if (attributeIndex >= 0 && attributeIndex < presenterIndex)
                return;

            const currentActiveElement = this.app.activeElement;
            this._renderedAttributeElement.focus();

            if (currentActiveElement !== this.app.activeElement) {
                e.preventDefault();
                e.stopPropagation();
            }
        }
    }

    private _onBulkEditCheckboxChanged(e: CustomEvent) {
        this.attribute.isValueChanged = e.detail.value;
    }

    private _devToggle() {
        this.developer = !this.attribute?.parent?.isSystem && developerShortcut.state;
    }

    queueFocus() {
        const activeElement = document.activeElement;
        this.#focusElement(this);

        if (activeElement !== document.activeElement)
            this._focusQueued = true;
    }

    #focusElement(element: HTMLElement, maxAttempts: number = 10, interval: number = 100, attempt: number = 0) {
        if (element && typeof element.focus === "function") {
            const oldActiveElementPath = this.app?.activeElementPath || [];
            if (oldActiveElementPath.some(e => e === element))
                return;

            element.focus();

            if (this.app?.activeElementPath?.some(e => e === element))
                return;
        }

        if (attempt < maxAttempts)
            setTimeout(() => this.#focusElement(element, maxAttempts, interval, attempt + 1), interval);
    }

    private async _renderAttribute(attribute: Vidyano.PersistentObjectAttribute, attributeType: string) {
        if (!this.isConnected || attribute !== this.attribute || this._renderedAttribute === attribute)
            return;

        let focusTarget: HTMLElement;
        try {
            this._renderedAttributeElement = this.createAttributeElement(attributeType);
            this._renderedAttributeElement.classList.add("attribute");
            this._renderedAttributeElement.attribute = attribute;
            this._renderedAttributeElement.disabled = this.disabled;

            this.appendChild(focusTarget = this._renderedAttributeElement);
            this._renderedAttribute = attribute;
        }
        finally {
            this.loading = false;

            if (this._focusQueued) {
                await this.updateComplete;

                this.#focusElement(focusTarget);
                this._focusQueued = false;
            }
        }
    }

    protected createAttributeElement(attributeType: string): PersistentObjectAttribute {
        return <PersistentObjectAttribute>new (PersistentObjectAttributeRegister.get(attributeType) ?? PersistentObjectAttributeString)();
    }

    @observer("attribute")
    private _updateRowSpan() {
        if (!this.isConnected || !this.attribute)
            return;

        const height = this.calculateRowSpan(this.attribute);
        if (height > 0)
            this.style.setProperty("--vi-persistent-object-attribute-presenter--row-span", `${height}`);
        else
            this.style.removeProperty("--vi-persistent-object-attribute-presenter--row-span");
    }

    protected calculateRowSpan(attribute: Vidyano.PersistentObjectAttribute): number | null {
        return this.height || this.app.configuration.getAttributeConfig(attribute)?.calculateHeight(attribute);
    }

    private _openAttributeManagement() {
        this.app.changePath(`Management/PersistentObject.1456569d-e02b-44b3-9d1a-a1e417061c77/${this.attribute.id}`);
    }

    updateStyles(styles: Record<string, string>) {
        Object.entries(styles).forEach(([key, value]) => {
            this.style.setProperty(key, value);
        });
    }
}

customElements.define("vi-persistent-object-attribute-presenter", PersistentObjectAttributePresenter);
