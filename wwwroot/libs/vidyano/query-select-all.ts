import { Observable, IPropertyChangedObserver } from "./common/observable.js"
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
    }

    /**
     * Gets or sets whether selecting all items is available.
     */
    get isAvailable(): boolean {
        if (this.#query.maxSelectedItems)
            return;

        return this.#isAvailable;
    }

    set isAvailable(isAvailable: boolean) {
        if (this.#query.maxSelectedItems)
            return;

        if (this.#isAvailable === isAvailable)
            return;

        this.allSelected = this.inverse = false;

        const oldValue = this.#isAvailable;
        this.notifyPropertyChanged("isAvailable", this.#isAvailable = isAvailable, oldValue);
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
}