import { html, nothing, unsafeCSS } from "lit";
import { property, state } from "lit/decorators.js";
import * as Vidyano from "vidyano";
import { Scroller } from "components/scroller/scroller";
import { SelectReferenceDialog } from "components/select-reference-dialog/select-reference-dialog";
import { PersistentObjectAttributePresenter } from "components/persistent-object-attribute-presenter/persistent-object-attribute-presenter";
import { computed, listener, observer } from "components/web-component/web-component";
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute";
import * as PersistentObjectAttributeRegister from "components/persistent-object-attribute/persistent-object-attribute-register";
import styles from "./persistent-object-attribute-as-detail.css";

export class PersistentObjectAttributeAsDetail extends PersistentObjectAttribute {
    static styles = [super.styles, unsafeCSS(styles)];

    declare attribute: Vidyano.PersistentObjectAttributeAsDetail;

    #unfrozenActiveObjectIndex: number;

    @state()
    @computed(function(this: PersistentObjectAttributeAsDetail, columns: Vidyano.QueryColumn[]): Vidyano.QueryColumn[] {
        return columns?.filter(c => !c.isHidden && c.width !== "0") ?? [];
    }, "attribute.details.columns")
    declare readonly columns: Vidyano.QueryColumn[];

    @observer("columns", "canDelete", "hasVerticalScrollbar")
    private _updateColumnsWidths(columns: Vidyano.QueryColumn[], canDelete: boolean, hasVerticalScrollbar: boolean) {
        this.#updateWidths(columns, canDelete, hasVerticalScrollbar);
    }

    @state()
    newAction: Vidyano.Action;

    @property({ type: Boolean, reflect: true })
    newActionPinned: boolean = false;

    @state()
    deleteAction: boolean;

    @property({ type: Boolean, reflect: true })
    @computed(function(this: PersistentObjectAttributeAsDetail, editing: boolean, deleteAction: boolean, objects: Vidyano.PersistentObject[], attribute: Vidyano.PersistentObjectAttributeAsDetail): boolean {
        return editing && deleteAction && (attribute?.parent?.isNew || (!!objects && objects.some(o => !o.isDeleted)));
    }, "editing", "deleteAction", "attribute.objects", "attribute")
    declare readonly canDelete: boolean;

    @property({ type: Boolean, reflect: true })
    @state()
    initializing: boolean = true;

    @state()
    activeObjectIndex: number = -1;

    @state()
    isAdding: boolean = false;

    @state()
    hasVerticalScrollbar: boolean = false;

    @property({ type: Boolean, reflect: true })
    forceFullEdit: boolean = false;

    @observer("attribute.details.actions", "editing", "readOnly", "attribute")
    private _updateActions(actions: Record<string, Vidyano.Action>, editing: boolean, readOnly: boolean, attribute: Vidyano.PersistentObjectAttributeAsDetail) {
        this.newAction = editing && !readOnly ? actions?.["New"] || null : null;
        this.deleteAction = editing && !readOnly && (attribute?.parent?.isNew || !!actions?.["Delete"]);
    }

    #updateWidths(columns: Vidyano.QueryColumn[], canDelete: boolean, hasVerticalScrollbar: boolean) {
        if (!this.isConnected || !columns?.length)
            return;

        let remainingFraction = 100;
        const widths = columns.filter(c => c.width !== "0").map(c => {
            if (c.width?.endsWith("%")) {
                const width = parseInt(c.width);
                remainingFraction -= width;
                return `${width}fr`;
            }

            const width = parseInt(c.width);
            if (!isNaN(width) && width)
                return `${width}px`;

            return null;
        });

        const remainingWidths = widths.filter(w => w === null);
        if (remainingWidths.length > 0) {
            const remainingWidth = `${remainingFraction / remainingWidths.length}fr`;
            widths.forEach((w, i) => {
                if (w)
                    return;

                widths[i] = remainingWidth;
            });
        }

        if (canDelete)
            widths.push("min-content");

        if (hasVerticalScrollbar && canDelete)
            widths.push("var(--vi-scroller-thumb-capture-size)");

        this.style.setProperty("--column-widths", widths.join(" "));

        this.initializing = false;
    }

    @observer("frozen")
    private _frozenChanged(frozen: boolean) {
        if (frozen) {
            this.#unfrozenActiveObjectIndex = this.activeObjectIndex;
            this.activeObjectIndex = -1;
        } else if (this.#unfrozenActiveObjectIndex !== undefined && this.attribute.objects.length > this.#unfrozenActiveObjectIndex) {
            this.activeObjectIndex = this.#unfrozenActiveObjectIndex;
            this.#unfrozenActiveObjectIndex = undefined;
        }
    }

    private async _add() {
        if (this.isAdding)
            return;

        try {
            this.isAdding = true;

            // Ensure any pending updates are applied before creating the new object
            await this.updateComplete;

            const po = await this.attribute.newObject();
            if (!po)
                return;

            if (po.stateBehavior.indexOf("OpenAsDialog") < 0) {
                if (this.attribute.lookupAttribute && po.attributes[this.attribute.lookupAttribute]) {
                    const lookupAttribute = po.attributes[this.attribute.lookupAttribute] as Vidyano.PersistentObjectAttributeWithReference;
                    lookupAttribute.lookup.search();

                    lookupAttribute.lookup.maxSelectedItems = 0;
                    const items = await this.app.showDialog(new SelectReferenceDialog(lookupAttribute.lookup)) as Vidyano.QueryResultItem[];
                    if (items && items.length > 0) {
                        const objects = [po];

                        let item = items.shift();
                        await lookupAttribute.changeReference([item]);
                        do {
                            if (!(item = items.shift()))
                                break;

                            const po2 = await this.attribute.newObject();
                            await (po2.getAttribute(this.attribute.lookupAttribute) as Vidyano.PersistentObjectAttributeWithReference).changeReference([item]);
                            objects.push(po2);
                        }
                        while (items.length > 0);

                        await this.#finalizeAdd(...objects);
                    }
                }
                else
                    await this.#finalizeAdd(po);
            }
            else {
                const { PersistentObjectDialog } = await import("components/persistent-object-dialog/persistent-object-dialog");
                this.app.showDialog(new PersistentObjectDialog(po, {
                    saveLabel: po.service.actionDefinitions["AddReference"].displayName,
                    save: (po, close) => {
                        this.#finalizeAdd(po);
                        close();
                    }
                }));
            }
        }
        catch (e) {
            this.attribute.parent.setNotification(e);
        }
        finally {
            this.isAdding = false;
        }
    }

    async #finalizeAdd(...objects: Vidyano.PersistentObject[]) {
        objects.forEach(po => {
            po.parent = this.attribute.parent;
            this.attribute.objects.push(po);
        });
        this.activeObjectIndex = this.attribute.objects.length - 1;

        await this.updateComplete;
        requestAnimationFrame(() => {
            const scroller = this.shadowRoot?.querySelector("#body") as Scroller;
            if (scroller)
                scroller.verticalScrollOffset = scroller.innerHeight;
        });

        this.attribute.isValueChanged = true;
        this.attribute.parent.triggerDirty();

        if (this.attribute.triggersRefresh)
            await this.attribute.triggerRefresh(true);

        this.requestUpdate();
    }

    private _delete(object: Vidyano.PersistentObject) {
        object.isDeleted = true;
        if (object.isNew) {
            const index = this.attribute.objects.indexOf(object);
            if (index >= 0)
                this.attribute.objects.splice(index, 1);
        }

        this.attribute.isValueChanged = true;
        this.attribute.parent.triggerDirty();

        if (this.attribute.triggersRefresh)
            this.attribute.triggerRefresh(true);

        this.requestUpdate();
    }

    private _setActiveObjectIndex(index: number, e: Event) {
        if (!this.readOnly)
            this.activeObjectIndex = index;

        e.stopPropagation();
    }

    private _titleMouseenter(e: MouseEvent) {
        const label = e.target as HTMLLabelElement;
        label.setAttribute("title", label.textContent);
    }

    #isRowFullEdit(index: number): boolean {
        return this.forceFullEdit || this.activeObjectIndex === index;
    }

    #isSoftEdit(obj: Vidyano.PersistentObject): boolean {
        return obj && this.attribute?.objects?.[0] === obj;
    }

    #getAttributeForColumn(obj: Vidyano.PersistentObject, column: Vidyano.QueryColumn): Vidyano.PersistentObjectAttribute {
        return obj.attributes[column.name];
    }

    #getCellForegroundStyle(attribute: Vidyano.PersistentObjectAttribute): string | undefined {
        const foreground = attribute?.getTypeHint("foreground", null);
        return foreground ? `--vi-persistent-object-attribute-foreground: ${foreground}` : undefined;
    }

    #isCellSensitive(column: Vidyano.QueryColumn): boolean {
        return column.isSensitive && this.isAppSensitive;
    }

    private _onCellClick(obj: Vidyano.PersistentObject, column: Vidyano.QueryColumn, index: number) {
        this.dispatchEvent(new CustomEvent("full-edit", { bubbles: true, composed: true }));
        this.activeObjectIndex = index;

        requestAnimationFrame(() => {
            const attribute = this.#getAttributeForColumn(obj, column);
            const presenters = Array.from(this.shadowRoot.querySelectorAll(`[data-row-index="${index}"] vi-persistent-object-attribute-presenter`));
            const presenter = presenters.find(p => (p as PersistentObjectAttributePresenter).attribute === attribute) as PersistentObjectAttributePresenter;
            if (presenter)
                presenter.queueFocus();
        });
    }

    @listener("attribute-loading")
    private _onAttributeLoading(e: CustomEvent) {
        e.stopPropagation();
    }

    @listener("attribute-loaded")
    private _onAttributeLoaded(e: CustomEvent) {
        e.stopPropagation();
    }

    private _onSizeChanged() {
        const scroller = this.shadowRoot?.querySelector("#body") as Scroller;
        if (!scroller)
            return;

        const hasScrollbar = scroller.innerHeight > scroller.outerHeight;
        if (this.newAction)
            this.newActionPinned = hasScrollbar;

        this.hasVerticalScrollbar = hasScrollbar;
    }

    get #addButton() {
        return html`
            <vi-button inverse icon="Action_New" label=${this.newAction.displayName} @click=${this._add} ?disabled=${this.attribute.parent.isFrozen || this.isAdding} ?busy=${this.isAdding}></vi-button>
            <slot name="button"></slot>
        `;
    }

    override render() {
        if (!this.attribute)
            return nothing;

        const visibleObjects = this.attribute.objects?.filter(o => !o.isDeleted) ?? [];

        return html`
            <div id="table">
                <div id="head" part="head">
                    ${this.columns.map(column => html`
                        <div class="column" data-column=${column.name}>
                            <label @mouseenter=${this._titleMouseenter}>${column.label}</label>
                        </div>
                    `)}
                    ${this.canDelete ? html`<div class="delete-spacer"></div>` : nothing}
                    ${this.canDelete && this.hasVerticalScrollbar ? html`<div class="scrollbar-spacer"></div>` : nothing}
                </div>
                <vi-scroller id="body" no-horizontal ?force-scrollbars=${this.editing} @outer-height-changed=${this._onSizeChanged}>
                    <div id="data">
                        <vi-size-tracker .trigger-zero=${true} @size-changed=${this._onSizeChanged}></vi-size-tracker>
                        <div id="rows">
                            ${visibleObjects.map((obj, index) => this.#renderRow(obj, index))}
                        </div>
                        ${this.newAction && !this.newActionPinned ? html`<div class="row add">${this.#addButton}</div>` : nothing}
                    </div>
                </vi-scroller>
                ${this.newAction && this.newActionPinned ? html`<div id="foot">${this.#addButton}</div>` : nothing}
            </div>
        `;
    }

    #renderRow(obj: Vidyano.PersistentObject, index: number) {
        const fullEdit = this.#isRowFullEdit(index);
        const softEdit = this.#isSoftEdit(obj);

        return html`
            <div class="row"
                 data-row-index=${index}
                 ?editing=${this.editing}
                 ?full-edit=${fullEdit}
                 ?frozen=${this.frozen}
                 ?read-only=${this.readOnly}
                 @click=${(e: Event) => this._setActiveObjectIndex(index, e)}>
                ${this.columns.map(column => this.#renderColumn(obj, column, index, fullEdit, softEdit))}
                ${this.canDelete ? html`
                    <vi-button class="delete-button" inverse @click=${() => this._delete(obj)} ?disabled=${this.frozen || obj.isReadOnly}>
                        <vi-icon source="Action_Delete"></vi-icon>
                    </vi-button>
                    ${this.hasVerticalScrollbar ? html`<div class="scrollbar-spacer"></div>` : nothing}
                ` : nothing}
            </div>
        `;
    }

    #renderColumn(obj: Vidyano.PersistentObject, column: Vidyano.QueryColumn, index: number, fullEdit: boolean, softEdit: boolean) {
        const attribute = this.#getAttributeForColumn(obj, column);
        const isSensitive = this.#isCellSensitive(column);

        return html`
            <div class="column" data-column=${column.name}>
                ${this.editing ? html`
                    ${fullEdit || softEdit ? html`
                        <vi-persistent-object-attribute-presenter
                            class="presenter"
                            no-label
                            .attribute=${attribute}
                            ?soft-edit-only=${!fullEdit && softEdit}>
                        </vi-persistent-object-attribute-presenter>
                    ` : nothing}
                    ${!fullEdit ? html`
                        <div class="pre-edit" pre-edit @click=${() => this._onCellClick(obj, column, index)}>
                            <vi-persistent-object-attribute-validation-error .attribute=${attribute}></vi-persistent-object-attribute-validation-error>
                            <vi-sensitive ?disabled=${!isSensitive}>
                                <div class="value-box cell" style=${this.#getCellForegroundStyle(attribute) || nothing}>
                                    ${attribute?.displayValue || ""}
                                </div>
                            </vi-sensitive>
                        </div>
                    ` : nothing}
                ` : html`
                    <vi-sensitive ?disabled=${!isSensitive}>
                        <div class="cell" style=${this.#getCellForegroundStyle(attribute) || nothing}>
                            ${attribute?.displayValue || ""}
                        </div>
                    </vi-sensitive>
                `}
            </div>
        `;
    }
}

customElements.define("vi-persistent-object-attribute-as-detail", PersistentObjectAttributeAsDetail);

PersistentObjectAttributeRegister.add("AsDetail", PersistentObjectAttributeAsDetail);
