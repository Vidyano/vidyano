import { PropertyDeclaration } from "lit";
import type { WebComponent } from "./web-component";

export const COMPUTED_CONFIG_SYMBOL = Symbol("WebComponent.computedConfig");
export const OBSERVERS_CONFIG_SYMBOL = Symbol("WebComponent.observersConfig");
export const PROPERTY_OBSERVERS_CONFIG_SYMBOL = Symbol("WebComponent.propertyObserversConfig");
export const NOTIFY_CONFIG_SYMBOL = Symbol("WebComponent.notifyConfig");
export const SENSITIVE_CONFIG_SYMBOL = Symbol("WebComponent.sensitiveConfig");
export const LISTENERS_CONFIG_SYMBOL = Symbol("WebComponent.listenersConfig");
export const KEYBINDINGS_CONFIG_SYMBOL = Symbol("WebComponent.keybindingsConfig");

/**
 * Parses a method signature string of the form "methodName(arg1, arg2, ...)".
 * Returns an object with the method name and an array of argument names.
 * If the signature is invalid, returns null.
 * @param signature The method signature string to parse.
 * @returns An object with methodName and args, or null if parsing fails.
 */
export function parseMethodSignature(signature: string): { methodName: string; args: string[] } | null {
    const match = signature.match(/^([a-zA-Z0-9_]+)\((.*)\)$/);
    if (!match)
        return null;

    const [, methodName, argsString] = match;
    const args = argsString ? argsString.split(',').map(d => d.trim()).filter(Boolean) : [];

    return { methodName, args };
}

type ComputedPropertyConfig = {
    dependencies: string[];
    computeFunction?: Function; // Compute function, or undefined for simple forwarding
    allowUndefined: boolean;
};

type ObserverConfig = {
    dependencies: string[];
    allowUndefined: boolean;
};

export type ComputedConfig = Record<string, ComputedPropertyConfig>;
export type ObserversConfig = Record<string, ObserverConfig>;
export type PropertyObserversConfig = Record<string, Function>;
export type NotifyConfig = Record<string, string | true>; // true = auto-generate kebab-case-changed, string = custom event name
export type ListenersConfig = Record<string, string>;
export type KeybindingsConfig = Record<string, string>; // keybinding -> methodName

type WebComponentConstructor = typeof WebComponent & {
    properties?: Record<string, PropertyDeclaration>;
    [COMPUTED_CONFIG_SYMBOL]?: ComputedConfig;
    [OBSERVERS_CONFIG_SYMBOL]?: ObserversConfig;
    [PROPERTY_OBSERVERS_CONFIG_SYMBOL]?: PropertyObserversConfig;
    [NOTIFY_CONFIG_SYMBOL]?: NotifyConfig;
    [SENSITIVE_CONFIG_SYMBOL]?: boolean;
    [LISTENERS_CONFIG_SYMBOL]?: ListenersConfig;
    [KEYBINDINGS_CONFIG_SYMBOL]?: KeybindingsConfig;
};


export interface WebComponentRegistrationInfo {
    /**
     * The properties of the web component.
     */
    properties?: Record<string, PropertyDeclaration>;

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

export function getListenersConfig(component: WebComponent): ListenersConfig {
    return (component.constructor as WebComponentConstructor)[LISTENERS_CONFIG_SYMBOL] || {};
}

export function getKeybindingsConfig(component: WebComponent): KeybindingsConfig {
    return (component.constructor as WebComponentConstructor)[KEYBINDINGS_CONFIG_SYMBOL] || {};
}

export function getObserversConfig(component: WebComponent): ObserversConfig {
    return (component.constructor as WebComponentConstructor)[OBSERVERS_CONFIG_SYMBOL] || {};
}

export function getComputedConfig(component: WebComponent): ComputedConfig {
    return (component.constructor as WebComponentConstructor)[COMPUTED_CONFIG_SYMBOL] || {};
}

export function getPropertyObserversConfig(component: WebComponent): PropertyObserversConfig {
    return (component.constructor as WebComponentConstructor)[PROPERTY_OBSERVERS_CONFIG_SYMBOL] || {};
}

export function getNotifyConfig(component: WebComponent): NotifyConfig {
    return (component.constructor as WebComponentConstructor)[NOTIFY_CONFIG_SYMBOL] || {};
}

export function getSensitiveConfig(component: WebComponent): boolean {
    return (component.constructor as WebComponentConstructor)[SENSITIVE_CONFIG_SYMBOL];
}

export type WebComponentRegistration = { tagName: string, targetClass: typeof WebComponent };

/**
 * Registers a web component class with the specified configuration and tag name.
 * Overload: If the first parameter is a string, it is treated as the tagName and config defaults to {}.
 * @param config The registration configuration object or the tag name as a string.
 * @param tagName The custom element tag name to register (if config is provided).
 * @param targetClass The web component class to register.
 * @returns The web component class or void.
 */
export function registerWebComponent<T extends typeof WebComponent>(tagName: string, targetClass: T): WebComponentRegistration | undefined;
export function registerWebComponent<T extends typeof WebComponent>(config: WebComponentRegistrationInfo, tagName: string, targetClass: T): WebComponentRegistration | undefined;
export function registerWebComponent<T extends typeof WebComponent>(configOrTag: WebComponentRegistrationInfo | string, tagNameOrClass: string | T, maybeClass?: T): WebComponentRegistration | undefined {
    let config: WebComponentRegistrationInfo;
    let tagName: string;
    let targetClass: T;

    if (typeof configOrTag === "string") {
        // Overload: (tagName, targetClass)
        config = {};
        tagName = configOrTag;
        targetClass = tagNameOrClass as T;
    } else {
        // (config, tagName, targetClass)
        config = configOrTag;
        tagName = tagNameOrClass as string;
        targetClass = maybeClass!;
    }

    const parentClass = Object.getPrototypeOf(targetClass) as WebComponentConstructor;

    const inheritedComputedConfig = parentClass[COMPUTED_CONFIG_SYMBOL] || {};
    const inheritedPropertyObserversConfig = parentClass[PROPERTY_OBSERVERS_CONFIG_SYMBOL] || {};
    const inheritedObserversConfig = parentClass[OBSERVERS_CONFIG_SYMBOL] || {};
    const inheritedListenersConfig = parentClass[LISTENERS_CONFIG_SYMBOL] || {};
    const inheritedKeybindingsConfig = parentClass[KEYBINDINGS_CONFIG_SYMBOL] || {};
    const inheritedSensitive = parentClass[SENSITIVE_CONFIG_SYMBOL];

    // Process the decorated configurations from the target class.
    const decoratedComputedConfig = targetClass[COMPUTED_CONFIG_SYMBOL] || {};
    const decoratedPropertyObserversConfig = targetClass[PROPERTY_OBSERVERS_CONFIG_SYMBOL] || {};
    const decoratedObserversConfig = targetClass[OBSERVERS_CONFIG_SYMBOL] || {};
    const decoratedListenersConfig = targetClass[LISTENERS_CONFIG_SYMBOL] || {};
    const decoratedKeybindingsConfig = targetClass[KEYBINDINGS_CONFIG_SYMBOL] || {};

    // Merge new configs with inherited configs and decorator-provided configs. Child-specific config wins.
    (targetClass as WebComponentConstructor)[COMPUTED_CONFIG_SYMBOL] = { ...inheritedComputedConfig, ...decoratedComputedConfig };
    (targetClass as WebComponentConstructor)[PROPERTY_OBSERVERS_CONFIG_SYMBOL] = { ...inheritedPropertyObserversConfig, ...decoratedPropertyObserversConfig };
    (targetClass as WebComponentConstructor)[LISTENERS_CONFIG_SYMBOL] = { ...inheritedListenersConfig, ...decoratedListenersConfig, ...(config.listeners || {}) };
    (targetClass as WebComponentConstructor)[KEYBINDINGS_CONFIG_SYMBOL] = { ...inheritedKeybindingsConfig, ...decoratedKeybindingsConfig };

    // Merge new properties with inherited ones, overriding as necessary.
    const { properties: newProperties, ...restConfig } = config;
    if (newProperties) {
        targetClass.properties = {
            ...targetClass.properties,
            ...newProperties
        };
    }
    
    // Merge observers to combine dependencies.
    const finalObserversConfig: ObserversConfig = { ...inheritedObserversConfig, ...decoratedObserversConfig };
    if (config.observers) {
        for (const observer of config.observers) {
            const parsed = parseMethodSignature(observer);
            if (parsed) {
                const existing = finalObserversConfig[parsed.methodName];
                const existingDeps = existing?.dependencies || [];
                const existingAllowUndefined = existing?.allowUndefined || false;

                const combinedDeps = new Set([...existingDeps, ...parsed.args]);
                finalObserversConfig[parsed.methodName] = {
                    dependencies: Array.from(combinedDeps),
                    allowUndefined: existingAllowUndefined // Preserve existing allowUndefined setting
                };
            } else {
                console.warn(`[${tagName}] Invalid observer signature: ${observer}. Must be "methodName(dep1, dep2)".`);
            }
        }
    }

    (targetClass as WebComponentConstructor)[OBSERVERS_CONFIG_SYMBOL] = finalObserversConfig;

    (targetClass as WebComponentConstructor)[SENSITIVE_CONFIG_SYMBOL] = config.sensitive !== undefined ? config.sensitive : inheritedSensitive;

    // Register the custom element.
    if (!window.customElements.get(tagName))
        return { tagName, targetClass };

    console.warn(`Custom element ${tagName} is already defined.`);
    return undefined;
}
