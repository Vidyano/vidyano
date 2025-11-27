import { ReactiveController } from "lit";
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

/**
 * A Reactive Controller that manages keyboard shortcut bindings
 * based on a declarative configuration.
 */
export class WebComponentKeybindingController implements ReactiveController {
    private host: WebComponent;
    private keybindings: KeybindingsConfig;
    private boundHandler: EventListener | null = null;

    constructor(host: WebComponent) {
        this.host = host;
        this.keybindings = getKeybindingsConfig(host);
        this.host.addController(this);
    }

    hostConnected(): void {
        if (Object.keys(this.keybindings).length === 0) return;

        this.boundHandler = this.handleKeydown.bind(this);
        // Listen at document level in capture phase to catch before browser defaults
        document.addEventListener("keydown", this.boundHandler, true);
    }

    hostDisconnected(): void {
        if (this.boundHandler) {
            document.removeEventListener("keydown", this.boundHandler, true);
            this.boundHandler = null;
        }
    }

    private handleKeydown(e: Event): void {
        const keyEvent = e as KeyboardEvent;
        const combo = this.buildComboString(keyEvent);

        // Skip if it's just a modifier key
        if (!combo) return;

        // Skip text-editing keys when focus is in an editable element
        if (this.isEditableElement(keyEvent) && this.isTextEditingKey(keyEvent))
            return;

        for (const [keybinding, methodName] of Object.entries(this.keybindings)) {
            if (this.matchesKeybinding(combo, keybinding)) {
                // Prevent default and stop propagation immediately when matched
                keyEvent.preventDefault();
                keyEvent.stopPropagation();

                const handler = this.host[methodName];
                if (typeof handler === "function") {
                    handler.call(this.host, keyEvent);
                } else {
                    console.warn(`[${this.host.tagName.toLowerCase()}] Keybinding method '${methodName}' for '${keybinding}' not found.`);
                }
            }
        }
    }

    private buildComboString(e: KeyboardEvent): string {
        const key = e.key.toLowerCase();

        // Skip if it's just a modifier key by itself
        if (["control", "alt", "shift", "meta"].includes(key)) {
            return "";
        }

        const parts: string[] = [];
        if (e.ctrlKey) parts.push("ctrl");
        if (e.altKey) parts.push("alt");
        if (e.shiftKey) parts.push("shift");
        if (e.metaKey) parts.push("meta");

        parts.push(key);

        return parts.join("+");
    }

    private matchesKeybinding(combo: string, keybinding: string): boolean {
        const normalized = keybinding.toLowerCase().replace(/\s+/g, "");
        return combo === normalized;
    }

    private isEditableElement(e: KeyboardEvent): boolean {
        const target = e.composedPath()[0] as Element;
        if (!target)
            return false;

        const tagName = target.tagName?.toLowerCase();
        if (tagName === "input" || tagName === "textarea")
            return true;

        if (target instanceof HTMLElement && target.isContentEditable)
            return true;

        return false;
    }

    private isTextEditingKey(e: KeyboardEvent): boolean {
        // Only consider it a text-editing key if no modifier keys are pressed
        // (except Shift, which is commonly used with text editing)
        if (e.ctrlKey || e.altKey || e.metaKey)
            return false;

        const key = e.key.toLowerCase();
        const textEditingKeys = ["delete", "insert", "backspace"];
        return textEditingKeys.includes(key);
    }
}
