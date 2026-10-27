import { ReactiveController } from "lit";
import { ServiceBus, ServiceBusSubscriptionDisposer } from "@vidyano/core";
import type { WebComponent } from "./web-component";

export const SERVICE_BUS_OBSERVERS_CONFIG_SYMBOL = Symbol("WebComponent.serviceBusObserversConfig");

export type ServiceBusObserverConfig = { methodName: string; receiveLast: boolean };
export type ServiceBusObserversConfig = Record<string | symbol, ServiceBusObserverConfig>;

export interface ServiceBusObserverOptions {
    /**
     * Whether the method receives the last message sent before the component connected.
     * Defaults to true.
     */
    receiveLast?: boolean;
}

type WebComponentConstructor = typeof WebComponent & {
    [SERVICE_BUS_OBSERVERS_CONFIG_SYMBOL]?: ServiceBusObserversConfig;
};

function ensureOwn<T extends object>(ctor: any, symbol: symbol, initial: T): T {
    if (!Object.prototype.hasOwnProperty.call(ctor, symbol)) {
        ctor[symbol] = initial;
    }
    return ctor[symbol];
}

/**
 * Decorator for subscribing a method to a ServiceBus message while the component is connected.
 * The method is called with the sender, the message and its detail.
 * @param message - The message to subscribe to (string or symbol), possibly with a topic prefix.
 * @param options - Optional settings, see {@link ServiceBusObserverOptions}.
 *
 * @example
 * ```typescript
 * @serviceBusObserver("vi-menu-item:select")
 * private _onSelect(sender: any, message: string, detail: { name: string }) {
 *   // Expand the item
 * }
 * ```
 */
export function serviceBusObserver(message: string | symbol, options?: ServiceBusObserverOptions) {
    return (target: any, propertyKey: string, _desc: PropertyDescriptor) => {
        const ctor = target.constructor as WebComponentConstructor;
        const conf = ensureOwn<ServiceBusObserversConfig>(ctor, SERVICE_BUS_OBSERVERS_CONFIG_SYMBOL, {});
        conf[message] = { methodName: propertyKey, receiveLast: options?.receiveLast ?? true };
    };
}

/**
 * Retrieves the ServiceBus observers configuration for a component instance.
 * @param component The WebComponent instance.
 * @returns A map of messages to their observer configuration.
 */
export function getServiceBusObserversConfig(component: WebComponent): ServiceBusObserversConfig {
    return (component.constructor as WebComponentConstructor)[SERVICE_BUS_OBSERVERS_CONFIG_SYMBOL] || {};
}

/**
 * A Reactive Controller that subscribes to ServiceBus messages while the host is connected
 * based on a declarative configuration.
 */
export class WebComponentServiceBusController implements ReactiveController {
    private host: WebComponent;
    private observers: ServiceBusObserversConfig;
    private disposers: ServiceBusSubscriptionDisposer[] = [];

    constructor(host: WebComponent) {
        this.host = host;
        this.observers = getServiceBusObserversConfig(host);
        this.host.addController(this);
    }

    hostConnected(): void {
        this.hostDisconnected();

        // Reflect.ownKeys includes symbol messages, which for...in skips
        for (const message of Reflect.ownKeys(this.observers) as (string | symbol)[]) {
            const { methodName, receiveLast } = this.observers[message];
            const handler = this.host[methodName];

            if (typeof handler === "function")
                this.disposers.push(ServiceBus.subscribe(message, handler.bind(this.host), receiveLast));
            else
                console.warn(`[${this.host.tagName.toLowerCase()}] ServiceBus observer method '${methodName}' for message '${String(message)}' not found.`);
        }
    }

    hostDisconnected(): void {
        this.disposers.forEach(dispose => dispose());
        this.disposers = [];
    }
}
