import { html, nothing, unsafeCSS, type TemplateResult } from "lit";
import * as Vidyano from "vidyano";
import "components/checkbox/checkbox";
import "components/icon/icon";
import "components/popup/popup";
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute";
import * as PersistentObjectAttributeRegister from "components/persistent-object-attribute/persistent-object-attribute-register";
import styles from "./persistent-object-attribute-flags-enum.css";

export class PersistentObjectAttributeFlagsEnum extends PersistentObjectAttribute {
    static styles = [super.styles, unsafeCSS(styles)];

    protected override renderDisplay() {
        return super.renderDisplay(html`<span>${this.attribute?.displayValue}</span>`);
    }

    protected override renderEdit(innerTemplate?: TemplateResult) {
        return super.renderEdit(html`
            <vi-popup sticky ?disabled=${this.readOnly || this.frozen || this.sensitive} auto-width>
                <div slot="header" class="header">
                    <vi-sensitive ?disabled=${!this.sensitive}>
                        <span>${this.attribute?.displayValue}</span>
                    </vi-sensitive>
                    ${!this.readOnly ? html`<vi-icon source="CaretDown"></vi-icon>` : nothing}
                </div>
                <ul>
                    ${(this.options as Vidyano.PersistentObjectAttributeOption[])?.map(option => html`
                        <li>
                            <vi-checkbox
                                .checked=${this.#isChecked(option)}
                                @checked-changed=${(e: CustomEvent) => this.#onCheckedChanged(option, e.detail.value)}
                                label=${option.value}>
                            </vi-checkbox>
                        </li>
                    `)}
                </ul>
            </vi-popup>
        `);
    }

    #isChecked(option: Vidyano.PersistentObjectAttributeOption): boolean {
        const currentOptions = this.options as Vidyano.PersistentObjectAttributeOption[];
        const currentValue = this.attribute?.value ? this.#parseValues(this.attribute.value).sum(v => parseInt(currentOptions.find(o => o.value === v)?.key || "0")) : 0;
        const optionKey = parseInt(option.key);

        return (currentValue === 0 && optionKey === 0) || (optionKey !== 0 && (currentValue & optionKey) === optionKey);
    }

    #onCheckedChanged(option: Vidyano.PersistentObjectAttributeOption, checked: boolean) {
        // Skip if checked state matches expected (event fired from property update, not user interaction)
        if (checked === this.#isChecked(option))
            return;

        const optionKey = parseInt(option.key);

        if (checked && optionKey === 0) {
            this.attribute.setValue(option.value, false);
            return;
        }

        const currentOptions = this.options as Vidyano.PersistentObjectAttributeOption[];
        let currentValue = this.attribute.value ? this.#parseValues(this.attribute.value).sum(v => parseInt(currentOptions.find(o => o.value === v)?.key || "0")) : 0;

        if (checked)
            currentValue |= optionKey;
        else
            currentValue &= ~optionKey;

        const value: string[] = [];
        currentOptions.orderByDescending(o => parseInt(o.key)).forEach(opt => {
            const key = parseInt(opt.key);
            if (key !== 0 && (currentValue & key) === key) {
                currentValue &= ~key;
                value.splice(0, 0, opt.value);
            }
        });

        if (value.length > 0)
            this.attribute.setValue(value.join(", "), false);
        else
            this.attribute.setValue(currentOptions.find(o => o.key === "0")?.value || "", false);
    }

    #parseValues(value: string): string[] {
        return value.split(",").map(v => v.trim());
    }
}

customElements.define("vi-persistent-object-attribute-flags-enum", PersistentObjectAttributeFlagsEnum);

PersistentObjectAttributeRegister.add("FlagsEnum", PersistentObjectAttributeFlagsEnum);
