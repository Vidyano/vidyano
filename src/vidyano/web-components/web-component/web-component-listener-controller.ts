import { ReactiveController } from "lit";
import type { WebComponentLit } from "./web-component-lit";
import { getListenersConfig, ListenersConfig } from "./web-component-registration";

/**
 * A Reactive Controller that manages adding and removing event listeners
 * based on a declarative configuration.
 */
export class WebComponentListenerController implements ReactiveController {
    private host: WebComponentLit;
    private listeners: ListenersConfig;

    // We must store the bound handlers to ensure we can remove the exact same function reference.
    private boundHandlers: Map<string, EventListener> = new Map();

    constructor(host: WebComponentLit) {
        this.host = host;
        this.listeners = getListenersConfig(host);
        this.host.addController(this);
    }

    hostConnected(): void {
        this.boundHandlers.clear();

        for (const eventName in this.listeners) {
            const handlerName = this.listeners[eventName];
            const handler = this.host[handlerName] as EventListener;

            if (typeof handler === "function") {
                const boundHandler = handler.bind(this.host);
                this.boundHandlers.set(eventName, boundHandler);
                this.host.addEventListener(eventName, boundHandler);
            } else {
                console.warn(`[${this.host.tagName.toLowerCase()}] Listener method '${handlerName}' for event '${eventName}' not found.`);
            }
        }
    }

    hostDisconnected(): void {
        for (const [eventName, boundHandler] of this.boundHandlers.entries()) {
            this.host.removeEventListener(eventName, boundHandler);
        }
        this.boundHandlers.clear();
    }
}