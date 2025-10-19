import { COMPUTED_CONFIG_SYMBOL, PROPERTY_OBSERVERS_CONFIG_SYMBOL, OBSERVERS_CONFIG_SYMBOL, NOTIFY_CONFIG_SYMBOL, LISTENERS_CONFIG_SYMBOL, KEYBINDINGS_CONFIG_SYMBOL } from "./web-component-registration";
import type { WebComponent } from "./web-component";

type WebComponentConstructor = typeof WebComponent & {
    [COMPUTED_CONFIG_SYMBOL]?: Record<string, any>;
    [PROPERTY_OBSERVERS_CONFIG_SYMBOL]?: Record<string, any>;
    [OBSERVERS_CONFIG_SYMBOL]?: Record<string, string[]>;
    [NOTIFY_CONFIG_SYMBOL]?: Record<string, string | true>;
    [LISTENERS_CONFIG_SYMBOL]?: Record<string, string>;
    [KEYBINDINGS_CONFIG_SYMBOL]?: Record<string, string>;
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
 * Decorator for binding keyboard shortcuts to component methods.
 * @param keybinding - Keyboard shortcut (e.g., "ctrl+s", "escape", "alt+shift+k")
 *
 * @example
 * ```typescript
 * @keybinding("ctrl+s")
 * private handleSave(e: KeyboardEvent) {
 *   e.preventDefault();
 *   // Save logic
 * }
 *
 * @keybinding("escape")
 * private handleEscape(e: KeyboardEvent) {
 *   // Close dialog
 * }
 * ```
 */
export function keybinding(keybinding: string) {
    return (target: any, propertyKey: string, _desc: PropertyDescriptor) => {
        const ctor = target.constructor as WebComponentConstructor;
        const conf = ensureOwn<Record<string, string>>(ctor, KEYBINDINGS_CONFIG_SYMBOL, {});
        conf[keybinding] = propertyKey;
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
 * Use { allowUndefined: true } as the last parameter to compute even when some dependencies are undefined.
 *
 * @param computeFunctionOrDependency - Either a compute function with explicit `this` parameter, or a string property path
 * @param dependencies - One or more property names as strings, optionally followed by ComputedOptions
 *
 * @example
 * ```typescript
 * @property({ type: String })
 * firstName: string;
 *
 * @property({ type: String })
 * lastName: string;
 *
 * // With named function and explicit this typing
 * async function computeFullNameAsync(this: MyComponent, firstName: string, lastName: string) {
 *   return new Promise(r => setTimeout(() => r(`${firstName} ${lastName}`), 100));
 * }
 *
 * @property({ type: String })
 * @computed(computeFullNameAsync, "firstName", "lastName")
 * declare readonly fullName: string;
 *
 * // With inline function and explicit this typing
 * @property({ type: String })
 * @computed(function(this: MyComponent, firstName: string, lastName: string) {
 *   return `${firstName} ${lastName}`;
 * }, "firstName", "lastName")
 * declare readonly fullNameInline: string;
 *
 * // With string path (simple forwarding)
 * @property({ type: String })
 * @computed("user.name")
 * declare readonly userName: string;
 *
 * // With allowUndefined option
 * @property({ type: String })
 * @computed(function(this: MyComponent, firstName: string | undefined, lastName: string | undefined) {
 *   return `${firstName ?? ''} ${lastName ?? ''}`;
 * }, "firstName", "lastName", { allowUndefined: true })
 * declare readonly fullName: string;
 * ```
 */
export function computed(computeFunctionOrDependency: Function | string, ...dependencies: Array<string | Function | ComputedOptions>) {
    return (target: any, propertyKey: string) => {
        const ctor = target.constructor as WebComponentConstructor;
        const conf = ensureOwn<Record<string, any>>(ctor, COMPUTED_CONFIG_SYMBOL, {});

        let computeFunction: Function | undefined;
        let deps: string[];
        let options: ComputedOptions = {};

        // Check if first parameter is a function (compute function provided)
        if (typeof computeFunctionOrDependency === 'function') {
            // Store the compute function directly
            computeFunction = computeFunctionOrDependency;

            // Separate remaining dependencies from options
            if (dependencies.length > 0 && typeof dependencies[dependencies.length - 1] === 'object' && typeof dependencies[dependencies.length - 1] !== 'function' && !Array.isArray(dependencies[dependencies.length - 1])) {
                // Last argument is options object (not a function)
                options = dependencies[dependencies.length - 1] as ComputedOptions;
                deps = dependencies.slice(0, -1).map(dep => typeof dep === 'function' ? dep.name : dep) as string[];
            } else {
                // All arguments are dependencies
                deps = dependencies.map(dep => typeof dep === 'function' ? dep.name : dep) as string[];
            }
        } else {
            // First parameter is a string dependency (simple property path)
            // Check if last argument is options
            if (dependencies.length > 0 && typeof dependencies[dependencies.length - 1] === 'object' && typeof dependencies[dependencies.length - 1] !== 'function' && !Array.isArray(dependencies[dependencies.length - 1])) {
                options = dependencies[dependencies.length - 1] as ComputedOptions;
                deps = [computeFunctionOrDependency, ...dependencies.slice(0, -1).map(dep => typeof dep === 'function' ? dep.name : dep)] as string[];
            } else {
                deps = [computeFunctionOrDependency, ...dependencies.map(dep => typeof dep === 'function' ? dep.name : dep)] as string[];
            }
        }

        conf[propertyKey] = {
            dependencies: deps,
            computeFunction: computeFunction,
            allowUndefined: options.allowUndefined ?? false
        };
    };
}
