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
        // Handle numeric index access
        if (typeof property === "string") {
            const index = parseInt(property);
            if (!isNaN(index)) {
                return this.#handleIndexAccess(target, index, receiver);
            }
        }

        // Handle Symbol.asyncIterator
        if (property === Symbol.asyncIterator) {
            return this.#createAsyncIterator(target);
        }

        // Handle async methods
        switch (property) {
            case "forEachAsync":
                return this.#createForEachAsync(target);
            case "mapAsync":
                return this.#createMapAsync(target);
            case "filterAsync":
                return this.#createFilterAsync(target);
            case "toArrayAsync":
                return this.#createToArrayAsync(target);
            case "sliceAsync":
                return this.#createSliceAsync(target);
            default:
                return Reflect.get(target, property, receiver);
        }
    }

    /**
     * Handles access to items by numeric index, triggering lazy loading if needed.
     */
    #handleIndexAccess(target: QueryResultItem[], index: number, receiver: any): QueryResultItem | null {
        const item = Reflect.get(target, index, receiver);
        
        // Fetch query item if not loaded yet, unless lazy loading is disabled or index exceeds query bounds
        if (item === undefined && !this.#query.disableLazyLoading && (index < this.#query.totalItems || this.#query.hasMore)) {
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
     * Ensures an item at the given index is loaded.
     */
    async #ensureItemLoaded(target: QueryResultItem[], index: number): Promise<void> {
        // Check if item is already loaded
        if (target[index] !== undefined && target[index] !== null) {
            return;
        }
        
        // Check if we can load this item
        if (this.#query.disableLazyLoading || (index >= this.#query.totalItems && !this.#query.hasMore)) {
            return;
        }
        
        // Load the item
        await this.#query.getItemsByIndex(index);
    }

    /**
     * Creates an async iterator for the query items.
     */
    #createAsyncIterator(target: QueryResultItem[]) {
        const self = this;
        return async function* () {
            let i = 0;
            // Continue until we've processed all items
            while (i < self.#query.totalItems || self.#query.hasMore) {
                // Ensure item is loaded
                await self.#ensureItemLoaded(target, i);
                
                // If item couldn't be loaded (end of results), break
                if (target[i] === undefined) {
                    break;
                }
                
                yield target[i];
                i++;
            }
        };
    }

    /**
     * Creates the forEachAsync method.
     */
    #createForEachAsync(target: QueryResultItem[]) {
        return async (
            cb: (value: QueryResultItem, index: number, self: QueryResultItem[]) => void | Promise<void>,
            thisArg?: any
        ): Promise<void> => {
            let i = 0;
            // Continue until we've processed all items
            while (i < this.#query.totalItems || this.#query.hasMore) {
                // Ensure item is loaded
                await this.#ensureItemLoaded(target, i);
                
                // If item couldn't be loaded (end of results), break
                if (target[i] === undefined) {
                    break;
                }
                
                await cb.call(thisArg, target[i], i, target);
                i++;
            }
        };
    }

    /**
     * Creates the mapAsync method.
     */
    #createMapAsync(target: QueryResultItem[]) {
        return async <U>(
            cb: (value: QueryResultItem, index: number, self: QueryResultItem[]) => U | Promise<U>,
            thisArg?: any
        ): Promise<U[]> => {
            const results: U[] = [];
            let i = 0;
            // Continue until we've processed all items
            while (i < this.#query.totalItems || this.#query.hasMore) {
                // Ensure item is loaded
                await this.#ensureItemLoaded(target, i);
                
                // If item couldn't be loaded (end of results), break
                if (target[i] === undefined) {
                    break;
                }
                
                results.push(await cb.call(thisArg, target[i], i, target));
                i++;
            }
            return results;
        };
    }

    /**
     * Creates the filterAsync method.
     */
    #createFilterAsync(target: QueryResultItem[]) {
        return async (
            cb: (value: QueryResultItem, index: number, self: QueryResultItem[]) => boolean | Promise<boolean>,
            thisArg?: any
        ): Promise<QueryResultItem[]> => {
            const results: QueryResultItem[] = [];
            let i = 0;
            // Continue until we've processed all items
            while (i < this.#query.totalItems || this.#query.hasMore) {
                // Ensure item is loaded
                await this.#ensureItemLoaded(target, i);
                
                // If item couldn't be loaded (end of results), break
                if (target[i] === undefined) {
                    break;
                }
                
                if (await cb.call(thisArg, target[i], i, target)) {
                    results.push(target[i]);
                }
                i++;
            }
            return results;
        };
    }

    /**
     * Creates the toArrayAsync method.
     */
    #createToArrayAsync(target: QueryResultItem[]) {
        return async (): Promise<QueryResultItem[]> => {
            // Load all items
            let i = 0;
            while (i < this.#query.totalItems || this.#query.hasMore) {
                await this.#ensureItemLoaded(target, i);
                
                // If item couldn't be loaded (end of results), break
                if (target[i] === undefined) {
                    break;
                }
                i++;
            }
            
            // Return all loaded items
            return target.filter(item => item !== undefined && item !== null);
        };
    }

    /**
     * Creates the sliceAsync method.
     */
    #createSliceAsync(target: QueryResultItem[]) {
        return async (start?: number, end?: number): Promise<QueryResultItem[]> => {
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
                await this.#ensureItemLoaded(target, i);
                
                // If item couldn't be loaded (end of results), break
                if (target[i] === undefined) {
                    break;
                }
                
                results.push(target[i]);
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