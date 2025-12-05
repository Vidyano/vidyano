import { PropertyDeclaration } from "lit";
import { WebComponent } from "./web-component";
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
 * Collects decorator configs from the entire prototype chain.
 * @param targetClass The class to start from.
 * @param symbol The config symbol to collect.
 * @returns Merged configs from all ancestors.
 */
function collectInheritedConfig<T extends object>(targetClass: WebComponentConstructor, symbol: symbol): T {
    const configs: T[] = [];
    let currentClass = Object.getPrototypeOf(targetClass) as WebComponentConstructor;

    // Walk up the prototype chain until we hit WebComponent or null
    while (currentClass && currentClass !== WebComponent && currentClass.prototype instanceof WebComponent) {
        // Check if this class has its own config (not inherited from its parent)
        if (Object.hasOwn(currentClass, symbol)) {
            configs.push(currentClass[symbol] as T);
        }
        currentClass = Object.getPrototypeOf(currentClass) as WebComponentConstructor;
    }

    // Merge configs from most distant ancestor to closest parent
    // This ensures child configs override parent configs
    return configs.reverse().reduce((merged, config) => ({ ...merged, ...config }), {} as T);
}

/**
 * Registers a web component class with the specified tag name.
 * This function processes and merges decorator configurations from the component class hierarchy.
 * @param tagName The custom element tag name to register.
 * @param targetClass The web component class to register.
 * @returns The web component registration info or undefined if already registered.
 */
export function registerWebComponent<T extends typeof WebComponent>(tagName: string, targetClass: T): WebComponentRegistration | undefined {
    const parentClass = Object.getPrototypeOf(targetClass) as WebComponentConstructor;

    const inheritedComputedConfig = collectInheritedConfig<ComputedConfig>(targetClass as WebComponentConstructor, COMPUTED_CONFIG_SYMBOL);
    const inheritedPropertyObserversConfig = collectInheritedConfig<PropertyObserversConfig>(targetClass as WebComponentConstructor, PROPERTY_OBSERVERS_CONFIG_SYMBOL);
    const inheritedMethodObserversConfig = collectInheritedConfig<MethodObserversConfig>(targetClass as WebComponentConstructor, METHOD_OBSERVERS_CONFIG_SYMBOL);
    const inheritedListenersConfig = collectInheritedConfig<ListenersConfig>(targetClass as WebComponentConstructor, LISTENERS_CONFIG_SYMBOL);
    const inheritedKeybindingsConfig = collectInheritedConfig<KeybindingsConfig>(targetClass as WebComponentConstructor, KEYBINDINGS_CONFIG_SYMBOL);
    const inheritedSensitive = parentClass[SENSITIVE_CONFIG_SYMBOL];

    // Check hasOwnProperty to avoid false conflict warnings from prototype chain inheritance
    const decoratedComputedConfig = targetClass.hasOwnProperty(COMPUTED_CONFIG_SYMBOL) ? targetClass[COMPUTED_CONFIG_SYMBOL] : {};
    const decoratedPropertyObserversConfig = targetClass.hasOwnProperty(PROPERTY_OBSERVERS_CONFIG_SYMBOL) ? targetClass[PROPERTY_OBSERVERS_CONFIG_SYMBOL] : {};
    const decoratedMethodObserversConfig = targetClass.hasOwnProperty(METHOD_OBSERVERS_CONFIG_SYMBOL) ? targetClass[METHOD_OBSERVERS_CONFIG_SYMBOL] : {};
    const decoratedListenersConfig = targetClass.hasOwnProperty(LISTENERS_CONFIG_SYMBOL) ? targetClass[LISTENERS_CONFIG_SYMBOL] : {};
    const decoratedKeybindingsConfig = targetClass.hasOwnProperty(KEYBINDINGS_CONFIG_SYMBOL) ? targetClass[KEYBINDINGS_CONFIG_SYMBOL] : {};

    // Detect duplicate computed properties (derived class redefining same property as parent)
    const duplicateComputedProps = Object.keys(inheritedComputedConfig).filter(key => key in decoratedComputedConfig);
    if (duplicateComputedProps.length > 0)
        console.error(`[${tagName}] Computed property conflict: derived class overrides parent computed properties: ${duplicateComputedProps.join(', ')}. Only derived class computed property will be used.`);

    // Detect duplicate property observers (derived class redefining same property as parent)
    const duplicatePropertyObservers = Object.keys(inheritedPropertyObserversConfig).filter(key => key in decoratedPropertyObserversConfig);
    if (duplicatePropertyObservers.length > 0)
        console.error(`[${tagName}] Property observer conflict: derived class overrides parent observer for properties: ${duplicatePropertyObservers.join(', ')}. Only derived class observer will run.`);

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
