import { ReactiveController } from "lit";
import type { WebComponent } from "./web-component";

// The TypedTranslations type alias remains the same, it's the correct approach.
type Translations<T> = { [K in keyof T]: string };
export type TypedTranslations<T> = Translations<T> & Record<string, string>;

/**
 * A Reactive Controller that manages component-specific translations.
 * It lazily creates a proxy on first connection and exposes it via a getter.
 */
export class WebComponentTranslationController<T extends Record<string, any>> implements ReactiveController {
    // Private fields for better encapsulation
    #host: WebComponent<T>;
    #componentTranslations: T;

    // This will store the proxy instance once it's created.
    #proxy: TypedTranslations<T> | null = null;

    // Cached client messages passed from the parent component
    #clientMessages: Record<string, string> = {};

    constructor(host: WebComponent<T>, componentTranslations: T) {
        this.#host = host;
        this.#componentTranslations = componentTranslations;
        this.#host.addController(this);
    }

    /**
     * Updates the cached client messages.
     * Called from the parent component when messages change.
     */
    updateMessages(messages: Record<string, string>): void {
        this.#clientMessages = messages || {};
    }

    /**
     * Public getter for the translations proxy.
     * It ensures the proxy is created if it hasn't been already.
     */
    public get translations(): TypedTranslations<T> {
        return this.#proxy;
    }

    /**
     * Lit lifecycle hook. Called when the host connects to the DOM.
     * We use this to create the proxy, ensuring it only happens once.
     */
    hostConnected(): void {
        // The check `!this.#proxy` ensures we only create the proxy
        // on the very first connection, not on subsequent re-connections.
        if (!this.#proxy)
            this.#proxy = this.#createProxy();
    }

    /**
     * Creates the actual proxy object. This is now a private implementation detail.
     */
    #createProxy(): TypedTranslations<T> {
        return new Proxy({}, {
            get: (_target, prop) => {
                if (typeof prop === "symbol" || String(prop).startsWith("_"))
                    return undefined;

                if (typeof prop !== "string")
                    return undefined;

                const componentTranslation = this.#componentTranslations[prop];
                if (componentTranslation) {
                    const culture = this.#host.service?.language?.culture;
                    if (culture && componentTranslation[culture] !== undefined)
                        return componentTranslation[culture];
                }

                // Use cached client messages
                if (prop in this.#clientMessages)
                    return this.#clientMessages[prop];

                if (prop === "toJSON") {
                    return () => {
                        const culture = this.#host.service?.language?.culture;

                        const specific = Object.keys(this.#componentTranslations).reduce((acc, key) => {
                            acc[key] = this.#componentTranslations[key][culture] || `[[${key}]]`;
                            return acc;
                        }, {});

                        return { ...this.#clientMessages, ...specific };
                    };
                }

                console.warn(`[${this.#host.tagName.toLowerCase()}] Translation for '${prop}' not found.`);
                return `[[${prop}]]`;
            },
        }) as TypedTranslations<T>;
    }
}
