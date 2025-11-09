import { ReactiveController } from "lit";
import { Observable } from "vidyano";
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

    // Observable disposer for observing the service.language.messages path
    // Wrapped to include a reference to the service it was bound to
    #messagesDisposer: ((() => void) & { service?: any }) | null = null;

    constructor(host: WebComponent<T>, componentTranslations: T) {
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
     * Lit lifecycle hook. Called when the host disconnects from the DOM.
     */
    hostDisconnected(): void {
        this.#cleanupObservers();
    }

    /**
     * Lit lifecycle hook. Called when host is about to update.
     * Re-setup observer if service property changes.
     */
    hostUpdate(): void {
        if (this.#host.service !== this.#messagesDisposer?.service && this.#messagesDisposer)
            this.#setupMessagesObserver();
    }

    /**
     * Cleans up all observers
     */
    #cleanupObservers(): void {
        if (this.#messagesDisposer) {
            this.#messagesDisposer();
            this.#messagesDisposer = null;
        }
    }

    /**
     * Sets up observer for the entire service.language.messages chain using Observable.forward
     */
    #setupMessagesObserver(): void {
        // Clean up existing observers first
        this.#cleanupObservers();

        // Use Observable.forward to observe the entire service.language.messages chain
        // This automatically handles re-establishing observers when any part of the chain changes
        const disposer = Observable.forward(this.#host, "service.language.messages", () => {
            this.#host.requestUpdate("translations");
        }) as (() => void) & { service?: any };

        // Store which service this disposer is bound to for change detection in hostUpdate
        disposer.service = this.#host.service;
        this.#messagesDisposer = disposer;
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

                // Dynamically look up client messages each time
                const clientMessages = this.#host.service?.language?.messages || {};

                // Set up observer lazily on first access to client messages
                if (!this.#messagesDisposer)
                    this.#setupMessagesObserver();

                if (prop in clientMessages)
                    return clientMessages[prop];

                if (prop === "toJSON") {
                    return () => {
                        const culture = this.#host.service?.language?.culture;
                        const clientMessages = this.#host.service?.language?.messages || {};

                        const specific = Object.keys(this.#componentTranslations).reduce((acc, key) => {
                            acc[key] = this.#componentTranslations[key][culture] || `[[${key}]]`;
                            return acc;
                        }, {});

                        return { ...clientMessages, ...specific };
                    };
                }

                console.warn(`[${this.#host.tagName.toLowerCase()}] Translation for '${prop}' not found.`);
                return `[[${prop}]]`;
            },
        }) as TypedTranslations<T>;
    }
}
