import type { WebComponent } from "./web-component";

export const COMPUTED_CONFIG_SYMBOL = Symbol("WebComponent.computedConfig");

type ComputedPropertyConfig = {
    dependencies: string[];
    computeFunction?: Function; // Compute function, or undefined for simple forwarding
    allowUndefined: boolean;
};

export type ComputedConfig = Record<string, ComputedPropertyConfig>;

type WebComponentConstructor = typeof WebComponent & {
    [COMPUTED_CONFIG_SYMBOL]?: ComputedConfig;
};

function ensureOwn<T extends object>(ctor: any, symbol: symbol, initial: T): T {
    if (!Object.prototype.hasOwnProperty.call(ctor, symbol)) {
        ctor[symbol] = initial;
    }
    return ctor[symbol];
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
 * @param computeFunctionOrDependency - Either a compute function (inline with `this` parameter or prototype reference), or a string property path
 * @param dependencies - One or more property names as strings, optionally followed by ComputedOptions
 *
 * @example
 * Using a prototype function reference:
 * ```typescript
 * @property({ type: String })
 * @computed(MyComponent.prototype._computeFullName, "firstName", "lastName")
 * declare readonly fullName: string;
 *
 * private _computeFullName(firstName: string, lastName: string) {
 *   return `${firstName} ${lastName}`;
 * }
 * ```
 *
 * @example
 * Using an inline function with explicit this typing:
 * ```typescript
 * @property({ type: String })
 * @computed(function(this: MyComponent, firstName: string, lastName: string) {
 *   return `${firstName} ${lastName}`;
 * }, "firstName", "lastName")
 * declare readonly fullName: string;
 * ```
 *
 * @example
 * Using a named function with explicit this typing:
 * ```typescript
 * async function computeFullNameAsync(this: MyComponent, firstName: string, lastName: string) {
 *   return new Promise(r => setTimeout(() => r(`${firstName} ${lastName}`), 100));
 * }
 *
 * @property({ type: String })
 * @computed(computeFullNameAsync, "firstName", "lastName")
 * declare readonly fullName: string;
 * ```
 *
 * @example
 * Using a string path (simple forwarding):
 * ```typescript
 * @property({ type: String })
 * @computed("user.name")
 * declare readonly userName: string;
 * ```
 *
 * @example
 * With allowUndefined option:
 * ```typescript
 * @property({ type: String })
 * @computed(function(this: MyComponent, firstName: string | undefined, lastName: string | undefined) {
 *   return `${firstName ?? ''} ${lastName ?? ''}`;
 * }, "firstName", "lastName", { allowUndefined: true })
 * declare readonly fullName: string;
 * ```
 */
export function computed<T extends WebComponent, K extends keyof T>(
    computeFunctionOrDependency: ((this: T, ...args: any[]) => T[K] | Promise<T[K]>) | ((...args: any[]) => T[K] | Promise<T[K]>) | string,
    ...dependencies: Array<string | Function | ComputedOptions>
): PropertyDecorator {
    return (target: any, propertyKey: string) => {
        const ctor = target.constructor as WebComponentConstructor;
        const conf = ensureOwn<Record<string, any>>(ctor, COMPUTED_CONFIG_SYMBOL, {});

        let computeFunction: Function | undefined;
        let deps: string[];
        let options: ComputedOptions = {};

        // Parse options from dependencies array
        let parsedDeps: Array<string | Function>;
        if (dependencies.length > 0 && typeof dependencies[dependencies.length - 1] === 'object' && !Array.isArray(dependencies[dependencies.length - 1])) {
            // Last argument is options object
            options = dependencies[dependencies.length - 1] as ComputedOptions;
            parsedDeps = dependencies.slice(0, -1) as Array<string | Function>;
        } else {
            // All arguments are dependencies
            parsedDeps = dependencies as Array<string | Function>;
        }

        // Handle the two cases for computeFunctionOrDependency
        if (typeof computeFunctionOrDependency === 'function') {
            // Store the compute function directly
            computeFunction = computeFunctionOrDependency;
            deps = parsedDeps.map(dep => typeof dep === 'function' ? dep.name : dep) as string[];
        } else {
            // First parameter is a string dependency (simple property path)
            deps = [computeFunctionOrDependency, ...parsedDeps.map(dep => typeof dep === 'function' ? dep.name : dep)] as string[];
        }

        conf[propertyKey] = {
            dependencies: deps,
            computeFunction: computeFunction,
            allowUndefined: options.allowUndefined ?? false
        };
    };
}

/**
 * Retrieves the computed configuration for a component instance.
 * @param component The WebComponent instance.
 * @returns A map of computed property names to their configuration.
 */
export function getComputedConfig(component: WebComponent): ComputedConfig {
    return (component.constructor as WebComponentConstructor)[COMPUTED_CONFIG_SYMBOL] || {};
}
