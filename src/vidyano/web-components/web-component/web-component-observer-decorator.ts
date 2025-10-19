import type { WebComponent } from "./web-component";

export const OBSERVERS_CONFIG_SYMBOL = Symbol("WebComponent.observersConfig");
export const PROPERTY_OBSERVERS_CONFIG_SYMBOL = Symbol("WebComponent.propertyObserversConfig");

type ObserverConfig = {
    dependencies: string[];
    allowUndefined: boolean;
};

export type ObserversConfig = Record<string, ObserverConfig>;
export type PropertyObserversConfig = Record<string, Function>;

type WebComponentConstructor = typeof WebComponent & {
    [OBSERVERS_CONFIG_SYMBOL]?: ObserversConfig;
    [PROPERTY_OBSERVERS_CONFIG_SYMBOL]?: PropertyObserversConfig;
};

function ensureOwn<T extends object>(ctor: any, symbol: symbol, initial: T): T {
    if (!Object.prototype.hasOwnProperty.call(ctor, symbol)) {
        ctor[symbol] = initial;
    }
    return ctor[symbol];
}

export interface ObserverOptions {
    /**
     * If true, the observer will be called even if some dependencies are undefined.
     * If false (default), the observer will only be called when all dependencies are NOT undefined.
     * Note: null values are always allowed and do not block observer execution.
     */
    allowUndefined?: boolean;
}

/**
 * Unified decorator for observing property changes in a web component.
 *
 * Can be used in two ways:
 *
 * 1. **Property observation** - Observes a single property by passing an observer function:
 * ```typescript
 * @property({ type: Number })
 * @observer(MyClass.prototype._handleCounterChange)
 * declare counter: number;
 *
 * private _handleCounterChange(newValue: number, oldValue: number) {
 *   console.log(`Changed from ${oldValue} to ${newValue}`);
 * }
 * ```
 *
 * 2. **Method observation** - Observes multiple properties by decorating a method:
 * ```typescript
 * @observer("firstName", "lastName")
 * private _handleNameChange(firstName: string, lastName: string) {
 *   console.log(`Name: ${firstName} ${lastName}`);
 * }
 * ```
 *
 * **IMPORTANT:** By JavaScript design, truly private methods (with `#`) cannot be
 * referenced via `Class.prototype.#method`. Use regular `private` methods with underscore prefix instead.
 *
 * By default, observers are only called when ALL dependencies are NOT undefined.
 * Note: null values are allowed and do not block execution.
 * Use `{ allowUndefined: true }` to call the observer even when some dependencies are undefined.
 *
 * @param args - For property observation: observer function. For method observation: property names followed by optional options object.
 */
export function observer<T extends WebComponent, K extends keyof T>(
    ...args: Array<((this: T, newValue?: T[K], oldValue?: T[K]) => void) | string | ObserverOptions>
): any {
    // Return a decorator function that can handle both property and method decoration
    return (target: any, propertyKey: string | symbol, descriptor?: PropertyDescriptor): any => {
        // Detect if this is a property decorator (no descriptor) or method decorator (has descriptor)
        const isMethodDecorator = descriptor !== undefined;

        if (isMethodDecorator) {
            // Method observation: args are property names + optional options
            const ctor = target.constructor as WebComponentConstructor;
            let deps: string[];
            let options: ObserverOptions = {};

            if (args.length > 0 && typeof args[args.length - 1] === 'object' && !Array.isArray(args[args.length - 1])) {
                // Last argument is options object
                options = args[args.length - 1] as ObserverOptions;
                deps = args.slice(0, -1) as string[];
            } else {
                // All arguments are dependencies
                deps = args as string[];
            }

            const conf = ensureOwn<Record<string, any>>(ctor, OBSERVERS_CONFIG_SYMBOL, {});
            const existing = conf[propertyKey as string];

            if (existing) {
                // Merge dependencies, keeping the most permissive allowUndefined setting
                const existingDeps = existing.dependencies || existing;
                const existingAllowUndefined = typeof existing === 'object' && 'allowUndefined' in existing
                    ? existing.allowUndefined
                    : false;

                conf[propertyKey as string] = {
                    dependencies: Array.from(new Set([...(Array.isArray(existingDeps) ? existingDeps : []), ...deps])),
                    allowUndefined: existingAllowUndefined || (options.allowUndefined ?? false)
                };
            } else {
                conf[propertyKey as string] = {
                    dependencies: deps,
                    allowUndefined: options.allowUndefined ?? false
                };
            }
        } else {
            // Property observation: first arg is the observer function
            if (args.length !== 1 || typeof args[0] !== 'function') {
                throw new Error(
                    `@observer on property '${String(propertyKey)}' requires exactly one argument (the observer function). ` +
                    `Received ${args.length} argument(s). ` +
                    `For multi-property observation, use @observer on a method instead.`
                );
            }

            const observerFunction = args[0] as Function;
            const ctor = target.constructor as WebComponentConstructor;
            const conf = ensureOwn<Record<string, Function>>(ctor, PROPERTY_OBSERVERS_CONFIG_SYMBOL, {});
            conf[propertyKey as string] = observerFunction;
        }
    };
}

/**
 * Retrieves the observers configuration for a component instance.
 * @param component The WebComponent instance.
 * @returns A map of observer method names to their configuration.
 */
export function getObserversConfig(component: WebComponent): ObserversConfig {
    return (component.constructor as WebComponentConstructor)[OBSERVERS_CONFIG_SYMBOL] || {};
}

/**
 * Retrieves the property observers configuration for a component instance.
 * @param component The WebComponent instance.
 * @returns A map of property names to their observer functions.
 */
export function getPropertyObserversConfig(component: WebComponent): PropertyObserversConfig {
    return (component.constructor as WebComponentConstructor)[PROPERTY_OBSERVERS_CONFIG_SYMBOL] || {};
}

/**
 * Executes single-property observers for any property that has changed.
 * This function is called during the component update cycle.
 * @param host The WebComponent instance.
 * @param changedProperties A map of properties that have changed.
 */
export function executePropertyObservers(host: WebComponent, changedProperties: Map<PropertyKey, unknown>): void {
    const propertyObservers = getPropertyObserversConfig(host);
    if (!propertyObservers) return;

    for (const [prop, oldVal] of changedProperties.entries()) {
        const observerFunction = propertyObservers[prop as string];
        if (!observerFunction) continue;

        const newVal = host[prop as string];
        if (newVal === oldVal) continue;

        try {
            // Call the function with the host as `this` context
            observerFunction.call(host, newVal, oldVal);
        } catch (e) {
            const observerName = observerFunction.name || '<anonymous>';
            console.error(`[${host.tagName.toLowerCase()}] Error in property observer '${observerName}' for property '${String(prop)}':`, e);
        }
    }
}
