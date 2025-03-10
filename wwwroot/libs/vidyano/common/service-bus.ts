import { ISubjectDisposer, ISubjectNotifier, Subject } from "./observable.js"

/**
 * Callback function to handle messages sent via the service bus.
 * Use this to process messages broadcast across different parts of your app.
 * @param sender The originator of the message.
 * @param message The message content.
 * @param detail Extra data associated with the message.
 */
export type ServiceBusCallback = (sender: any, message: string, detail: any) => void;

/**
 * Disposer interface for service bus subscriptions.
 * Allows you to clean up a subscription when it's no longer needed.
 */
export interface ServiceBusSubscriptionDisposer extends ISubjectDisposer {
}

/**
 * The service bus is a central hub that enables decoupled communication across your application.
 * It lets different components send and subscribe to messages without tight coupling.
 */
export interface IServiceBus {
    /**
     * Sends a message on the service bus.
     * If the message contains a colon, the part before it defines the topic.
     * @param message The message text or topic:message string.
     * @param detail Optional extra data to accompany the message.
     */
    send(message: string, detail?: any): void;
    /**
     * Sends a message from a specified sender on the service bus.
     * If the message contains a colon, the part before it defines the topic.
     * @param sender The sender of the message.
     * @param message The message text or topic:message string.
     * @param detail Optional extra data to accompany the message.
     */
    send(sender: any, message: string, detail?: any): void;
    /**
     * Subscribes to a message on the service bus.
     * You can subscribe to all messages in a topic using the "topic:*" syntax.
     * Optionally, the callback can be invoked immediately with the last message sent on that topic.
     * @param message The message to listen for, possibly with a topic prefix.
     * @param callback Function invoked when a matching message is sent.
     * @param receiveLast If true, immediately receive the last sent message on that topic if available.
     * @returns A disposer to cancel the subscription.
     */
    subscribe(message: string, callback: ServiceBusCallback, receiveLast?: boolean): ServiceBusSubscriptionDisposer;
}

/**
 * Represents a message within a service bus topic.
 * Contains the sender, message content, and any extra details.
 */
interface IServiceTopicMessage {
    sender: any;
    message: string;
    detail: any;
}

/**
 * Internal representation of a service bus topic.
 * It groups subscribers and holds the most recent message.
 */
interface IServiceBusTopic {
    subject: Subject<IServiceBus, IServiceTopicMessage>;
    notifier: ISubjectNotifier<IServiceBus, IServiceTopicMessage>;
    lastMessage?: IServiceTopicMessage;
}

/**
 * Implementation of the IServiceBus that enables decoupled messaging.
 * It manages topics internally, where each topic groups messages and subscriptions.
 */
class ServiceBusImpl implements IServiceBus {
    /**
     * Map storing all topics by name. Each topic manages its own subscribers and last message.
     */
    #topics: Record<string, IServiceBusTopic> = {};

    /**
     * Retrieves an existing topic or creates a new one if it doesn't exist.
     * A topic is used to group related messages. If no topic is specified,
     * a default topic (empty string) is used.
     * @param topic The name of the topic.
     * @returns The topic instance with its notifier and subject.
     */
    #getTopic(topic: string = ""): IServiceBusTopic {
        if (!this.#topics[topic]) {
            const topicNotifier = {};
            this.#topics[topic] = {
                notifier: topicNotifier,
                subject: new Subject(topicNotifier)
            };
        }
        return this.#topics[topic];
    }

    send(message: string, detail?: any): void;
    send(sender: any, message: string, detail?: any): void;
    send(senderOrMessage: any, messageOrDetail?: any, detail?: any) {
        let sender: any;
        let message: string;

        if (typeof senderOrMessage !== "string") {
            sender = senderOrMessage;
            message = messageOrDetail;
        } else {
            sender = null;
            message = senderOrMessage;
            detail = messageOrDetail;
        }

        // Split message string by colon.
        // If a colon exists, the text before it defines the topic.
        const topicOrMessage = message.split(":", 2);
        const topic = this.#getTopic(topicOrMessage.length > 1 ? topicOrMessage[0] : "");
        message = topicOrMessage.length === 1 ? topicOrMessage[0] : topicOrMessage[1];

        // Store as the last message and notify all subscribers.
        topic.notifier.notify(this, topic.lastMessage = {
            sender: sender,
            message: message,
            detail: detail
        });
    }

    /**
     * Subscribes to a specific message or topic.
     * The callback is called whenever a matching message is sent.
     * If receiveLast is true, the callback is also invoked with the last message on that topic.
     * @param message The message to subscribe to. Can include a topic prefix, e.g. "topic:message".
     *                Use "*" to match any message in the topic.
     * @param callback Function to execute when a matching message is received.
     * @param receiveLast If true, the callback is invoked immediately with the last message if available.
     * @returns A disposer to remove the subscription when no longer needed.
     */
    subscribe(message: string, callback: ServiceBusCallback, receiveLast?: boolean) {
        const topicOrMessage = message.split(":", 2);
        const topic = this.#getTopic(topicOrMessage.length > 1 ? topicOrMessage[0] : "");
        message = topicOrMessage.length === 1 ? topicOrMessage[0] : topicOrMessage[1];

        const disposer = topic.subject.attach((_, detail) => {
            if (message === "*" || message === detail.message)
                callback(detail.sender, detail.message, detail.detail);
        });

        if (receiveLast && topic.lastMessage != null) {
            if (message === "*" || message === topic.lastMessage.message)
                callback(topic.lastMessage, topic.lastMessage.message, topic.lastMessage.detail);
        }

        return disposer;
    }
}

export const ServiceBus: IServiceBus = new ServiceBusImpl();