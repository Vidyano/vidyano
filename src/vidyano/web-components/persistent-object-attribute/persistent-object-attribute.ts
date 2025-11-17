import { unsafeCSS, type CSSResultGroup } from "lit";
import { property } from "lit/decorators.js";
import * as Vidyano from "vidyano";
import type { Select } from "components/select/select";
import { computed, notify, observer, WebComponent } from "components/web-component/web-component";
import styles from "./persistent-object-attribute.css";

export abstract class PersistentObjectAttribute extends WebComponent {
    static styles: CSSResultGroup = unsafeCSS(styles);

    private _foreground: string;

    @property({ type: Object })
    @observer(function(this: PersistentObjectAttribute) {
        this._attributeChanged();
    })
    attribute: Vidyano.PersistentObjectAttribute;

    @property({ type: Boolean, reflect: true })
    @computed(function(this: PersistentObjectAttribute, isEditing: boolean, nonEdit: boolean): boolean {
        return !nonEdit && isEditing;
    }, "attribute.parent.isEditing", "nonEdit")
    declare readonly editing: boolean;

    @property({ type: Boolean, reflect: true })
    nonEdit: boolean = false;

    @property({ type: Boolean, reflect: true })
    disabled: boolean = false;

    @property({ type: Boolean, reflect: true })
    @computed(function(this: PersistentObjectAttribute, isReadOnly: boolean, disabled: boolean, sensitive: boolean): boolean {
        return [isReadOnly, disabled, sensitive].some(f => f);
    }, "attribute.isReadOnly", "disabled", "sensitive")
    declare readonly readOnly: boolean;

    @property({ type: String, reflect: true })
    @computed(function(this: PersistentObjectAttribute, readOnly: boolean): string {
        return readOnly ? "-1" : null;
    }, "readOnly")
    declare readonly readOnlyTabIndex: string;

    @property({ type: Boolean })
    @computed(function(this: PersistentObjectAttribute, isFrozen: boolean): boolean {
        return isFrozen;
    }, "attribute.parent.isFrozen")
    declare readonly frozen: boolean;

    @property({ type: Boolean, reflect: true })
    @computed(function(this: PersistentObjectAttribute, isRequired: boolean): boolean {
        return isRequired;
    }, "attribute.isRequired")
    declare readonly required: boolean;

    @property({ type: Boolean, reflect: true })
    @computed(function(this: PersistentObjectAttribute, isSensitive: boolean, isAppSensitive: boolean, type: string): boolean {
        return isSensitive && isAppSensitive && type !== "AsDetail";
    }, "attribute.isSensitive", "isAppSensitive", "attribute.type")
    declare readonly sensitive: boolean;

    @property({ type: Object })
    @notify()
    @observer(function(this: PersistentObjectAttribute, newValue: any, oldValue: any) {
        if (this.attribute && newValue !== this.attribute.value)
            this.attribute.setValue(newValue, false).catch(Vidyano.noop);
    })
    value: any;

    @property({ type: String })
    @computed(function(this: PersistentObjectAttribute, attribute: Vidyano.PersistentObjectAttribute): string {
        return attribute ? attribute.getTypeHint("placeholder", "", void 0) : "";
    }, "attribute")
    declare readonly placeholder: string;

    @property({ type: Object })
    @notify()
    @computed(function(this: PersistentObjectAttribute, validationError: string): string {
        return validationError;
    }, "attribute.validationError")
    declare readonly validationError: string;

    @property({ type: Boolean, reflect: true })
    @computed(function(this: PersistentObjectAttribute, validationError: string): boolean {
        return !String.isNullOrEmpty(validationError);
    }, "validationError")
    declare readonly hasError: boolean;

    get options(): string[] | Vidyano.PersistentObjectAttributeOption[] {
        if (!this.attribute)
            return null;

        return this._computeOptions(this.attribute.options, this.attribute.isRequired, this.attribute.type);
    }

    @property({ type: String, reflect: true })
    @observer(function(this: PersistentObjectAttribute, gridArea: string) {
        this.style.gridArea = gridArea;
    })
    gridArea: string;

    focus() {
        (this.shadowRoot.querySelector("vi-persistent-object-attribute-edit input") as HTMLInputElement ||
        this.shadowRoot.querySelector("vi-persistent-object-attribute-edit textarea") as HTMLInputElement ||
        this.shadowRoot.querySelector("vi-persistent-object-attribute-edit vi-select") as Select)?.focus();
    }

    @observer("attribute.value")
    protected _attributeValueChanged() {
        this.value = this.attribute.value !== undefined ? this.attribute.value : null;
    }

    protected _optionsChanged(options: string[] | Vidyano.PersistentObjectAttributeOption[]) {
        // Noop
    }

    protected _attributeChanged() {
        // Noop
    }

    @observer("attribute.parent.isEditing")
    protected _editingChanged() {
        // Noop
    }

    private _computeOptions(options: string[] | Vidyano.PersistentObjectAttributeOption[], isRequired: boolean, type: string): string[] | Vidyano.PersistentObjectAttributeOption[] {
        if (!options || options.length === 0 || isRequired || ["KeyValueList", "DropDown", "ComboBox"].indexOf(type) === -1)
            return options;

        if (typeof options[0] === "string" || options[0] == null) {
            if ((<string[]>options).some(o => o == null))
                return options;

            return [null].concat(options);
        }

        if ((<Vidyano.PersistentObjectAttributeOption[]>options).some(o => !o.key))
            return options;

        return [{ key: null, value: "" }].concat((<Vidyano.PersistentObjectAttributeOption[]>options));
    }

    @observer("editing", "readOnly", "attribute.typeHints")
    private _updateForeground(isEditing: boolean, isReadOnly: boolean) {
        const foreground = this.attribute.getTypeHint("foreground", null);

        if ((!isEditing || isReadOnly) && foreground)
            this.style.setProperty("--vi-persistent-object-attribute-foreground", this._foreground = foreground);
        else if (this._foreground)
            this.style.setProperty("--vi-persistent-object-attribute-foreground", this._foreground = null);
    }

    protected _onFocus(e: FocusEvent) {
        if (this.shadowRoot.activeElement)
            return;

        // TODO
        // const element = getTabbableNodes(this.shadowRoot.host)[0];
        // if (!element)
        //     return;

        // element.focus();
    }
}
