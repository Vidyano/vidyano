import { Observable } from "./observable"
import type { Action } from "./action.js"
import type { PersistentObject } from "./persistent-object.js"
import type { Query } from "./query.js"
import type { PersistentObjectAttributeAsDetail } from "./persistent-object-attribute-as-detail.js"
import { _internal } from "./_internals.js";

/**
 * Manages a collection of query filters for a query.
 */
export class QueryFilters extends Observable<QueryFilters> {
    #filters: QueryFilter[];
    #currentFilter: QueryFilter;
    #filtersAsDetail: PersistentObjectAttributeAsDetail;
    #skipSearch: boolean;
    #query: Query;
    #filtersPO: PersistentObject;

    /**
     * Initializes a new instance of the QueryFilters class.
     * @param query The parent query.
     * @param filtersPO The persistent object containing filters.
     */
    constructor(query: Query, filtersPO: PersistentObject) {
        super();

        this.#query = query;
        this.#filtersPO = filtersPO;
        this.#filtersAsDetail = <PersistentObjectAttributeAsDetail>this.#filtersPO.attributes["Filters"];
        this.#computeFilters(true);

        // Important: Do not trigger a search during filter initialization when cloning a query.
        // Setting a filter overrides selected distincts and would normally trigger a search, which we want to avoid here.
        if (!query.isClone) {
            const defaultFilter = this.#filters.find(f => f.isDefault);
            if (defaultFilter) {
                this.#skipSearch = true;
                try {
                    this.currentFilter = defaultFilter;
                }
                finally {
                    this.#skipSearch = false;
                }
            }
        }
    }

    /**
     * Gets the list of filters.
     */
    get filters(): QueryFilter[] {
        return this.#filters;
    }

    /**
     * Sets the filters and notifies listeners.
     * @param filters The new filters array.
     */
    #setFilters(filters: QueryFilter[]) {
        const oldFilters = this.#filters;
        this.notifyPropertyChanged("filters", this.#filters = filters, oldFilters);
    }

    /**
     * Gets the details attribute as a PersistentObjectAttributeAsDetail.
     */
    get detailsAttribute(): PersistentObjectAttributeAsDetail {
        return this.#filtersAsDetail;
    }

    /**
     * Gets or sets the current filter.
     */
    get currentFilter(): QueryFilter {
        return this.#currentFilter;
    }

    set currentFilter(filter: QueryFilter) {
        let doSearch: boolean;
        if (!!filter) {
            if (!filter.persistentObject.isNew) {
                let columnsFilterData = <{ name: string; includes: string[]; excludes: string[]; }[]>JSON.parse(filter.persistentObject.getAttributeValue("Columns"));
                this.#query.columns.forEach(col => {
                    let columnFilterData = columnsFilterData.find(c => c.name === col.name);
                    if (columnFilterData) {
                        if (columnFilterData.includes && columnFilterData.includes.length > 0)
                            col.selectedDistincts = columnFilterData.includes;
                        else if (columnFilterData.excludes && columnFilterData.excludes.length > 0)
                            col.selectedDistincts = columnFilterData.excludes;
                        else
                            col.selectedDistincts = [];

                        col.selectedDistinctsInversed = columnFilterData.excludes && columnFilterData.excludes.length > 0;
                        col.distincts = null;

                        doSearch = doSearch || (col.selectedDistincts.length > 0);
                    }
                    else
                        col.selectedDistincts = [];
                });
            }
        } else {
            this.#query.columns.forEach(col => {
                col.selectedDistincts = [];
                col.selectedDistinctsInversed = false;
                col.distincts = null;
            });

            doSearch = !!this.#currentFilter;
        }

        const oldCurrentFilter = this.#currentFilter;
        this.notifyPropertyChanged("currentFilter", this.#currentFilter = filter, oldCurrentFilter);

        if (doSearch && !this.#skipSearch)
            this.#query.search();
    }

    /**
     * Computes the filters from the details attribute.
     * @param setDefaultFilter If true, sets the default filter.
     */
    #computeFilters(setDefaultFilter?: boolean) {
        if (!this.#filtersAsDetail) {
            this.#setFilters([]);
            return;
        }

        const currentFilters: { [name: string]: QueryFilter; } = {};
        if (this.#filters)
            this.#filters.forEach(f => currentFilters[f.name || ""] = f);

        this.#setFilters(this.#filtersAsDetail.objects.map(filter => new QueryFilter(filter)));

        if (setDefaultFilter)
            this.#currentFilter = this.#filters.find(f => f.persistentObject.getAttributeValue("IsDefault")) || null;
    }

    /**
     * Computes the filter data as a JSON string.
     */
    #computeFilterData(): string {
        return JSON.stringify(this.#query.columns.filter(c => c.selectedDistincts.length > 0).map(c => {
            return {
                name: c.name,
                includes: !c.selectedDistinctsInversed ? c.selectedDistincts : [],
                excludes: c.selectedDistinctsInversed ? c.selectedDistincts : []
            };
        }));
    }

    /**
     * Clones the filters for a target query.
     * @param targetQuery The target query.
     */
    clone(targetQuery: Query): QueryFilters {
        return new QueryFilters(targetQuery, targetQuery.service.hooks.onConstructPersistentObject(targetQuery.service, _internal(this.#filtersPO).dto));
    }

    /**
     * Gets a filter by name.
     * @param name The filter name.
     */
    getFilter(name: string): QueryFilter {
        return this.filters.find(f => f.name === name);
    }

    /**
     * Creates a new filter.
     */
    createNew(): Promise<QueryFilter> {
        const newAction = (<Action>this.#filtersAsDetail.details.actions["New"]);

        return this.#query.queueWork(async () => {
            const po = await newAction.execute({ skipOpen: true });
            return new QueryFilter(po);
        });
    }

    /**
     * Saves a filter.
     * @param filter The filter to save.
     */
    save(filter: QueryFilter = this.currentFilter): Promise<boolean> {
        if (!filter)
            return Promise.reject<boolean>("Expected argument filter.");

        if (filter.isLocked)
            return Promise.reject<boolean>("Filter is locked.");

        if (this.#filtersAsDetail.objects.some(f => f.isNew))
            return Promise.reject<boolean>("Only one new filter can be saved at a time.");

        this.#filtersPO.beginEdit();

        if (filter === this.currentFilter || filter.persistentObject.isNew) {
            filter.persistentObject.beginEdit();
            filter.persistentObject.attributes["Columns"].setValue(this.#computeFilterData());
        }

        if (filter.persistentObject.isNew)
            this.#filtersAsDetail.objects.push(filter.persistentObject);

        return this.#query.queueWork(async () => {
            let result: boolean;

            try {
                result = await this.#filtersPO.save();
            }
            catch (e) {
                result = false;
                filter.persistentObject.setNotification(e, "Error");
            }

            const newFilter = this.#filtersAsDetail.objects.find(f => f.isNew);
            if (newFilter)
                this.#filtersAsDetail.objects.remove(filter.persistentObject = newFilter);

            this.#computeFilters();
            this.currentFilter = this.filters.find(f => f.name === filter.name);

            return result;
        });
    }

    /**
     * Deletes a filter by name or instance.
     * @param name The filter name or instance.
     */
    delete(name: string | QueryFilter): Promise<any> {
        const filter = typeof name === "string" ? this.getFilter(name) : name;
        if (!filter)
            return Promise.reject(`No filter found with name '${name}'.`);

        if (filter.isLocked)
            return Promise.reject("Filter is locked.");

        if (!filter.persistentObject.isNew) {
            filter.persistentObject.isDeleted = true;

            return this.#query.queueWork(async () => {
                this.#filtersPO.beginEdit();

                await this.#filtersPO.save();
                this.#computeFilters();

                if (this.currentFilter === filter)
                    this.currentFilter = null;

                return null;
            });
        }

        this.#filtersAsDetail.objects.remove(filter.persistentObject);
        this.#computeFilters();

        return Promise.resolve(null);
    }
}

/**
 * Represents a single query filter.
 */
export class QueryFilter extends Observable<QueryFilter> {
    #persistentObject: PersistentObject;

    /**
     * Initializes a new instance of the QueryFilter class.
     * @param persistentObject The persistent object for this filter.
     */
    constructor(persistentObject: PersistentObject) {
        super();
        this.#persistentObject = persistentObject;
    }

    /**
     * Gets or sets the persistent object backing this filter.
     */
    get persistentObject(): PersistentObject {
        return this.#persistentObject;
    }

    set persistentObject(po: PersistentObject) {
        this.#persistentObject = po;
    }

    /**
     * Gets the name of the filter.
     */
    get name(): string {
        return this.#persistentObject.getAttributeValue("Name") || "";
    }

    /**
     * Gets whether the filter is locked.
     */
    get isLocked(): boolean {
        return this.#persistentObject.getAttributeValue("IsLocked");
    }

    /**
     * Gets whether the filter is the default filter.
     */
    get isDefault(): boolean {
        return this.#persistentObject.getAttributeValue("IsDefault");
    }
}