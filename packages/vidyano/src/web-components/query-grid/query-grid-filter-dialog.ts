import { CSSResultGroup, html, TemplateResult, unsafeCSS } from "lit"
import { state } from "lit/decorators.js"
import * as Vidyano from "@vidyano/core"
import { Dialog } from "components/dialog/dialog"
import "components/notification/notification"
import { PersistentObjectAttributePresenter } from "components/persistent-object-attribute-presenter/persistent-object-attribute-presenter"
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute"
import { QueryGridFilterDialogName } from "./query-grid-filter-dialog-name"
import styles from "./query-grid-filter-dialog.css"

/**
 * Presents the filter name attribute with the group/name editor instead of the default string editor.
 */
export class QueryGridFilterDialogNamePresenter extends PersistentObjectAttributePresenter {
    protected createAttributeElement(): PersistentObjectAttribute {
        return <PersistentObjectAttribute><unknown>new QueryGridFilterDialogName();
    }
}

customElements.define("vi-query-grid-filter-dialog-name-presenter", QueryGridFilterDialogNamePresenter);

export class QueryGridFilterDialog extends Dialog {
    static styles: CSSResultGroup = [Dialog.styles, unsafeCSS(styles)];

    @state()
    persistentObject: Vidyano.PersistentObject;

    @state()
    saving: boolean = false;

    constructor(private _filters: Vidyano.QueryFilters, private _filter: Vidyano.QueryFilter) {
        super();

        this.persistentObject = _filter.persistentObject;
        this.persistentObject.beginEdit();
    }

    protected renderContent(): TemplateResult {
        return html`
            <vi-notification .serviceObject=${this.persistentObject}></vi-notification>
            <main>
                <vi-query-grid-filter-dialog-name-presenter .attribute=${this.persistentObject?.attributes.Name}></vi-query-grid-filter-dialog-name-presenter>
                <vi-persistent-object-attribute-presenter .attribute=${this.persistentObject?.attributes.IsDefault}></vi-persistent-object-attribute-presenter>
            </main>
            <footer>
                <vi-button inverse @click=${this.cancel} label=${this.translations.Cancel} ?disabled=${this.saving}></vi-button>
                <vi-button @click=${this._save} action-type="Default" label=${this.translations.Save} ?disabled=${this.saving}></vi-button>
            </footer>
        `;
    }

    private async _save() {
        this.saving = true;
        try {
            if (await this._filters.save(this._filter)) {
                super.close();
                return;
            }

            this.persistentObject = this._filter.persistentObject;
        }
        finally {
            this.saving = false;
        }
    }

    close(result?: any) {
        this._filter.persistentObject.cancelEdit();
        super.close();
    }
}

customElements.define("vi-query-grid-filter-dialog", QueryGridFilterDialog);
