import type { WebComponent } from "./web-component";

export const KEYBINDINGS_CONFIG_SYMBOL = Symbol("WebComponent.keybindingsConfig");

export type KeybindingsConfig = Record<string, string>; // keybinding -> methodName

type WebComponentConstructor = typeof WebComponent & {
    [KEYBINDINGS_CONFIG_SYMBOL]?: KeybindingsConfig;
};

function ensureOwn<T extends object>(ctor: any, symbol: symbol, initial: T): T {
    if (!Object.prototype.hasOwnProperty.call(ctor, symbol)) {
        ctor[symbol] = initial;
    }
    return ctor[symbol];
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

/**
 * Retrieves the keybindings configuration for a component instance.
 * @param component The WebComponent instance.
 * @returns A map of keybindings to their handler method names.
 */
export function getKeybindingsConfig(component: WebComponent): KeybindingsConfig {
    return (component.constructor as WebComponentConstructor)[KEYBINDINGS_CONFIG_SYMBOL] || {};
}
