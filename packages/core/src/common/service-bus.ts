import { ISubjectDisposer, ISubjectNotifier, Subject } from "../observable"

/**
 * Callback function to handle messages sent via the service bus.
 * Use this to process messages broadcast across different parts of your app.
 * @param sender - The originator of the message.
 * @param message - The message content (string or symbol).
 * @param detail - Extra data associated with the message.
 */
export type ServiceBusCallback = (sender: any, message: string | symbol, detail: any) => void;

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
     * For strings: If the message contains a colon, the part before it defines the topic.
     * For symbols: The symbol's description is parsed for topic:message pattern.
     * @param message - The message text, topic:message string, or symbol.
     * @param detail - Optional extra data to accompany the message.
     */
    send(message: string | symbol, detail?: any): void;
    /**
     * Sends a message from a specified sender on the service bus.
     * For strings: If the message contains a colon, the part before it defines the topic.
     * For symbols: The symbol's description is parsed for topic:message pattern.
     * @param sender - The sender of the message.
     * @param message - The message text, topic:message string, or symbol.
     * @param detail - Optional extra data to accompany the message.
     */
    send(sender: any, message: string | symbol, detail?: any): void;
    /**
     * Subscribes to a message on the service bus.
     * You can subscribe to all messages in a topic using the "topic:*" syntax (strings only).
     * Optionally, the callback can be invoked immediately with the last message sent on that topic.
     * @param message - The message to listen for (string or symbol), possibly with a topic prefix.
     * @param callback - Function invoked when a matching message is sent.
     * @param receiveLast - If true, immediately receive the last sent message on that topic if available.
     * @returns A disposer to cancel the subscription.
     */
    subscribe(message: string | symbol, callback: ServiceBusCallback, receiveLast?: boolean): ServiceBusSubscriptionDisposer;
}

/**
 * Represents a message within a service bus topic.
 * Contains the sender, message content, and any extra details.
 */
interface IServiceTopicMessage {
    sender: any;
    message: string | symbol;
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
     * Map storing all topics by key (string or symbol). Each topic manages its own subscribers and last message.
     */
    #topics = new Map<string | symbol, IServiceBusTopic>();

    /**
     * Gets the string representation of a symbol for parsing purposes.
     * Uses Symbol.keyFor for global symbols, otherwise uses the description.
     * @param sym - The symbol to get the key from.
     * @returns The string representation of the symbol.
     */
    #getSymbolKey(sym: symbol): string {
        return Symbol.keyFor(sym) ?? sym.description ?? "";
    }

    /**
     * Retrieves an existing topic or creates a new one if it doesn't exist.
     * A topic is used to group related messages. If no topic is specified,
     * a default topic (empty string) is used.
     * @param topic - The key of the topic (string or symbol).
     * @returns The topic instance with its notifier and subject.
     */
    #getTopic(topic: string | symbol = ""): IServiceBusTopic {
        if (!this.#topics.has(topic)) {
            const topicNotifier = {};
            this.#topics.set(topic, {
                notifier: topicNotifier,
                subject: new Subject(topicNotifier)
            });
        }
        return this.#topics.get(topic)!;
    }

    send(message: string | symbol, detail?: any): void;
    send(sender: any, message: string | symbol, detail?: any): void;
    send(senderOrMessage: any, messageOrDetail?: any, detail?: any) {
        let sender: any;
        let message: string | symbol;

        if (typeof senderOrMessage !== "string" && typeof senderOrMessage !== "symbol") {
            sender = senderOrMessage;
            message = messageOrDetail;
        } else {
            sender = null;
            message = senderOrMessage;
            detail = messageOrDetail;
        }

        // For symbols, use the symbol itself as the topic key
        // Parse the description for the message part
        if (typeof message === "symbol") {
            const topic = this.#getTopic(message);
            const symbolKey = this.#getSymbolKey(message);
            const topicOrMessage = symbolKey.split(":", 2);
            const parsedMessage = topicOrMessage.length === 1 ? topicOrMessage[0] : topicOrMessage[1];

            // Store as the last message and notify all subscribers.
            topic.notifier.notify(this, topic.lastMessage = {
                sender: sender,
                message: parsedMessage || message,
                detail: detail
            });
        } else {
            // For strings, split by colon as before
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
    }

    /**
     * Subscribes to a specific message or topic.
     * The callback is called whenever a matching message is sent.
     * If receiveLast is true, the callback is also invoked with the last message on that topic.
     * @param message - The message to subscribe to (string or symbol). Can include a topic prefix for strings, e.g. "topic:message".
     *                Use "*" to match any message in the topic (strings only).
     * @param callback - Function to execute when a matching message is received.
     * @param receiveLast - If true, the callback is invoked immediately with the last message if available.
     * @returns A disposer to remove the subscription when no longer needed.
     */
    subscribe(message: string | symbol, callback: ServiceBusCallback, receiveLast?: boolean) {
        if (typeof message === "symbol") {
            // For symbols, use the symbol itself as the topic key
            const topic = this.#getTopic(message);
            const symbolKey = this.#getSymbolKey(message);
            const topicOrMessage = symbolKey.split(":", 2);
            const parsedMessage = topicOrMessage.length === 1 ? topicOrMessage[0] : topicOrMessage[1];

            const disposer = topic.subject.attach((_, detail) => {
                // Match against the parsed message or the symbol itself
                if (parsedMessage === detail.message || message === detail.message)
                    callback(detail.sender, detail.message, detail.detail);
            });

            if (receiveLast && topic.lastMessage != null) {
                if (parsedMessage === topic.lastMessage.message || message === topic.lastMessage.message)
                    callback(topic.lastMessage.sender, topic.lastMessage.message, topic.lastMessage.detail);
            }

            return disposer;
        } else {
            // For strings, use the existing logic
            const topicOrMessage = message.split(":", 2);
            const topic = this.#getTopic(topicOrMessage.length > 1 ? topicOrMessage[0] : "");
            message = topicOrMessage.length === 1 ? topicOrMessage[0] : topicOrMessage[1];

            const disposer = topic.subject.attach((_, detail) => {
                if (message === "*" || message === detail.message)
                    callback(detail.sender, detail.message, detail.detail);
            });

            if (receiveLast && topic.lastMessage != null) {
                if (message === "*" || message === topic.lastMessage.message)
                    callback(topic.lastMessage.sender, topic.lastMessage.message, topic.lastMessage.detail);
            }

            return disposer;
        }
    }
}

export const ServiceBus: IServiceBus = new ServiceBusImpl();