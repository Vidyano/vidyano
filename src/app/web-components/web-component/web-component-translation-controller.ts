import { ReactiveController } from "lit";
import type { WebComponentLit } from "./web-component-lit";

// The TypedTranslations type alias remains the same, it's the correct approach.
type Translations<T> = { [K in keyof T]: string };
export type TypedTranslations<T> = Translations<T> & Record<string, string>;

/**
 * A Reactive Controller that manages component-specific translations.
 * It lazily creates a proxy on first connection and exposes it via a getter.
 */
export class WebComponentTranslationController<T extends Record<string, any>> implements ReactiveController {
    // Private fields for better encapsulation
    #host: WebComponentLit<T>;
    #componentTranslations: T;

    // This will store the proxy instance once it's created.
    #proxy: TypedTranslations<T> | null = null;

    constructor(host: WebComponentLit<T>, componentTranslations: T) {
        this.#host = host;
        this.#componentTranslations = componentTranslations;
        this.#host.addController(this);
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
        const globalMessages = this.#host.service?.language?.messages || {};

        return new Proxy(globalMessages, {
            get: (target, prop) => {
                if (typeof prop === "symbol" || String(prop).startsWith("_"))
                    return Reflect.get(target, prop);

                if (typeof prop !== "string")
                    return Reflect.get(target, prop);

                const componentTranslation = this.#componentTranslations[prop];
                if (componentTranslation) {
                    const culture = this.#host.service?.language?.culture;
                    if (culture && componentTranslation[culture] !== undefined)
                        return componentTranslation[culture];
                }

                if (prop in target)
                    return target[prop];

                if (prop === "toJSON") {
                    return () => {
                        const culture = this.#host.service?.language?.culture;
                        if (!culture)
                            return { ...target };

                        const specific = Object.keys(this.#componentTranslations).reduce((acc, key) => {
                            acc[key] = this.#componentTranslations[key][culture] || `[[${key}]]`;
                            return acc;
                        }, {});

                        return { ...target, ...specific };
                    };
                }

                console.warn(`[${this.#host.tagName.toLowerCase()}] Translation for '${prop}' not found.`);
                return `[[${prop}]]`;
            },
        }) as TypedTranslations<T>;
    }
}