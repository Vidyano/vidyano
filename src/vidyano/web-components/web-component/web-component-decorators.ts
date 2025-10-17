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

export interface ObserverOptions {
    /**
     * If true, the observer will be called even if some dependencies are undefined.
     * If false (default), the observer will only be called when all dependencies are NOT undefined.
     * Note: null values are always allowed and do not block observer execution.
     */
    allowUndefined?: boolean;
}

/**
 * Decorator for observing changes to multiple properties in a web component.
 *
 * By default, the observer method is only called when ALL dependencies are NOT undefined.
 * Note: null values are allowed and do not block execution.
 * Use { allowUndefined: true } to call the observer even when some dependencies are undefined.
 *
 * @param deps - The names of the properties to observe, optionally followed by an options object.
 *
 * @example
 * ```typescript
 * // Observer called only when both firstName and lastName are NOT undefined
 * @observer("firstName", "lastName")
 * private _handleNameChange(firstName: string, lastName: string) {
 *   // firstName and lastName are guaranteed to NOT be undefined
 *   // (but they could be null)
 * }
 *
 * // Observer called even if some properties are undefined
 * @observer("firstName", "lastName", { allowUndefined: true })
 * private _handleNameChangeWithUndefined(firstName: string, lastName: string) {
 *   if (firstName === undefined || lastName === undefined) return;
 *   // Handle the change...
 * }
 * ```
 */
export function observer(...args: Array<string | ObserverOptions>): (target: any, propertyKey: string, _desc: PropertyDescriptor) => void {
    return (target: any, propertyKey: string, _desc: PropertyDescriptor) => {
        const ctor = target.constructor as WebComponentConstructor;

        // Separate dependencies from options
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
        const existing = conf[propertyKey];

        if (existing) {
            // Merge dependencies, keeping the most permissive allowUndefined setting
            const existingDeps = existing.dependencies || existing;
            const existingAllowUndefined = typeof existing === 'object' && 'allowUndefined' in existing
                ? existing.allowUndefined
                : false;

            conf[propertyKey] = {
                dependencies: Array.from(new Set([...(Array.isArray(existingDeps) ? existingDeps : []), ...deps])),
                allowUndefined: existingAllowUndefined || (options.allowUndefined ?? false)
            };
        } else {
            conf[propertyKey] = {
                dependencies: deps,
                allowUndefined: options.allowUndefined ?? false
            };
        }
    };
}

/**
 * Decorator for observing changes to a single property.
 * The decorated property will call the specified observer method when it changes.
 *
 * **IMPORTANT:** By JavaScript design, truly private methods (with `#`) cannot be
 * referenced via `Class.prototype.#method`. Use regular `private` methods with underscore prefix instead.
 *
 * @param observerFunction - A reference to the observer method function via prototype.
 *
 * @example
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
 */
export function observe(observerFunction: Function) {
    return (target: any, propertyKey: string) => {
        const ctor = target.constructor as WebComponentConstructor;
        const conf = ensureOwn<Record<string, Function>>(ctor, PROPERTY_OBSERVERS_CONFIG_SYMBOL, {});

        // Store the function reference
        conf[propertyKey] = observerFunction;
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

export interface ComputedOptions {
    /**
     * If true, the computed property will be calculated even if some dependencies are undefined.
     * If false (default), the computed property will only be calculated when all dependencies are NOT undefined.
     * Note: null values are always allowed and do not block computation.
     */
    allowUndefined?: boolean;
}

/**
 * Decorator for creating computed properties that depend on other properties.
 * The computed property will automatically update when its dependencies change.
 *
 * By default, computed properties are only calculated when ALL dependencies are NOT undefined.
 * Note: null values are allowed and do not block computation.
 * Use { allowUndefined: true } as the second parameter to compute even when some dependencies are undefined.
 *
 * @param signature - Method signature like "methodName(dep1, dep2)" or simple path like "user.name"
 * @param options - Optional configuration object
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
 *
 * // With allowUndefined option
 * @property({ type: String })
 * @computed("_computeFullName(firstName, lastName)", { allowUndefined: true })
 * readonly fullName: string;
 *
 * private _computeFullName(firstName: string | undefined, lastName: string | undefined): string {
 *   return `${firstName ?? ''} ${lastName ?? ''}`;
 * }
 * ```
 */
export function computed(signature: string, options?: ComputedOptions) {
    return (target: any, propertyKey: string) => {
        const ctor = target.constructor as WebComponentConstructor;
        const parsed = parseMethodSignature(signature);
        const conf = ensureOwn<Record<string, any>>(ctor, COMPUTED_CONFIG_SYMBOL, {});
        conf[propertyKey] = parsed
            ? { dependencies: parsed.args, methodName: parsed.methodName, allowUndefined: options?.allowUndefined ?? false }
            : { dependencies: [signature], allowUndefined: options?.allowUndefined ?? false };
    };
}
