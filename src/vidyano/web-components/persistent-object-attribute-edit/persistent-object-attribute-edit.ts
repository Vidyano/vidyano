import { html, nothing, unsafeCSS } from "lit";
import { property } from "lit/decorators.js";
import { computed, listener, observer, WebComponent } from "components/web-component/web-component";
import type * as Vidyano from "vidyano";
import * as IconRegister from "components/icon/icon-register";
import "components/persistent-object-attribute-validation-error/persistent-object-attribute-validation-error";
import styles from "./persistent-object-attribute-edit.css";

export class PersistentObjectAttributeEdit extends WebComponent {
    static styles = unsafeCSS(styles);

    @property({ type: Object })
    attribute: Vidyano.PersistentObjectAttribute;

    @property({ type: Boolean, reflect: true })
    hasFocus: boolean = false;

    @property({ type: Boolean, reflect: true })
    @computed("attribute.validationError")
    declare readonly hasError: boolean;

    @property({ type: Boolean, reflect: true })
    reverse: boolean;

    @property({ type: Boolean, reflect: true })
    @computed(function(this: PersistentObjectAttributeEdit, isSensitive: boolean, isAppSensitive: boolean): boolean {
        return isSensitive && isAppSensitive;
    }, "attribute.isSensitive", "isAppSensitive")
    declare readonly sensitive: boolean;

    @property({ type: Boolean, reflect: true })
    @computed("attribute.isReadOnly")
    declare readonly readOnly: boolean;

    @property({ type: Boolean })
    @computed(function(this: PersistentObjectAttributeEdit, validationError: string, isReadOnly: boolean): boolean {
        return !!validationError && !isReadOnly;
    }, "attribute.validationError", "attribute.isReadOnly")
    declare readonly hasValidationError: boolean;

    @listener("focusin")
    private _focus() {
        this.hasFocus = true;
    }

    @listener("focusout")
    private _blur() {
        this.hasFocus = false;
    }

    @observer("attribute.actions", "attribute.parent.isFrozen")
    private _onAttributeChanged() {
        this.requestUpdate();
    }

    private _computeActionIcon(action: Vidyano.Action): string {
        if (!action)
            return "";

        return !IconRegister.exists(action.definition.icon) ? "Action_Default$" : action.definition.icon;
    }

    private _onAction(e: Event) {
        const target = e.currentTarget as HTMLElement;
        const actionIndex = parseInt(target.dataset.actionIndex || "0");
        const action = this.attribute.actions[actionIndex];
        action?.execute({
            parameters: {
                "AttributeName": this.attribute.name
            }
        });
    }

    render() {
        return html`
            <div class="box" ?disabled=${this.attribute?.parent.isFrozen}>
                <div class="left extras">
                    <slot name="left"></slot>
                </div>
                <slot></slot>
                <div class="right extras">
                    ${this.attribute?.actions?.map((action, index) => html`
                        <vi-button class="action" @click=${this._onAction} data-action-index=${index} tabindex="-1">
                            <vi-icon source=${this._computeActionIcon(action)}></vi-icon>
                        </vi-button>
                    `)}
                    <slot name="right"></slot>
                </div>
            </div>

            ${this.hasValidationError ? html`
                <vi-persistent-object-attribute-validation-error .attribute=${this.attribute}></vi-persistent-object-attribute-validation-error>
            ` : nothing}
        `;
    }
}

customElements.define("vi-persistent-object-attribute-edit", PersistentObjectAttributeEdit);
