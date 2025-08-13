import { QueryResultItem } from "./query-result-item.js";
import type { Query } from "./query.js";

/**
 * Query result items collection with lazy loading capabilities.
 * Behaves like an array but fetches items on-demand as they're accessed,
 * supporting async iteration and query-specific operations.
 */
export type QueryItems =
    // Extends Array<QueryResultItem> for full compatibility with array operations
    // The proxy implementation will handle lazy loading
    Array<QueryResultItem> &

    // Add async iteration so `for await (const item of arr)` works and triggers lazy loading.
    AsyncIterable<QueryResultItem> & {

        // Iterates through query items asynchronously, loading them as needed.
        // Waits for each callback before continuing.
        forEachAsync(
            cb: (value: QueryResultItem, index: number, self: QueryResultItem[]) => void | Promise<void>,
            thisArg?: any
        ): Promise<void>;

        // Maps query items to new values, loading items on-demand.
        // Returns a fully resolved array of mapped query results.
        mapAsync<U>(
            cb: (value: QueryResultItem, index: number, self: QueryResultItem[]) => U | Promise<U>,
            thisArg?: any
        ): Promise<U[]>;

        // Filters query items based on a predicate, loading items as needed.
        // Returns a fully resolved array of matching query items.
        filterAsync(
            cb: (value: QueryResultItem, index: number, self: QueryResultItem[]) => boolean | Promise<boolean>,
            thisArg?: any
        ): Promise<QueryResultItem[]>;

        // Loads all remaining query items and returns the complete result set as a plain array.
        toArrayAsync(): Promise<QueryResultItem[]>;

        // Returns a subset of query items within the specified range.
        // Loads items in the range if needed and returns them as a plain array.
        sliceAsync(start?: number, end?: number): Promise<QueryResultItem[]>;
    };

/**
 * Proxy handler for query result items that enables lazy loading.
 * Intercepts array access to fetch query items on-demand from the underlying query.
 */
export class QueryItemsProxy {
    #queuedLazyItemIndexes: number[] | null = null;
    #queuedLazyItemIndexesTimeout: any;
    #query: Query;
    #items!: QueryItems;

    constructor(query: Query) {
        this.#query = query;
        // Initialize with empty array
        this.setItems([]);
    }

    /**
     * Gets the current query items.
     */
    get items(): QueryItems {
        return this.#items;
    }

    /**
     * Sets new items for the query, cleaning up any existing proxy.
     * @param items - The array of query result items to proxy.
     */
    setItems(items: QueryResultItem[]): void {
        // Cleanup existing timeout if any
        this.cleanup();
        
        // Create new proxy
        this.#items = new Proxy(items, { 
            get: this.#getItemsLazy.bind(this) 
        }) as QueryItems;
    }

    /**
     * Handles access to the length property.
     */
    #handleLengthProperty(): number {
        return this.#query.totalItems;
    }

    /**
     * Handles access to Symbol.asyncIterator.
     */
    #handleAsyncIterator() {
        return this.#createAsyncIterator();
    }

    /**
     * Handles access to Symbol.iterator for synchronous iteration.
     */
    #handleSyncIterator(target: QueryResultItem[]) {
        return function* () {
            for (let i = 0; i < target.length; i++) {
                const item = target[i];
                if (item === null || item === undefined) {
                    continue; // skip unloaded items
                }
                yield item;
            }
        };
    }

    /**
     * Handles access to numeric indices.
     */
    #handleNumericIndex(target: QueryResultItem[], index: number, receiver: any): QueryResultItem | null {
        return this.#handleIndexAccess(target, index, receiver);
    }

    /**
     * Handles access to async method properties.
     */
    #handleAsyncMethods(property: string): Function | undefined {
        switch (property) {
            case "forEachAsync":
                return this.#createForEachAsync();
            case "mapAsync":
                return this.#createMapAsync();
            case "filterAsync":
                return this.#createFilterAsync();
            case "toArrayAsync":
                return this.#createToArrayAsync();
            case "sliceAsync":
                return this.#createSliceAsync();
            default:
                return undefined;
        }
    }

    /**
     * Iterates over non-null items in a sparse array.
     * @param target - The sparse array to iterate
     * @param callback - Function to call for each non-null item
     * @param thisArg - Optional this context
     * @param options - Options for iteration (reverse, early exit, etc.)
     */
    #iterateSparse<T>(
        target: QueryResultItem[], 
        callback: (item: QueryResultItem, index: number, array: QueryResultItem[]) => T,
        thisArg?: any,
        options?: { reverse?: boolean; earlyExit?: (result: T) => boolean }
    ): T | undefined {
        const keys = Object.keys(target).map(k => parseInt(k)).filter(k => !isNaN(k));
        if (options?.reverse) keys.reverse();
        
        for (const index of keys) {
            const item = target[index];
            if (item != null) {
                const result = callback.call(thisArg, item, index, target);
                if (options?.earlyExit?.(result)) {
                    return result;
                }
            }
        }
        return undefined;
    }

    /**
     * Handles sync operations that may work on incomplete data.
     */
    #handleIncompleteDataOperations(target: QueryResultItem[], property: string): Function | undefined {
        switch (property) {
            case "forEach":
                return (callback: (value: QueryResultItem, index: number, array: QueryResultItem[]) => void, thisArg?: any) => {
                    this.#iterateSparse(target, callback, thisArg);
                };

            case "filter":
                return (callback: (value: QueryResultItem, index: number, array: QueryResultItem[]) => boolean, thisArg?: any) => {
                    const result: QueryResultItem[] = [];
                    this.#iterateSparse(target, (item, index, array) => {
                        if (callback.call(thisArg, item, index, array)) {
                            result.push(item);
                        }
                    });
                    return result;
                };

            case "find":
                return (callback: (value: QueryResultItem, index: number, array: QueryResultItem[]) => boolean, thisArg?: any) => {
                    let found: QueryResultItem | undefined;
                    this.#iterateSparse(target, (item, index, array) => {
                        if (callback.call(thisArg, item, index, array)) {
                            found = item;
                            return true; // Signal early exit
                        }
                        return false;
                    }, null, { earlyExit: result => result === true });
                    return found;
                };

            case "findIndex":
                return (callback: (value: QueryResultItem, index: number, array: QueryResultItem[]) => boolean, thisArg?: any) => {
                    let foundIndex = -1;
                    this.#iterateSparse(target, (item, index, array) => {
                        if (callback.call(thisArg, item, index, array)) {
                            foundIndex = index;
                            return true; // Signal early exit
                        }
                        return false;
                    }, null, { earlyExit: result => result === true });
                    return foundIndex;
                };

            case "some":
                return (callback: (value: QueryResultItem, index: number, array: QueryResultItem[]) => boolean, thisArg?: any) => {
                    let hasMatch = false;
                    this.#iterateSparse(target, (item, index, array) => {
                        if (callback.call(thisArg, item, index, array)) {
                            hasMatch = true;
                            return true; // Signal early exit
                        }
                        return false;
                    }, null, { earlyExit: result => result === true });
                    return hasMatch;
                };

            case "every":
                return (callback: (value: QueryResultItem, index: number, array: QueryResultItem[]) => boolean, thisArg?: any) => {
                    let allMatch = true;
                    this.#iterateSparse(target, (item, index, array) => {
                        if (!callback.call(thisArg, item, index, array)) {
                            allMatch = false;
                            return true; // Signal early exit
                        }
                        return false;
                    }, null, { earlyExit: result => result === true });
                    return allMatch;
                };

            case "includes":
                return (searchElement: QueryResultItem, fromIndex?: number) => {
                    let found = false;
                    const startIndex = fromIndex ?? 0;
                    this.#iterateSparse(target, (item, index) => {
                        if (index >= startIndex && item === searchElement) {
                            found = true;
                            return true; // Signal early exit
                        }
                        return false;
                    }, null, { earlyExit: result => result === true });
                    return found;
                };

            case "indexOf":
                return (searchElement: QueryResultItem, fromIndex?: number) => {
                    let foundIndex = -1;
                    const startIndex = fromIndex ?? 0;
                    this.#iterateSparse(target, (item, index) => {
                        if (index >= startIndex && item === searchElement) {
                            foundIndex = index;
                            return true; // Signal early exit
                        }
                        return false;
                    }, null, { earlyExit: result => result === true });
                    return foundIndex;
                };

            case "map":
                return <U>(callback: (value: QueryResultItem, index: number, array: QueryResultItem[]) => U, thisArg?: any): U[] => {
                    const result = new Array(target.length);
                    this.#iterateSparse(target, (item, index, array) => {
                        result[index] = callback.call(thisArg, item, index, array);
                    });
                    return result;
                };

            case "reduce":
                return <U>(callback: (acc: U, value: QueryResultItem, index: number, array: QueryResultItem[]) => U, initialValue?: U): U => {
                    let hasInitial = arguments.length >= 2;
                    let accumulator = initialValue as U;
                    let firstItem = true;
                    
                    this.#iterateSparse(target, (item, index, array) => {
                        if (firstItem && !hasInitial) {
                            accumulator = item as any;
                            firstItem = false;
                        } else {
                            accumulator = callback(accumulator, item, index, array);
                        }
                    });
                    
                    if (firstItem && !hasInitial) {
                        throw new TypeError('Reduce of empty array with no initial value');
                    }
                    
                    return accumulator;
                };

            default:
                return undefined;
        }
    }

    /**
     * Handles array mutation attempts.
     */
    #handleArrayMutation(property: string): never {
        throw new Error(`Operation '${property}' not allowed on query items`);
    }

    /**
     * Handles operations that work on a copy.
     */
    #handleCopyOperation(target: QueryResultItem[], property: string, receiver: any): any {
        console.log(`WARNING: '${property}' works on a copy of the array and not on the original array.`);
        return Reflect.get(Array.from(target), property, receiver);
    }

    /**
     * Intercepts access to query items and triggers lazy loading when needed.
     * @param target - The array of query result items.
     * @param property - The property being accessed (index or method name).
     * @param receiver - The proxy receiver.
     * @returns The query item at the index or the result of the method call.
     */
    #getItemsLazy(target: QueryResultItem[], property: string | symbol, receiver: any) {
        // Handle length property
        if (property === "length") {
            return this.#handleLengthProperty();
        }

        // Handle Symbol.asyncIterator
        if (property === Symbol.asyncIterator) {
            return this.#handleAsyncIterator();
        }

        // Handle Symbol.iterator
        if (property === Symbol.iterator) {
            return this.#handleSyncIterator(target);
        }

        // Handle string properties
        if (typeof property === "string") {
            // Handle numeric index access (most common operation)
            const index = parseInt(property);
            if (!isNaN(index)) {
                return this.#handleNumericIndex(target, index, receiver);
            }

            // Handle async methods
            const asyncMethod = this.#handleAsyncMethods(property);
            if (asyncMethod !== undefined) {
                return asyncMethod;
            }

            // Handle sync operations that may work on incomplete data
            const incompleteDataOperation = this.#handleIncompleteDataOperations(target, property);
            if (incompleteDataOperation !== undefined) {
                return incompleteDataOperation;
            }

            // Handle array mutations
            if (["push", "pop", "shift", "unshift", "splice"].includes(property)) {
                return this.#handleArrayMutation(property);
            }

            // Handle operations that work on a copy
            if (["reverse", "sort"].includes(property)) {
                return this.#handleCopyOperation(target, property, receiver);
            }
        }

        // Default: pass through to the target
        return Reflect.get(target, property, receiver);
    }


    /**
     * Handles access to items by numeric index, triggering lazy loading if needed.
     */
    #handleIndexAccess(target: QueryResultItem[], index: number, receiver: any): QueryResultItem | null {
        const item = Reflect.get(target, index, receiver);
        
        // Fetch query item if not loaded yet, unless lazy loading is disabled
        // If query hasn't been searched yet, we should still try to load
        const canLoad = !this.#query.hasSearched || (index < this.#query.totalItems || this.#query.hasMore);
        if (item === undefined && !this.#query.disableLazyLoading && canLoad) {
            this.#queueLazyLoad(target, index);
            return target[index] = null;
        }

        return item;
    }

    /**
     * Queues an index for lazy loading with batching.
     */
    #queueLazyLoad(target: QueryResultItem[], index: number): void {
        if (this.#queuedLazyItemIndexes) {
            this.#queuedLazyItemIndexes.push(index);
        } else {
            this.#queuedLazyItemIndexes = [index];
        }

        clearTimeout(this.#queuedLazyItemIndexesTimeout);
        this.#queuedLazyItemIndexesTimeout = setTimeout(async () => {
            await this.#processBatchedLazyLoads(target);
        }, 10);
    }

    /**
     * Processes batched lazy load requests.
     */
    async #processBatchedLazyLoads(target: QueryResultItem[]): Promise<void> {
        const queuedLazyItemIndexes = this.#queuedLazyItemIndexes!.filter(i => target[i] === null);
        if (queuedLazyItemIndexes.length === 0) {
            return;
        }

        try {
            await this.#query.getItemsByIndex(...queuedLazyItemIndexes);
        } finally {
            queuedLazyItemIndexes.forEach(i => {
                if (target[i] == null) {
                    delete target[i];
                }
            });
        }
    }

    /**
     * Common async iteration helper that handles initialization and loading.
     * @param callback - Function to call for each item. Return false to stop iteration.
     * @param thisArg - Optional this context for the callback.
     */
    async #iterateAsync<T>(
        callback: (item: QueryResultItem, index: number, items: QueryResultItem[]) => T | Promise<T>,
        thisArg?: any
    ): Promise<void> {
        // If query hasn't been searched yet, initialize it first
        if (!this.#query.hasSearched) {
            await this.#query.getItemsByIndex(0);
        }
        
        // Use the actual items from the query
        const items = this.#query.items;
        let i = 0;
        // Continue until we've processed all items
        while (i < this.#query.totalItems || this.#query.hasMore) {
            // Ensure item is loaded
            if (items[i] === undefined || items[i] === null) {
                await this.#query.getItemsByIndex(i);
            }
            
            // If item couldn't be loaded (end of results), break
            if (items[i] === undefined) {
                break;
            }
            
            const result = await callback.call(thisArg, items[i], i, items);
            // Allow early termination by returning false
            if (result === false) {
                break;
            }
            i++;
        }
    }

    /**
     * Creates an async iterator for the query items.
     */
    #createAsyncIterator() {
        const self = this;
        return async function* () {
            const results: QueryResultItem[] = [];
            await self.#iterateAsync((item) => {
                results.push(item);
            });
            for (const item of results) {
                yield item;
            }
        };
    }

    /**
     * Creates the forEachAsync method.
     */
    #createForEachAsync() {
        return async (
            cb: (value: QueryResultItem, index: number, self: QueryResultItem[]) => void | Promise<void>,
            thisArg?: any
        ): Promise<void> => {
            await this.#iterateAsync(cb, thisArg);
        };
    }

    /**
     * Creates the mapAsync method.
     */
    #createMapAsync() {
        return async <U>(
            cb: (value: QueryResultItem, index: number, self: QueryResultItem[]) => U | Promise<U>,
            thisArg?: any
        ): Promise<U[]> => {
            const results: U[] = [];
            await this.#iterateAsync(async (item, index, items) => {
                results.push(await cb.call(thisArg, item, index, items));
            });
            return results;
        };
    }

    /**
     * Creates the filterAsync method.
     */
    #createFilterAsync() {
        return async (
            cb: (value: QueryResultItem, index: number, self: QueryResultItem[]) => boolean | Promise<boolean>,
            thisArg?: any
        ): Promise<QueryResultItem[]> => {
            const results: QueryResultItem[] = [];
            await this.#iterateAsync(async (item, index, items) => {
                if (await cb.call(thisArg, item, index, items)) {
                    results.push(item);
                }
            });
            return results;
        };
    }

    /**
     * Creates the toArrayAsync method.
     */
    #createToArrayAsync() {
        return async (): Promise<QueryResultItem[]> => {
            const results: QueryResultItem[] = [];
            await this.#iterateAsync((item) => {
                results.push(item);
            });
            return results;
        };
    }

    /**
     * Creates the sliceAsync method.
     */
    #createSliceAsync() {
        return async (start?: number, end?: number): Promise<QueryResultItem[]> => {
            // If query hasn't been searched yet, initialize it first
            if (!this.#query.hasSearched) {
                const actualStart = start ?? 0;
                await this.#query.getItemsByIndex(actualStart);
            }
            
            // Use the actual items from the query
            const items = this.#query.items;
            
            // Load query items in the requested range and return the slice
            const actualStart = start ?? 0;
            
            // Determine the actual end based on query bounds
            let actualEnd: number;
            if (end !== undefined) {
                // If end is specified, use it but cap at totalItems if known
                actualEnd = this.#query.totalItems > 0 ? Math.min(end, this.#query.totalItems) : end;
            } else {
                // If no end specified, use totalItems if known, otherwise load all available
                actualEnd = this.#query.totalItems > 0 ? this.#query.totalItems : Number.MAX_SAFE_INTEGER;
            }
            
            const results: QueryResultItem[] = [];
            for (let i = actualStart; i < actualEnd; i++) {
                // Ensure item is loaded
                if (items[i] === undefined || items[i] === null) {
                    await this.#query.getItemsByIndex(i);
                }
                
                // If item couldn't be loaded (end of results), break
                if (items[i] === undefined) {
                    break;
                }
                
                results.push(items[i]);
            }
            return results;
        };
    }

    /**
     * Cleans up pending query item load operations.
     */
    cleanup(): void {
        clearTimeout(this.#queuedLazyItemIndexesTimeout);
        this.#queuedLazyItemIndexes = null;
    }
}