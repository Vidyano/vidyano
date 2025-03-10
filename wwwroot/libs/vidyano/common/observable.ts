/**
 * Interface for subject notifier that receives notifications.
 * @template TSource - The type of the subject.
 * @template TDetail - The type of detail sent in notifications.
 */
export interface ISubjectNotifier<TSource, TDetail> {
    notify?: (source: TSource, detail?: TDetail) => void;
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
 * Interface for disposing an observer from a subject.
 * @callback ISubjectDisposer
 */
export interface ISubjectDisposer {
    (): void;
}

/**
 * Represents a subject that notifies attached observers of changes.
 * @template TSource - The type of the subject.
 * @template TDetail - The type of detail sent in notifications.
 */
export class Subject<TSource, TDetail> {
    #observers: ((sender: TSource, detail: TDetail) => void)[] = [];

    /**
     * Creates a new Subject instance.
     * @param {ISubjectNotifier<TSource, TDetail>} notifier - The notifier to wrap.
     */
    constructor(notifier: ISubjectNotifier<TSource, TDetail>) {
        notifier.notify = (source: TSource, detail: TDetail) => {
            for (const i in this.#observers)
                this.#observers[i](source, detail);
        };
    }

    /**
     * Attaches an observer to the subject.
     * @param {ISubjectObserver<TSource, TDetail>} observer - The observer function to attach.
     * @returns {ISubjectDisposer} A function that detaches the observer.
     */
    attach(observer: ISubjectObserver<TSource, TDetail>): ISubjectDisposer {
        const id = this.#observers.length;
        this.#observers.push(observer);

        return <ISubjectDisposer>this.#detach.bind(this, id);
    }

    /**
     * Detaches an observer from the subject.
     * @param {number} observerId - The identifier of the observer to detach.
     */
    #detach(observerId: number) {
        delete this.#observers[observerId];
    }
}

/**
 * Represents an observer function for subject notifications.
 * @template TSource - The type of the subject.
 * @template TDetail - The type of detail sent in notifications.
 * @callback ISubjectObserver
 * @param {TSource} sender - The subject sending the notification.
 * @param {TDetail} detail - The detail of the notification.
 */
export interface ISubjectObserver<TSource, TDetail> {
    (sender: TSource, detail: TDetail): void;
}

/**
 * Represents an observable object that notifies observers about property and array changes.
 * @template T - The type of the observable object.
 */
export class Observable<T> {
    #propertyChangedNotifier: ISubjectNotifier<T, PropertyChangedArgs>;
    #arrayChangedNotifier: ISubjectNotifier<T, ArrayChangedArgs>;
    
    readonly propertyChanged: Subject<T, PropertyChangedArgs>;
    readonly arrayChanged: Subject<T, ArrayChangedArgs>;

    /**
     * Creates a new observable instance.
     */
    constructor() {
        this.propertyChanged = new Subject<T, PropertyChangedArgs>(this.#propertyChangedNotifier = {});
        this.arrayChanged = new Subject<T, ArrayChangedArgs>(this.#arrayChangedNotifier = {});
    }

    /**
     * Notifies observers about a property change.
     * @protected
     * @param {string} propertyName - The name of the property that changed.
     * @param {*} newValue - The new value of the property.
     * @param {*} [oldValue] - The old value of the property.
     */
    protected notifyPropertyChanged(propertyName: string, newValue: any, oldValue?: any) {
        this.#propertyChangedNotifier.notify(<T><any>this, new PropertyChangedArgs(propertyName, newValue, oldValue));
    }

    /**
     * Notifies observers about an array change.
     * @protected
     * @param {string} arrayPropertyName - The name of the array property that changed.
     * @param {number} index - The index at which the change occurred.
     * @param {any[]} [removedItems=[]] - The items that were removed.
     * @param {number} addedCount - The number of items added.
     */
    protected notifyArrayChanged(arrayPropertyName: string, index: number, removedItems: any[] = [], addedCount: number) {
        this.#arrayChangedNotifier.notify(<T><any>this, new ArrayChangedArgs(arrayPropertyName, index, removedItems, addedCount));
    }
}

/**
 * Observer for property change events.
 * @template T - The type of the observable object.
 * @extends ISubjectObserver<T, PropertyChangedArgs>
 */
export interface IPropertyChangedObserver<T> extends ISubjectObserver<T, PropertyChangedArgs> {}