import "../common/string.js";
import { PropertyChangedArgs, ArrayChangedArgs } from "./event-args.js";
import type { Subject } from "./subject.js";
import type { Observable } from "./index.js";

/**
 * Disposer returned by {@link forwardObserver} to cancel all observers.
 */
export type ForwardObservedChainDisposer = () => void;

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
function _buildPathSegment(basePath: string, segment: string | number): string {
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

function _isObservableSource(obj: any): obj is IObservableSourceInternal {
    return obj && typeof obj === 'object' && obj.propertyChanged && typeof obj.propertyChanged.attach === 'function';
}

function _isObservableArraySourceCapable(obj: any): obj is IObservableSourceInternal & { arrayChanged: Subject<any, ArrayChangedArgs> } {
    return _isObservableSource(obj) && !!obj.arrayChanged && typeof obj.arrayChanged.attach === 'function';
}

/**
 * Notifies the observer about the initial value of a specific segment in the path.
 * This is typically called when `notifyInitialState` is true and the path traversal
 * for observation purposes ends at this segment.
 * @param observer The observer callback to notify.
 * @param currentValueSource The object/value from which 'segmentName' is accessed.
 * @param segmentName The name of the property segment being observed.
 * @param fullPathToSegment The complete path to this segment, used for notification.
 */
function _notifyInitialValueForSegment(
    observer: ForwardObservedCallback,
    currentValueSource: any,
    segmentName: string,
    fullPathToSegment: string
): void {
    let initialValue: any;
    let propertyOwner: any;

    if (segmentName === "") { // Path is "", observing the source itself
        initialValue = undefined; // The "value" of an empty path is considered undefined for notification
        propertyOwner = currentValueSource;
    } else if (currentValueSource && typeof currentValueSource === 'object') {
        initialValue = (currentValueSource as Record<string, any>)[segmentName];
        propertyOwner = (segmentName in currentValueSource) ? currentValueSource : undefined;
    } else if (typeof currentValueSource !== 'object' && currentValueSource !== null && currentValueSource !== undefined) {
        // currentValueSource is a primitive. 'segmentName' property doesn't exist "on" it.
        initialValue = undefined;
        propertyOwner = currentValueSource; // The primitive itself is the "owner".
    } else { // currentValueSource is null or undefined.
        initialValue = undefined;
        propertyOwner = undefined;
    }

    observer(new ForwardObservedPropertyChangedArgs(fullPathToSegment, segmentName, initialValue, undefined, propertyOwner));
}

/**
 * Handles observation for paths like "arraySource[*].remainingPathForItems".
 * Iterates over array items and recursively calls forwardObserverImpl for each item's sub-path.
 * @param arraySource The array to observe.
 * @param remainingPathForItems The path to observe for each item in the array (e.g., "subProp.leaf").
 * @param currentPathPrefix The path prefix before the wildcard and index (e.g., "myArray" if path is "myArray.*").
 * @param observer The observer callback to notify about changes.
 * @param notifyInitialState If true, the observer will be notified with the initial state of each item.
 * @param effectiveOriginalSource The original source object from the initial call to forwardObserver.
 * @returns An array of disposer functions for each item's observation.
 */
function _observeArrayWildcardItems(
    arraySource: any[],
    remainingPathForItems: string | undefined,
    currentPathPrefix: string,
    observer: ForwardObservedCallback,
    notifyInitialState?: boolean,
    effectiveOriginalSource?: any
): ForwardObservedChainDisposer[] {
    const itemDisposers: ForwardObservedChainDisposer[] = [];
    
    if (remainingPathForItems) { // Only observe items if there's a sub-path beyond "*"
        arraySource.forEach((item, index) => {
            const itemPathPrefix = _buildPathSegment(currentPathPrefix, index); // e.g., "myArray.0"
            itemDisposers.push(
                forwardObserverImpl(item, remainingPathForItems, itemPathPrefix, observer, notifyInitialState, effectiveOriginalSource)
            );
        });
    }
    
    // If no remainingPathForItems (e.g., path is just "myArray.*"), this function does not set up further listeners.
    // Observation of the array "myArray" itself (if it's a property of an observable) is handled by _observeObservableProperty.
    return itemDisposers;
}

/**
 * Sets up listeners for an array property, typically when the path is "propertyName.*".
 * This handles attaching to `arrayChanged` events and notifying initial state of the array property.
 * @param arrayOwner The observable object that owns the array property.
 * @param arrayPropName The name of the array property (e.g., "items").
 * @param arrayValue The actual array value to observe.
 * @param arrayFullPath The full path to the array property (e.g., "obj.items").
 * @param observer The observer callback to notify about changes.
 * @param notifyInitialState If true, the observer will be notified with the initial state of the array property.
 * @param isInitialCall True if this is the initial setup, false if due to property change.
 * @returns A disposer function that cleans up the listeners set up by this function.
 */
function _setupArrayPropertyListeners(
    arrayOwner: IObservableSourceInternal,
    arrayPropName: string,
    arrayValue: any[] | undefined,
    arrayFullPath: string,
    observer: ForwardObservedCallback,
    notifyInitialState?: boolean,
    isInitialCall?: boolean
): (() => void) | null {
    if (!arrayValue || !Array.isArray(arrayValue))
        return null;

    const listenerDisposers: (() => void)[] = [];
    let initialArrayValueNotifiedByThisFunc = false;

    if (_isObservableArraySourceCapable(arrayValue)) {
        // Try to listen to arrayValue.arrayChanged (if the array itself is observable)
        listenerDisposers.push(
            arrayValue.arrayChanged.attach((_s, evDeets) => {
                observer(new ForwardObservedArrayChangedArgs(arrayFullPath, arrayPropName, evDeets.index, evDeets.removedItems, evDeets.addedItemCount, arrayValue));
            })
        );

        if (notifyInitialState && isInitialCall && arrayPropName in arrayOwner) {
             observer(new ForwardObservedPropertyChangedArgs(arrayFullPath, arrayPropName, arrayValue, undefined, arrayOwner));
             initialArrayValueNotifiedByThisFunc = true;
        }
    }
    else if (_isObservableArraySourceCapable(arrayOwner)) {
        // Try to listen to arrayOwner.arrayChanged (if parent handles array property changes)
        listenerDisposers.push(
            arrayOwner.arrayChanged!.attach((_s, evDeets) => {
                if (evDeets.arrayPropertyName === arrayPropName) {
                    observer(new ForwardObservedArrayChangedArgs(arrayFullPath, arrayPropName, evDeets.index, evDeets.removedItems, evDeets.addedItemCount, arrayValue));
                }
            })
        );

        if (notifyInitialState && isInitialCall && (arrayPropName in arrayOwner) && !initialArrayValueNotifiedByThisFunc) {
             observer(new ForwardObservedPropertyChangedArgs(arrayFullPath, arrayPropName, arrayValue, undefined, arrayOwner));
             initialArrayValueNotifiedByThisFunc = true;
        }
    }

    // Fallback for initial notification of the array property itself, if not already done.
    if (notifyInitialState && isInitialCall && (arrayPropName in arrayOwner) && !initialArrayValueNotifiedByThisFunc)
        observer(new ForwardObservedPropertyChangedArgs(arrayFullPath, arrayPropName, arrayValue, undefined, arrayOwner));

    return listenerDisposers.length > 0 ? () => listenerDisposers.forEach(d => d()) : null;
}


/**
 * Observes a specific property on an Observable source.
 * Manages sub-chain observation for nested properties and specialized observation for array properties.
 * @param observableSource The observable source object to observe.
 * @param propertyName The name of the property to observe on the observable source.
 * @param remainingPath The path relative to the property's value (e.g., "subProp.leaf").
 * @param propertyAbsolutePath The full path to this propertyName (e.g., "obj.propertyName").
 * @param observer The observer callback to notify about changes.
 * @param notifyInitialState If true, the observer will be notified with the initial state of the property.
 * @param effectiveOriginalSource The original source object from the initial call to forwardObserver.
 * @returns A disposer function that cleans up all observers and listeners set up by this function.
 */
function _observeObservableProperty(
    observableSource: IObservableSourceInternal,
    propertyName: string,
    remainingPath: string | undefined,
    propertyAbsolutePath: string,
    observer: ForwardObservedCallback,
    notifyInitialState?: boolean,
    effectiveOriginalSource?: any
): ForwardObservedChainDisposer {
    let activeSubChainDisposer: ForwardObservedChainDisposer | null = null;
    let activeArrayPropertyListenersDisposer: (() => void) | null = null;

    // Sets up or updates observation based on the property's current value.
    const setupObservationForPropertyValue = (value: any, isInitialSetup: boolean) => {
        // Clean up any existing listeners for the old value
        if (activeSubChainDisposer) activeSubChainDisposer();
        if (activeArrayPropertyListenersDisposer) activeArrayPropertyListenersDisposer();
        activeSubChainDisposer = null;
        activeArrayPropertyListenersDisposer = null;

        if (value !== null && value !== undefined) {
            if (remainingPath && remainingPath !== "*") {
                // Observe a nested property: propertyName.remainingPath
                activeSubChainDisposer = forwardObserverImpl(value, remainingPath, propertyAbsolutePath, observer, notifyInitialState, effectiveOriginalSource);
            } else if (remainingPath === "*") {
                // Observe array mutations/content: propertyName.*
                activeArrayPropertyListenersDisposer = _setupArrayPropertyListeners(
                    observableSource, propertyName, value as any[], propertyAbsolutePath,
                    observer, notifyInitialState, isInitialSetup
                );
            }
            // If no remainingPath, observation for this propertyName is complete.
            // Initial value for this property (if notifyInitialState is true and path ends here)
            // is handled by _notifyInitialValueForSegment in the main forwardObserverImpl.
        } else if (remainingPath && remainingPath !== "*" && notifyInitialState) {
            // Property value is null/undefined, but path continues (e.g., "prop.subProp") and initial state is needed.
            // This will result in notifying undefined for the sub-path.
            activeSubChainDisposer = forwardObserverImpl(undefined, remainingPath, propertyAbsolutePath, observer, notifyInitialState, effectiveOriginalSource);
        }
    };

    // Attach to propertyChanged event of the observableSource
    const propertyChangedEventDisposer = observableSource.propertyChanged.attach((sender, eventDetail) => {
        if (eventDetail.propertyName === propertyName) {
            // The property we are observing has changed its value.
            setupObservationForPropertyValue(eventDetail.newValue, false); // `false` as this is not the initial setup.

            // Notify the observer about this property's change.
            observer(new ForwardObservedPropertyChangedArgs(propertyAbsolutePath, propertyName, eventDetail.newValue, eventDetail.oldValue, sender));
        }
    });

    // Initial setup: observe the property's current value.
    const currentPropertyValue = (observableSource as Record<string, any>)[propertyName];
    setupObservationForPropertyValue(currentPropertyValue, true); // `true` for initial setup.

    // Return a disposer that cleans up everything set up by this function call.
    return () => {
        propertyChangedEventDisposer();
        
        if (activeSubChainDisposer)
            activeSubChainDisposer();
        
        if (activeArrayPropertyListenersDisposer)
            activeArrayPropertyListenersDisposer();
    };
}

/**
 * Observes a specific property on a plain JavaScript object.
 * If there's a remaining path, it recursively calls forwardObserverImpl.
 * @param plainObjectSource The plain object to observe.
 * @param propertyName The name of the property to observe on the plain object.
 * @param remainingPath The path relative to the property's value (e.g., "subProp.leaf").
 * @param propertyAbsolutePath The full path to this propertyName (e.g., "obj.propertyName").
 * @param observer The observer callback to notify about changes.
 * @param notifyInitialState If true, the observer will be notified with the initial state of the property.
 * @param effectiveOriginalSource The original source object from the initial call to forwardObserver.
 * @returns A disposer function that cleans up all observers and listeners set up by this function.
 */
function _observePlainObjectProperty(
    plainObjectSource: Record<string, any>,
    propertyName: string,
    remainingPath: string | undefined,
    propertyAbsolutePath: string,
    observer: ForwardObservedCallback,
    notifyInitialState?: boolean,
    effectiveOriginalSource?: any
): ForwardObservedChainDisposer {
    const propertyValue = plainObjectSource[propertyName];

    if (remainingPath) {
        // If propertyValue is an object/array, or if it's not but notifyInitialState is true (to reach end of path).
        if ((propertyValue !== null && typeof propertyValue === 'object') || (notifyInitialState && !(propertyValue !== null && typeof propertyValue === 'object'))) {
            return forwardObserverImpl(propertyValue, remainingPath, propertyAbsolutePath, observer, notifyInitialState, effectiveOriginalSource);
        }
    }

    // No remainingPath or propertyValue is not suitable for further observation (and not forced by notifyInitialState).
    // Initial notification for this segment (if path ends here) is handled by `_notifyInitialValueForSegment`.
    return () => {}; // Plain objects don't have change events, so no active listeners beyond recursion.
}

/**
 * Core recursive implementation for {@link forwardObserver}.
 * @param source The current object/value in the path being observed.
 * @param relativePath The path segment(s) relative to the current source.
 * @param currentPathPrefix The absolute path accumulated so far, up to (but not including) the current relativePath.
 * @param observer The callback for change notifications.
 * @param notifyInitialState If true, send initial state notifications.
 * @param originalSource The very first source object from the initial call to {@link forwardObserver}.
 * @returns A disposer function to cancel observations set up by this call and its children.
 */
function forwardObserverImpl(
    source: any,
    relativePath: string,
    currentPathPrefix: string,
    observer: ForwardObservedCallback,
    notifyInitialState?: boolean,
    originalSource?: any
): ForwardObservedChainDisposer {
    const aggregateDisposers: ForwardObservedChainDisposer[] = [];
    const effectiveOriginalSource = originalSource !== undefined ? originalSource : source; // Use originalSource if provided, otherwise current source is the starting point for this chain.

    // 1. Parse current path segment and remaining path.
    const pathSegments = (relativePath as any).splitWithTail(".", 2);
    const currentSegment = pathSegments[0]; // e.g., "prop" or "*" or ""
    const remainingPathStr = pathSegments.length > 1 ? pathSegments[1] : undefined; // e.g., "subProp.leaf" or undefined

    const propertyAbsolutePath = _buildPathSegment(currentPathPrefix, currentSegment);

    // 2. Handle initial state notification.

    // 2.A: Path ends at `currentSegment` (not wildcard, not empty path segment).
    if (notifyInitialState && !remainingPathStr && currentSegment !== "*" && currentSegment !== "") {
        _notifyInitialValueForSegment(observer, source, currentSegment, propertyAbsolutePath);
    }

    // 2.B: Path is exactly `""` (observing the source object itself).
    if (currentSegment === "" && notifyInitialState && !remainingPathStr) {
        _notifyInitialValueForSegment(observer, source, "", propertyAbsolutePath); // Path and segment are both ""
    }

    // 3. Delegate observation based on source type and path structure.
    if (currentSegment === "" && !remainingPathStr) {
        // Path is exactly "", observation is complete (initial notification handled above).
        return () => {};
    }

    if (Array.isArray(source) && currentSegment === "*") {
        // Path involves iterating over array items (e.g., "arrayProperty.*.child").
        // `currentPathPrefix` here is the path to the array itself. `remainingPathStr` is for items.
        const itemDisposers = _observeArrayWildcardItems(source, remainingPathStr, currentPathPrefix, observer, notifyInitialState, effectiveOriginalSource);
        aggregateDisposers.push(...itemDisposers);
    } else if (_isObservableSource(source)) {
        // If remainingPathStr is '*' and the property is not an array, notify initial value for the property itself.
        if (remainingPathStr === "*") {
            const propertyValue = (source as Record<string, any>)[currentSegment];
            if (!Array.isArray(propertyValue) && notifyInitialState) {
                _notifyInitialValueForSegment(observer, source, currentSegment, propertyAbsolutePath);
                // Also, listen for property changes and notify again if the property changes.
                aggregateDisposers.push(source.propertyChanged.attach((sender, eventDetail) => {
                    if (eventDetail.propertyName === currentSegment)
                        observer(new ForwardObservedPropertyChangedArgs(propertyAbsolutePath, currentSegment, eventDetail.newValue, eventDetail.oldValue, sender));
                }));

                return () => { aggregateDisposers.forEach(d => d()); aggregateDisposers.length = 0; };
            }
        }
        
        // Source is an Observable object, observe its property `currentSegment`.
        aggregateDisposers.push(_observeObservableProperty(source, currentSegment, remainingPathStr, propertyAbsolutePath, observer, notifyInitialState, effectiveOriginalSource));
    } else if (source && typeof source === 'object') { // Plain object (not null)
        // If remainingPathStr is '*' and the property is not an array, notify initial value for the property itself.
        if (remainingPathStr === "*") {
            const propertyValue = (source as Record<string, any>)[currentSegment];
            if (!Array.isArray(propertyValue) && notifyInitialState) {
                _notifyInitialValueForSegment(observer, source, currentSegment, propertyAbsolutePath);
                return () => {};
            }
        }

        // Source is a plain object, access its property `currentSegment`.
        aggregateDisposers.push(_observePlainObjectProperty(source, currentSegment, remainingPathStr, propertyAbsolutePath, observer, notifyInitialState, effectiveOriginalSource));
    } else if (remainingPathStr && notifyInitialState && !(source && typeof source === 'object')) {
        // Source is primitive/null/undefined, but path continues (e.g., "prop.subProp") and initial state is needed.
        // `propertyAbsolutePath` is the path to `currentSegment` (which is effectively undefined on `source`).
        // We need to observe `remainingPathStr` starting from this undefined value.
        const subDisposer = forwardObserverImpl(
            undefined, // The value of `currentSegment` on a primitive `source` is undefined for path traversal.
            remainingPathStr,
            propertyAbsolutePath, // `propertyAbsolutePath` is the base for the `remainingPathStr`.
            observer,
            notifyInitialState,
            effectiveOriginalSource
        );

        aggregateDisposers.push(subDisposer);
    }

    // If none of the above, then:
    // - Source is primitive/null/undefined, AND
    //   - EITHER no remainingPathStr (observation ends, initial value handled if applicable)
    //   - OR no notifyInitialState (so no need to trace non-existent paths).
    // In these cases, no further active listeners are set up beyond potential initial notifications.
    return () => {
        aggregateDisposers.forEach(d => d());
        aggregateDisposers.length = 0;
    };
}

/**
 * Recursively forwards change notifications to a {@link ForwardObservedCallback} for an Observable, Array, or plain object property path.
 * @param source The source object to observe, which can be an Observable, Array, or plain object. Can be null or undefined.
 * @param relativePath The relative path to the property to observe, e.g., "property.subProperty" or "*".
 * @param observer The observer callback that will receive notifications about property changes.
 * @param notifyInitialState Optional. If set to true, the observer will be called with the initial state of properties as they are encountered.
 * @returns A disposer function that, when called, will cancel all observers and stop forwarding notifications.
 */
export function forwardObserver(
    source: Observable<any> | Array<any> | Record<string, any> | null | undefined,
    relativePath: string,
    observer: ForwardObservedCallback,
    notifyInitialState?: boolean
): ForwardObservedChainDisposer {
    return forwardObserverImpl(source, relativePath, "", observer, notifyInitialState, source);
}

export default forwardObserver;