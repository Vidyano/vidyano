import * as Vidyano from "vidyano"
import * as Polymer from "polymer"
import { WebComponent } from "components/web-component/web-component"

@WebComponent.register({
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
})
export class QueryGridFilterDialogName extends WebComponent {
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

            const name = <string>attribute.value;
            this._setGrouping(name ? name.contains("\n") : false);

            if (!this.grouping)
                this.name = name;
            else {
                const parts = name.split("\n");
                this.group = parts[0];
                this.name = parts[1];
            }
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