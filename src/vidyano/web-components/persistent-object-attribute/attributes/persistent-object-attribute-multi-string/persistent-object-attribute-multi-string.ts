import { html, nothing, unsafeCSS } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { state } from "lit/decorators.js";
import * as Vidyano from "vidyano";
import * as PersistentObjectAttributeRegister from "components/persistent-object-attribute/persistent-object-attribute-register";
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute";
import { computed, observer } from "components/web-component/web-component";
import type { Tags } from "components/tags/tags";
import type { ISortableDragEndDetails } from "components/sortable/sortable";
import "components/tags/tags";
import styles from "./persistent-object-attribute-multi-string.css";

interface StringItem {
    id: string;
    value: string;
    isReadOnly: boolean;
    sensitive: boolean;
}

let _nextId = 0;

export class PersistentObjectAttributeMultiString extends PersistentObjectAttribute {
    static styles = [super.styles, unsafeCSS(styles)];

    @state()
    private _strings: StringItem[] = [];

    @state()
    private _newItemValue: string = "";

    @state()
    tags: string[] = [];

    private _dragInProgress = false;
    private _valueAtFocus: string = null;

    @computed(function(this: PersistentObjectAttributeMultiString): boolean {
        return this.attribute?.getTypeHint("inputtype", undefined, undefined) === "tags";
    }, "attribute.typeHints")
    declare readonly isTags: boolean;

    @computed(function(this: PersistentObjectAttributeMultiString): string[] {
        if (!this.attribute?.options || this.attribute.options.length === 0)
            return null;

        return (this.attribute.options as string[]).filter(o => !String.isNullOrEmpty(o));
    }, "attribute.options")
    declare readonly suggestions: string[];

    get filteredSuggestions(): string[] {
        if (!this.suggestions || this.suggestions.length === 0)
            return [];

        const currentStrings = this._strings.map(s => s.value);
        return this.suggestions.filter(s => currentStrings.indexOf(s) < 0);
    }

    get hasSuggestions(): boolean {
        return this.editing && !this.readOnly && this.filteredSuggestions?.length > 0;
    }

    get isTagsReadonly(): boolean {
        return this.readOnly || !this.editing || this.frozen;
    }

    override focus() {
        if (!this.isTags) {
            const firstInput = this.shadowRoot.querySelector(".string-item input") as HTMLInputElement;
            firstInput?.focus();
        }
        else {
            (this.shadowRoot.querySelector("vi-tags") as Tags)?.focus();
        }
    }

    @observer("value", "attribute.isReadOnly", "sensitive")
    private _computeStrings(value: string, isReadOnly: boolean, sensitive: boolean) {
        // Don't recreate strings while dragging - the DOM is being managed by vi-sortable
        if (this._dragInProgress)
            return;

        const newValues = value ? value.split("\n").filter(v => !!v.length) : [];
        const currentValues = this._strings.map(s => s.value);

        // Check if values actually changed (order or content)
        const valuesMatch = newValues.length === currentValues.length &&
            newValues.every((v, i) => v === currentValues[i]);

        if (valuesMatch) {
            // Just update isReadOnly/sensitive flags without recreating items
            this._strings.forEach(s => {
                s.isReadOnly = isReadOnly || sensitive;
                s.sensitive = sensitive;
            });
            return;
        }

        // Values changed - recreate strings array
        const strings: StringItem[] = newValues.map(v => ({
            id: `str-${_nextId++}`,
            value: v,
            isReadOnly: isReadOnly || sensitive,
            sensitive: sensitive
        }));

        this._strings = strings;
    }

    protected override _valueChanged(newValue: any, oldValue: any) {
        super._valueChanged(newValue, oldValue);

        if (!newValue)
            this.tags = [];
        else
            this.tags = newValue.split("\n").filter((v: string) => !!v.length);
    }

    private _onDragStart() {
        this._dragInProgress = true;
    }

    private _onItemFocus() {
        this._valueAtFocus = this.attribute?.value;
    }

    private _onItemInput(e: InputEvent, index: number) {
        const input = e.target as HTMLInputElement;
        this._strings[index].value = input.value;
        this.#updateValueFromStrings();
    }

    private _onItemBlur() {
        if (this._dragInProgress)
            return;

        if (!this.frozen && this.attribute && this._valueAtFocus !== this.attribute.value)
            this.attribute.setValue(this.attribute.value, true).catch(Vidyano.noop);
    }

    private _onNewItemInput(e: InputEvent) {
        const input = e.target as HTMLInputElement;
        const value = input.value;

        if (value) {
            // Add the new value to the list
            this.value = `${this.value || ""}\n${value}`;
            this._newItemValue = "";

            // Focus the last item and clear new-item input after update
            this.updateComplete.then(() => {
                // Clear the new-item input after Lit has re-rendered
                const newItemInput = this.shadowRoot.querySelector(".new-item input") as HTMLInputElement;
                if (newItemInput)
                    newItemInput.value = "";

                const items = this.shadowRoot.querySelectorAll(".string-item:not(.new-item) input");
                const lastInput = items[items.length - 1] as HTMLInputElement;
                lastInput?.focus();
            });
        }
    }

    private _itemsOrderChanged(e: CustomEvent<ISortableDragEndDetails>) {
        const details = e.detail;
        if (details.newIndex === details.oldIndex || details.newIndex < 0) {
            this._dragInProgress = false;
            return;
        }

        // Reorder _strings array to match the new DOM order
        const stringsContainer = this.shadowRoot.querySelector("#strings") as HTMLElement;
        const newOrder: StringItem[] = [];
        stringsContainer.querySelectorAll(".string-item:not(.new-item)").forEach((item) => {
            const input = item.querySelector("input") as HTMLInputElement;
            const existingItem = this._strings.find(s => s.value === input.value);
            if (existingItem)
                newOrder.push(existingItem);
        });

        this._dragInProgress = false;
        this._strings = newOrder;

        const newValue = this._strings.filter(s => !!s.value).map(s => s.value).join("\n");
        if (this.attribute)
            this.attribute.setValue(newValue, true).catch(Vidyano.noop);
    }

    #updateValueFromStrings() {
        this.value = this._strings.filter(s => !!s.value).map(s => s.value).join("\n");
    }

    private _onTagsChanged(e: CustomEvent) {
        if (!this.isTags || !this.editing)
            return;

        const tags = e.detail.value as string[];
        const newValue = tags.filter(t => !!t).join("\n");
        if (this.value !== newValue)
            this.value = newValue;
    }

    private _addSuggestionTag(e: MouseEvent) {
        const suggestion = (e.currentTarget as HTMLElement).textContent;
        this.value = `${this.value}\n${suggestion}`;
    }

    #renderStringItem(item: StringItem, index: number) {
        return html`
            <div class="string-item" data-index=${index}>
                <vi-icon source="Hamburger" class="sort-handle" part="icon" ?hidden=${item.sensitive} ?disabled=${this.frozen}></vi-icon>
                <vi-sensitive ?disabled=${!item.sensitive}>
                    <input
                        .value=${item.value}
                        @focus=${this._onItemFocus}
                        @input=${(e: InputEvent) => this._onItemInput(e, index)}
                        @blur=${this._onItemBlur}
                        type="text"
                        ?readonly=${item.isReadOnly}
                        tabindex=${item.isReadOnly ? "-1" : nothing}
                        ?disabled=${this.frozen}>
                </vi-sensitive>
            </div>
        `;
    }

    #renderNewItem() {
        return html`
            <div class="string-item new-item">
                <vi-icon source="Hamburger" class="sort-handle" part="icon" style="visibility: hidden;"></vi-icon>
                <vi-sensitive ?disabled=${!this.sensitive}>
                    <input
                        .value=${this._newItemValue}
                        @input=${this._onNewItemInput}
                        type="text"
                        ?disabled=${this.frozen}
                        placeholder=${this.placeholder || nothing}>
                </vi-sensitive>
            </div>
        `;
    }

    protected override renderDisplay() {
        if (this.isTags) {
            return html`
                <vi-tags content .tags=${this.tags} disabled ?sensitive=${this.sensitive}></vi-tags>
            `;
        }

        return html`
            <vi-scroller no-horizontal class="flex">
                <vi-sensitive ?disabled=${!this.sensitive}>
                    <pre>${this.attribute?.displayValue}</pre>
                </vi-sensitive>
            </vi-scroller>
        `;
    }

    protected override renderEdit() {
        if (this.isTags) {
            return super.renderEdit(html`
                <vi-tags content .tags=${this.tags} @tags-changed=${this._onTagsChanged} ?disabled=${this.isTagsReadonly} ?sensitive=${this.sensitive}></vi-tags>
                ${this.hasSuggestions ? html`
                    <vi-popup id="suggestions" slot="right">
                        <vi-icon source="Add" slot="header"></vi-icon>
                        <vi-scroller>
                            <ul>
                                ${this.filteredSuggestions?.map(suggestion => html`
                                    <li @click=${this._addSuggestionTag}>${suggestion}</li>
                                `)}
                            </ul>
                        </vi-scroller>
                    </vi-popup>
                ` : nothing}
            `);
        }

        return html`
            <vi-scroller no-horizontal class="flex">
                <vi-sortable id="strings" draggable-items=".string-item:not(.new-item)" handle=".sort-handle" ?enabled=${!this.frozen} ?sensitive=${this.sensitive} ?disabled=${this.frozen} @drag-start=${this._onDragStart} @drag-end=${this._itemsOrderChanged}>
                    ${repeat(this._strings, (item) => item.id, (item, index) => this.#renderStringItem(item, index))}
                </vi-sortable>
                ${!this.readOnly ? this.#renderNewItem() : nothing}
            </vi-scroller>
            <vi-persistent-object-attribute-validation-error .attribute=${this.attribute}></vi-persistent-object-attribute-validation-error>
        `;
    }
}

customElements.define("vi-persistent-object-attribute-multi-string", PersistentObjectAttributeMultiString);

PersistentObjectAttributeRegister.add("MultiString", PersistentObjectAttributeMultiString);
