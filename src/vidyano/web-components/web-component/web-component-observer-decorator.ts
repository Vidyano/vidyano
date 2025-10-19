import type { WebComponent } from "./web-component";

export const OBSERVERS_CONFIG_SYMBOL = Symbol("WebComponent.observersConfig");

type ObserverConfig = {
    dependencies: string[];
    allowUndefined: boolean;
};

export type ObserversConfig = Record<string, ObserverConfig>;

type WebComponentConstructor = typeof WebComponent & {
    [OBSERVERS_CONFIG_SYMBOL]?: ObserversConfig;
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
 * Retrieves the observers configuration for a component instance.
 * @param component The WebComponent instance.
 * @returns A map of observer method names to their configuration.
 */
export function getObserversConfig(component: WebComponent): ObserversConfig {
    return (component.constructor as WebComponentConstructor)[OBSERVERS_CONFIG_SYMBOL] || {};
}
