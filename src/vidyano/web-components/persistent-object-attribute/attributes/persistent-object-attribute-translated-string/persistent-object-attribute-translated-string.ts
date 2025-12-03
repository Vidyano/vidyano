import { html, nothing, unsafeCSS, type TemplateResult } from "lit";
import { property, state } from "lit/decorators.js";
import * as Vidyano from "vidyano";
import { computed } from "components/web-component/web-component";
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute";
import * as PersistentObjectAttributeRegister from "components/persistent-object-attribute/persistent-object-attribute-register";
import { PersistentObjectAttributeTranslatedStringDialog } from "./persistent-object-attribute-translated-string-dialog";
import styles from "./persistent-object-attribute-translated-string.css";

export interface ITranslatedString {
    key: string;
    label: string;
    value: string;
}

export class PersistentObjectAttributeTranslatedString extends PersistentObjectAttribute {
    static styles = [super.styles, unsafeCSS(styles)];

    private _defaultLanguage: string;

    @state()
    strings: ITranslatedString[] = [];

    @property({ type: Boolean, reflect: true })
    @computed(function(this: PersistentObjectAttributeTranslatedString): boolean {
        return this.attribute?.getTypeHint("MultiLine") === "True";
    }, "attribute.typeHints")
    declare readonly multiline: boolean;

    @computed(function(this: PersistentObjectAttributeTranslatedString): boolean {
        return this.strings?.length > 1 || this.multiline;
    }, "strings", "multiline")
    declare readonly canShowDialog: boolean;

    protected override _attributeChanged() {
        super._attributeChanged();

        if (this.attribute?.options)
            this._optionsChanged(this.attribute.options);
    }

    protected override _optionsChanged(options: string[] | Vidyano.PersistentObjectAttributeOption[]) {
        super._optionsChanged(options);

        if (!this.attribute?.options || this.attribute.options.length < 3)
            return;

        const strings: ITranslatedString[] = [];
        this._defaultLanguage = <string>this.attribute.options[1];
        const data = JSON.parse(<string>this.attribute.options[0]);
        const labels = JSON.parse(<string>this.attribute.options[2]);

        for (const key in labels) {
            strings.push({
                key: key,
                value: data[key] || "",
                label: labels[key]
            });
        }

        this.strings = strings;
    }

    protected override _valueChanged(newValue: string, oldValue: string) {
        if (newValue === this.attribute?.value)
            return;

        super._valueChanged(newValue, oldValue);

        const defaultString = this.strings?.find(s => s.key === this._defaultLanguage);
        if (defaultString)
            defaultString.value = newValue;

        const newOption = {};
        this.strings?.forEach(val => {
            newOption[val.key] = val.value;
        });

        if (this.attribute?.options)
            this.attribute.options[0] = JSON.stringify(newOption);
    }

    private _editInputBlur() {
        if (this.attribute && this.attribute.isValueChanged && this.attribute.triggersRefresh)
            this.attribute.setValue(this.value = this.attribute.value, true).catch(Vidyano.noop);
    }

    private async _showLanguagesDialog() {
        const result = await this.app.showDialog(new PersistentObjectAttributeTranslatedStringDialog(this.attribute.label, this.strings.slice(), this.multiline, this.readOnly));
        if (this.readOnly || !result)
            return;

        const newData = {};
        result.forEach(s => {
            newData[s.key] = this.strings[s.key] = s.value;
            if (s.key === this._defaultLanguage)
                this.attribute.value = s.value;
        });

        this.attribute.options[0] = JSON.stringify(newData);

        this.attribute.isValueChanged = true;
        this.attribute.parent.triggerDirty();

        await this.attribute.setValue(this.value = this.attribute.value, true);
    }

    protected override renderDisplay() {
        if (!this.multiline)
            return super.renderDisplay(html`<span>${this.attribute?.displayValue}</span>`);

        return html`
            <vi-scroller>
                <vi-sensitive ?disabled=${!this.sensitive}>
                    <pre>${this.attribute?.displayValue}</pre>
                </vi-sensitive>
            </vi-scroller>
        `;
    }

    protected override renderEdit(innerTemplate?: TemplateResult) {
        return super.renderEdit(html`
            ${!this.multiline ? html`
                <vi-sensitive ?disabled=${!this.sensitive}>
                    <input
                        class="flex"
                        .value=${this.value || ""}
                        @input=${(e: InputEvent) => this.value = (e.target as HTMLInputElement).value}
                        @blur=${this._editInputBlur}
                        type="text"
                        ?readonly=${this.readOnly}
                        ?disabled=${this.frozen}
                        tabindex=${this.readOnlyTabIndex || nothing}
                        placeholder=${this.placeholder || nothing}>
                </vi-sensitive>
            ` : html`
                <vi-scroller class="fit">
                    <vi-sensitive ?disabled=${!this.sensitive}>
                        <pre id="multiline">${this.attribute?.value}</pre>
                    </vi-sensitive>
                </vi-scroller>
            `}
            ${this.canShowDialog ? html`
                <vi-button slot="right" @click=${this._showLanguagesDialog} tabindex="-1" ?hidden=${this.sensitive}>
                    <vi-icon source="TranslatedString"></vi-icon>
                </vi-button>
            ` : nothing}
        `);
    }
}

customElements.define("vi-persistent-object-attribute-translated-string", PersistentObjectAttributeTranslatedString);

PersistentObjectAttributeRegister.add("TranslatedString", PersistentObjectAttributeTranslatedString);
