import type { WebComponent } from "./web-component";

export const PROPERTY_OBSERVERS_CONFIG_SYMBOL = Symbol("WebComponent.propertyObserversConfig");

type WebComponentConstructor = typeof WebComponent & {
    [PROPERTY_OBSERVERS_CONFIG_SYMBOL]?: Record<string, Function>;
};

function ensureOwn<T extends object>(ctor: any, symbol: symbol, initial: T): T {
    if (!Object.prototype.hasOwnProperty.call(ctor, symbol)) {
        ctor[symbol] = initial;
    }
    return ctor[symbol];
}

/**
 * Decorator for observing changes to a single property.
 * The decorated property will call the specified observer method when it changes.
 *
 * **IMPORTANT:** By JavaScript design, truly private methods (with `#`) cannot be
 * referenced via `Class.prototype.#method`. Use regular `private` methods with underscore prefix instead.
 *
 * @param observerFunction - A reference to the observer method function via prototype, or an inline function with explicit `this` typing.
 *
 * @example
 * Using a function reference:
 * ```typescript
 * @property({ type: Number })
 * @observe(DatePicker.prototype._handleScrollChange)
 * scrollTop: number;
 *
 * private _handleScrollChange(newValue: number, oldValue: number) {
 *   // `this` refers to the DatePicker instance
 *   console.log(`Scroll changed from ${oldValue} to ${newValue}`);
 * }
 * ```
 *
 * @example
 * Using an inline function:
 * ```typescript
 * @property({ type: Number })
 * @observe(function(this: DatePicker, newValue?: number, oldValue?: number) {
 *   // `this` refers to the DatePicker instance
 *   console.log(`Scroll changed from ${oldValue} to ${newValue}`);
 * })
 * scrollTop: number;
 * ```
 */
export function observe<T extends WebComponent, K extends keyof T>(
    observerFunction: (this: T, newValue?: T[K], oldValue?: T[K]) => void
): PropertyDecorator {
    return (target: any, propertyKey: string) => {
        const ctor = target.constructor as WebComponentConstructor;
        const conf = ensureOwn<Record<string, Function>>(ctor, PROPERTY_OBSERVERS_CONFIG_SYMBOL, {});

        // Store the function reference
        conf[propertyKey] = observerFunction;
    };
}

export type PropertyObserversConfig = Record<string, Function>;

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
