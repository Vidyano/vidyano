import * as Polymer from "../../../../libs/polymer/polymer.js"
import * as Vidyano from "../../../../libs/vidyano/vidyano.js"
import "../../../button/button.js"
import { WebComponent } from "../../../web-component/web-component.js"
import { PersistentObjectAttribute } from "../../persistent-object-attribute.js"

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
    }
})
export class PersistentObjectAttributeBinaryFile extends PersistentObjectAttribute {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-binary-file.html">`; }

    connectedCallback(): void {
        super.connectedCallback();

        this._hookInput(this.attribute);
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();

        this._unhookInput();
    }

    focus() {
        this.attribute?.input?.focus();
    }

    protected _attributeChanged() {
        super._attributeChanged();

        this._unhookInput();
        this._hookInput(this.attribute);
    }

    private async _change(e: Event) {
        const targetInput = <HTMLInputElement>e.target;
        if (targetInput.files && targetInput.files.length > 0) {
            this.value = targetInput.files[0].name;
            if (this.attribute.triggersRefresh)
                await this.attribute.triggerRefresh(true);
        }
    }

    private _unhookInput() {
        const currentInput = this.querySelector("input[slot=upload]") as HTMLInputElement;
        if (currentInput)
            this.removeChild(currentInput);
    }

    private _hookInput(attribute: Vidyano.PersistentObjectAttribute) {
        if (!attribute?.input)
            return;
        
        attribute.input.setAttribute("slot", "upload");
        this.appendChild(attribute.input);
    }

    private async _clear() {
        this.value = null;
        
        if (this.attribute?.input?.files?.length)
            this.attribute.input.value = null;

        if(this.attribute?.triggersRefresh)
            await this.attribute.triggerRefresh(true);
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