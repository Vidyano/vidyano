import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
import "components/button/button"
import { WebComponent } from "components/web-component/web-component"
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute"

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
}, "vi-persistent-object-attribute-binary-file")
export class PersistentObjectAttributeBinaryFile extends PersistentObjectAttribute {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-binary-file.html">`; }

    private _inputElement: HTMLInputElement;

    connectedCallback(): void {
        super.connectedCallback();

        this._createInput();
        this._hookInput();
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();

        this._unhookInput();
    }

    focus() {
        this._inputElement?.focus();
    }

    protected _attributeChanged() {
        super._attributeChanged();

        this._unhookInput();
        this._createInput();
        this._hookInput();
    }

    private async _change(e: Event) {
        const targetInput = <HTMLInputElement>e.target;
        if (targetInput.files && targetInput.files.length > 0) {
            const file = targetInput.files[0];
            this.value = file.name;
            await this.attribute.setFile(file);
            if (this.attribute.triggersRefresh)
                await this.attribute.triggerRefresh(true);
        }
    }

    private _unhookInput() {
        const currentInput = this.querySelector("input[slot=upload]") as HTMLInputElement;
        if (currentInput)
            this.removeChild(currentInput);
    }

    private _createInput() {
        if (!this.attribute || this.attribute.type !== "BinaryFile")
            return;

        this._inputElement = document.createElement("input");
        this._inputElement.type = "file";
        const accept = this.attribute.getTypeHint("accept", null);
        if (accept)
            this._inputElement.accept = accept;
    }

    private _hookInput() {
        if (!this._inputElement)
            return;
        
        this._inputElement.setAttribute("slot", "upload");
        this.appendChild(this._inputElement);
    }

    private async _clear() {
        this.value = null;
        await this.attribute.setFile(null);
        
        if (this._inputElement)
            this._inputElement.value = null;

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