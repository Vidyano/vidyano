import { QueryResultItem } from "./query-result-item.js";
import type { Query } from "./query.js";
import { _internal } from "./_internals.js";

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

        // Finds the first query item that satisfies the predicate, loading items as needed.
        // Stops loading once a match is found.
        findAsync(
            predicate: (value: QueryResultItem, index: number, self: QueryResultItem[]) => boolean | Promise<boolean>,
            thisArg?: any
        ): Promise<QueryResultItem | undefined>;

        // Finds the index of the first query item that satisfies the predicate, loading items as needed.
        // Stops loading once a match is found.
        findIndexAsync(
            predicate: (value: QueryResultItem, index: number, self: QueryResultItem[]) => boolean | Promise<boolean>,
            thisArg?: any
        ): Promise<number>;

        // Tests whether at least one query item satisfies the predicate, loading items as needed.
        // Stops loading once a match is found.
        someAsync(
            predicate: (value: QueryResultItem, index: number, self: QueryResultItem[]) => boolean | Promise<boolean>,
            thisArg?: any
        ): Promise<boolean>;

        // Tests whether all query items satisfy the predicate, loading items as needed.
        // Stops loading if any item fails the test.
        everyAsync(
            predicate: (value: QueryResultItem, index: number, self: QueryResultItem[]) => boolean | Promise<boolean>,
            thisArg?: any
        ): Promise<boolean>;

        // Checks if the query items include a specific element, loading items as needed.
        // Stops loading once the element is found.
        includesAsync(searchElement: QueryResultItem, fromIndex?: number): Promise<boolean>;

        // Finds the index of a specific element in the query items, loading items as needed.
        // Stops loading once the element is found.
        indexOfAsync(searchElement: QueryResultItem, fromIndex?: number): Promise<number>;

        // Reduces the query items to a single value, loading all items as needed.
        reduceAsync<U>(
            reducer: (acc: U, value: QueryResultItem, index: number, self: QueryResultItem[]) => U | Promise<U>,
            initialValue?: U
        ): Promise<U>;

        // Returns the query item at the specified index, loading it if needed.
        // Supports negative indices to access items from the end of the array.
        atAsync(index: number): Promise<QueryResultItem | undefined>;
        // Returns multiple query items at the specified indices, loading them if needed.
        // Supports negative indices to access items from the end of the array.
        atAsync(indices: number[]): Promise<(QueryResultItem | undefined)[]>;
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
                return this.#forEachAsync.bind(this);
            case "mapAsync":
                return this.#mapAsync.bind(this);
            case "filterAsync":
                return this.#filterAsync.bind(this);
            case "toArrayAsync":
                return this.#toArrayAsync.bind(this);
            case "sliceAsync":
                return this.#sliceAsync.bind(this);
            case "findAsync":
                return this.#findAsync.bind(this);
            case "findIndexAsync":
                return this.#findIndexAsync.bind(this);
            case "someAsync":
                return this.#someAsync.bind(this);
            case "everyAsync":
                return this.#everyAsync.bind(this);
            case "includesAsync":
                return this.#includesAsync.bind(this);
            case "indexOfAsync":
                return this.#indexOfAsync.bind(this);
            case "reduceAsync":
                return this.#createReduceAsync();
            case "atAsync":
                return this.#atAsync.bind(this);
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
                return function<U>(callback: (acc: U, value: QueryResultItem, index: number, array: QueryResultItem[]) => U, initialValue?: U): U {
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
                }.bind(this);

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
    #handleCopyOperation(target: QueryResultItem[], property: string): any {
        return (...args: any[]) => {
            const copy = Array.from(target);
            return (copy as any)[property](...args);
        };
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
                return this.#handleCopyOperation(target, property);
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
        // Snapshot the current queue and reset it immediately to prevent indefinite growth
        const queued = this.#queuedLazyItemIndexes;
        this.#queuedLazyItemIndexes = null;
        
        if (!queued)
            return;
        
        // Filter out already loaded items
        const queuedLazyItemIndexes = queued.filter(i => target[i] === null);
        if (queuedLazyItemIndexes.length === 0)
            return;

        try {
            await this.#atAsync(queuedLazyItemIndexes);
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
    async #iterateAsync<T>(callback: (item: QueryResultItem, index: number, items: QueryResultItem[]) => T | Promise<T>, thisArg?: any): Promise<void> {
        // If query hasn't been searched yet, initialize it first
        if (!this.#query.hasSearched) {
            await this.#atAsync(0);
        }

        // Use the actual items from the query
        const items = this.#query.items;
        let i = 0;
        // Continue until we've processed all items
        while (i < this.#query.totalItems || this.#query.hasMore) {
            // Ensure item is loaded
            if (items[i] === undefined || items[i] === null) {
                await this.#atAsync(i);
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
     * Iterates through all items asynchronously.
     */
    async #forEachAsync(cb: (value: QueryResultItem, index: number, self: QueryResultItem[]) => void | Promise<void>, thisArg?: any): Promise<void> {
        await this.#iterateAsync(cb, thisArg);
    }

    /**
     * Maps all items asynchronously.
     */
    async #mapAsync<U>(cb: (value: QueryResultItem, index: number, self: QueryResultItem[]) => U | Promise<U>, thisArg?: any): Promise<U[]> {
        const results: U[] = [];
        await this.#iterateAsync(async (item, index, items) => {
            results.push(await cb.call(thisArg, item, index, items));
        });
        return results;
    }

    /**
     * Filters items asynchronously.
     */
    async #filterAsync(cb: (value: QueryResultItem, index: number, self: QueryResultItem[]) => boolean | Promise<boolean>, thisArg?: any): Promise<QueryResultItem[]> {
        const results: QueryResultItem[] = [];
        await this.#iterateAsync(async (item, index, items) => {
            if (await cb.call(thisArg, item, index, items)) {
                results.push(item);
            }
        });
        return results;
    }

    /**
     * Converts all items to an array asynchronously.
     */
    async #toArrayAsync(): Promise<QueryResultItem[]> {
        const results: QueryResultItem[] = [];
        await this.#iterateAsync(item => {
            results.push(item);
        });
        return results;
    }

    /**
     * Returns a slice of items asynchronously.
     */
    async #sliceAsync(start?: number, end?: number): Promise<QueryResultItem[]> {
        // Handle negative indices - need to ensure query is fully loaded first
        const hasNegativeIndex = (start !== undefined && start < 0) || (end !== undefined && end < 0);
        
        if (hasNegativeIndex) {
            if (this.#query.hasMore) {
                throw new Error("Cannot use negative indices in sliceAsync when there are more items to load in the query.");
            }
            
            if (!this.#query.hasSearched) {
                await this.#query.search();
            }
        } else if (!this.#query.hasSearched) {
            // If query hasn't been searched yet, initialize it first
            const actualStart = start ?? 0;
            await this.#atAsync(actualStart);
        }

        // Use the actual items from the query
        const items = this.#query.items;
        const totalItems = this.#query.totalItems;

        // Convert negative indices to positive
        let actualStart: number;
        if (start === undefined) {
            actualStart = 0;
        } else if (start < 0) {
            actualStart = Math.max(0, totalItems + start);
        } else {
            actualStart = start;
        }

        // Determine the actual end based on query bounds
        let actualEnd: number;
        if (end === undefined) {
            // If no end specified, use totalItems if known, otherwise load all available
            actualEnd = totalItems > 0 ? totalItems : Number.MAX_SAFE_INTEGER;
        } else if (end < 0) {
            actualEnd = Math.max(0, totalItems + end);
        } else {
            // If end is specified, use it but cap at totalItems if known
            actualEnd = totalItems > 0 ? Math.min(end, totalItems) : end;
        }

        const results: QueryResultItem[] = [];
        for (let i = actualStart; i < actualEnd; i++) {
            // Ensure item is loaded
            if (items[i] === undefined || items[i] === null) {
                await this.#atAsync(i);
            }

            // If item couldn't be loaded (end of results), break
            if (items[i] === undefined) {
                break;
            }

            results.push(items[i]);
        }
        return results;
    }

    /**
     * Finds the first item matching the predicate asynchronously.
     */
    async #findAsync(predicate: (value: QueryResultItem, index: number, self: QueryResultItem[]) => boolean | Promise<boolean>, thisArg?: any): Promise<QueryResultItem | undefined> {
        let found: QueryResultItem | undefined;
        await this.#iterateAsync(async (item, index, items) => {
            if (await predicate.call(thisArg, item, index, items)) {
                found = item;
                return false; // Stop iteration
            }
        });
        return found;
    }

    /**
     * Finds the index of the first item matching the predicate asynchronously.
     */
    async #findIndexAsync(predicate: (value: QueryResultItem, index: number, self: QueryResultItem[]) => boolean | Promise<boolean>, thisArg?: any): Promise<number> {
        let foundIndex = -1;
        await this.#iterateAsync(async (item, index, items) => {
            if (await predicate.call(thisArg, item, index, items)) {
                foundIndex = index;
                return false; // Stop iteration
            }
        });
        return foundIndex;
    }

    /**
     * Checks if any item matches the predicate asynchronously.
     */
    async #someAsync(predicate: (value: QueryResultItem, index: number, self: QueryResultItem[]) => boolean | Promise<boolean>, thisArg?: any): Promise<boolean> {
        let hasMatch = false;
        await this.#iterateAsync(async (item, index, items) => {
            if (await predicate.call(thisArg, item, index, items)) {
                hasMatch = true;
                return false; // Stop iteration
            }
        });
        return hasMatch;
    }

    /**
     * Checks if all items match the predicate asynchronously.
     */
    async #everyAsync(predicate: (value: QueryResultItem, index: number, self: QueryResultItem[]) => boolean | Promise<boolean>, thisArg?: any): Promise<boolean> {
        let allMatch = true;
        await this.#iterateAsync(async (item, index, items) => {
            if (!(await predicate.call(thisArg, item, index, items))) {
                allMatch = false;
                return false; // Stop iteration
            }
        });
        return allMatch;
    }

    /**
     * Checks if the array includes a specific item asynchronously.
     */
    async #includesAsync(searchElement: QueryResultItem, fromIndex?: number): Promise<boolean> {
        const startIndex = fromIndex ?? 0;
        let found = false;

        await this.#iterateAsync((item, index) => {
            if (index >= startIndex && item === searchElement) {
                found = true;
                return false; // Stop iteration
            }
        });
        return found;
    }

    /**
     * Finds the index of a specific item asynchronously.
     */
    async #indexOfAsync(searchElement: QueryResultItem, fromIndex?: number): Promise<number> {
        const startIndex = fromIndex ?? 0;
        let foundIndex = -1;

        await this.#iterateAsync((item, index) => {
            if (index >= startIndex && item === searchElement) {
                foundIndex = index;
                return false; // Stop iteration
            }
        });
        return foundIndex;
    }

    /**
     * Creates the reduceAsync method.
     */
    #createReduceAsync() {
        return async function <U>(reducer: (acc: U, value: QueryResultItem, index: number, self: QueryResultItem[]) => U | Promise<U>, initialValue?: U): Promise<U> {
            const hasInitial = arguments.length >= 2;
            let accumulator = initialValue as U;
            let firstItem = true;

            await this.#iterateAsync(async (item: QueryResultItem, index: number, items: QueryResultItem[]) => {
                if (firstItem && !hasInitial) {
                    accumulator = item as any;
                    firstItem = false;
                } else {
                    accumulator = await reducer(accumulator, item, index, items);
                }
            });

            if (firstItem && !hasInitial) {
                throw new TypeError('Reduce of empty array with no initial value');
            }

            return accumulator;
        }.bind(this);
    }

    /**
     * Gets items at the specified indices asynchronously.
     */
    async #atAsync(indices: number | number[]): Promise<QueryResultItem | undefined | (QueryResultItem | undefined)[]> {
        const indicesArray = typeof indices === 'number' ? [indices] : indices;

        // Prepare indices and handle negative values
        const hasNegativeIndices = indicesArray.some(idx => idx < 0);

        if (hasNegativeIndices) {
            if (this.#query.hasMore)
                throw new Error("Cannot use negative indices when there are more items to load in the query.");

            if (!this.#query.hasSearched)
                await this.#query.search();
        } else if (!this.#query.hasSearched) {
            // Initialize the query if it hasn't been searched yet
            const minIndex = Math.min(...indicesArray);
            await _internal(this.#query).getItems(minIndex, this.#query.pageSize || 1);
        }

        const actualIndices = indicesArray.map(idx => idx < 0 ? this.#query.totalItems + idx : idx);

        const validIndices = actualIndices.filter(idx =>
            idx >= 0 && (this.#query.totalItems === 0 || idx < this.#query.totalItems)
        );

        const uniqueValidIndices = [...new Set(validIndices)];

        // Load the required pages for all unique valid indices
        if (uniqueValidIndices.length > 0 && this.#query.pageSize > 0) {
            const sortedIndexes = uniqueValidIndices.sort((a, b) => a - b);

            // Calculate page ranges inline
            const ranges: [skip: number, top: number][] = [];
            if (sortedIndexes.length > 0) {
                let currentRangeStart = sortedIndexes[0];
                let currentRangeEnd = sortedIndexes[0];

                for (let i = 1; i < sortedIndexes.length; i++) {
                    const idx = sortedIndexes[i];

                    if (idx <= currentRangeEnd + this.#query.pageSize) {
                        currentRangeEnd = idx;
                    } else {
                        const skip = Math.floor(currentRangeStart / this.#query.pageSize) * this.#query.pageSize;
                        const top = currentRangeEnd - skip + 1;
                        ranges.push([skip, top]);

                        currentRangeStart = idx;
                        currentRangeEnd = idx;
                    }
                }

                const skip = Math.floor(currentRangeStart / this.#query.pageSize) * this.#query.pageSize;
                const top = currentRangeEnd - skip + 1;
                ranges.push([skip, top]);
            }

            await Promise.all(ranges.map(([skip, top]) => _internal(this.#query).getItems(skip, top)));
        }

        // Map indices to their items
        const itemMap = new Map<number, QueryResultItem | undefined>();
        uniqueValidIndices.forEach(idx => {
            itemMap.set(idx, this.#query.items[idx]);
        });

        const results = actualIndices.map(idx => {
            if (idx < 0 || (this.#query.totalItems > 0 && idx >= this.#query.totalItems))
                return undefined;
            return itemMap.get(idx);
        });

        return typeof indices === 'number' ? results[0] : results;
    }

    /**
     * Cleans up pending query item load operations.
     */
    cleanup(): void {
        clearTimeout(this.#queuedLazyItemIndexesTimeout);
        this.#queuedLazyItemIndexes = null;
    }
}