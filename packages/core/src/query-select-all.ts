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
                this.#availabilityChanged(this.#isAvailableFor(args.oldValue, query.maxSelectedItems, query.canReorder));
            else if (args.propertyName === "maxSelectedItems")
                this.#availabilityChanged(this.#isAvailableFor(query.hasMore, args.oldValue, query.canReorder));
        });
    }

    /**
     * Gets or sets whether selecting all items is available.
     * Not while the query's total is unknown (hasMore), because the action would act on rows nobody has seen, nor while the selection is limited (maxSelectedItems),
     * nor on a reorderable query (canReorder), whose rows are put in order by hand.
     * Setting it is ignored while the selection is limited, and has no effect on a reorderable query.
     */
    get isAvailable(): boolean {
        return this.#isAvailableFor(this.#query.hasMore, this.#query.maxSelectedItems, this.#query.canReorder);
    }

    set isAvailable(isAvailable: boolean) {
        if (this.#query.maxSelectedItems)
            return;

        if (this.#isAvailable === isAvailable)
            return;

        const wasAvailable = this.isAvailable;
        this.#isAvailable = isAvailable;
        this.#availabilityChanged(wasAvailable);
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
            this.notifyPropertyChanged("inverse", this.#inverse, oldInverse);
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
     * Whether select-all is available for the given state of the query.
     */
    #isAvailableFor(hasMore: boolean, maxSelectedItems: number, canReorder: boolean): boolean {
        return this.#isAvailable && !hasMore && !maxSelectedItems && !canReorder;
    }

    /**
     * Disabling it, an unknown total or a limit on the selection ends select-all; the opposite makes it available again.
     * @param wasAvailable - What isAvailable returned before the query changed.
     */
    #availabilityChanged(wasAvailable: boolean) {
        const isAvailable = this.isAvailable;
        if (isAvailable === wasAvailable)
            return;

        // The guarded setters no longer accept a change once select-all is unavailable, so reset the fields here
        if (!isAvailable && (this.#allSelected || this.#inverse)) {
            const wasAllSelected = this.#allSelected, wasInverse = this.#inverse;
            this.#allSelected = this.#inverse = false;

            if (wasAllSelected)
                this.notifyPropertyChanged("allSelected", false, true);

            if (wasInverse)
                this.notifyPropertyChanged("inverse", false, true);
        }

        this.notifyPropertyChanged("isAvailable", isAvailable, wasAvailable);
    }
}