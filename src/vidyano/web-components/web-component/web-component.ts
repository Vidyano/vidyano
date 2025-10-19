import { AppBase } from "components/app/app";
import { LitElement, PropertyValueMap } from "lit";
import { property } from "lit/decorators.js";
import { Service } from "vidyano";
import { WebComponentReactiveController } from "./web-component-reactive-controller";
import { WebComponentListenerController, getListenersConfig } from "./web-component-listener-decorator";
import { WebComponentKeybindingController, getKeybindingsConfig } from "./web-component-keybinding-decorator";
import { registerWebComponent } from "./web-component-registration";
import { WebComponentTranslationController } from "./web-component-translation-controller";
import { getComputedConfig, computed } from "./web-component-computed-decorator";
import { getObserversConfig, getPropertyObserversConfig } from "./web-component-observer-decorator";

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

// A mapped type to get the shape of the specific translations.
type Translations<T> = { [K in keyof T]: string };

/**
 * This `type` alias uses an intersection to merge the specific keys from `Translations<T>`
 * with a general `Record<string, string>` for the global keys.
 */
export type TypedTranslations<T> = Translations<T> & Record<string, string>;

/**
 * Base class for all lit-based web components in a Vidyano application.
 */
export abstract class WebComponent<TTranslations extends Record<string, any> = {}> extends LitElement {
    #app: AppBase;
    #service: Service;

    @property({ attribute: false })
    get app(): AppBase {
        return this.#app;
    }
    set app(value: AppBase) {
        const oldValue = this.#app;
        this.#app = value;
        if (value && !value.service) {
            this.#listenForService(value);
        } else if (value?.service) {
            this.service = value.service;
        }
        this.requestUpdate("app", oldValue);
    }

    @property({ attribute: false })
    get service(): Service {
        return this.#service;
    }
    set service(value: Service) {
        const oldValue = this.#service;
        this.#service = value;
        this.requestUpdate("service", oldValue);
    }

    @property({ type: Object })
    @computed("service.language.messages")
    translations: TypedTranslations<TTranslations>;

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
     * @param translations - Optional translations object that contains key-value pairs for translations.
     */
    constructor(translations?: TTranslations) {
        super();

        if (translations)
            this[TRANSLATION_CONTROLLER_SYMBOL] = new WebComponentTranslationController(this, translations);

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
            Object.keys(getObserversConfig(this)).length > 0) {
            this[REACTIVE_CONTROLLER_SYMBOL] = new WebComponentReactiveController(this);
        }
    }

    override connectedCallback() {
        if (!this.app) {
            // @ts-ignore
            if (window.app) {
                // @ts-ignore
                this.app = window.app;
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
     * Listens for the global "app-changed" event and updates the app property.
     */
    #listenForApp() {
        window.addEventListener("app-changed", this[APP_CHANGE_LISTENER_SYMBOL] = (e: CustomEvent) => {
            window.removeEventListener("app-changed", this[APP_CHANGE_LISTENER_SYMBOL]);
            this[APP_CHANGE_LISTENER_SYMBOL] = null;

            const oldApp = this.app;
            // @ts-ignore - window.app is set but not typed
            this.app = window.app;
            this.requestUpdate("app", oldApp);

            if (!this.app.service)
                this.#listenForService(this.app);
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

            const oldService = this.service;
            this.service = app.service;
            this.requestUpdate("service", oldService);
        });
    }
}

const originalDefine = customElements.define;
customElements.define = function (name, constructor, options) {
    if (window.VidyanoSettings?.skipElements?.includes(name))
        return;

    if (constructor.prototype instanceof WebComponent) {
        const registrationInfo = registerWebComponent(name, constructor as any);
        if (!registrationInfo)
            return;

        originalDefine.call(this, registrationInfo.tagName, registrationInfo.targetClass as unknown as CustomElementConstructor, options);
        return;
    }

    return originalDefine.call(this, name, constructor, options);
};
