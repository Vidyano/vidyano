import { html, nothing, unsafeCSS, type TemplateResult } from "lit";
import { property } from "lit/decorators.js";
import * as Vidyano from "vidyano";
import { Path } from "libs/pathjs/pathjs";
import { computed, notify, observer } from "components/web-component/web-component";
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute";
import * as PersistentObjectAttributeRegister from "components/persistent-object-attribute/persistent-object-attribute-register";
import { SelectReferenceDialog } from "components/select-reference-dialog/select-reference-dialog";
import type { Select } from "components/select/select";
import "components/select/select";
import styles from "./persistent-object-attribute-reference.css";

export class PersistentObjectAttributeReference extends PersistentObjectAttribute {
    static styles = [super.styles, unsafeCSS(styles)];

    declare attribute: Vidyano.PersistentObjectAttributeWithReference;

    @property({ type: String })
    @notify()
    filter: string;

    @property({ type: String })
    @computed("attribute.objectId")
    declare readonly objectId: string;

    @property({ type: String })
    @computed(function(this: PersistentObjectAttributeReference, attribute: Vidyano.PersistentObjectAttributeWithReference): string {
        return attribute && attribute.getTypeHint("inputtype", "default");
    }, "attribute")
    declare readonly inputtype: string;

    @property({ type: Boolean, reflect: true })
    @computed("attribute.selectInPlace")
    declare readonly selectInPlace: boolean;

    @property({ type: Boolean })
    @computed(function(this: PersistentObjectAttributeReference, readOnly: boolean, options: string[]): boolean {
        return !readOnly && !!options && options.length > 0;
    }, "readOnly", "options")
    declare readonly canOpenSelect: boolean;

    @property({ type: String })
    @computed(function(this: PersistentObjectAttributeReference, attribute: Vidyano.PersistentObjectAttributeWithReference): string {
        return attribute && attribute.getTypeHint("orientation", "vertical");
    }, "attribute")
    declare readonly orientation: string;

    @property({ type: String })
    @computed(function(this: PersistentObjectAttributeReference, attribute: Vidyano.PersistentObjectAttribute, href: string): string {
        return attribute && href && attribute.parent.isNew ? "_blank" : "";
    }, "attribute", "href")
    declare readonly target: string;

    @property({ type: String })
    @computed(function(this: PersistentObjectAttributeReference, displayValue: string, sensitive: boolean): string {
        return !sensitive ? displayValue : "";
    }, "attribute.displayValue", "sensitive")
    declare readonly title: string;

    @property({ type: String })
    @computed(function(this: PersistentObjectAttributeReference, attribute: Vidyano.PersistentObjectAttributeWithReference, objectId: string): string {
        if (!(attribute instanceof Vidyano.PersistentObjectAttributeWithReference))
            return null;

        if (this.app && 'getUrlForPersistentObject' in this.app && attribute.lookup && attribute.lookup.canRead && objectId)
            return Path.routes.rootPath + (<any>this.app).getUrlForPersistentObject(attribute.lookup.persistentObject.id, objectId);

        return null;
    }, "attribute", "objectId")
    declare readonly href: string;

    @property({ type: Boolean })
    @computed(function(this: PersistentObjectAttributeReference, attribute: Vidyano.PersistentObjectAttributeWithReference, editing: boolean, readOnly: boolean, sensitive: boolean, objectId: string): boolean {
        if (!(attribute instanceof Vidyano.PersistentObjectAttributeWithReference))
            return false;

        return editing && !readOnly && !sensitive && !attribute.isRequired && !String.isNullOrEmpty(objectId);
    }, "attribute", "editing", "readOnly", "sensitive", "objectId")
    declare readonly canClear: boolean;

    @property({ type: Boolean })
    @computed(function(this: PersistentObjectAttributeReference, attribute: Vidyano.PersistentObjectAttributeWithReference, editing: boolean, readOnly: boolean, sensitive: boolean): boolean {
        if (!(attribute instanceof Vidyano.PersistentObjectAttributeWithReference))
            return false;

        return editing && !readOnly && !sensitive && attribute.canAddNewReference;
    }, "attribute", "editing", "readOnly", "sensitive")
    declare readonly canAddNewReference: boolean;

    @property({ type: Boolean })
    @computed(function(this: PersistentObjectAttributeReference, attribute: Vidyano.PersistentObjectAttributeWithReference, editing: boolean, readOnly: boolean, sensitive: boolean): boolean {
        if (!(attribute instanceof Vidyano.PersistentObjectAttributeWithReference))
            return false;

        return editing && !readOnly && !sensitive && !attribute.selectInPlace;
    }, "attribute", "editing", "readOnly", "sensitive")
    declare readonly canBrowseReference: boolean;

    protected _attributeChanged() {
        super._attributeChanged();

        if (this.attribute instanceof Vidyano.PersistentObjectAttributeWithReference)
            this.filter = this.attribute.value;
        else
            this.filter = "";
    }

    @observer("value")
    protected _valueChanged(newValue: any) {
        this.filter = newValue || "";

        if (this.attribute && newValue !== this.attribute.value)
            this.attribute.setValue(newValue, true).catch(Vidyano.noop);
    }

    private async _filterBlur() {
        if (!this.attribute)
            return;

        if (!String.isNullOrEmpty(this.filter) && this.filter !== this.attribute.value) {
            this.attribute.lookup.textSearch = "vi-breadcrumb:\"" + this.filter + "\"";
            const result = await this.attribute.lookup.search();
            this.attribute.lookup.textSearch = null;

            if (!result)
                return;

            if (result.length === 1)
                await this.attribute.changeReference([result[0]]);
            else {
                if (result.length === 0) {
                    this.filter = this.attribute.value;
                    this.attribute.lookup.textSearch = "";
                }
                else
                    this.attribute.lookup.textSearch = this.filter;

                await this._browseReference(true, true);
            }
        }
        else
            this.filter = this.attribute.value;
    }

    private _browse(_e: Event) {
        this.attribute.lookup.textSearch = "";
        this._browseReference(false, true);
    }

    private async _browseReference(_throwExceptions?: boolean, forceSearch?: boolean): Promise<any> {
        this.attribute.lookup.selectedItems = [];

        const result = await this.app.showDialog(new SelectReferenceDialog(this.attribute.lookup, forceSearch, this.canAddNewReference));
        if (!result)
            return;

        if (result instanceof Array && result.length > 0 && result[0] instanceof Vidyano.QueryResultItem)
            await this.attribute.changeReference(result);

        if (result === "AddNewReference")
            await this._addNewReference();
    }

    private async _addNewReference(_e?: Event) {
        await this.attribute.addNewReference();
    }

    private async _clearReference(_e: Event) {
        await this.attribute.changeReference([]);
    }

    private _openSelect() {
        const selectInPlace = <Select>this.shadowRoot.querySelector("#selectInPlace");
        selectInPlace.open();
    }

    private _selectInPlaceChanged(e: CustomEvent) {
        if (e.detail.value !== this.attribute.objectId)
            this.attribute.changeReference([e.detail.value]);
    }

    private async _open(e: Event) {
        if (!this.app || !('getUrlForPersistentObject' in this.app) || this.attribute.parent.isNew || !this.attribute.lookup.canRead)
            return;

        e.preventDefault();

        try {
            const po = await this.attribute.getPersistentObject();
            if (po)
                this.attribute.service.hooks.onOpen(po, false);
        }
        catch (e) {
            this.attribute.parent.setNotification(e, "Error");
        }
    }

    protected renderDisplay() {
        return html`
            <a href=${this.href || nothing} title=${this.title || nothing} ?disabled=${!this.href} @click=${this._open} target=${this.target || nothing}>
                <vi-sensitive ?disabled=${!this.sensitive}>
                    <span>${this.attribute?.displayValue}</span>
                </vi-sensitive>
                ${this.href ? html`
                    <vi-icon source="ArrowUpRight" class="size-h4"></vi-icon>
                ` : nothing}
            </a>
        `;
    }

    #renderEditSelectDefault() {
        return super.renderEdit(html`
            <vi-select id="selectInPlace" class="fit" .options=${this.options} .selectedOption=${this.objectId} @selected-option-changed=${this._selectInPlaceChanged} ?readonly=${this.readOnly} placeholder=${this.placeholder || "—"} ?sensitive=${this.sensitive} ?disabled=${this.frozen}></vi-select>
            <vi-button slot="right" @click=${this._openSelect} ?hidden=${!this.canOpenSelect} tabindex="-1" ?disabled=${this.frozen}>
                <vi-icon source="CaretDown"></vi-icon>
            </vi-button>
            <a slot="right" href=${this.href || nothing} title=${this.title || nothing} ?disabled=${!this.href} tabindex="-1" @click=${this._open} target=${this.target || nothing}>
                <vi-icon source="ArrowUpRight"></vi-icon>
            </a>
            ${this.canAddNewReference ? html`
                <vi-button slot="right" @click=${this._addNewReference} tabindex="-1" ?disabled=${this.frozen}>
                    <vi-icon source="Add"></vi-icon>
                </vi-button>
            ` : nothing}
            ${this.canClear ? html`
                <vi-button slot="right" @click=${this._clearReference} tabindex="-1" ?disabled=${this.frozen}>
                    <vi-icon source="Remove"></vi-icon>
                </vi-button>
            ` : nothing}
        `);
    }

    #renderEditSelectRadio() {
        return html`
            <div>
                <div id="radiobuttons" orientation=${this.orientation || nothing}>
                    ${this.options?.map((option: any) => html`
                        <vi-checkbox label=${option.value} ?checked=${option.key === this.objectId} @changed=${(e: CustomEvent) => { e.stopPropagation(); this.attribute.changeReference([option.key]); }} radio part="radio"></vi-checkbox>
                    `)}
                </div>
            </div>
        `;
    }

    #renderEditSelectChip() {
        return html`
            <div>
                <div id="chips" orientation=${this.orientation || nothing}>
                    ${this.options?.map((option: any) => html`
                        <vi-button label=${option.value} ?inverse=${option.key !== this.objectId} @click=${(e: Event) => { e.stopPropagation(); this.attribute.changeReference([option.key]); }} part="chip"></vi-button>
                    `)}
                </div>
            </div>
        `;
    }

    #renderEditInput() {
        return super.renderEdit(html`
            <vi-sensitive ?disabled=${!this.sensitive}>
                <input .value=${this.filter || ""} @input=${(e: InputEvent) => this.filter = (e.target as HTMLInputElement).value} @blur=${this._filterBlur} ?readonly=${this.readOnly} tabindex=${this.readOnlyTabIndex || nothing} placeholder=${this.placeholder || "—"} ?disabled=${this.frozen}>
            </vi-sensitive>
            <a slot="right" href=${this.href || nothing} title=${this.title || nothing} ?disabled=${!this.href} tabindex="-1" @click=${this._open} target=${this.target || nothing}>
                <vi-icon source="ArrowUpRight"></vi-icon>
            </a>
            ${this.canBrowseReference ? html`
                <vi-button slot="right" @click=${this._browse} tabindex="-1" ?disabled=${this.frozen}>
                    <vi-icon source="Ellipsis"></vi-icon>
                </vi-button>
            ` : nothing}
            ${this.canAddNewReference ? html`
                <vi-button slot="right" @click=${this._addNewReference} tabindex="-1" ?disabled=${this.frozen}>
                    <vi-icon source="Add"></vi-icon>
                </vi-button>
            ` : nothing}
            ${this.canClear ? html`
                <vi-button slot="right" @click=${this._clearReference} tabindex="-1" ?disabled=${this.frozen}>
                    <vi-icon source="Remove"></vi-icon>
                </vi-button>
            ` : nothing}
        `);
    }

    protected renderEdit(innerTemplate?: TemplateResult) {
        if (this.attribute?.selectInPlace) {
            if (this.inputtype === "default")
                return this.#renderEditSelectDefault();

            if (this.inputtype === "radio")
                return this.#renderEditSelectRadio();

            if (this.inputtype === "chip")
                return this.#renderEditSelectChip();
        }

        return this.#renderEditInput();
    }
}

customElements.define("vi-persistent-object-attribute-reference", PersistentObjectAttributeReference);
PersistentObjectAttributeRegister.add("Reference", PersistentObjectAttributeReference);
