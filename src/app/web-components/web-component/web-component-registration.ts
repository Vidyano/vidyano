import { PropertyDeclaration } from "lit";
import type { WebComponentLit } from "./web-component-lit";

const COMPUTED_CONFIG_SYMBOL = Symbol.for("WebComponent.computedConfig");
const OBSERVERS_CONFIG_SYMBOL = Symbol.for("WebComponent.observersConfig");
const PROPERTY_OBSERVERS_CONFIG_SYMBOL = Symbol.for("WebComponent.propertyObserversConfig");
const SENSITIVE_CONFIG_SYMBOL = Symbol.for("WebComponent.sensitiveConfig");
const LISTENERS_CONFIG_SYMBOL = Symbol.for("WebComponent.listenersConfig");

/**
 * Parses a method signature string of the form "methodName(arg1, arg2, ...)".
 * Returns an object with the method name and an array of argument names.
 * If the signature is invalid, returns null.
 * @param signature The method signature string to parse.
 * @returns An object with methodName and args, or null if parsing fails.
 */
function parseMethodSignature(signature: string): { methodName: string; args: string[] } | null {
    const match = signature.match(/^([a-zA-Z0-9_]+)\((.*)\)$/);
    if (!match)
        return null;

    const [, methodName, argsString] = match;
    const args = argsString ? argsString.split(',').map(d => d.trim()).filter(Boolean) : [];

    return { methodName, args };
}

type ComputedPropertyConfig = {
    dependencies: string[];
    methodName?: string; // When undefined, the value is forwarded from the first dependency
};

type ComputedConfig = Record<string, ComputedPropertyConfig>;

type ObserversConfig = Record<string, string[]>;

type PropertyObserversConfig = Record<string, string>;

type ListenersConfig = Record<string, string>;

type WebComponentConstructor = typeof WebComponentLit & {
    properties?: Record<string, WebComponentProperty>;
    [COMPUTED_CONFIG_SYMBOL]?: ComputedConfig;
    [OBSERVERS_CONFIG_SYMBOL]?: ObserversConfig;
    [PROPERTY_OBSERVERS_CONFIG_SYMBOL]?: PropertyObserversConfig;
    [SENSITIVE_CONFIG_SYMBOL]?: boolean;
    [LISTENERS_CONFIG_SYMBOL]?: ListenersConfig;
};

export interface WebComponentProperty<T = unknown> extends PropertyDeclaration<T> {
    /**
     *  Computed properties can be either:
     *  - A path string (e.g., "user.firstName") to observe property changes,
     *  - Or a function signature (e.g., "myObserver(user.firstName, user.lastName)") to call a method when dependencies change.
     */
    computed?: string;

    /**
     * Observer method to call when the property changes.
     * The method should accept two parameters: the new value and the old value.
     */
    observer?: string;
}

export interface WebComponentRegistrationInfo {
    /**
     * The properties of the web component.
     */
    properties?: Record<string, WebComponentProperty>;

    /**
     * An array of observer strings to forward changes to.
     * Each string can be a method signature (e.g., "myObserver(user.firstName, user.lastName)") or a simple path (e.g., "user.firstName").
     * In case of a simple path, the requestUpdate will be called with the path as the first argument.
     */
    observers?: string[];

    /**
     * A map of event names to handler method names.
     * The handler methods should be defined in the web component class.
     */
    listeners?: { [eventName: string]: string };

    sensitive?: boolean;
}

export function getListenersConfig(component: WebComponentLit): ListenersConfig {
    return (component.constructor as WebComponentConstructor)[LISTENERS_CONFIG_SYMBOL] || {};
}

export function getObserversConfig(component: WebComponentLit): ObserversConfig {
    return (component.constructor as WebComponentConstructor)[OBSERVERS_CONFIG_SYMBOL] || {};
}

export function getComputedConfig(component: WebComponentLit): ComputedConfig {
    return (component.constructor as WebComponentConstructor)[COMPUTED_CONFIG_SYMBOL] || {};
}

export function getPropertyObserversConfig(component: WebComponentLit): PropertyObserversConfig {
    return (component.constructor as WebComponentConstructor)[PROPERTY_OBSERVERS_CONFIG_SYMBOL] || {};
}

export function getSensitiveConfig(component: WebComponentLit): boolean {
    return (component.constructor as WebComponentConstructor)[SENSITIVE_CONFIG_SYMBOL];
}

/**
 * Registers a web component class with the specified configuration and tag name.
 * @param config The registration configuration object.
 * @param tagName The custom element tag name to register.
 * @param targetClass The web component class to register.
 * @returns The web component class or void.
 */
export function registerWebComponent<T extends typeof WebComponentLit>(config: WebComponentRegistrationInfo, tagName: string, targetClass: T): T | void {
    if (config.properties) {
        const computedConfig: ComputedConfig = {};
        const propertyObserversConfig: PropertyObserversConfig = {};

        for (const [name, propConfig] of Object.entries(config.properties)) {
            if (propConfig.computed) {
                const parsed = parseMethodSignature(propConfig.computed);
                if (parsed) {
                    computedConfig[name] = {
                        dependencies: parsed.args,
                        methodName: parsed.methodName
                    };
                } else {
                    // Simple path forwarding
                    computedConfig[name] = {
                        dependencies: [propConfig.computed]
                    };
                }
            }

            if (propConfig.observer) {
                propertyObserversConfig[name] = propConfig.observer;
            }
        }

        if (Object.keys(computedConfig).length > 0)
            (targetClass as WebComponentConstructor)[COMPUTED_CONFIG_SYMBOL] = computedConfig;

        if (Object.keys(propertyObserversConfig).length > 0)
            (targetClass as WebComponentConstructor)[PROPERTY_OBSERVERS_CONFIG_SYMBOL] = propertyObserversConfig;

        // Merge with existing static properties, Lit @property decorator defines this
        targetClass.properties = {
            ...targetClass.properties,
            ...config.properties
        };
    }

    if (config.observers) {
        const observersConfig: ObserversConfig = {};
        for (const observer of config.observers) {
            const parsed = parseMethodSignature(observer);
            if (parsed)
                observersConfig[parsed.methodName] = parsed.args;
            else
                console.warn(`Invalid observer signature: ${observer}. It should be like "methodName(dep1, dep2)".`);
        }

        if (Object.keys(observersConfig).length > 0)
            (targetClass as WebComponentConstructor)[OBSERVERS_CONFIG_SYMBOL] = observersConfig;
    }

    if (config.listeners)
        (targetClass as WebComponentConstructor)[LISTENERS_CONFIG_SYMBOL] = config.listeners;

    if (config.sensitive !== undefined)
        (targetClass as WebComponentConstructor)[SENSITIVE_CONFIG_SYMBOL] = config.sensitive;

    // Lit's customElement decorator will define the custom element
    // This is typically done by @customElement(tagName) on the class
    // Ensure this function is called in a context where that decorator can work,
    // or call customElements.define(tagName, targetClass) directly if needed.
    if (window.customElements.get(tagName))
        console.warn(`Custom element ${tagName} is already defined.`);
    else
        window.customElements.define(tagName, targetClass as unknown as CustomElementConstructor);

    return targetClass;
}