import "../common/string.js";
import { PropertyChangedArgs, ArrayChangedArgs } from "./event-args.js";
import type { Subject } from "./subject.js";
import type { Observable } from "./observable.js";

/**
 * Disposer returned by {@link forwardObserver} to cancel all observers.
 */
export interface IObserveChainDisposer {
    (): void;
}

/**
 * Specialized PropertyChangedArgs for observer chain notifications, including path and owner.
 */
export class ForwardObservedPropertyChangedArgs extends PropertyChangedArgs {
    public readonly path: string;
    public readonly propertyOwner: any;

    /**
     * Creates a new instance of ObserveChainPropertyChangedArgs.
     * @param path The full path to the property that changed.
     * @param propertyName The name of the property that changed.
     * @param newValue The new value of the property.
     * @param oldValue The old value of the property.
     * @param propertyOwner The owner of the property that changed.
     */
    constructor(path: string, propertyName: string, newValue: any, oldValue: any, propertyOwner: any) {
        super(propertyName, newValue, oldValue);

        this.path = path;
        this.propertyOwner = propertyOwner;
    }
}

/**
 * Specialized ArrayChangedArgs for observer chain notifications, including path and array instance.
 */
export class ForwardObservedArrayChangedArgs extends ArrayChangedArgs {
    public readonly path: string;
    public readonly arrayInstance: any[];

    /**
     * Creates a new instance of ObserveChainArrayChangedArgs.
     * @param path The full path to the array property that changed.
     * @param arrayPropertyName The name of the array property that changed.
     * @param index The index at which the change occurred.
     * @param removedItems The items that were removed from the array.
     * @param addedItemCount The number of items added to the array.
     * @param arrayInstance The instance of the array that changed.
     */
    constructor(path: string, arrayPropertyName: string, index: number, removedItems: any[] | undefined, addedItemCount: number | undefined, arrayInstance: any[]) {
        super(arrayPropertyName, index, removedItems, addedItemCount);

        this.path = path;
        this.arrayInstance = arrayInstance;
    }
}

/**
 * Callback signature for an observer that receives notifications from {@link forwardObserver}.
 */
export type ForwardObservedCallback = (detail: ForwardObservedPropertyChangedArgs | ForwardObservedArrayChangedArgs) => void;

// Helper to build a path segment (e.g., "root" + "prop" -> "root.prop")
function buildPathSegment(basePath: string, segment: string | number): string {
    if (basePath === "")
        return String(segment);

    return `${basePath}.${segment}`;
}

/**
 * Type Guard for Observable-like objects
 */
interface IObservableSourceInternal<T = any> {
    propertyChanged: Subject<T, PropertyChangedArgs>;
    arrayChanged?: Subject<T, ArrayChangedArgs>;
}

function isObservableSource(obj: any): obj is IObservableSourceInternal {
    return obj && typeof obj === 'object' && obj.propertyChanged && typeof obj.propertyChanged.attach === 'function';
}

function isObservableArraySourceCapable(obj: any): obj is IObservableSourceInternal & { arrayChanged: Subject<any, ArrayChangedArgs> } {
    return isObservableSource(obj) && !!obj.arrayChanged && typeof obj.arrayChanged.attach === 'function';
}

/**
 * Recursively forwards change notifications to a {@link ForwardObservedCallback} for an Observable, Array, or plain object property path.
 * @param source The source object to observe, which can be an Observable, Array, or plain object.
 * @param relativePath The relative path to the property to observe, e.g., "property.subProperty" or "*".
 * @param currentPathPrefix The prefix for the current path, used for building absolute paths.
 * @param observer The observer callback that will receive notifications about property changes.
 * @param notifyInitialState Optional. If true (default), the observer will be called with the initial state of properties as they are encountered.
 * @returns A disposer function that, when called, will cancel all observers and stop forwarding notifications.
 */
export function forwardObserver(source: Observable<any> | Array<any> | Record<string, any>, relativePath: string, currentPathPrefix: string, observer: ForwardObservedCallback, notifyInitialState: boolean = true): IObserveChainDisposer {
    // Base case: If source is not an object or array, no observation is possible.
    if (!source || (typeof source !== 'object' && !Array.isArray(source)))
        return () => {}; // Return a no-op disposer.

    // Parse the current segment of the path and any remaining path.
    // String.prototype.splitWithTail is assumed to be defined (e.g. in "./string.js")
    const pathSegments = (relativePath as any).splitWithTail(".", 2); // Cast relativePath to any if splitWithTail is a prototype extension
    const currentSegment = pathSegments[0];
    const remainingPathString = pathSegments.length > 1 ? pathSegments[1] : undefined;

    // Construct the absolute path to the property being observed in this call.
    const propertyAbsolutePath = buildPathSegment(currentPathPrefix, currentSegment);

    const disposers: (() => void)[] = []; // Stores cleanup functions for listeners.
    let subChainDisposer: IObserveChainDisposer | null = null; // Disposer for a deeper observation chain.

    // Case 1: Source is an array and path is like "*.childProperty"
    if (Array.isArray(source) && currentSegment === "*") {
        if (remainingPathString) { // Only proceed if there's a sub-path for array items.
            (source as any[]).forEach((item: any, idx: number) => {
                // Recursively observe the 'remainingPathString' on each item.
                const itemAbsolutePathPrefix = buildPathSegment(currentPathPrefix, idx);
                disposers.push(forwardObserver(item, remainingPathString, itemAbsolutePathPrefix, observer, notifyInitialState));
            });
        }
    }
    // Case 2: Source is an Observable object.
    else if (isObservableSource(source)) {
        // Listen for property changes on the source Observable.
        const propertyChangedDispose = source.propertyChanged.attach((sender, eventDetail) => {
            // If the changed property is the one we're interested in (currentSegment):
            if (eventDetail.propertyName === currentSegment) {
                // If there was a sub-chain observing the old value, dispose it.
                if (subChainDisposer) {
                    subChainDisposer();
                    const idx = disposers.indexOf(subChainDisposer);
                    if (idx > -1) disposers.splice(idx, 1);
                    subChainDisposer = null;
                }

                const newValue = eventDetail.newValue;
                // If the new value exists and there's a remaining path to observe (and it's not an array wildcard path),
                // start a new sub-chain observation.
                if (newValue !== null && newValue !== undefined && remainingPathString && remainingPathString !== "*") {
                    subChainDisposer = forwardObserver(newValue, remainingPathString, propertyAbsolutePath, observer, notifyInitialState);
                    disposers.push(subChainDisposer);
                }

                // Notify the observer about this property change.
                observer(new ForwardObservedPropertyChangedArgs(propertyAbsolutePath, currentSegment, newValue, eventDetail.oldValue, sender));
            }
        });
        disposers.push(propertyChangedDispose);

        const currentPropertyValue = (source as Record<string, any>)[currentSegment];

        // Initial setup for any sub-chain or array listeners based on the current property's value.
        if (currentPropertyValue !== null && currentPropertyValue !== undefined) {
            if (remainingPathString) {
                if (remainingPathString !== "*") { // Path like "prop.subProp"
                    // Recursively observe the sub-property on the current value.
                    subChainDisposer = forwardObserver(currentPropertyValue, remainingPathString, propertyAbsolutePath, observer, notifyInitialState);
                    disposers.push(subChainDisposer);
                }
                else if (isObservableArraySourceCapable(source)) { // Path like "arrayProp.*"
                    // Listen for array changes (splices) on the 'arrayProp'.
                    const arrayChangedDispose = source.arrayChanged.attach((_sender, eventDetail) => {
                        if (eventDetail.arrayPropertyName === currentSegment) {
                            const arrayInstance = (source as Record<string, any>)[currentSegment];
                            if (Array.isArray(arrayInstance)) { // Ensure it's an array.
                                observer(new ForwardObservedArrayChangedArgs(
                                    propertyAbsolutePath, currentSegment, eventDetail.index,
                                    eventDetail.removedItems, eventDetail.addedItemCount, arrayInstance
                                ));
                            }
                        }
                    });
                    disposers.push(arrayChangedDispose);

                    // Notify observer about the array property itself (initial state), if requested.
                    if (notifyInitialState && Object.prototype.hasOwnProperty.call(source, currentSegment)) {
                        observer(new ForwardObservedPropertyChangedArgs(
                            propertyAbsolutePath, currentSegment, currentPropertyValue, undefined, source
                        ));
                    }
                }
            }
        }

        // Initial notification for the current property's value, if requested and not already handled for arrayProp.*.
        // This ensures the observer gets the initial state of the property.
        if (notifyInitialState && Object.prototype.hasOwnProperty.call(source, currentSegment) && !(remainingPathString === "*" && isObservableArraySourceCapable(source))) {
             observer(new ForwardObservedPropertyChangedArgs(propertyAbsolutePath, currentSegment, currentPropertyValue, undefined, source));
        }
    }
    // Case 3: Source is a plain JavaScript object (or a non-Observable part of the chain).
    else if (typeof source === 'object' && source !== null && currentSegment in source) {
        const subSourceValue = (source as Record<string, any>)[currentSegment];
        if (remainingPathString) { // If there's a sub-path to observe:
            if (subSourceValue !== null && subSourceValue !== undefined) {
                // Recursively observe the sub-property.
                subChainDisposer = forwardObserver(subSourceValue, remainingPathString, propertyAbsolutePath, observer, notifyInitialState);
                disposers.push(subChainDisposer);
            }
        }
        // Initial notification for the property's current value on this plain object, if requested.
        if (notifyInitialState && Object.prototype.hasOwnProperty.call(source, currentSegment)) {
             observer(new ForwardObservedPropertyChangedArgs(
                propertyAbsolutePath, currentSegment, subSourceValue, undefined, source
            ));
        }
    }

    // Return a function that, when called, disposes all listeners set up in this call.
    return () => {
        disposers.forEach(d => d());
        disposers.length = 0; // Clear the disposers array.
    };
}

export default forwardObserver;