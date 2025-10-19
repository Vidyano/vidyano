import type { WebComponent } from "./web-component";

export const NOTIFY_CONFIG_SYMBOL = Symbol("WebComponent.notifyConfig");

export type NotifyConfig = Record<string, string | true>; // true = auto-generate kebab-case-changed, string = custom event name

type WebComponentConstructor = typeof WebComponent & {
    [NOTIFY_CONFIG_SYMBOL]?: NotifyConfig;
};

function ensureOwn<T extends object>(ctor: any, symbol: symbol, initial: T): T {
    if (!Object.prototype.hasOwnProperty.call(ctor, symbol)) {
        ctor[symbol] = initial;
    }
    return ctor[symbol];
}

/**
 * Decorator for dispatching property change events (Polymer-style notify).
 * When the property changes, a custom event will be dispatched.
 *
 * @param eventName - Optional custom event name. If not provided, uses kebab-case property name with "-changed" suffix.
 *
 * @example
 * ```typescript
 * // Dispatches "scroll-top-changed" event
 * @property({ type: Number })
 * @notify()
 * scrollTop: number;
 *
 * // Dispatches custom "custom-scroll-event" event
 * @property({ type: Number })
 * @notify("custom-scroll-event")
 * scrollOffset: number;
 * ```
 */
export function notify(eventName?: string) {
    return (target: any, propertyKey: string) => {
        const ctor = target.constructor as WebComponentConstructor;
        const conf = ensureOwn<Record<string, string | true>>(ctor, NOTIFY_CONFIG_SYMBOL, {});
        conf[propertyKey] = eventName || true; // true = auto-generate kebab-case-changed
    };
}

/**
 * Retrieves the notify configuration for a component instance.
 * @param component The WebComponent instance.
 * @returns A map of property names to their notify event names.
 */
export function getNotifyConfig(component: WebComponent): NotifyConfig {
    return (component.constructor as WebComponentConstructor)[NOTIFY_CONFIG_SYMBOL] || {};
}
