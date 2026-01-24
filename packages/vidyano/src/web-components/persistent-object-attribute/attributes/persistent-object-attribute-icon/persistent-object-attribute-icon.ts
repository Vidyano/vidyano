import { html, nothing, unsafeCSS, type TemplateResult } from "lit";
import { state } from "lit/decorators.js";
import "components/icon/icon";
import * as IconRegister from "components/icon/icon-register";
import type { Popup } from "components/popup/popup";
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute";
import * as PersistentObjectAttributeRegister from "components/persistent-object-attribute/persistent-object-attribute-register";
import styles from "./persistent-object-attribute-icon.css";

export class PersistentObjectAttributeIcon extends PersistentObjectAttribute {
    static styles = [super.styles, unsafeCSS(styles)];

    @state()
    private icons: string[];

    private _onOpening() {
        const icons = IconRegister.all();
        this.icons = !this.attribute.isRequired ? [null, ...icons] : icons;
    }

    private _selectIcon(icon: string) {
        this.attribute.setValue(icon);
        this.shadowRoot.querySelector<Popup>("vi-popup")?.close();
    }

    private _onInput(e: InputEvent) {
        this.value = (e.target as HTMLInputElement).value;
    }

    protected override renderDisplay() {
        return html`
            <div class="value">
                <vi-icon source=${this.attribute?.displayValue}></vi-icon>
                <span>${this.attribute?.displayValue}</span>
            </div>
        `;
    }

    protected override renderEdit(innerTemplate?: TemplateResult) {
        return super.renderEdit(html`
            <vi-popup auto-width @popup-opening=${this._onOpening}>
                <div class="value" slot="header">
                    <vi-icon source=${this.attribute?.value}></vi-icon>
                    <input class="flex"
                        .value=${this.value || ""}
                        @input=${this._onInput}
                        ?readonly=${this.readOnly}
                        tabindex=${this.readOnlyTabIndex}
                        ?disabled=${this.frozen}>
                </div>
                <vi-scroller>
                    <div class="icon-grid">
                        ${this.icons?.map(icon => html`
                            <div class="icon" @click=${() => this._selectIcon(icon)} ?selected=${icon === this.value}>
                                <vi-icon source=${icon}></vi-icon>
                            </div>
                        `)}
                    </div>
                </vi-scroller>
            </vi-popup>
        `);
    }
}

customElements.define("vi-persistent-object-attribute-icon", PersistentObjectAttributeIcon);

PersistentObjectAttributeRegister.add("Icon", PersistentObjectAttributeIcon);
