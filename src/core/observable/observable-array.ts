/**
 * Callback invoked when array elements are added, removed, or replaced.
 * @template T - The type of items in the array.
 */
export type ArrayMutationCallback<T> = (index: number, removedItems: T[], addedCount: number) => void;

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
export function createObservableArray<T>(array: T[], onArrayChanged: ArrayMutationCallback<T>): T[] {
    let isMutating = false;

    const notify = (index: number, removedItems: T[], addedCount: number) => {
        try {
            isMutating = true;
            onArrayChanged(index, removedItems, addedCount);
        }
        finally {
            isMutating = false;
        }
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

                if (removedItems.length > 0)
                    notify(newLength, removedItems, 0);

                return result;
            }

            if (typeof prop === 'string' && prop.trim() !== '' && Number.isInteger(Number(prop))) {
                const index = Number(prop);
                const oldLength = target.length;
                const oldValue = target[index];
                const result = Reflect.set(target, prop, value, receiver);

                if (oldValue !== value) {
                    if (index < oldLength)
                        notify(index, [oldValue], 1);
                    else
                        notify(index, [], 1);
                }

                return result;
            }

            return Reflect.set(target, prop, value, receiver);
        },

        get(target, prop, receiver) {
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
                }

                switch (methodName) {
                    case 'push':
                        notify(oldLength, [], args.length);
                        break;
                    case 'pop':
                        if (target.length < oldLength)
                            notify(oldLength - 1, [result], 0);
                        break;
                    case 'shift':
                        if (target.length < oldLength)
                            notify(0, [result], 0);
                        break;
                    case 'unshift':
                        notify(0, [], args.length);
                        break;
                    case 'splice': {
                        const [spliceStart] = args;
                        const actualStart = spliceStart < 0 ? Math.max(0, oldLength + spliceStart) : Math.min(spliceStart, oldLength);
                        const removed = result as T[];
                        const added = Math.max(0, args.length - 2);
                        notify(actualStart, removed, added);
                        break;
                    }
                    case 'sort':
                    case 'reverse':
                    case 'fill':
                    case 'copyWithin':
                        notify(startIndex, removedForNotify, addCount);
                        break;
                }

                return result;
            };
        }
    });
}
