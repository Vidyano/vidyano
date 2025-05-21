import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute"
import { PersistentObjectAttributeMultiStringItem } from "./persistent-object-attribute-multi-string-item"
import { Sortable } from "components/sortable/sortable"
import type { Tags } from "components/tags/tags"
import "components/tags/tags"
import { WebComponent } from "components/web-component/web-component"

@WebComponent.register()
export class PersistentObjectAttributeMultiStringItems extends Sortable {
    protected _dragEnd() {
        this.fire("reorder-strings", {}, { bubbles: true });
    }
}

@WebComponent.register({
    properties: {
        maxlength: Number,
        strings: {
            type: Array,
            computed: "_computeStrings(value, attribute.isReadOnly, sensitive)"
        },
        isTags: {
            type: Boolean,
            computed: "_computeIsTags(attribute)"
        },
        tags: {
            type: Array
        },
        suggestions: {
            type: Array,
            computed: "_computeTagSuggestions(attribute)"
        },
        hasSuggestions: {
            type: Boolean,
            computed: "_computeHasTagSuggestions(filteredSuggestions, editing, readOnly)"
        },
        filteredSuggestions: {
            type: Array,
            computed: "_computeFilteredSuggestions(suggestions, strings)"
        },
        isTagsReadonly: {
            type: Boolean,
            computed: "_computeIsTagsReadonly(readOnly, editing, frozen)"
        }
    },
    observers: [
        "_render(strings, editing, isConnected)",
        "_onTagsChanged(isTags, tags.*)",
        "_onFrozenChanged(frozen)"
    ],
    listeners: {
        "multi-string-item-value-new": "_itemValueNew",
        "multi-string-item-value-changed": "_itemValueChanged",
        "reorder-strings": "_itemsOrderChanged"
    },
    forwardObservers: [
        "attribute.isReadOnly"
    ]
})
export class PersistentObjectAttributeMultiString extends PersistentObjectAttribute {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-attribute-multi-string.html">`; }

    readonly isTags: boolean;
    readonly suggestions: string[];
    readonly hasSuggestions: boolean;
    strings: PersistentObjectAttributeMultiStringItem[];
    tags: string[];

    focus() {
        if (Array.from(this.shadowRoot.querySelectorAll("vi-persistent-object-attribute-multi-string-item")).some(str => str.shadowRoot?.contains(this.app.activeElement)))
            return;

        if (!this.isTags)
            (this.shadowRoot.querySelector("vi-persistent-object-attribute-multi-string-item") as PersistentObjectAttributeMultiStringItem)?.focus();
        else
            (this.shadowRoot.querySelector("vi-tags") as Tags)?.focus();
    }

    private _computeStrings(value: string, readOnly: boolean, sensitive: boolean): PersistentObjectAttributeMultiStringItem[] {
        const strings = value ? value.split("\n").filter(v => !!v.length).map((v: string, n: number) => this.strings && this.strings[n] && this.strings[n].value === v ? this.strings[n] : new PersistentObjectAttributeMultiStringItem(v)) : [];
        strings.forEach(s => {
            s.isReadOnly = readOnly || sensitive;
            s.sensitive = sensitive;
        });

        return strings;
    }

    private _itemValueNew(e: CustomEvent) {
        const { value }: { value: string } = e.detail;
        this.value = `${this.value || ""}\n${value}`;

        Polymer.flush();
        this._focusElement(this.strings[this.strings.length - 1].input);

        e.stopPropagation();
    }

    private _itemsOrderChanged() {
        const stringsContainer = <HTMLElement>this.shadowRoot.querySelector("#strings");
        this.value = Array.from(stringsContainer.children).filter((i: PersistentObjectAttributeMultiStringItem) => !!i.value).map((i: PersistentObjectAttributeMultiStringItem) => i.value).join("\n");
    }

    private _itemValueChanged(e: Event) {
        this.value = this.strings.filter(s => !!s.value).map(s => s.value).join("\n");

        e.stopPropagation();
    }

    private _render(strings: PersistentObjectAttributeMultiStringItem[], editing: boolean, isConnected: boolean) {
        if (!editing || !isConnected || this.isTags)
            return;

        Polymer.flush();

        const stringsContainer = <HTMLElement>this.shadowRoot.querySelector("#strings");
        if (stringsContainer.children.length !== strings.length || strings.some((s, n) => stringsContainer.children[n] !== s))
            strings.forEach((s: PersistentObjectAttributeMultiStringItem) => stringsContainer.appendChild(s));

        Array.from(stringsContainer.children).forEach((c: PersistentObjectAttributeMultiStringItem) => {
            if (strings.indexOf(c) < 0)
                stringsContainer.removeChild(c);
        });
    }

    /// Tags specific code

    private _computeIsTags(attribute: Vidyano.PersistentObjectAttribute): boolean {
        return attribute && attribute.getTypeHint("inputtype", undefined, undefined, true) === "tags";
    }

    protected _valueChanged(newValue: any, oldValue: any) {
        super._valueChanged(newValue, oldValue);

        if (!newValue)
            this.tags = [];
        else
            this.tags = newValue.split("\n").filter(v => !!v.length);
    }

    private _onTagsChanged(isTags: boolean) {
        if (!this.isTags || !this.tags || !this.editing)
            return;

        const newValue = this.tags.filter(t => !!t).join("\n");
        if (this.value !== newValue)
            this.value = newValue;
    }

    private _onFrozenChanged(frozen: boolean) {
        this.strings?.forEach(str => str.toggleAttribute("disabled", frozen));
    }

    private _computeTagSuggestions(attribute: Vidyano.PersistentObjectAttribute): string[] {
        if (!attribute || !attribute.options || !attribute.options.length)
            return null;

        return (<string[]>this.attribute.options).filter(o => !String.isNullOrEmpty(o));
    }

    private _computeHasTagSuggestions(suggestions: string[], editing: boolean, readOnly: boolean): boolean {
        return editing && !readOnly && suggestions && suggestions.length > 0;
    }

    private _computeFilteredSuggestions(suggestions: string[], strings: PersistentObjectAttributeMultiStringItem[]): string[] {
        if (!suggestions || suggestions.length === 0)
            return [];

        const currentStrings = strings.map(s => s.value);
        return suggestions.filter(s => currentStrings.indexOf(s) < 0);
    }

    private _computeIsTagsReadonly(readOnly: boolean, editing: boolean, frozen: boolean) {
        return readOnly || !editing || frozen;
    }

    private _addSuggestionTag(e: Polymer.Gestures.TapEvent) {
        this.value = `${this.value}\n${e.model.suggestion}`;
    }
}

PersistentObjectAttribute.registerAttributeType("MultiString", PersistentObjectAttributeMultiString);