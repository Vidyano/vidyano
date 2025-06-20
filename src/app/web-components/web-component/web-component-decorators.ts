import { property as litProperty } from "lit/decorators.js";
import { parseMethodSignature, COMPUTED_CONFIG_SYMBOL, PROPERTY_OBSERVERS_CONFIG_SYMBOL, OBSERVERS_CONFIG_SYMBOL, LISTENERS_CONFIG_SYMBOL, WebComponentProperty } from "./web-component-registration";
import type { WebComponentLit } from "./web-component-lit";

type WebComponentConstructor = typeof WebComponentLit & {
    [COMPUTED_CONFIG_SYMBOL]?: Record<string, any>;
    [PROPERTY_OBSERVERS_CONFIG_SYMBOL]?: Record<string, any>;
    [OBSERVERS_CONFIG_SYMBOL]?: Record<string, string[]>;
    [LISTENERS_CONFIG_SYMBOL]?: Record<string, string>;
};

function ensureOwn<T extends object>(ctor: any, symbol: symbol, initial: T): T {
    if (!Object.prototype.hasOwnProperty.call(ctor, symbol)) {
        ctor[symbol] = initial;
    }
    return ctor[symbol];
}

/**
 * Decorator for defining a property in a web component.
 * @param options - Options for the property, such as type, computed method, and observer.
 */
export function property(options?: WebComponentProperty) {
    return (target: any, key: string) => {
        const ctor = target.constructor as WebComponentConstructor;
        const { computed, observer, ...litOptions } = options || {};

        if (computed) {
            const parsed = parseMethodSignature(computed);
            const conf = ensureOwn<Record<string, any>>(ctor, COMPUTED_CONFIG_SYMBOL, {});
            conf[key] = parsed ? { dependencies: parsed.args, methodName: parsed.methodName } : { dependencies: [computed] };
        }

        if (observer) {
            const conf = ensureOwn<Record<string, any>>(ctor, PROPERTY_OBSERVERS_CONFIG_SYMBOL, {});
            conf[key] = observer;
        }

        litProperty(litOptions as any)(target, key);
    };
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
