import { ArrayChangedArgs, PropertyChangedArgs } from "./event-args.js";
import { ISubjectNotifier, ISubjectObserver, Subject } from "./subject.js";
import { forwardObserver, ForwardObservedCallback, ForwardObservedChainDisposer } from "./forward-observer.js";

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

    /**
     * Recursively forwards change notifications to a {@link ForwardObservedCallback} for an Observable, Array, or plain object property path.
     * @param source The source object to observe, which can be an Observable, Array, or plain object.
     * @param relativePath The relative path to the property to observe, e.g., "property.subProperty" or "*".
     * @param observer The observer callback that will receive notifications about property changes.
     * @param notifyInitialState Optional. If set to true, the observer will be notified with the initial state of the property at the specified path.
     * @returns A disposer function that, when called, will cancel all observers and stop forwarding notifications.
     */
    static forward(source: Observable<any> | Array<any> | Record<string, any>, relativePath: string, observer: ForwardObservedCallback, notifyInitialState?: boolean): ForwardObservedChainDisposer {
        return forwardObserver(source, relativePath, observer, notifyInitialState);
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
export { ForwardObservedCallback, ForwardObservedPropertyChangedArgs, ForwardObservedArrayChangedArgs, ForwardObservedChainDisposer } from "./forward-observer.js";