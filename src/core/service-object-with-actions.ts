import { Queue } from "./common/queue.js";
import { ServiceObject } from "./service-object.js";
import type { NotificationType, Service } from "./service.js";
import { Action } from "./action.js";

/**
 * Represents a service object that manages actions and notifications.
 */
export class ServiceObjectWithActions extends ServiceObject {
    readonly #queue: Queue;
    #isBusy: boolean = false;
    #notification: string;
    #notificationType: NotificationType;
    #notificationDuration: number;
    readonly #actionNames: string[];
    readonly #actionLabels?: { [key: string]: string };

    /**
     * An array of actions associated with the service object.
     * Indexed both as an array and as a dictionary by action name.
     */
    actions: Array<Action> & Record<string, Action> = <any>[];

    /**
     * Initializes a new instance of the ServiceObjectWithActions class.
     * @param service - The associated service.
     * @param actionNames - Names of actions to initialize.
     * @param actionLabels - Optional labels for actions.
     */
    constructor(service: Service, actionNames: string[] = [], actionLabels?: { [key: string]: string }) {
        super(service);

        this.#actionNames = actionNames;
        this.#actionLabels = actionLabels;
        this.#queue = new Queue(1);
    }

    /**
     * Gets a value indicating whether the service object is busy.
     */
    get isBusy(): boolean {
        return this.#isBusy;
    }

    /**
     * Sets the busy state and notifies listeners if it changes.
     * @param val - The new busy state.
     */
    #setIsBusy(val: boolean) {
        if (this.#isBusy === val)
            return;

        const oldIsBusy = this.#isBusy;
        this.notifyPropertyChanged("isBusy", this.#isBusy = val, oldIsBusy);
    }

    /**
     * Gets the current notification message.
     */
    get notification(): string {
        return this.#notification;
    }

    /**
     * Gets the current notification type.
     */
    get notificationType(): NotificationType {
        return this.#notificationType;
    }

    /**
     * Gets the current notification duration.
     */
    get notificationDuration(): number {
        return this.#notificationDuration;
    }

    /**
     * Retrieves an action by its name.
     * @param name - The name of the action.
     * @returns The requested Action.
     */
    getAction(name: string): Action {
        return this.actions[name];
    }

    /**
     * Sets the notification for the service object.
     * Overload: Accepts a string message.
     */
    setNotification(notification?: string, type?: NotificationType, duration?: number, skipShowNotification?: boolean): void;
    /**
     * Sets the notification for the service object.
     * Overload: Accepts an Error object.
     */
    setNotification(notification?: Error, type?: NotificationType, duration?: number, skipShowNotification?: boolean): void;
    setNotification(notificationOrError: string | Error = null, type: NotificationType = "Error", duration: number = null, skipShowNotification?: boolean) {
        const notification = typeof notificationOrError === "string" || !notificationOrError 
            ? notificationOrError as string 
            : notificationOrError?.["message"];

        const oldNotificationDuration = this.notificationDuration;
        if (oldNotificationDuration !== duration)
            this.notifyPropertyChanged("notificationDuration", this.#notificationDuration = duration, oldNotificationDuration);

        const oldNotificationType = this.#notificationType;
        if (oldNotificationType !== type)
            this.notifyPropertyChanged("notificationType", this.#notificationType = type, oldNotificationType);

        const oldNotification = this.notification;
        if (oldNotification !== notification)
            this.notifyPropertyChanged("notification", this.#notification = notification, oldNotification);

        if (!skipShowNotification && this.notificationDuration) {
            this.service.hooks.onShowNotification(notification, type, duration);
            this.setNotification();
        }
    }

    /**
     * Queues a work function to be executed asynchronously.
     * @param work - The asynchronous work function.
     * @param blockActions - If true, actions are blocked during execution.
     * @returns A promise that resolves with the result of the work.
     */
    queueWork<T>(work: () => Promise<T>, blockActions: boolean = true): Promise<T> {
        this.#setIsBusy(true);

        return this.#queue.add(async () => {
            if (blockActions)
                this.#blockActions(true);

            try {
                const result = await work();
                this.#setIsBusy(this.#queue.queueLength > 0);
                if (blockActions)
                    this.#blockActions(false);

                return result;
            }
            catch (e) {
                this.#setIsBusy(this.#queue.queueLength > 0);
                this.#blockActions(false);

                throw e;
            }
        });
    }

    /**
     * Initializes actions based on the provided action names and labels.
     */
    protected _initializeActions() {
        Action.addActions(this.service, this, this.actions, this.#actionNames);

        this.actions.forEach(a => {
            this.actions[a.name] = a;

            if (this.#actionLabels && this.#actionLabels[a.name] != null)
                a.displayName = this.#actionLabels[a.name];
        });
    }

    /**
     * Blocks or unblocks all associated actions.
     * @param block - True to block actions; false to unblock them.
     */
    #blockActions(block: boolean) {
        this.actions.forEach(action => {
            action.block = block;
        });
    }
}