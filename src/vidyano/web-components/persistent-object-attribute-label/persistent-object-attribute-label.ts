import * as Vidyano from "vidyano"
import { html, nothing, unsafeCSS } from "lit"
import { property } from "lit/decorators.js"
import { computed, WebComponent } from "components/web-component/web-component"
import styles from "./persistent-object-attribute-label.css"

export class PersistentObjectAttributeLabel extends WebComponent {
    static styles = unsafeCSS(styles);

    @property({ type: Object })
    attribute: Vidyano.PersistentObjectAttribute;

    @property({ type: Boolean, reflect: true })
    @computed(function(this: PersistentObjectAttributeLabel, isEditing: boolean): boolean {
        return this.computeEditing(isEditing);
    }, "attribute.parent.isEditing")
    declare readonly editing: boolean;

    @property({ type: Boolean, reflect: true })
    @computed(function(this: PersistentObjectAttributeLabel, toolTip: string): boolean {
        return !!toolTip;
    }, "attribute.toolTip")
    declare readonly hasToolTip: boolean;

    @property({ type: Boolean, reflect: true })
    @computed(function(this: PersistentObjectAttributeLabel, attribute: Vidyano.PersistentObjectAttribute, required: boolean, value: any): boolean {
        return required && (value == null || (attribute && attribute.rules && attribute.rules.contains("NotEmpty") && value === ""));
    }, "attribute", "attribute.isRequired", "attribute.value")
    declare readonly required: boolean;

    @property({ type: Boolean, reflect: true })
    disabled: boolean = false;

    @property({ type: Boolean, reflect: true })
    @computed(function(this: PersistentObjectAttributeLabel, isReadOnly: boolean, disabled: boolean): boolean {
        return isReadOnly || disabled;
    }, "attribute.isReadOnly", "disabled")
    declare readonly readOnly: boolean;

    @property({ type: Boolean, reflect: true })
    @computed("attribute.parent.isBulkEdit")
    declare readonly bulkEdit: boolean;

    @property({ type: Boolean, reflect: true })
    @computed(function(this: PersistentObjectAttributeLabel, validationError: string): boolean {
        return !String.isNullOrEmpty(validationError);
    }, "attribute.validationError")
    declare readonly hasError: boolean;

    protected computeEditing(isEditing: boolean): boolean {
        return isEditing;
    }

    render() {
        return html`
            <div class="container">
                <label>${this.attribute?.label}</label>
                <span class="required">${this.translateMessage("Required")}</span>
                <div class="locked">
                    <vi-icon source="Lock"></vi-icon>
                </div>
                ${this.hasToolTip ? html`
                    <vi-button inverse class="info" icon="Info" @click=${this._showTooltip} tabindex="-1"></vi-button>
                ` : nothing}
            </div>
        `;
    }

    private _showTooltip() {
        this.app.showMessageDialog({
            title: this.attribute.label,
            titleIcon: "Info",
            rich: true,
            message: this.attribute.toolTip,
            actions: [this.translateMessage("OK")]
        });
    }
}

customElements.define("vi-persistent-object-attribute-label", PersistentObjectAttributeLabel);
