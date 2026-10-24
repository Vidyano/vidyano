import { Observable, IPropertyChangedObserver } from "./observable"
import type { Query } from "./query.js";

/**
 * Represents the grouping information for a query.
 */
export interface IQuerySelectAll {
    /**
     * Gets or sets whether selecting all items is available.
     */
    isAvailable: boolean;
    /**
     * Gets or sets whether all items are selected.
     */
    allSelected: boolean;
    /**
     * Gets or sets whether the selection is inverse.
     */
    inverse: boolean;
}

/**
 * Represents the select all functionality for a query.
 */
export class QuerySelectAll extends Observable<IQuerySelectAll> implements IQuerySelectAll {
    #allSelected: boolean = false;
    #inverse: boolean = false;
    #query: Query;
    #isAvailable: boolean;

    constructor(query: Query, isAvailable: boolean, observer: IPropertyChangedObserver<QuerySelectAll>) {
        super();

        this.#query = query;
        this.#isAvailable = isAvailable;
        this.propertyChanged.attach(observer);
        query.propertyChanged.attach((_, args) => {
            if (args.propertyName === "hasMore")
                this.#hasMoreChanged(!!args.oldValue, !!args.newValue);
        });
    }

    /**
     * Gets or sets whether selecting all items is available.
     * Not while the query's total is unknown (hasMore), because the action would act on rows nobody has seen.
     */
    get isAvailable(): boolean {
        if (this.#query.maxSelectedItems)
            return;

        if (this.#query.hasMore)
            return false;

        return this.#isAvailable;
    }

    set isAvailable(isAvailable: boolean) {
        if (this.#query.maxSelectedItems)
            return;

        if (this.#isAvailable === isAvailable)
            return;

        this.allSelected = this.inverse = false;

        // Announce only a change of what the getter returns, which stays false while the total is unknown
        const oldValue = this.isAvailable;
        this.#isAvailable = isAvailable;
        if (this.isAvailable !== oldValue)
            this.notifyPropertyChanged("isAvailable", this.isAvailable, oldValue);
    }

    /**
     * Gets or sets whether all items are selected.
     */
    get allSelected(): boolean {
        return this.#allSelected;
    }

    set allSelected(allSelected: boolean) {
        if (!this.isAvailable)
            return;

        if (this.#allSelected === allSelected)
            return;

        const oldInverse = this.#inverse;
        if (oldInverse)
            this.#inverse = false;

        const oldValue = this.#allSelected;
        this.notifyPropertyChanged("allSelected", this.#allSelected = allSelected, oldValue);

        if (oldInverse)
            this.notifyPropertyChanged("inverse", this.#inverse, oldValue);
    }

    /**
     * Gets or sets whether the selection is inverse.
     */
    get inverse(): boolean {
        return this.#inverse;
    }

    set inverse(inverse: boolean) {
        if (!this.isAvailable)
            return;

        if (this.#inverse === inverse)
            return;

        const oldValue = this.#inverse;
        this.notifyPropertyChanged("inverse", this.#inverse = inverse, oldValue);
    }

    /**
     * An unknown total ends select-all, a known one makes it available again.
     */
    #hasMoreChanged(hadMore: boolean, hasMore: boolean) {
        if (hadMore === hasMore || this.#query.maxSelectedItems || !this.#isAvailable)
            return;

        // The guarded setters no longer accept a change once the total is unknown, so reset the fields here
        if (hasMore && (this.#allSelected || this.#inverse)) {
            const wasAllSelected = this.#allSelected, wasInverse = this.#inverse;
            this.#allSelected = this.#inverse = false;

            if (wasAllSelected)
                this.notifyPropertyChanged("allSelected", false, true);

            if (wasInverse)
                this.notifyPropertyChanged("inverse", false, true);
        }

        // Passing the guards above, the total is the only thing that changes isAvailable here
        this.notifyPropertyChanged("isAvailable", this.isAvailable, !hadMore);
    }
}