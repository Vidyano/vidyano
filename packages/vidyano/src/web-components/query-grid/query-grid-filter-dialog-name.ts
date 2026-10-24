import * as Polymer from "polymer"
import * as Vidyano from "@vidyano/core"

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

@Polymer.WebComponent.register({
    properties: {
        attribute: {
            type: Object,
            observer: "_attributeChanged"
        },
        grouping: {
            type: String,
            readOnly: true
        },
        group: {
            type: String,
            notify: true,
            value: null
        },
        name: {
            type: String,
            notify: true,
            value: null
        }
    },
    observers: [
        "_focusInput(grouping, isConnected)",
        "_updateAttributeValue(attribute, name, group, isConnected)",
    ]
}, "vi-query-grid-filter-dialog-name")
export class QueryGridFilterDialogName extends Polymer.WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="query-grid-filter-dialog-name.html">` }

    private _blockUpdate: boolean;

    readonly grouping: boolean; private _setGrouping: (grouping: boolean) => void;
    attribute: Vidyano.PersistentObjectAttribute;
    group: string;
    name: string;

    private _attributeChanged(attribute: Vidyano.PersistentObjectAttribute) {
        if (!attribute)
            return;

        try {
            this._blockUpdate = true;

            const parts = splitFilterName(<string>attribute.value);
            this._setGrouping(parts.group != null);

            if (this.grouping)
                this.group = parts.group;

            this.name = parts.name;
        }
        finally {
            this._blockUpdate = false;
        }
    }

    private _focusInput(grouping: boolean, isConnected: boolean) {
        if (!this.isConnected)
            return;

        const input = <HTMLInputElement>this.shadowRoot.querySelector(`input.${grouping ? "group" : "name"}`);
        this._focusElement(input);
    }

    private _toggleGrouping() {
        this._setGrouping(!this.grouping);
        if (!this.grouping)
            this.group = "";
    }

    private _updateAttributeValue(attribute: Vidyano.PersistentObjectAttribute, name: string, group: string, isConnected: boolean) {
        if (!this.isConnected || this._blockUpdate)
            return;

        attribute.setValue(name && group ? `${group}\n${name}` : name);
    }
}
