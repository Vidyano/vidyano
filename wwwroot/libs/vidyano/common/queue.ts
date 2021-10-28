interface IQueueEntry {
    promiseGenerator: () => Promise<any>;
    resolve: (result?: any) => void;
    reject: (error?: any) => void;
    notify?: (message?: any) => void;
}

export class Queue {
    private pendingPromises: number;
    private maxPendingPromises: number;
    private maxQueuedPromises: number;
    private queue: IQueueEntry[];

    constructor(maxPendingPromises?: number, maxQueuedPromises?: number) {
        this.pendingPromises = 0;
        this.maxPendingPromises = typeof maxPendingPromises !== 'undefined' ? maxPendingPromises : Infinity;
        this.maxQueuedPromises = typeof maxQueuedPromises !== 'undefined' ? maxQueuedPromises : Infinity;
        this.queue = [];
    }

    add<T>(promiseGenerator: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            if (this.queue.length >= this.maxQueuedPromises) {
                reject(new Error('Queue limit reached'));
                return;
            }

            // Add to queue
            this.queue.push({
                promiseGenerator: promiseGenerator,
                resolve: resolve,
                reject: reject
            });

            this._dequeue();
        });
    }

    private _dequeue() {
        if (this.pendingPromises >= this.maxPendingPromises)
            return false;

        // Remove from queue
        const item = this.queue.shift();
        if (!item)
            return false;

        this.pendingPromises++;
        item.promiseGenerator()
            // Forward all stuff
            .then(value => {
                // It is not pending now
                this.pendingPromises--;
                this._dequeue();
                // It should pass values
                item.resolve(value);
            }, err => {
                // It is not pending now
                this.pendingPromises--;
                this._dequeue();
                // It should not mask errors
                item.reject(err);
            });

        return true;
    }

    get pendingLength() {
        return this.pendingPromises;
    }

    get queueLength() {
        return this.queue.length;
    }
}