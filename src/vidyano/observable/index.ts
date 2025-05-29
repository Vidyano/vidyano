import { ArrayChangedArgs, PropertyChangedArgs } from "./event-args.js";
import { ISubjectNotifier, ISubjectObserver, Subject } from "./subject.js";
import { forwardObserver, ForwardObservedCallback, IObserveChainDisposer } from "./forward-observer.js";

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

    static forward(source: Observable<any> | Array<any> | Record<string, any>, relativePath: string, currentPathPrefix: string, observer: ForwardObservedCallback, notifyInitialState: boolean = true): IObserveChainDisposer {
        return forwardObserver(source, relativePath, currentPathPrefix, observer, notifyInitialState);
    }
}

/**
 * Observer for property change events.
 * @template T - The type of the observable object.
 * @extends ISubjectObserver<T, PropertyChangedArgs>
 */
export interface IPropertyChangedObserver<T> extends ISubjectObserver<T, PropertyChangedArgs> {}

// Export all observable-related classes and interfaces from this module
export * from "./event-args.js";
export * from "./subject.js";
export { ForwardObservedCallback, ForwardObservedPropertyChangedArgs, ForwardObservedArrayChangedArgs } from "./forward-observer.js";