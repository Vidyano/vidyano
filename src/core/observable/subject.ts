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
    #observers = new Set<ISubjectObserver<TSource, TDetail>>();
    #weakObserverRegistry: FinalizationRegistry<ISubjectObserver<TSource, TDetail>>;

    /**
     * Creates a new Subject instance.
     * @param {ISubjectNotifier<TSource, TDetail>} notifier - The notifier to wrap.
     */
    constructor(notifier: ISubjectNotifier<TSource, TDetail>) {
        notifier.notify = (source: TSource, detail: TDetail) => {
            for (const observer of this.#observers)
                observer(source, detail);
        };

        this.#weakObserverRegistry = new FinalizationRegistry<ISubjectObserver<TSource, TDetail>>((wrapper) => {
            this.#observers.delete(wrapper);
        });
    }

    /**
     * Attaches an observer to the subject.
     * @param {ISubjectObserver<TSource, TDetail>} observer - The observer function to attach.
     * @param {{ weak?: boolean }} [options] - Optional settings. Set `weak` to true to attach the observer using a WeakRef.
     * @returns {ISubjectDisposer} A function that detaches the observer.
     */
    attach(observer: ISubjectObserver<TSource, TDetail>, options?: { weak?: boolean }): ISubjectDisposer {
        if (options?.weak) {
            const weak = new WeakRef(observer);

            const wrapper: ISubjectObserver<TSource, TDetail> = (sender: TSource, detail: TDetail) => {
                const target = weak.deref();
                if (target)
                    target(sender, detail);
                else {
                    this.#observers.delete(wrapper);
                    this.#weakObserverRegistry.unregister(wrapper);
                }
            };

            this.#weakObserverRegistry.register(observer, wrapper, wrapper);
            this.#observers.add(wrapper);

            return () => {
                this.#weakObserverRegistry.unregister(wrapper);
                this.#observers.delete(wrapper);
            };
        }

        this.#observers.add(observer);
        return () => this.#observers.delete(observer);
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