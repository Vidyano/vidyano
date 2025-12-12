import type { AppBase } from "components/app/app";
import { LitElement, PropertyValueMap } from "lit";
import { Service, ServiceBus } from "vidyano";
import { WebComponentReactiveController } from "./web-component-reactive-controller";
import { WebComponentListenerController, getListenersConfig } from "./web-component-listener-decorator";
import { WebComponentKeybindingController, getKeybindingsConfig } from "./web-component-keybinding-decorator";
import { WebComponentTranslationController } from "./web-component-translation-controller";
import { getComputedConfig } from "./web-component-computed-decorator";
import { getMethodObserversConfig, getPropertyObserversConfig } from "./web-component-observer-decorator";
import { getNotifyConfig } from "./web-component-notify-decorator";

export { listener } from "./web-component-listener-decorator";
export { keybinding } from "./web-component-keybinding-decorator";
export { observer, type ObserverOptions } from "./web-component-observer-decorator";
export { notify } from "./web-component-notify-decorator";
export { computed, type ComputedOptions } from "./web-component-computed-decorator";

const LISTENER_CONTROLLER_SYMBOL = Symbol("WebComponent.listenerController");
const KEYBINDING_CONTROLLER_SYMBOL = Symbol("WebComponent.keybindingController");
const REACTIVE_CONTROLLER_SYMBOL = Symbol("WebComponent.reactiveController");
const TRANSLATION_CONTROLLER_SYMBOL = Symbol("WebComponent.translationController");

const APP_CHANGE_LISTENER_SYMBOL = Symbol("WebComponent.appChangeListener");
const SERVICE_CHANGE_LISTENER_SYMBOL = Symbol("WebComponent.serviceChangeListener");
const DOLLAR_PROXY_SYMBOL = Symbol("WebComponent.dollarProxy");
const IS_APP_SENSITIVE_SYMBOL = Symbol("WebComponent.isAppSensitive");
const IS_APP_SENSITIVE_SUBSCRIPTION_SYMBOL = Symbol("WebComponent.isAppSensitiveSubscription");

// A mapped type to get the shape of the specific translations.
type Translations<T> = { [K in keyof T]: string };

/**
 * This `type` alias uses an intersection to merge the specific keys from `Translations<T>`
 * with a general `Record<string, string>` for the global keys.
 */
export type TypedTranslations<T> = Translations<T> & Record<string, string>;

/**
 * Options for configuring a WebComponent instance.
 */
export interface WebComponentOptions<TTranslations extends Record<string, any>> {
    /**
     * Component-specific translations that override client messages.
     * Format: { TranslationKey: { "en": "English", "nl": "Dutch", ... } }
     */
    translations?: TTranslations;
}

/**
 * Base class for all lit-based web components in a Vidyano application.
 */
export abstract class WebComponent<TTranslations extends Record<string, any> = {}> extends LitElement {
    #app: AppBase;
    #service: Service;

    get app(): AppBase {
        return this.#app;
    }
    set app(app: AppBase) {
        const oldValue = this.#app;
        this.#app = app;

        // Check if oldValue and new value are the same to avoid unnecessary updates, but undefined vs null should not trigger an update
        if (oldValue !== app && !(oldValue == null && app == null))
            this.requestUpdate("app", oldValue);

        this.service = app?.service;
        if (!app?.service)
            this.#listenForService(app);
    }

    get service(): Service {
        return this.#service;
    }
    set service(value: Service) {
        const oldValue = this.#service;
        this.#service = value;

        // Check if oldValue and new value are the same to avoid unnecessary updates, but undefined vs null should not trigger an update
        if (oldValue !== value && !(oldValue == null && value == null))
            this.requestUpdate("service", oldValue);
    }

    get isAppSensitive(): boolean {
        if (this[IS_APP_SENSITIVE_SYMBOL] === undefined) {
            this[IS_APP_SENSITIVE_SYMBOL] = false;

            let isInitializing = true;

            this[IS_APP_SENSITIVE_SUBSCRIPTION_SYMBOL] = ServiceBus.subscribe("vi-app:sensitive-changed", (_, __, sensitive: boolean) => {
                const oldValue = this[IS_APP_SENSITIVE_SYMBOL];
                if (oldValue !== sensitive) {
                    this[IS_APP_SENSITIVE_SYMBOL] = sensitive;

                    // Only trigger requestUpdate if we're not initializing
                    if (!isInitializing)
                        this.requestUpdate("isAppSensitive", oldValue);
                }
            }, true); // receiveLast = true to get current value

            isInitializing = false;
        }

        return this[IS_APP_SENSITIVE_SYMBOL];
    }

    get translations(): TypedTranslations<TTranslations> {
        // Lazily create translation controller if it doesn't exist yet
        if (!this[TRANSLATION_CONTROLLER_SYMBOL])
            this[TRANSLATION_CONTROLLER_SYMBOL] = new WebComponentTranslationController(this, {} as TTranslations);

        return this[TRANSLATION_CONTROLLER_SYMBOL].translations;
    }

    /**
     * Override createProperty to automatically convert camelCase property names to kebab-case attribute names.
     * This provides Polymer-like behavior and improves HTML readability.
     *
     * Example: `openOnHover` property -> `open-on-hover` attribute
     */
    static override createProperty(name: PropertyKey, options?: any) {
        // Only process string property names (not symbols or numbers)
        if (typeof name === 'string') {
            // If no explicit attribute name is provided, convert camelCase to kebab-case
            if (options?.attribute === undefined || options?.attribute === true) {
                const kebabName = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
                options = {
                    ...options,
                    attribute: kebabName
                };
            }
        }

        super.createProperty(name, options);
    }

    /**
     * Creates a new instance of the WebComponent class.
     * @param options - Optional configuration options for the component.
     */
    constructor(options?: WebComponentOptions<TTranslations>) {
        super();

        // Only create translation controller if translations are provided
        if (options?.translations)
            this[TRANSLATION_CONTROLLER_SYMBOL] = new WebComponentTranslationController(this, options.translations);

        const listenerConfig = getListenersConfig(this);
        if (Object.keys(listenerConfig).length > 0) {
            this.addController(this[LISTENER_CONTROLLER_SYMBOL] = new WebComponentListenerController(this));
        }

        const keybindingConfig = getKeybindingsConfig(this);
        if (Object.keys(keybindingConfig).length > 0) {
            this.addController(this[KEYBINDING_CONTROLLER_SYMBOL] = new WebComponentKeybindingController(this));
        }

        if (Object.keys(getComputedConfig(this)).length > 0 ||
            Object.keys(getPropertyObserversConfig(this)).length > 0 ||
            Object.keys(getMethodObserversConfig(this)).length > 0 ||
            Object.keys(getNotifyConfig(this)).length > 0) {
            this[REACTIVE_CONTROLLER_SYMBOL] = new WebComponentReactiveController(this);
        }
    }

    override connectedCallback() {
        if (!this.app) {
            if (Symbol.for("Vidyano.App") in window) {
                this.app = window[Symbol.for("Vidyano.App")];
            } else {
                this.#listenForApp();
            }
        }

        if (this.app && !this.app.service)
            this.#listenForService(this.app);

        super.connectedCallback();
    }

    override disconnectedCallback() {
        super.disconnectedCallback();

        if (this[APP_CHANGE_LISTENER_SYMBOL]) {
            window.removeEventListener("app-changed", this[APP_CHANGE_LISTENER_SYMBOL]);
            this[APP_CHANGE_LISTENER_SYMBOL] = null;
        }

        if (this[SERVICE_CHANGE_LISTENER_SYMBOL]) {
            this.app.removeEventListener("service-changed", this[SERVICE_CHANGE_LISTENER_SYMBOL]);
            this[SERVICE_CHANGE_LISTENER_SYMBOL] = null;
        }

        if (this[IS_APP_SENSITIVE_SUBSCRIPTION_SYMBOL]) {
            this[IS_APP_SENSITIVE_SUBSCRIPTION_SYMBOL]();
            this[IS_APP_SENSITIVE_SUBSCRIPTION_SYMBOL] = null;
        }
    }


    /**
     * Provides convenient $ accessor for shadow DOM elements by ID.
     * Usage: this.$.elementId returns the element with id="elementId" in the shadow DOM.
     */
    get $(): Record<string, HTMLElement> {
        if (!this[DOLLAR_PROXY_SYMBOL]) {
            this[DOLLAR_PROXY_SYMBOL] = new Proxy({}, {
                get: (_target, prop: string) => {
                    if (typeof prop !== 'string') return undefined;
                    return this.shadowRoot?.getElementById(prop) as HTMLElement;
                }
            });
        }
        return this[DOLLAR_PROXY_SYMBOL];
    }

    override willUpdate(changedProperties: PropertyValueMap<any>) {
        // The ObserverController handles computed properties, observers, and side-effects,
        // returning the complete set of properties that have changed.
        const totalChangedProps = this[REACTIVE_CONTROLLER_SYMBOL]?.onWillUpdate(changedProperties) ?? changedProperties;

        // Finally, call super.willUpdate with the complete set of changes.
        super.willUpdate(totalChangedProps);
    }

    /**
     * A shallow comparer for arrays. It checks if two arrays have the same length
     * and if all their elements are strictly equal (===).
     * @param a The first array.
     * @param b The second array.
     * @returns True if the arrays are shallowly equal, false otherwise.
     */
    #shallowComparer(a: any, b: any): boolean {
        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length) return false;

            for (let i = 0; i < a.length; i++) {
                if (a[i] !== b[i]) return false;
            }

            return true;
        }

        return false;
    }

    /**
     * Finds a parent element in the DOM tree that matches a given condition.
     * Traverses up through both regular DOM and shadow DOM boundaries.
     *
     * @param condition A predicate function to test each parent element.
     * @param options Optional configuration for the search.
     * @param options.parent Optional starting point for the search. Defaults to this element's parent.
     * @param options.followSlots If true, follows assignedSlot to search within shadow DOM when elements are slotted.
     * @returns The first parent element that matches the condition, or null if none found.
     */
    protected findParent<T extends HTMLElement>(condition: (element: Node) => boolean = e => !!e, options?: { parent?: Node; followSlots?: boolean }): T | null {
        let parent = options?.parent;

        if (!parent) {
            parent = this.parentElement ||
                     (this.parentNode instanceof ShadowRoot ? (this.parentNode as ShadowRoot).host : null);
        }

        while (!!parent && !condition(parent)) {
            if (options?.followSlots && parent instanceof HTMLElement && parent.assignedSlot) {
                const slotResult = this.findParent<T>(condition, { parent: (parent as any).assignedSlot, followSlots: options.followSlots });
                if (slotResult) {
                    return slotResult;
                }
            }

            parent = parent.parentElement ||
                     (parent.parentNode instanceof ShadowRoot ? (parent.parentNode as ShadowRoot).host : null);
        }

        return parent as T;
    }

    /**
     * Memoizes a value by comparing it to the previous value, preventing unnecessary
     * updates for computed properties that return new array or object instances.
     *
     * This method should be used in computed property functions. It compares the
     * newly computed value with the previously stored value. If they are the same
     * (based on the comparer), it returns the old instance, preventing Lit
     * from detecting a change and re-rendering.
     *
     * @param oldValue The previous value of the property.
     * @param newValue The newly computed value.
     * @param comparer An optional function to compare the old and new values. Defaults to a shallow array comparer.
     * @returns The `newValue` if it's different from the `oldValue`, otherwise the `oldValue`.
     */
    protected memoize<T>(oldValue: T, newValue: T, comparer: (a: T, b: T) => boolean = this.#shallowComparer): T {
        // If the old and new values are strictly equal, return the old value immediately.
        if (oldValue === newValue)
            return oldValue;

        const oldValueIsUndefined = oldValue === undefined;
        const newValueIsUndefined = newValue === undefined;

        // If one value is undefined and the other is not, return newValue immediately.
        if (oldValueIsUndefined !== newValueIsUndefined)
            return newValue;

        // If both are undefined, or both are defined, proceed with the comparer.
        if (comparer(oldValue, newValue)) {
            return oldValue;
        }

        return newValue;
    }

    /**
     * Translates a message key using the service's language system with optional string formatting.
     * This method retrieves the translation for the given key and applies String.format with any provided parameters.
     *
     * @param key The translation key to look up.
     * @param params Optional parameters for string formatting (e.g., {0}, {1} placeholders).
     * @returns The translated and formatted string, or the key itself if translation is not available.
     */
    protected translateMessage(key: string, ...params: string[]): string {
        if (!key || !this.service)
            return key;

        return this.service.getTranslatedMessage.apply(this.service, [key].concat(params));
    }

    /**
     * Returns a promise that resolves after the specified number of milliseconds.
     * @param milliseconds The number of milliseconds to wait.
     * @returns A promise that resolves after the delay.
     */
    protected sleep(milliseconds: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, milliseconds));
    }

    /**
     * Listens for the global "app-changed" event and updates the app property.
     */
    #listenForApp() {
        window.addEventListener("app-changed", this[APP_CHANGE_LISTENER_SYMBOL] = (e: CustomEvent) => {
            window.removeEventListener("app-changed", this[APP_CHANGE_LISTENER_SYMBOL]);
            this[APP_CHANGE_LISTENER_SYMBOL] = null;

            if (Symbol.for("Vidyano.App") in window)
                this.app = window[Symbol.for("Vidyano.App")];
        });
    }

    /**
     * Listens for the "service-changed" event on the given app and updates the service property.
     * @param app The AppBase instance to listen on.
     */
    #listenForService(app: AppBase) {
        app.addEventListener("service-changed", this[SERVICE_CHANGE_LISTENER_SYMBOL] = (e: CustomEvent) => {
            app.removeEventListener("service-changed", this[SERVICE_CHANGE_LISTENER_SYMBOL]);
            this[SERVICE_CHANGE_LISTENER_SYMBOL] = null;

            this.service = app.service;
        });
    }
}
