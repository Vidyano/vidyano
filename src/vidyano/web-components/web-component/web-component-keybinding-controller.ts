import { ReactiveController } from "lit";
import type { WebComponent } from "./web-component";
import { getKeybindingsConfig, KeybindingsConfig } from "./web-component-registration";

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
        this.host.addEventListener("keydown", this.boundHandler);
    }

    hostDisconnected(): void {
        if (this.boundHandler) {
            this.host.removeEventListener("keydown", this.boundHandler);
            this.boundHandler = null;
        }
    }

    private handleKeydown(e: Event): void {
        const keyEvent = e as KeyboardEvent;
        const combo = this.buildComboString(keyEvent);

        for (const [keybinding, methodName] of Object.entries(this.keybindings)) {
            if (this.matchesKeybinding(combo, keybinding)) {
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
        const parts: string[] = [];
        if (e.ctrlKey) parts.push("ctrl");
        if (e.altKey) parts.push("alt");
        if (e.shiftKey) parts.push("shift");
        if (e.metaKey) parts.push("meta");

        const key = e.key.toLowerCase();
        // Don't add modifier keys twice
        if (!["control", "alt", "shift", "meta"].includes(key)) {
            parts.push(key);
        }

        return parts.join("+");
    }

    private matchesKeybinding(combo: string, keybinding: string): boolean {
        const normalized = keybinding.toLowerCase().replace(/\s+/g, "");
        return combo === normalized;
    }
}
