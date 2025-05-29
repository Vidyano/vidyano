/**
 * Represents an array change event.
 */
export class ArrayChangedArgs {
    #arrayPropertyName: string;
    #index: number;
    #removedItems?: any[];
    #addedItemCount?: number;

    /**
     * Creates an instance of ArrayChangedArgs.
     * @param {string} arrayPropertyName - Name of the array property.
     * @param {number} index - Index at which the change occurred.
     * @param {any[]} [removedItems] - Items that were removed.
     * @param {number} [addedItemCount] - Number of items added.
     */
    constructor(arrayPropertyName: string, index: number, removedItems?: any[], addedItemCount?: number) {
        this.#arrayPropertyName = arrayPropertyName;
        this.#index = index;
        this.#removedItems = removedItems;
        this.#addedItemCount = addedItemCount;
    }

    /**
     * Gets the array property name.
     */
    get arrayPropertyName(): string {
        return this.#arrayPropertyName;
    }

    /**
     * Gets the index of the change.
     */
    get index(): number {
        return this.#index;
    }

    /**
     * Gets the removed items.
     */
    get removedItems(): any[] | undefined {
        return this.#removedItems;
    }

    /**
     * Gets the count of added items.
     */
    get addedItemCount(): number | undefined {
        return this.#addedItemCount;
    }
}

/**
 * Represents a property change event.
 */
export class PropertyChangedArgs {
    #propertyName: string;
    #newValue: any;
    #oldValue: any;

    /**
     * Creates an instance of PropertyChangedArgs.
     * @param {string} propertyName - Name of the property.
     * @param {*} newValue - New value of the property.
     * @param {*} oldValue - Old value of the property.
     */
    constructor(propertyName: string, newValue: any, oldValue: any) {
        this.#propertyName = propertyName;
        this.#newValue = newValue;
        this.#oldValue = oldValue;
    }

    /**
     * Gets the property name.
     */
    get propertyName(): string {
        return this.#propertyName;
    }

    /**
     * Gets the new value.
     */
    get newValue(): any {
        return this.#newValue;
    }

    /**
     * Gets the old value.
     */
    get oldValue(): any {
        return this.#oldValue;
    }
}