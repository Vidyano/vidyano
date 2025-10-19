import { ReactiveController } from "lit";
import type { WebComponent } from "./web-component";

export const LISTENERS_CONFIG_SYMBOL = Symbol("WebComponent.listenersConfig");

export type ListenersConfig = Record<string, string>;

type WebComponentConstructor = typeof WebComponent & {
    [LISTENERS_CONFIG_SYMBOL]?: ListenersConfig;
};

function ensureOwn<T extends object>(ctor: any, symbol: symbol, initial: T): T {
    if (!Object.prototype.hasOwnProperty.call(ctor, symbol)) {
        ctor[symbol] = initial;
    }
    return ctor[symbol];
}

/**
 * Decorator for listening to a specific event on a web component.
 * @param eventName - The name of the event to listen for.
 */
export function listener(eventName: string) {
    return (target: any, propertyKey: string, _desc: PropertyDescriptor) => {
        const ctor = target.constructor as WebComponentConstructor;
        const conf = ensureOwn<Record<string, string>>(ctor, LISTENERS_CONFIG_SYMBOL, {});
        conf[eventName] = propertyKey;
    };
}

/**
 * Retrieves the listeners configuration for a component instance.
 * @param component The WebComponent instance.
 * @returns A map of event names to their handler method names.
 */
export function getListenersConfig(component: WebComponent): ListenersConfig {
    return (component.constructor as WebComponentConstructor)[LISTENERS_CONFIG_SYMBOL] || {};
}

/**
 * A Reactive Controller that manages adding and removing event listeners
 * based on a declarative configuration.
 */
export class WebComponentListenerController implements ReactiveController {
    private host: WebComponent;
    private listeners: ListenersConfig;

    // We must store the bound handlers to ensure we can remove the exact same function reference.
    private boundHandlers: Map<string, EventListener> = new Map();

    constructor(host: WebComponent) {
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
