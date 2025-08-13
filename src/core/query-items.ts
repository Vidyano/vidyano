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
     * Intercepts access to query items and triggers lazy loading when needed.
     * @param target - The array of query result items.
     * @param property - The property being accessed (index or method name).
     * @param receiver - The proxy receiver.
     * @returns The query item at the index or the result of the method call.
     */
    #getItemsLazy(target: QueryResultItem[], property: string | symbol, receiver: any) {
        // Handle length property - return totalItems from query
        if (property === "length") {
            return this.#query.totalItems;
        }

        // Handle Symbol.asyncIterator
        if (property === Symbol.asyncIterator) {
            return this.#createAsyncIterator();
        }

        // Handle string properties
        if (typeof property === "string") {
            // Handle numeric index access (most common operation)
            const index = parseInt(property);
            if (!isNaN(index)) {
                return this.#handleIndexAccess(target, index, receiver);
            }

            // Handle async methods
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
            }

            // Handle methods that may operate on incomplete data
            if (property === "forEach" || property === "filter") {
                // Handle forEach - skip null items which are queued for lazy loading
                if (property === "forEach") {
                    return (callback: (value: QueryResultItem, index: number, array: QueryResultItem[]) => void, thisArg?: any) => {
                        let processedCount = 0;
                        let skippedCount = 0;
                        
                        for (const key in target) {
                            const index = parseInt(key);
                            if (!isNaN(index)) {
                                const item = target[index];
                                if (item != null) {
                                    callback.call(thisArg, item, index, target);
                                    processedCount++;
                                } else {
                                    skippedCount++;
                                }
                            }
                        }
                        
                        this.#warnIncompleteData("forEach", processedCount, skippedCount, "forEachAsync()");
                    };
                }

                // Handle filter - skip null items which are queued for lazy loading
                if (property === "filter") {
                    return (callback: (value: QueryResultItem, index: number, array: QueryResultItem[]) => boolean, thisArg?: any) => {
                        const result: QueryResultItem[] = [];
                        let processedCount = 0;
                        let skippedCount = 0;
                        
                        for (const key in target) {
                            const index = parseInt(key);
                            if (!isNaN(index)) {
                                const item = target[index];
                                if (item != null) {
                                    if (callback.call(thisArg, item, index, target)) {
                                        result.push(item);
                                    }
                                    processedCount++;
                                } else {
                                    skippedCount++;
                                }
                            }
                        }
                        
                        this.#warnIncompleteData("filter", processedCount, skippedCount, "filterAsync()");
                        return result;
                    };
                }
            }

            // Don't allow array manipulations
            if (["push", "pop", "shift", "unshift", "splice"].indexOf(property) >= 0) {
                throw new Error("Operation not allowed");
            }

            // Warn about operations that work on a copy
            if (["reverse", "sort"].indexOf(property) >= 0) {
                console.log(`WARNING: '${property}' works on a copy of the array and not on the original array.`);
                return Reflect.get(Array.from(target), property, receiver);
            }
        }

        // Handle Symbol.iterator for synchronous iteration
        if (property === Symbol.iterator) {
            const self = this;
            return function* () {
                let processedCount = 0;
                let skippedCount = 0;
                
                for (let i = 0; i < target.length; i++) {
                    const item = target[i];
                    if (item === null || item === undefined) {
                        skippedCount++;
                        continue; // skip unloaded items
                    }
                    processedCount++;
                    yield item;
                }
                
                self.#warnIncompleteData("Symbol.iterator", processedCount, skippedCount, "async iteration (for await)");
            };
        }

        return Reflect.get(target, property, receiver);
    }

    /**
     * Warns about incomplete data processing in synchronous methods.
     * @param methodName - Name of the method being used
     * @param processedCount - Number of items actually processed
     * @param skippedCount - Number of null/undefined items skipped
     * @param asyncAlternative - Suggested async alternative method
     */
    #warnIncompleteData(methodName: string, processedCount: number, skippedCount: number, asyncAlternative: string): void {
        const warnings: string[] = [];
        
        // Warn about skipped items
        if (skippedCount > 0) {
            warnings.push(`${skippedCount} unloaded items were skipped`);
        }
        
        // Warn about items not yet in the array
        const totalCount = processedCount + skippedCount;
        if (totalCount < this.#query.totalItems || this.#query.hasMore) {
            const moreInfo = this.#query.totalItems > 0 
                ? `${this.#query.totalItems - totalCount} more items available`
                : "more items available";
            warnings.push(moreInfo);
        }
        
        if (warnings.length > 0) {
            console.warn(
                `WARNING: ${methodName} only processed ${processedCount} items (${warnings.join(", ")}). ` +
                `Consider using ${asyncAlternative} to ensure all items are loaded.`
            );
        }
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