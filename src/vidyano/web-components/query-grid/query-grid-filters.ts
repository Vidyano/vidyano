import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
import { Popup } from "components/popup/popup"
import { QueryGridFilterDialog } from "./query-grid-filter-dialog"

interface IQueryFilter {
    filter?: Vidyano.QueryFilter;
    groupName?: string;
    children?: IQueryFilter[];
}

@Polymer.WebComponent.register({
    properties: {
        query: Object,
        queryFilters: {
            type: Object,
            computed: "query.filters"
        },
        hidden: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeHidden(query.filters)"
        },
        filters: {
            type: Array,
            computed: "query.filters.filters"
        },
        userFilters: {
            type: Array,
            computed: "_computeUserFilters(filters)"
        },
        lockedFilters: {
            type: Array,
            computed: "_computeLockedFilters(filters)"
        },
        hasFilters: {
            type: Boolean,
            computed: "_computeHasFilters(filters)"
        },
        currentFilter: {
            type: Object,
            computed: "query.filters.currentFilter"
        },
        isFiltering: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "query.isFiltering"
        },
        disabled: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeDisabled(filters, currentFilter)"
        },
        canReset: {
            type: Boolean,
            computed: "_computeCanReset(currentFilter)"
        },
        canSave: {
            type: Boolean,
            computed: "_computeCanSave(currentFilter, canSaveAs)"
        },
        canSaveAs: {
            type: Boolean,
            computed: "_computeCanSaveAs(currentFilter)"
        },
        editLabel: {
            type: String,
            computed: "query.filters.actions.Edit.displayName"
        },
        saveCurrentLabel: {
            type: String,
            computed: "_computeCurrentFilterSaveLabel(currentFilter)"
        }
    },
    forwardObservers: [
        "query.isFiltering",
        "query.filters",
        "query.filters.filters",
        "query.filters.currentFilter"
    ]
}, "vi-query-grid-filters")
export class QueryGridFilters extends Polymer.WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="query-grid-filters.html">` }

    query: Vidyano.Query;
    queryFilters: Vidyano.QueryFilters;
    currentFilter: Vidyano.QueryFilter;

    private _computeUserFilters(filters: Vidyano.QueryFilter[]): IQueryFilter[] {
        return this._computeFilters(filters, false);
    }

    private _computeLockedFilters(filters: Vidyano.QueryFilter[]): IQueryFilter[] {
        return this._computeFilters(filters, true);
    }

    private _computeFilters(filters: Vidyano.QueryFilter[], isLocked: boolean): IQueryFilter[] {
        if (!filters)
            return null;

        const orderedFilters = filters.filter(f => f.isLocked === isLocked).orderBy(f => f.name.split("\n", 2)[0].toLowerCase());
        if (orderedFilters.length === 0)
            return null;

        const result: IQueryFilter[] = [];
        let group: IQueryFilter;
        orderedFilters.forEach(filter => {
            if (!filter.name)
                return;

            const nameParts = filter.name.split("\n", 2);
            if (nameParts.length === 1)
                result.push({ filter: filter });
            else {
                if (group && group.groupName === nameParts[0])
                    group.children.push({ filter: filter });
                else {
                    result.push(group = {
                        groupName: nameParts[0],
                        children: [{ filter: filter }]
                    });
                }
            }
        });

        return result;
    }

    private _catchGroupTap(e: Polymer.Gestures.TapEvent) {
        e.stopPropagation();
    }

    private _filterNonGroupName(name: string): string {
        if (!name)
            return name;

        const nameParts = name.split("\n", 2);
        return nameParts.length === 1 ? nameParts[0] : nameParts[1];
    }

    private _computeHidden(filters: Vidyano.QueryFilters): boolean {
        return !filters;
    }

    private _computeDisabled(filters: Vidyano.QueryFilter[], currentFilter: Vidyano.QueryFilter): boolean {
        return (!filters || filters.length === 0) && !currentFilter;
    }

    private _computeHasFilters(filters: Vidyano.QueryFilter[]): boolean {
        return !!filters && filters.length > 0;
    }

    private _computeCanReset(currentFilter: Vidyano.QueryFilter): boolean {
        return !!currentFilter;
    }

    private _computeCanSave(currentFilter: Vidyano.QueryFilter, canSaveAs: boolean): boolean {
        return !canSaveAs && !!currentFilter && !currentFilter.isLocked && !currentFilter.persistentObject.isNew;
    }

    private _computeCurrentFilterSaveLabel(currentFilter: Vidyano.QueryFilter): string {
        return !!currentFilter ? `${this.translateMessage("Save")} '${currentFilter.name}'` : "";
    }

    private _computeCanSaveAs(currentFilter: Vidyano.QueryFilter): boolean {
        return !!currentFilter && currentFilter.persistentObject.isNew;
    }

    private _computeFilterEditLabel(filter: Vidyano.QueryFilter): string {
        return this.query.service.actionDefinitions["Edit"].displayName;
    }

    private _reset() {
        Popup.closeAll();
        this.query.filters.currentFilter = null;
    }

    private _load(e: Polymer.Gestures.TapEvent) {
        this.queryFilters.currentFilter = <Vidyano.QueryFilter>e.model.filter.filter;
    }

    private async _saveAs() {
        this.app.showDialog(new QueryGridFilterDialog(this.query.filters, await this.query.filters.createNew()));
    }

    private _save() {
        this.query.filters.save();
    }

    private async _edit(e: Polymer.Gestures.TapEvent) {
        const filter = <Vidyano.QueryFilter>e.model.filter.filter;
        this.app.showDialog(new QueryGridFilterDialog(this.query.filters, filter));
    }

    private async _delete(e: Polymer.Gestures.TapEvent) {
        const filter = <Vidyano.QueryFilter>e.model.filter.filter;

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

    private _showUserFilterSeparator(canReset: boolean, canSave: boolean, canSaveAs: boolean): boolean {
        return canReset || canSave || canSaveAs;
    }

    private _hasGroupName(filter: IQueryFilter): boolean {
        return !!filter.groupName;
    }

    private _hasNoGroupName(filter: IQueryFilter): boolean {
        return !filter.groupName;
    }

    private _nonGroupName(name: string): string {
        if (!name)
            return name;

        const nameParts = name.split("\n", 2);
        return nameParts.length === 1 ? nameParts[0] : nameParts[1];
    }
}
