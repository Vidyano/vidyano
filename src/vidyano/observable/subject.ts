/**
 * Interface for subject notifier that receives notifications.
 * @template TSource - The type of the subject.
 * @template TDetail - The type of detail sent in notifications.
 */
export interface ISubjectNotifier<TSource, TDetail> {
    notify?: (source: TSource, detail?: TDetail) => void;
}

/**
 * Interface for disposing an observer from a subject.
 * @callback ISubjectDisposer
 */
export interface ISubjectDisposer {
    (): void;
}

/**
 * Represents a subject that notifies attached observers of changes.
 * @template TSource - The type of the subject.
 * @template TDetail - The type of detail sent in notifications.
 */
export class Subject<TSource, TDetail> {
    #observers: ((sender: TSource, detail: TDetail) => void)[] = [];
    #weakObserverRegistry: FinalizationRegistry<number>;

    /**
     * Creates a new Subject instance.
     * @param {ISubjectNotifier<TSource, TDetail>} notifier - The notifier to wrap.
     */
    constructor(notifier: ISubjectNotifier<TSource, TDetail>) {
        notifier.notify = (source: TSource, detail: TDetail) => {
            for (const i in this.#observers)
                this.#observers[i](source, detail);
        };

        this.#weakObserverRegistry = new FinalizationRegistry<number>((observerId) => {
            this.#detach(observerId);
        });
    }

    /**
     * Attaches an observer to the subject.
     * @param {ISubjectObserver<TSource, TDetail>} observer - The observer function to attach.
     * @param {{ weak?: boolean }} [options] - Optional settings. Set `weak` to true to attach the observer using a WeakRef.
     * @returns {ISubjectDisposer} A function that detaches the observer.
     */
    attach(observer: ISubjectObserver<TSource, TDetail>, options?: { weak?: boolean }): ISubjectDisposer {
        const id = this.#observers.length;

        if (options?.weak) {
            const weak = new WeakRef(observer);

            const wrapper = (sender: TSource, detail: TDetail) => {
                const target = weak.deref();
                if (target)
                    target(sender, detail);
                else
                    this.#detach(id);
            };

            this.#weakObserverRegistry.register(observer, id, wrapper);
            this.#observers[id] = wrapper;

            return () => {
                this.#weakObserverRegistry.unregister(wrapper);
                this.#detach(id);
            };
        }

        this.#observers.push(observer);
        return <ISubjectDisposer>this.#detach.bind(this, id);
    }

    /**
     * Detaches an observer from the subject.
     * @param {number} observerId - The identifier of the observer to detach.
     */
    #detach(observerId: number) {
        delete this.#observers[observerId];
    }
}

/**
 * Represents an observer function for subject notifications.
 * @template TSource - The type of the subject.
 * @template TDetail - The type of detail sent in notifications.
 * @callback ISubjectObserver
 * @param {TSource} sender - The subject sending the notification.
 * @param {TDetail} detail - The detail of the notification.
 */
export interface ISubjectObserver<TSource, TDetail> {
    (sender: TSource, detail: TDetail): void;
}