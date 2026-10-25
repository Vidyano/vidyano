import { html, nothing, unsafeCSS } from "lit";
import { property } from "lit/decorators.js";
import * as Vidyano from "@vidyano/core"
import { computed, WebComponent } from "components/web-component/web-component";
import { Popup } from "components/popup/popup"
import { QueryGridFilterDialog } from "./query-grid-filter-dialog"
import { splitFilterName } from "./query-grid-filter-dialog-name"
import styles from "./query-grid-filters.css";

interface IQueryFilter {
    filter?: Vidyano.QueryFilter;
    groupName?: string;
    children?: IQueryFilter[];
}

export class QueryGridFilters extends WebComponent {
    static styles = unsafeCSS(styles);

    @property({ type: Object })
    query: Vidyano.Query;

    @property({ type: Object })
    @computed("query.filters")
    declare readonly queryFilters: Vidyano.QueryFilters;

    @property({ type: Boolean, reflect: true })
    @computed(function(this: QueryGridFilters, filters: Vidyano.QueryFilters) {
        return !filters;
    }, "query.filters", { allowUndefined: true })
    declare hidden: boolean;

    @property({ type: Array })
    @computed("query.filters.filters")
    declare readonly filters: Vidyano.QueryFilter[];

    @property({ type: Array })
    @computed(function(this: QueryGridFilters, filters: Vidyano.QueryFilter[]) {
        return this._computeFilters(filters, false);
    }, "filters", { allowUndefined: true })
    declare readonly userFilters: IQueryFilter[];

    @property({ type: Array })
    @computed(function(this: QueryGridFilters, filters: Vidyano.QueryFilter[]) {
        return this._computeFilters(filters, true);
    }, "filters", { allowUndefined: true })
    declare readonly lockedFilters: IQueryFilter[];

    @property({ type: Object })
    @computed("query.filters.currentFilter")
    declare readonly currentFilter: Vidyano.QueryFilter;

    @property({ type: Boolean, reflect: true })
    @computed("query.isFiltering")
    declare readonly isFiltering: boolean;

    @property({ type: Boolean, reflect: true })
    @computed(function(this: QueryGridFilters, filters: Vidyano.QueryFilter[], currentFilter: Vidyano.QueryFilter) {
        return (!filters || filters.length === 0) && !currentFilter;
    }, "filters", "currentFilter", { allowUndefined: true })
    declare readonly disabled: boolean;

    @property({ type: Boolean })
    @computed(function(this: QueryGridFilters, currentFilter: Vidyano.QueryFilter) {
        return !!currentFilter;
    }, "currentFilter", { allowUndefined: true })
    declare readonly canReset: boolean;

    @property({ type: Boolean })
    @computed(function(this: QueryGridFilters, currentFilter: Vidyano.QueryFilter) {
        return !!currentFilter && currentFilter.persistentObject.isNew;
    }, "currentFilter", { allowUndefined: true })
    declare readonly canSaveAs: boolean;

    @property({ type: Boolean })
    @computed(function(this: QueryGridFilters, currentFilter: Vidyano.QueryFilter, canSaveAs: boolean) {
        return !canSaveAs && !!currentFilter && !currentFilter.isLocked && !currentFilter.persistentObject.isNew;
    }, "currentFilter", "canSaveAs", { allowUndefined: true })
    declare readonly canSave: boolean;

    @property({ type: String })
    @computed(function(this: QueryGridFilters, currentFilter: Vidyano.QueryFilter) {
        return !!currentFilter ? `${this.translateMessage("Save")} '${this._nonGroupName(currentFilter.name)}'` : "";
    }, "currentFilter", { allowUndefined: true })
    declare readonly saveCurrentLabel: string;

    render() {
        return html`
            <vi-popup-menu ?disabled=${this.disabled}>
                <vi-button slot="header" ?inverse=${!this.isFiltering} icon="Filter_Menu" ?disabled=${this.disabled}></vi-button>
                ${this.canReset ? html`
                    <vi-popup-menu-item icon="Filter_Reset" label=${this.translations.Reset} @click=${this._reset}></vi-popup-menu-item>
                ` : nothing}
                ${this.canSave ? html`
                    <vi-popup-menu-item icon="Filter_Save" label=${this.saveCurrentLabel} @click=${this._save}></vi-popup-menu-item>
                    <vi-popup-menu-item force-icon-space label=${this.translations.SaveAs} @click=${this._saveAs}></vi-popup-menu-item>
                ` : nothing}
                ${this.canSaveAs ? html`
                    <vi-popup-menu-item icon="Filter_Save" label=${this.translations.SaveAs} @click=${this._saveAs}></vi-popup-menu-item>
                ` : nothing}
                ${this.userFilters ? html`
                    ${this.canReset || this.canSave || this.canSaveAs ? html`<vi-popup-menu-item-separator></vi-popup-menu-item-separator>` : nothing}
                    ${this.userFilters.map(item => item.groupName ? html`
                        <vi-popup-menu-item label=${item.groupName} icon="Folder" @click=${this._catchGroupClick}>
                            ${item.children.map(child => this.#renderUserFilter(child))}
                        </vi-popup-menu-item>
                    ` : this.#renderUserFilter(item))}
                ` : nothing}
                ${this.lockedFilters ? html`
                    ${this.canReset || this.canSave || this.canSaveAs || this.userFilters ? html`<vi-popup-menu-item-separator></vi-popup-menu-item-separator>` : nothing}
                    ${this.lockedFilters.map(item => item.groupName ? html`
                        <vi-popup-menu-item label=${item.groupName} icon="Folder" @click=${this._catchGroupClick}>
                            ${item.children.map(child => this.#renderLockedFilter(child))}
                        </vi-popup-menu-item>
                    ` : this.#renderLockedFilter(item))}
                ` : nothing}
            </vi-popup-menu>
        `;
    }

    #renderUserFilter(item: IQueryFilter) {
        return html`
            <vi-popup-menu-item-with-actions force-icon-space label=${this._nonGroupName(item.filter.name)} @click=${() => this._load(item.filter)}>
                <vi-button slot="button" icon="Action_Edit" inverse @click=${() => this._edit(item.filter)}></vi-button>
                <vi-button slot="button" icon="Action_Delete" inverse @click=${() => this._delete(item.filter)}></vi-button>
            </vi-popup-menu-item-with-actions>
        `;
    }

    #renderLockedFilter(item: IQueryFilter) {
        return html`<vi-popup-menu-item-split force-icon-space label=${this._nonGroupName(item.filter.name)} @click=${() => this._load(item.filter)}></vi-popup-menu-item-split>`;
    }

    private _computeFilters(filters: Vidyano.QueryFilter[], isLocked: boolean): IQueryFilter[] {
        if (!filters)
            return null;

        const orderedFilters = filters.filter(f => f.isLocked === isLocked).orderBy(f => {
            const parts = splitFilterName(f.name);
            return (parts.group ?? parts.name).toLowerCase();
        });
        if (orderedFilters.length === 0)
            return null;

        // Folders first, then the filters without a group
        const groups: IQueryFilter[] = [];
        const ungrouped: IQueryFilter[] = [];
        orderedFilters.forEach(filter => {
            if (!filter.name)
                return;

            const groupName = splitFilterName(filter.name).group;
            if (groupName == null)
                ungrouped.push({ filter: filter });
            else {
                const group = groups[groups.length - 1];
                if (group && group.groupName === groupName)
                    group.children.push({ filter: filter });
                else {
                    groups.push({
                        groupName: groupName,
                        children: [{ filter: filter }]
                    });
                }
            }
        });

        return groups.concat(ungrouped);
    }

    private _catchGroupClick(e: MouseEvent) {
        e.stopPropagation();
    }

    private _reset() {
        Popup.closeAll();
        this.query.filters.currentFilter = null;
    }

    private _load(filter: Vidyano.QueryFilter) {
        Popup.closeAll();
        this.queryFilters.currentFilter = filter;
    }

    private async _saveAs() {
        this.app.showDialog(new QueryGridFilterDialog(this.query.filters, await this.query.filters.createNew()));
    }

    private _save() {
        this.query.filters.save();
    }

    private _edit(filter: Vidyano.QueryFilter) {
        this.app.showDialog(new QueryGridFilterDialog(this.query.filters, filter));
    }

    private async _delete(filter: Vidyano.QueryFilter) {
        const result = await this.app.showMessageDialog({
            title: this._nonGroupName(filter.name),
            titleIcon: "Action_Delete",
            message: this.translateMessage("AskForDeleteFilter", this._nonGroupName(filter.name)),
            actions: [this.translateMessage("Delete"), this.translateMessage("Cancel")],
            actionTypes: ["Danger"]
        });

        if (result === 0)
            await this.query.filters.delete(filter);
    }

    private _nonGroupName(name: string): string {
        return splitFilterName(name).name;
    }
}

customElements.define("vi-query-grid-filters", QueryGridFilters);
