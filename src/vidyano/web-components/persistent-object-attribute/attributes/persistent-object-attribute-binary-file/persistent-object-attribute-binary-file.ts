import { html, nothing, unsafeCSS, type TemplateResult } from "lit";
import { property } from "lit/decorators.js";
import { computed } from "components/web-component/web-component";
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute";
import * as PersistentObjectAttributeRegister from "components/persistent-object-attribute/persistent-object-attribute-register";
import styles from "./persistent-object-attribute-binary-file.css";

export class PersistentObjectAttributeBinaryFile extends PersistentObjectAttribute {
    static styles = [super.styles, unsafeCSS(styles)];

    @property({ type: Boolean })
    @computed(function(this: PersistentObjectAttributeBinaryFile, value: string, readOnly: boolean): boolean {
        return !readOnly && !String.isNullOrEmpty(value);
    }, "value", "readOnly")
    declare readonly canClear: boolean;

    @property({ type: String })
    @computed(function(this: PersistentObjectAttributeBinaryFile, value: string, editing: boolean): string {
        if (String.isNullOrEmpty(value))
            return editing ? "" : "—";

        return value.split("|")[0];
    }, "value", "editing")
    declare readonly fileName: string;

    focus() {
        (this.shadowRoot.querySelector("input[type='file']") as HTMLInputElement)?.focus();
    }

    private async _change(e: Event) {
        const targetInput = <HTMLInputElement>e.target;
        if (targetInput.files?.length !== 1)
            return;
        
        const file = targetInput.files[0];
        this.value = file.name;
        this.attribute.file = file;
        if (this.attribute.triggersRefresh)
            await this.attribute.triggerRefresh(true);
    }

    private async _clear() {
        this.value = null;
        this.attribute.file = null;

        const input = this.shadowRoot.querySelector("input[type='file']") as HTMLInputElement;
        if (input)
            input.value = null;

        if (this.attribute?.triggersRefresh)
            await this.attribute.triggerRefresh(true);
    }

    private _computeAccept(): string {
        if (!this.attribute)
            return "";

        return this.attribute.getTypeHint("accept", "");
    }

    protected renderDisplay() {
        return super.renderDisplay(html`<span>${this.fileName}</span>`);
    }

    protected renderEdit(innerTemplate?: TemplateResult) {
        return super.renderEdit(html`
            <vi-sensitive ?disabled=${!this.sensitive}>
                <input .value=${this.fileName} type="text" readonly placeholder=${this.placeholder || "—"}>
            </vi-sensitive>
            ${!this.readOnly ? html`
                <button id="browse" class="browse" slot="right" ?disabled=${this.frozen}>
                    <vi-icon source="FileUpload"></vi-icon>
                    <input type="file" accept=${this._computeAccept()} @change=${this._change}>
                </button>
            ` : nothing}
            ${this.canClear ? html`
                <button id="clear" slot="right" @click=${this._clear} tabindex="-1" ?disabled=${this.frozen}>
                    <vi-icon source="Remove"></vi-icon>
                </button>
            ` : nothing}
        `);
    }
}

customElements.define("vi-persistent-object-attribute-binary-file", PersistentObjectAttributeBinaryFile);

PersistentObjectAttributeRegister.add("BinaryFile", PersistentObjectAttributeBinaryFile);
