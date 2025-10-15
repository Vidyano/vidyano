import { parseMethodSignature, COMPUTED_CONFIG_SYMBOL, PROPERTY_OBSERVERS_CONFIG_SYMBOL, OBSERVERS_CONFIG_SYMBOL, NOTIFY_CONFIG_SYMBOL, LISTENERS_CONFIG_SYMBOL } from "./web-component-registration";
import type { WebComponent } from "./web-component";

type WebComponentConstructor = typeof WebComponent & {
    [COMPUTED_CONFIG_SYMBOL]?: Record<string, any>;
    [PROPERTY_OBSERVERS_CONFIG_SYMBOL]?: Record<string, any>;
    [OBSERVERS_CONFIG_SYMBOL]?: Record<string, string[]>;
    [NOTIFY_CONFIG_SYMBOL]?: Record<string, string | true>;
    [LISTENERS_CONFIG_SYMBOL]?: Record<string, string>;
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
 * Decorator for observing changes to multiple properties in a web component.
 * @param deps - The names of the properties to observe.
 */
export function observer(...deps: string[]) {
    return (target: any, propertyKey: string, _desc: PropertyDescriptor) => {
        const ctor = target.constructor as WebComponentConstructor;
        const conf = ensureOwn<Record<string, string[]>>(ctor, OBSERVERS_CONFIG_SYMBOL, {});
        const existing = conf[propertyKey] || [];
        conf[propertyKey] = Array.from(new Set([...existing, ...deps]));
    };
}

/**
 * Decorator for observing changes to a single property.
 * The decorated property will call the specified observer method when it changes.
 * @param methodName - The name of the observer method to call when the property changes.
 *
 * @example
 * ```typescript
 * @property({ type: Number })
 * @observe("_handleScrollChange")
 * scrollTop: number;
 *
 * private _handleScrollChange(newValue: number, oldValue: number) {
 *   console.log(`Scroll changed from ${oldValue} to ${newValue}`);
 * }
 * ```
 */
export function observe(methodName: string) {
    return (target: any, propertyKey: string) => {
        const ctor = target.constructor as WebComponentConstructor;
        const conf = ensureOwn<Record<string, string>>(ctor, PROPERTY_OBSERVERS_CONFIG_SYMBOL, {});
        conf[propertyKey] = methodName;
    };
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
 * Decorator for creating computed properties that depend on other properties.
 * The computed property will automatically update when its dependencies change.
 *
 * @param signature - Method signature like "methodName(dep1, dep2)" or simple path like "user.name"
 *
 * @example
 * ```typescript
 * @property({ type: String })
 * firstName: string;
 *
 * @property({ type: String })
 * lastName: string;
 *
 * @property({ type: String })
 * @computed("_computeFullName(firstName, lastName)")
 * readonly fullName: string;
 *
 * private _computeFullName(firstName: string, lastName: string): string {
 *   return `${firstName} ${lastName}`;
 * }
 * ```
 */
export function computed(signature: string) {
    return (target: any, propertyKey: string) => {
        const ctor = target.constructor as WebComponentConstructor;
        const parsed = parseMethodSignature(signature);
        const conf = ensureOwn<Record<string, any>>(ctor, COMPUTED_CONFIG_SYMBOL, {});
        conf[propertyKey] = parsed
            ? { dependencies: parsed.args, methodName: parsed.methodName }
            : { dependencies: [signature] };
    };
}
