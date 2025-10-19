import { PropertyDeclaration } from "lit";
import type { WebComponent } from "./web-component";
import { PROPERTY_OBSERVERS_CONFIG_SYMBOL, PropertyObserversConfig, METHOD_OBSERVERS_CONFIG_SYMBOL, MethodObserversConfig } from "./web-component-observer-decorator";
import { COMPUTED_CONFIG_SYMBOL, ComputedConfig } from "./web-component-computed-decorator";
import { NOTIFY_CONFIG_SYMBOL, NotifyConfig } from "./web-component-notify-decorator";
import { LISTENERS_CONFIG_SYMBOL, ListenersConfig } from "./web-component-listener-decorator";
import { KEYBINDINGS_CONFIG_SYMBOL, KeybindingsConfig } from "./web-component-keybinding-decorator";

export const SENSITIVE_CONFIG_SYMBOL = Symbol("WebComponent.sensitiveConfig");

// Re-export symbols for backward compatibility
export { COMPUTED_CONFIG_SYMBOL, METHOD_OBSERVERS_CONFIG_SYMBOL, NOTIFY_CONFIG_SYMBOL, LISTENERS_CONFIG_SYMBOL, KEYBINDINGS_CONFIG_SYMBOL, PROPERTY_OBSERVERS_CONFIG_SYMBOL };

// Re-export types for backward compatibility
export type { ComputedConfig, MethodObserversConfig, NotifyConfig, ListenersConfig, KeybindingsConfig, PropertyObserversConfig };

type WebComponentConstructor = typeof WebComponent & {
    properties?: Record<string, PropertyDeclaration>;
    [COMPUTED_CONFIG_SYMBOL]?: ComputedConfig;
    [METHOD_OBSERVERS_CONFIG_SYMBOL]?: MethodObserversConfig;
    [PROPERTY_OBSERVERS_CONFIG_SYMBOL]?: PropertyObserversConfig;
    [NOTIFY_CONFIG_SYMBOL]?: NotifyConfig;
    [SENSITIVE_CONFIG_SYMBOL]?: boolean;
    [LISTENERS_CONFIG_SYMBOL]?: ListenersConfig;
    [KEYBINDINGS_CONFIG_SYMBOL]?: KeybindingsConfig;
};

// Re-export getter functions from their respective decorator files for backward compatibility
export { getListenersConfig } from "./web-component-listener-decorator";
export { getKeybindingsConfig } from "./web-component-keybinding-decorator";
export { getMethodObserversConfig } from "./web-component-observer-decorator";
export { getComputedConfig } from "./web-component-computed-decorator";
export { getNotifyConfig } from "./web-component-notify-decorator";

export function getSensitiveConfig(component: WebComponent): boolean {
    return (component.constructor as WebComponentConstructor)[SENSITIVE_CONFIG_SYMBOL];
}

export type WebComponentRegistration = { tagName: string, targetClass: typeof WebComponent };

/**
 * Registers a web component class with the specified tag name.
 * This function processes and merges decorator configurations from the component class hierarchy.
 * @param tagName The custom element tag name to register.
 * @param targetClass The web component class to register.
 * @returns The web component registration info or undefined if already registered.
 */
export function registerWebComponent<T extends typeof WebComponent>(tagName: string, targetClass: T): WebComponentRegistration | undefined {
    const parentClass = Object.getPrototypeOf(targetClass) as WebComponentConstructor;

    const inheritedComputedConfig = parentClass[COMPUTED_CONFIG_SYMBOL] || {};
    const inheritedPropertyObserversConfig = parentClass[PROPERTY_OBSERVERS_CONFIG_SYMBOL] || {};
    const inheritedMethodObserversConfig = parentClass[METHOD_OBSERVERS_CONFIG_SYMBOL] || {};
    const inheritedListenersConfig = parentClass[LISTENERS_CONFIG_SYMBOL] || {};
    const inheritedKeybindingsConfig = parentClass[KEYBINDINGS_CONFIG_SYMBOL] || {};
    const inheritedSensitive = parentClass[SENSITIVE_CONFIG_SYMBOL];

    // Process the decorated configurations from the target class.
    const decoratedComputedConfig = targetClass[COMPUTED_CONFIG_SYMBOL] || {};
    const decoratedPropertyObserversConfig = targetClass[PROPERTY_OBSERVERS_CONFIG_SYMBOL] || {};
    const decoratedMethodObserversConfig = targetClass[METHOD_OBSERVERS_CONFIG_SYMBOL] || {};
    const decoratedListenersConfig = targetClass[LISTENERS_CONFIG_SYMBOL] || {};
    const decoratedKeybindingsConfig = targetClass[KEYBINDINGS_CONFIG_SYMBOL] || {};

    // Merge new configs with inherited configs and decorator-provided configs. Child-specific config wins.
    (targetClass as WebComponentConstructor)[COMPUTED_CONFIG_SYMBOL] = { ...inheritedComputedConfig, ...decoratedComputedConfig };
    (targetClass as WebComponentConstructor)[PROPERTY_OBSERVERS_CONFIG_SYMBOL] = { ...inheritedPropertyObserversConfig, ...decoratedPropertyObserversConfig };
    (targetClass as WebComponentConstructor)[LISTENERS_CONFIG_SYMBOL] = { ...inheritedListenersConfig, ...decoratedListenersConfig };
    (targetClass as WebComponentConstructor)[KEYBINDINGS_CONFIG_SYMBOL] = { ...inheritedKeybindingsConfig, ...decoratedKeybindingsConfig };
    (targetClass as WebComponentConstructor)[METHOD_OBSERVERS_CONFIG_SYMBOL] = { ...inheritedMethodObserversConfig, ...decoratedMethodObserversConfig };
    (targetClass as WebComponentConstructor)[SENSITIVE_CONFIG_SYMBOL] = inheritedSensitive;

    // Register the custom element.
    if (!window.customElements.get(tagName))
        return { tagName, targetClass };

    console.warn(`Custom element ${tagName} is already defined.`);
    return undefined;
}
