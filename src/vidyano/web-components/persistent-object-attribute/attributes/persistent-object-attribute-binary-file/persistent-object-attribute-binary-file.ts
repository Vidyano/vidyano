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
            computed: "_computeFileName(value, editing)"
        }
    }
}, "vi-persistent-object-attribute-binary-file")
export class PersistentObjectAttributeBinaryFile extends PersistentObjectAttribute {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-binary-file.html">`; }

    focus() {
        const input = this.shadowRoot.querySelector("input[type='file']") as HTMLInputElement;
        input?.focus();
    }

    private async _change(e: Event) {
        const targetInput = <HTMLInputElement>e.target;
        if (targetInput.files && targetInput.files.length > 0) {
            const file = targetInput.files[0];
            this.value = file.name;
            this.attribute.file = file;
            if (this.attribute.triggersRefresh)
                await this.attribute.triggerRefresh(true);
        }
    }


    private async _clear() {
        this.value = null;
        this.attribute.file = null;
        
        const input = this.shadowRoot.querySelector("input[type='file']") as HTMLInputElement;
        if (input)
            input.value = null;

        if(this.attribute?.triggersRefresh)
            await this.attribute.triggerRefresh(true);
    }

    private _computeCanClear(value: string, readOnly: boolean): boolean {
        return !readOnly && !String.isNullOrEmpty(value);
    }

    private _computeFileName(value: string, editing: boolean): string {
        if (String.isNullOrEmpty(value))
            return editing ? "" : "—";

        return value.split("|")[0];
    }

    private _computeAccept(attribute: Vidyano.PersistentObjectAttribute): string {
        if (!attribute)
            return "";
        
        return attribute.getTypeHint("accept", "");
    }
}

PersistentObjectAttribute.registerAttributeType("BinaryFile", PersistentObjectAttributeBinaryFile);