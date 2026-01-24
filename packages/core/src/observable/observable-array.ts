/**
 * Callback invoked when array elements are added, removed, or replaced.
 * @template T - The type of items in the array.
 */
export type ArrayMutationCallback<T> = (index: number, removedItems: T[], addedCount: number) => void;

/**
 * Callback invoked when a keyed entry is added, removed, or replaced.
 * @template T - The type of items in the array.
 * @template K - The type of the key (string).
 */
export type KeyChangedCallback<T, K extends string> = (key: K, newValue: T | undefined, oldValue: T | undefined) => void;

/**
 * Options for creating an observable array with key support.
 * @template T - The type of items in the array.
 * @template K - The type of the key (string).
 */
export interface ObservableArrayKeyOptions<T, K extends string> {
    /**
     * Function to extract a key from an item.
     */
    keySelector: (item: T) => K;
    /**
     * Callback invoked when a keyed entry changes.
     */
    onKeyChanged?: KeyChangedCallback<T, K>;
}

/**
 * Creates an observable array proxy that notifies about mutations.
 * The proxy intercepts all mutating operations and invokes the provided callback.
 *
 * @template T - The type of items in the array.
 * @param array - The array to wrap.
 * @param onArrayChanged - Callback invoked when array elements change.
 * @returns A proxied array that notifies on mutations.
 *
 * @example
 * ```typescript
 * class MyObservable extends Observable<MyObservable> {
 *     #items: string[];
 *
 *     constructor() {
 *         super();
 *         this.#items = createObservableArray(
 *             [],
 *             (index, removed, added) => this.notifyArrayChanged("items", index, removed, added)
 *         );
 *     }
 * }
 * ```
 */
export function createObservableArray<T>(array: T[], onArrayChanged: ArrayMutationCallback<T>): T[];

/**
 * Creates an observable array proxy with keyed access that notifies about mutations.
 * The proxy intercepts all mutating operations and invokes the provided callbacks.
 * Items can be accessed by both index and key.
 *
 * @template T - The type of items in the array.
 * @template K - The type of the key (string).
 * @param array - The array to wrap.
 * @param onArrayChanged - Callback invoked when array elements change.
 * @param options - Options for keyed access including keySelector and optional onKeyChanged callback.
 * @returns A proxied array that notifies on mutations and supports keyed access.
 *
 * @example
 * ```typescript
 * class MyObservable extends Observable<MyObservable> {
 *     #items: Item[] & Record<string, Item>;
 *
 *     constructor() {
 *         super();
 *         this.#items = createObservableArray(
 *             [],
 *             (index, removed, added) => this.notifyArrayChanged("items", index, removed, added),
 *             {
 *                 keySelector: item => item.name,
 *                 onKeyChanged: (key, newValue, oldValue) =>
 *                     this.notifyPropertyChanged(`items.${key}`, newValue, oldValue)
 *             }
 *         );
 *     }
 * }
 *
 * // Access by index or key:
 * observable.items[0]           // First item
 * observable.items["myItem"]    // Item with name "myItem"
 * ```
 */
export function createObservableArray<T, K extends string>(
    array: T[],
    onArrayChanged: ArrayMutationCallback<T>,
    options: ObservableArrayKeyOptions<T, K>
): T[] & Record<K, T>;

export function createObservableArray<T, K extends string = string>(
    array: T[],
    onArrayChanged: ArrayMutationCallback<T>,
    options?: ObservableArrayKeyOptions<T, K>
): T[] | (T[] & Record<K, T>) {
    let isMutating = false;
    const keySelector = options?.keySelector;
    const onKeyChanged = options?.onKeyChanged;

    // Track which keys are set on the proxy (not the underlying array)
    const keyMap = new Map<K, T>();

    const notify = (index: number, removedItems: T[], addedCount: number) => {
        try {
            isMutating = true;
            onArrayChanged(index, removedItems, addedCount);
        }
        finally {
            isMutating = false;
        }
    };

    const notifyKey = (key: K, newValue: T | undefined, oldValue: T | undefined) => {
        if (!onKeyChanged || newValue === oldValue)
            return;

        try {
            isMutating = true;
            onKeyChanged(key, newValue, oldValue);
        }
        finally {
            isMutating = false;
        }
    };

    const addKey = (item: T) => {
        if (!keySelector)
            return;

        const key = keySelector(item);
        const oldValue = keyMap.get(key);
        keyMap.set(key, item);
        notifyKey(key, item, oldValue);
    };

    const removeKey = (item: T) => {
        if (!keySelector)
            return;

        const key = keySelector(item);
        const currentValue = keyMap.get(key);

        // Only remove if this item is still the one mapped to this key
        if (currentValue === item) {
            keyMap.delete(key);
            notifyKey(key, undefined, item);
        }
    };

    const syncKeysForItems = (removedItems: T[], addedItems: T[]) => {
        // Remove keys for removed items
        for (const item of removedItems)
            removeKey(item);

        // Add keys for added items
        for (const item of addedItems)
            addKey(item);
    };

    // Initialize keys for existing items
    if (keySelector) {
        for (const item of array)
            keyMap.set(keySelector(item), item);
    }

    const isNumericIndex = (prop: string | symbol): prop is string => {
        return typeof prop === 'string' && prop.trim() !== '' && Number.isInteger(Number(prop));
    };

    const isKeyAccess = (prop: string | symbol): prop is K => {
        if (!keySelector || typeof prop !== 'string')
            return false;

        // Not a numeric index and not a property/method on the array prototype
        // This handles both built-in and custom array methods (like orderBy, groupBy, remove, etc.)
        return !isNumericIndex(prop) && !(prop in array);
    };

    return new Proxy(array, {
        set(target, prop, value, receiver) {
            if (isMutating)
                return Reflect.set(target, prop, value, receiver);

            if (prop === 'length') {
                const oldLength = target.length;
                const newLength = Number(value);

                let removedItems: T[] = [];
                if (newLength < oldLength)
                    removedItems = target.slice(newLength, oldLength);

                const result = Reflect.set(target, prop, value, receiver);

                if (removedItems.length > 0) {
                    syncKeysForItems(removedItems, []);
                    notify(newLength, removedItems, 0);
                }

                return result;
            }

            if (isNumericIndex(prop)) {
                const index = Number(prop);
                const oldLength = target.length;
                const oldValue = target[index];
                const result = Reflect.set(target, prop, value, receiver);

                if (oldValue !== value) {
                    if (index < oldLength) {
                        syncKeysForItems([oldValue], [value]);
                        notify(index, [oldValue], 1);
                    }
                    else {
                        syncKeysForItems([], [value]);
                        notify(index, [], 1);
                    }
                }

                return result;
            }

            // Handle direct key assignment: array["name"] = item
            if (isKeyAccess(prop)) {
                const key = prop;
                const oldValue = keyMap.get(key);

                if (oldValue === value)
                    return true;

                // Remove old item from array if it exists
                if (oldValue !== undefined) {
                    const oldIndex = target.indexOf(oldValue);
                    if (oldIndex >= 0) {
                        target.splice(oldIndex, 1);
                        keyMap.delete(key);
                        notifyKey(key, undefined, oldValue);
                        notify(oldIndex, [oldValue], 0);
                    }
                }

                // Add new item to array
                if (value !== undefined) {
                    const newLength = target.length;
                    target.push(value);
                    keyMap.set(key, value);
                    notifyKey(key, value, undefined);
                    notify(newLength, [], 1);
                }

                return true;
            }

            return Reflect.set(target, prop, value, receiver);
        },

        get(target, prop, receiver) {
            // Handle key access: array["name"]
            if (isKeyAccess(prop))
                return keyMap.get(prop);

            const value = Reflect.get(target, prop, receiver);

            if (typeof value !== 'function' || typeof prop !== 'string')
                return value;

            const methodName = prop;
            const mutatingMethods = [
                'push', 'pop', 'shift', 'unshift', 'splice',
                'sort', 'reverse', 'fill', 'copyWithin'
            ];

            if (!mutatingMethods.includes(methodName))
                return value;

            return function (this: T[], ...args: any[]) {
                if (isMutating)
                    return (value as Function).apply(target, args);

                const oldLength = target.length;
                let removedForNotify: T[] = [];
                let addedForNotify: T[] = [];
                let addCount = 0;
                let startIndex = 0;

                if (methodName === 'sort' || methodName === 'reverse') {
                    removedForNotify = [...target];
                    startIndex = 0;
                    addCount = target.length;
                }
                else if (methodName === 'fill') {
                    const [, start = 0, end = target.length] = args;
                    startIndex = start < 0 ? Math.max(0, oldLength + start) : Math.min(start, oldLength);
                    const actualEnd = end < 0 ? Math.max(0, oldLength + end) : Math.min(end, oldLength);

                    if (actualEnd > startIndex) {
                        removedForNotify = target.slice(startIndex, actualEnd);
                        addCount = actualEnd - startIndex;
                    }
                }
                else if (methodName === 'copyWithin') {
                    const [targetIndex, start = 0, end = target.length] = args;
                    startIndex = targetIndex < 0 ? Math.max(0, oldLength + targetIndex) : Math.min(targetIndex, oldLength);
                    const actualStart = start < 0 ? Math.max(0, oldLength + start) : Math.min(start, oldLength);
                    const actualEnd = end < 0 ? Math.max(0, oldLength + end) : Math.min(end, oldLength);

                    const count = Math.min(actualEnd - actualStart, oldLength - startIndex);
                    if (count > 0) {
                        removedForNotify = target.slice(startIndex, startIndex + count);
                        addCount = count;
                    }
                }

                const result = (value as Function).apply(target, args);

                if (['sort', 'reverse', 'fill', 'copyWithin'].includes(methodName)) {
                    const newSnapshot = target.slice(startIndex, startIndex + addCount);
                    const hasChanged = removedForNotify.length !== newSnapshot.length ||
                        !removedForNotify.every((val, i) => val === newSnapshot[i]);

                    if (!hasChanged)
                        return result;

                    addedForNotify = newSnapshot;
                }

                switch (methodName) {
                    case 'push':
                        addedForNotify = args;
                        syncKeysForItems([], addedForNotify);
                        notify(oldLength, [], args.length);
                        break;
                    case 'pop':
                        if (target.length < oldLength) {
                            syncKeysForItems([result], []);
                            notify(oldLength - 1, [result], 0);
                        }
                        break;
                    case 'shift':
                        if (target.length < oldLength) {
                            syncKeysForItems([result], []);
                            notify(0, [result], 0);
                        }
                        break;
                    case 'unshift':
                        addedForNotify = args;
                        syncKeysForItems([], addedForNotify);
                        notify(0, [], args.length);
                        break;
                    case 'splice': {
                        const [spliceStart] = args;
                        const actualStart = spliceStart < 0 ? Math.max(0, oldLength + spliceStart) : Math.min(spliceStart, oldLength);
                        const removed = result as T[];
                        const added = args.slice(2);
                        syncKeysForItems(removed, added);
                        notify(actualStart, removed, added.length);
                        break;
                    }
                    case 'sort':
                    case 'reverse':
                    case 'fill':
                    case 'copyWithin':
                        syncKeysForItems(removedForNotify, addedForNotify);
                        notify(startIndex, removedForNotify, addCount);
                        break;
                }

                return result;
            };
        },

        deleteProperty(target, prop) {
            if (isMutating)
                return Reflect.deleteProperty(target, prop);

            // Handle key deletion: delete array["name"]
            if (isKeyAccess(prop)) {
                const key = prop;
                const oldValue = keyMap.get(key);

                if (oldValue === undefined)
                    return true;

                const index = target.indexOf(oldValue);
                if (index >= 0) {
                    target.splice(index, 1);
                    keyMap.delete(key);
                    notifyKey(key, undefined, oldValue);
                    notify(index, [oldValue], 0);
                }

                return true;
            }

            return Reflect.deleteProperty(target, prop);
        },

        has(target, prop) {
            // Support "key" in array for keyed arrays
            if (isKeyAccess(prop))
                return keyMap.has(prop);

            return Reflect.has(target, prop);
        }
    });
}
