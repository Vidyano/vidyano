import { html, nothing, unsafeCSS } from "lit";
import { property } from "lit/decorators.js";
import * as Vidyano from "vidyano";
import { computed } from "components/web-component/web-component";
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute";
import { SelectReferenceDialog } from "components/select-reference-dialog/select-reference-dialog";
import * as PersistentObjectAttributeRegister from "components/persistent-object-attribute/persistent-object-attribute-register";
import styles from "./persistent-object-attribute-user.css";

export class PersistentObjectAttributeUser extends PersistentObjectAttribute {
    static styles = [super.styles, unsafeCSS(styles)];

    @property({ type: String })
    @computed(function(this: PersistentObjectAttributeUser, options: string[]): string {
        return options && options.length > 0 ? options[0] || "\u2014" : "\u2014";
    }, "attribute.options")
    declare readonly friendlyName: string;

    @property({ type: Boolean })
    @computed(function(this: PersistentObjectAttributeUser, readOnly: boolean, isRequired: boolean, value: string): boolean {
        return !readOnly && !isRequired && !String.isNullOrEmpty(value);
    }, "readOnly", "attribute.isRequired", "value")
    declare readonly canClear: boolean;

    @property({ type: Boolean })
    @computed(function(this: PersistentObjectAttributeUser, readOnly: boolean): boolean {
        return !readOnly;
    }, "readOnly")
    declare readonly canBrowseReference: boolean;

    private async _browseReference() {
        const query = await this.attribute.parent.queueWork(() => this.attribute.service.getQuery(this.attribute.getTypeHint("IncludeGroups") === "True" ? "98b12f32-3f2d-4f54-b963-cb9206f74355" : "273a8302-ddc8-43db-a7f6-c3c28fc8f593", undefined, this.attribute.parent));
        query.maxSelectedItems = 1;

        const result = <Vidyano.QueryResultItem[]>await this.app.showDialog(new SelectReferenceDialog(query));
        if (!result)
            return;

        this._setNewUser(result[0].id, result[0].getValue("FriendlyName") || result[0].getValue("Name"));
    }

    private _clearReference() {
        this._setNewUser(null, null);
    }

    private _setNewUser(id: string, name: string) {
        this.attribute.options = [name];
        this.attribute.setValue(id, true);
    }

    protected renderDisplay() {
        return html`
            <vi-sensitive disabled=${!this.sensitive}>
                <span>${this.friendlyName}</span>
            </vi-sensitive>
        `;
    }

    protected renderEdit() {
        return html`
            <vi-persistent-object-attribute-edit .attribute=${this.attribute}>
                <vi-sensitive disabled=${!this.sensitive}>
                    <input .value=${this.friendlyName} readonly>
                </vi-sensitive>
                ${!this.readOnly ? html`
                    <vi-button slot="right" @click=${this._browseReference} tabindex="-1">
                        <vi-icon source="Ellipsis"></vi-icon>
                    </vi-button>
                ` : nothing}
                ${this.canClear ? html`
                    <vi-button slot="right" @click=${this._clearReference} tabindex="-1">
                        <vi-icon source="Remove"></vi-icon>
                    </vi-button>
                ` : nothing}
            </vi-persistent-object-attribute-edit>
        `;
    }
}

customElements.define("vi-persistent-object-attribute-user", PersistentObjectAttributeUser);

PersistentObjectAttributeRegister.add("User", PersistentObjectAttributeUser);
