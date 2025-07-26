/**
 * Interface for a queue entry.
 * @template T The type of the result the promise will resolve to.
 */
interface IQueueEntry<T> {
    /**
     * A function that generates a promise when called.
     * This is used to create the promise that will be executed
     * when the queue item is processed.
     * @return A Promise that resolves or rejects with the result of the operation.
     */
    promiseGenerator: () => Promise<T>;

    /**
     * A function to call when the promise resolves successfully.
     * This will be called with the result of the promise.
     * @param result - The result of the promise.
     */
    resolve: (result: T) => void;

    /**
     * A function to call when the promise rejects with an error.
     * This will be called with the error that caused the rejection.
     * @param error - The error that caused the promise to reject.
     */
    reject: (error?: any) => void;

    /**
     * An optional function to notify about the status of the promise.
     * This can be used for logging or user notifications.
     * @param message - Optional message to notify about the promise status.
     */
    notify?: (message?: any) => void;
}

/**
 * Options for adding a task to the queue.
 * @template T The type of the result the promise will resolve to.
 */
export interface IQueueAddOptions {
    /**
     * An optional function to notify about the status of the promise.
     * This can be used for logging or user notifications.
     * @param message - Optional message to notify about the promise status.
     */
    notify?: (message?: any) => void;
}

/**
 * Represents a queue that processes promises sequentially,
 * with limits on concurrent pending promises and queue size.
 */
export class Queue {
    #pendingPromises: number;
    readonly #maxPendingPromises: number;
    readonly #maxQueuedPromises: number;
    #queue: Array<IQueueEntry<any>>; // Stores entries of various promise types

    /**
     * Creates an instance of Queue.
     * @param maxPendingPromises - The maximum number of promises that can be pending (executing) at once. Defaults to Infinity.
     * @param maxQueuedPromises - The maximum number of promises that can be waiting in the queue. Defaults to Infinity.
     */
    constructor(maxPendingPromises?: number, maxQueuedPromises?: number) {
        this.#pendingPromises = 0;
        this.#maxPendingPromises = maxPendingPromises ?? Infinity;
        this.#maxQueuedPromises = maxQueuedPromises ?? Infinity;
        this.#queue = [];
    }

    /**
     * Gets the number of promises currently pending (executing).
     */
    get pendingLength(): number {
        return this.#pendingPromises;
    }

    /**
     * Gets the number of promises currently in the queue (waiting to be executed).
     */
    get queueLength(): number {
        return this.#queue.length;
    }

    /**
     * Adds a promise generator to the queue.
     * The promise will be executed when its turn comes and concurrency limits allow.
     * @template T The type of the result the promise will resolve to.
     * @param promiseGenerator - A function that returns a Promise.
     * @param options - Optional parameters, including a `notify` callback.
     * @returns A Promise that resolves or rejects with the result of the generated promise.
     *          Rejects with an error if the queue limit is reached.
     */
    add<T>(promiseGenerator: () => Promise<T>, options?: IQueueAddOptions): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            if (this.#queue.length >= this.#maxQueuedPromises) {
                options?.notify?.("Queue limit reached, task rejected.");
                reject(new Error("Queue limit reached"));
                return;
            }

            const queueEntry: IQueueEntry<T> = {
                promiseGenerator,
                resolve,
                reject,
                notify: options?.notify,
            };

            this.#queue.push(queueEntry);
            options?.notify?.("Task added to queue.");
            this.#dequeue();
        });
    }

    /**
     * Dequeues the next item in the queue and executes its promise generator.
     * This method is async to allow use of await, but its calls are not typically awaited.
     */
    async #dequeue(): Promise<void> {
        if (this.#pendingPromises >= this.#maxPendingPromises)
            return; // Concurrency limit reached, wait for a slot

        const item = this.#queue.shift();
        if (!item)
            return; // Queue is empty

        this.#pendingPromises++;
        item.notify?.("Task starting execution.");

        try {
            const value = await item.promiseGenerator();
            item.notify?.("Task resolved successfully.");
            item.resolve(value);
        } catch (error) {
            item.notify?.(`Task rejected with error: ${error}`);
            item.reject(error);
        } finally {
            this.#pendingPromises--;
            // Attempt to dequeue another item if slots are available and queue has items
            this.#dequeue();
        }
    }
}