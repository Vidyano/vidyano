import * as Polymer from "../../../../libs/polymer/polymer";
import * as Vidyano from "../../../../libs/vidyano/vidyano"
import "../../../button/button"
import { Icon } from '../../../icon/icon.js';
import { WebComponent } from "../../../web-component/web-component"
import { PersistentObjectAttribute } from "../../persistent-object-attribute"

Icon.Add`
<vi-icon name="FileUpload">
    <svg viewBox="0 0 32 32">
        <g>
            <path d="M 7.4765625 1.4882812 L 7.4765625 6.2617188 L 24.523438 6.2617188 L 24.523438 1.4882812 L 7.4765625 1.4882812 z M 15.966797 7.9042969 L 4.3476562 19.521484 L 7.703125 22.880859 L 13.615234 16.966797 L 13.615234 30.46875 L 18.388672 30.46875 L 18.388672 17.033203 L 24.296875 22.949219 L 27.652344 19.589844 L 15.966797 7.9042969 z " />
        </g>
    </svg>
</vi-icon>`;

@WebComponent.register({
    properties: {
        canClear: {
            type: Boolean,
            computed: "_computeCanClear(value, readOnly)"
        },
        fileName: {
            type: String,
            computed: "_computeFileName(value)"
        }
    },
    observers: [
        "_registerInput(attribute, isConnected)"
    ]
})
export class PersistentObjectAttributeBinaryFile extends PersistentObjectAttribute {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-binary-file.html">`; }

    private _inputContainer: HTMLDivElement;
        private _inputAttribute: Vidyano.PersistentObjectAttribute;

        private async _change(e: Event) {
            const targetInput = <HTMLInputElement>e.target;
            if (targetInput.files && targetInput.files.length > 0) {
                this.value = targetInput.files[0].name;
                if (this.attribute.triggersRefresh)
                    await this.attribute._triggerAttributeRefresh(true);
            }
        }

        private _registerInput(attribute: Vidyano.PersistentObjectAttribute, isConnected: boolean) {
            if (this._inputAttribute) {
                this._inputAttribute.input = null;
                this._inputAttribute = null;
            }

            if (this._inputContainer)
                this._inputContainer.textContent = "";

            if (attribute && isConnected) {
                this._inputAttribute = attribute;

                const input = document.createElement("input");
                this._inputAttribute.input = input;
                input.type = "file";
                input.accept = this.attribute.getTypeHint("accept");

                if (!this._inputContainer) {
                    this._inputContainer = document.createElement("div");
                    this._inputContainer.setAttribute("slot", "upload");

                    this.appendChild(this._inputContainer);
                }
                this._inputContainer.appendChild(input);
            }
        }

        private _clear() {
            this.value = null;
        }

        private _computeCanClear(value: string, readOnly: boolean): boolean {
            return !readOnly && !String.isNullOrEmpty(value);
        }

        private _computeFileName(value: string): string {
            if (String.isNullOrEmpty(value))
                return "";

            return value.split("|")[0];
        }
}

PersistentObjectAttribute.registerAttributeType("BinaryFile", PersistentObjectAttributeBinaryFile);