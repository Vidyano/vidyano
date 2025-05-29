import type * as Dto from "./typings/service.js"
import type { QueryResultItemValue } from "./query-result-item-value.js"
import type { Service } from "./service.js"
import { ServiceObject } from "./service-object.js"
import type { Query } from "./query.js"
import { PersistentObjectAttribute } from "./persistent-object-attribute.js"
import type { PersistentObject } from "./persistent-object.js"
import type { PropertyChangedArgs } from "./observable"
import type { QueryResultItem } from "./query-result-item.js"
import { QueryColumnSymbols } from "./_internals.js";

/**
 * Represents the distinct values for a query column.
 */
export interface IQueryColumnDistincts {
    matching: string[];
    remaining: string[];
    isDirty: boolean;
    hasMore: boolean;
}

export type SortDirection = Dto.SortDirection;

/**
 * Represents a column in a query, including metadata and filter/sort state.
 */
export class QueryColumn extends ServiceObject {
    #id: string;
    #displayAttribute: string;
    #sortDirection: SortDirection;
    #canSort: boolean;
    #canGroupBy: boolean;
    #canFilter: boolean;
    #canListDistincts: boolean;
    #isSensitive: boolean;
    #name: string;
    #type: string;
    #label: string;
    #distincts: IQueryColumnDistincts;
    #selectedDistincts: string[];
    #selectedDistinctsInversed: boolean;
    #total: QueryResultItemValue;
    #tag: any;

    offset: number;
    isPinned: boolean;
    isHidden: boolean;
    width: string;
    typeHints: any;

    /**
     * Initializes a new instance of the QueryColumn class.
     * @param service The service instance.
     * @param col The column DTO or QueryColumn to copy from.
     * @param query The parent query.
     */
    constructor(service: Service, col: Dto.QueryColumn | any, public query: Query) {
        super(service);

        this[QueryColumnSymbols.IsQueryColumn] = true;
        this[QueryColumnSymbols.ToServiceObject] = this.#toServiceObject.bind(this);

        this.#id = col.id;
        this.#canSort = !!col.canSort;
        this.#canGroupBy = !!col.canGroupBy;
        this.#canFilter = !!col.canFilter;
        this.#canListDistincts = !!col.canListDistincts;
        this.#displayAttribute = col.displayAttribute;
        this.#isSensitive = !!col.isSensitive;
        if (col instanceof QueryColumn) {
            this.#selectedDistincts = col.#selectedDistincts;
            this.#selectedDistinctsInversed = col.#selectedDistinctsInversed;
        }
        else {
            this.#selectedDistincts = col.includes || col.excludes || [];
            this.#selectedDistinctsInversed = !!col.excludes && col.excludes.length > 0;
        }
        this.#label = col.label;
        this.#name = col.name;
        this.offset = col.offset || 0;
        this.#type = col.type;
        this.isPinned = !!col.isPinned;
        this.isHidden = !!col.isHidden;
        this.width = col.width;
        this.typeHints = col.typeHints;
        this.#sortDirection = "";
        this.#tag = col._tag;

        query.propertyChanged.attach(this.#queryPropertyChanged.bind(this));
    }

    /** Gets the column id. */
    get id(): string {
        return this.#id;
    }

    /** Gets the column name. */
    get name(): string {
        return this.#name;
    }

    /** Gets the column type. */
    get type(): string {
        return this.#type;
    }

    /** Gets the column label. */
    get label(): string {
        return this.#label;
    }

    /** Gets whether the column can be filtered. */
    get canFilter(): boolean {
        return this.#canFilter;
    }

    /** Gets whether the column can be sorted. */
    get canSort(): boolean {
        return this.#canSort;
    }

    /** Gets whether the column can be grouped by. */
    get canGroupBy(): boolean {
        return this.#canGroupBy;
    }

    /** Gets whether the column can list distinct values. */
    get canListDistincts(): boolean {
        return this.#canListDistincts;
    }

    /** Gets the display attribute for the column. */
    get displayAttribute(): string {
        return this.#displayAttribute;
    }

    /** Gets whether the column is sensitive. */
    get isSensitive(): boolean {
        return this.#isSensitive;
    }

    /** Gets whether the column is currently sorted. */
    get isSorting(): boolean {
        return this.#sortDirection !== "";
    }

    /** Gets the current sort direction. */
    get sortDirection(): SortDirection {
        return this.#sortDirection;
    }

    /** Gets or sets the selected distinct values for the column. */
    get selectedDistincts(): string[] {
        return this.#selectedDistincts;
    }

    set selectedDistincts(selectedDistincts: string[]) {
        const oldSelectedIncludes = this.#selectedDistincts;

        this.notifyPropertyChanged("selectedDistincts", this.#selectedDistincts = (selectedDistincts || []), oldSelectedIncludes);
        this.query.columns.forEach(c => {
            if (c === this)
                return;

            if (c.distincts)
                c.distincts.isDirty = true;
        });
    }

    /** Gets or sets whether the selected distincts are inversed (excludes instead of includes). */
    get selectedDistinctsInversed(): boolean {
        return this.#selectedDistinctsInversed;
    }

    set selectedDistinctsInversed(selectedDistinctsInversed: boolean) {
        const oldSelectedDistinctsInversed = this.#selectedDistinctsInversed;

        this.notifyPropertyChanged("selectedDistinctsInversed", this.#selectedDistinctsInversed = selectedDistinctsInversed, oldSelectedDistinctsInversed);
    }

    /** Gets or sets the distinct values for the column. */
    get distincts(): IQueryColumnDistincts {
        return this.#distincts;
    }

    set distincts(distincts: IQueryColumnDistincts) {
        const oldDistincts = this.#distincts;

        this.notifyPropertyChanged("distincts", this.#distincts = distincts, oldDistincts);
    }

    /** Gets the total value for the column. */
    get total(): QueryResultItemValue {
        return this.#total;
    }

    /** Gets the tag associated with the column. */
    get tag(): any {
        return this.#tag;
    }

    /** @internal Sets the total value for the column. */
    #setTotal(total: QueryResultItemValue) {
        const oldTotal = this.#total;

        this.notifyPropertyChanged("total", this.#total = total, oldTotal);
    }

    /** @internal Sets the sort direction for the column. */
    #setSortDirection(direction: SortDirection) {
        if (this.#sortDirection === direction)
            return;

        const oldSortDirection = this.#sortDirection;
        this.notifyPropertyChanged("sortDirection", this.#sortDirection = direction, oldSortDirection);
    }

    /**
     * Converts the column to a service object representation.
     * @returns The service object.
     */
    #toServiceObject(): Dto.QueryColumn {
        const serviceObject = <Dto.QueryColumn>this._copyPropertiesFromValues({
            id: this.id,
            name: this.name,
            label: this.label,
            type: this.type,
            displayAttribute: this.displayAttribute
        });

        serviceObject.includes = !this.selectedDistinctsInversed ? this.selectedDistincts : [];
        serviceObject.excludes = this.selectedDistinctsInversed ? this.selectedDistincts : [];

        return serviceObject;
    }

    /**
     * Gets the type hint for a given name, with an optional default value.
     * @param name The name of the type hint to retrieve.
     * @param defaultValue The default value to return if the type hint is not found.
     * @param typeHints Optional type hints object to use instead of the instance's typeHints.
     * @param ignoreCasing Optional flag to ignore casing.
     * @returns The type hint value or the default value if not found.
     */
    getTypeHint(name: string, defaultValue?: string, typeHints?: any, ignoreCasing?: boolean): string {
        // Use the PersistentObjectAttribute's getTypeHint method to ensure consistent behavior.
        return PersistentObjectAttribute.prototype.getTypeHint.apply(this, arguments);
    }

    /**
     * Refreshes the distinct values for the column, optionally with a search string.
     * @param search Optional search string to filter distincts.
     * @returns A promise resolving to the distincts.
     */
    async refreshDistincts(search?: string): Promise<IQueryColumnDistincts> {
        const parameters: any = { ColumnName: this.name, AsLookup: this.query.asLookup };
        if (search)
            parameters.Search = search;

        let result: PersistentObject;
        try {
            result = await this.service.executeAction("QueryFilter.RefreshColumn", this.query.parent, this.query.clone(), null, parameters);
        }
        catch (e) {
            return this.distincts;
        }

        this.query.columns.filter(q => q !== this).forEach(col => {
            if (col.distincts)
                col.distincts.isDirty = true;
        });

        const matchingDistinctsAttr = result.attributes["MatchingDistincts"];
        const remainingDistinctsAttr = result.attributes["RemainingDistincts"];

        this.distincts = {
            matching: <string[]>matchingDistinctsAttr.options,
            remaining: <string[]>remainingDistinctsAttr.options,
            isDirty: false,
            hasMore: Boolean.parse(matchingDistinctsAttr.typeHints.hasmore || remainingDistinctsAttr.typeHints.hasmore)
        };

        return this.distincts;
    }

    /**
     * Sorts the query by this column.
     * @param direction The sort direction.
     * @param multiSort Whether to use multi-sort.
     * @returns A promise resolving to the query result items.
     */
    async sort(direction: SortDirection, multiSort?: boolean): Promise<QueryResultItem[]> {
        if (!!multiSort) {
            const sortOption = this.query.sortOptions.filter(option => option.column === this)[0];
            if (sortOption && sortOption.direction === direction)
                return;

            if (!sortOption) {
                if (direction !== "")
                    this.query.sortOptions = this.query.sortOptions.concat([{ column: this, name: this.name, direction: direction }]);
            }
            else {
                if (direction !== "") {
                    sortOption.direction = direction;
                    this.query.sortOptions = this.query.sortOptions.slice();
                }
                else
                    this.query.sortOptions = this.query.sortOptions.filter(option => option !== sortOption);
            }
        } else
            this.query.sortOptions = direction !== "" ? [{ column: this, name: this.name, direction: direction }] : [];

        try {
            await this.query.search({ throwExceptions: true });
        }
        catch (e) {
            return this.query.items;
        }

        const querySettings = (this.service.application.userSettings["QuerySettings"] || (this.service.application.userSettings["QuerySettings"] = {}))[this.query.id] || {};
        querySettings["sortOptions"] = this.query.sortOptions.filter(option => option.direction !== "").map(option => `${option.name} ${option.direction}`.trimEnd()).join("; ");

        this.service.application.userSettings["QuerySettings"][this.query.id] = querySettings;
        await this.service.application.saveUserSettings();

        return this.query.items;
    }

    /**
     * Handles property changes on the parent query.
     * @param sender The query.
     * @param args The property changed arguments.
     */
    #queryPropertyChanged(sender: Query, args: PropertyChangedArgs) {
        if (args.propertyName === "sortOptions") {
            const sortOption = this.query.sortOptions ? this.query.sortOptions.filter(option => option.column === this)[0] : null;
            this.#setSortDirection(sortOption ? sortOption.direction : "");
        } else if (args.propertyName === "totalItem")
            this.#setTotal(sender.totalItem ? sender.totalItem.getFullValue(this.name) : null);
    }
}