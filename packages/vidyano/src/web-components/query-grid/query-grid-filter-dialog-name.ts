import { html, unsafeCSS } from "lit"
import { property } from "lit/decorators.js"
import * as Vidyano from "@vidyano/core"
import { notify, observer, WebComponent } from "components/web-component/web-component"
import styles from "./query-grid-filter-dialog-name.css"

/**
 * Splits a filter name at its first line break into a group (null without one) and a name.
 * Further line breaks in the name become spaces, since an input can't show them.
 */
export function splitFilterName(value: string): { group: string; name: string } {
    const index = value ? value.indexOf("\n") : -1;
    if (index < 0)
        return { group: null, name: value };

    return { group: value.substring(0, index), name: value.substring(index + 1).replace(/\n/g, " ") };
}

export class QueryGridFilterDialogName extends WebComponent {
    static styles = unsafeCSS(styles);

    @property({ type: Object })
    @observer(function(this: QueryGridFilterDialogName, attribute: Vidyano.PersistentObjectAttribute) {
        this._attributeChanged(attribute);
    })
    attribute: Vidyano.PersistentObjectAttribute;

    @property({ type: Boolean })
    @observer(function(this: QueryGridFilterDialogName) {
        this._focusInput();
    })
    grouping: boolean = false;

    @property({ type: String })
    @notify()
    group: string = null;

    @property({ type: String })
    @notify()
    name: string = null;

    connectedCallback() {
        super.connectedCallback();

        this._focusInput();
    }

    render() {
        return html`
            <vi-persistent-object-attribute-edit .attribute=${this.attribute} reverse>
                <vi-button slot="left" icon="Folder" @click=${this._toggleGrouping} inverse tabindex="-1"></vi-button>
                <div class="inputs">
                    <input class="group" .value=${this.group ?? ""} @input=${this._groupInput} ?hidden=${!this.grouping} />
                    <vi-icon source="ChevronRight" ?hidden=${!this.grouping}></vi-icon>
                    <input class="name" .value=${this.name ?? ""} @input=${this._nameInput} />
                </div>
            </vi-persistent-object-attribute-edit>
        `;
    }

    private _attributeChanged(attribute: Vidyano.PersistentObjectAttribute) {
        if (!attribute)
            return;

        const parts = splitFilterName(<string>attribute.value);
        this.grouping = parts.group != null;
        this.group = parts.group;
        this.name = parts.name;
    }

    private async _focusInput() {
        await this.updateComplete;
        if (!this.isConnected)
            return;

        this.#focusElement(this.shadowRoot.querySelector(`input.${this.grouping ? "group" : "name"}`));
    }

    #focusElement(element: HTMLElement, attempt: number = 0) {
        if (!this.isConnected)
            return;

        if (element) {
            const oldActiveElementPath = this.app?.activeElementPath || [];
            if (oldActiveElementPath.some(e => e === element))
                return;

            element.focus();

            if (this.app?.activeElementPath?.some(e => e === element))
                return;
        }

        if (attempt < 10)
            setTimeout(() => this.#focusElement(element, attempt + 1), 100);
    }

    private _toggleGrouping() {
        this.grouping = !this.grouping;
        if (!this.grouping) {
            this.group = "";
            this._updateAttributeValue();
        }
    }

    private _groupInput(e: InputEvent) {
        this.group = (<HTMLInputElement>e.target).value;
        this._updateAttributeValue();
    }

    private _nameInput(e: InputEvent) {
        this.name = (<HTMLInputElement>e.target).value;
        this._updateAttributeValue();
    }

    private _updateAttributeValue() {
        this.attribute?.setValue(this.name && this.group ? `${this.group}\n${this.name}` : this.name).catch(Vidyano.noop);
    }
}

customElements.define("vi-query-grid-filter-dialog-name", QueryGridFilterDialogName);
