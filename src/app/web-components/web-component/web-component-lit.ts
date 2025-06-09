import { AppBase } from "components/app/app";
import { LitElement, PropertyValueMap } from "lit";
import { Service } from "vidyano";
import { WebComponentObserverController } from "./web-component-observer-controller";
import { ListenerController } from "./listener-controller";
import type { WebComponentRegistrationInfo } from "./web-component-registration";
import { registerWebComponent } from "./web-component-registration";

const LISTENER_CONTROLLER_SYMBOL = Symbol("WebComponent.listenerController");
const OBSERVER_CONTROLLER_SYMBOL = Symbol("WebComponent.observerController");

/**
 * Base class for all lit-based web components in a Vidyano application.
 */
export abstract class WebComponentLit extends LitElement {
    static properties = {
        app: { type: Object, noAccessor: true },
        service: { type: Object, noAccessor: true },
        translations: { type: Object, computed: "service.language.messages" },
    };

    constructor() {
        super();

        this[LISTENER_CONTROLLER_SYMBOL] = new ListenerController(this);
        this[OBSERVER_CONTROLLER_SYMBOL] = new WebComponentObserverController(this);
    }

    override connectedCallback() {
        if (!this.app)
            this.#listenForApp();
        else if (!this.app.service)
            this.#listenForService(this.app);

        super.connectedCallback();
    }

    override disconnectedCallback() {
        super.disconnectedCallback();

        const appChangeListener = Symbol.for("WebComponent.appChangeListener");
        if (this[appChangeListener]) {
            window.removeEventListener("app-changed", this[appChangeListener]);
            this[appChangeListener] = null;
        }

        const serviceChangeListener = Symbol.for("WebComponent.serviceChangeListener");
        if (this[serviceChangeListener]) {
            this.app.removeEventListener("service-changed", this[serviceChangeListener]);
            this[serviceChangeListener] = null;
        }
    }

    /**
     * Gets the global app instance.
     */
    get app(): AppBase {
        return window.app;
    }

    /**
     * Gets the Vidyano service instance associated with the app.
     */
    get service(): Service {
        return this.app?.service;
    }

    /**
     * Gets the translations from the service's client-side language messages.
     */
    get translations(): Record<string, string> {
        return this.service?.language?.messages || {};
    }

    override willUpdate(changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>) {
        // The ObserverController handles computed properties, observers, and side-effects,
        // returning the complete set of properties that have changed.
        const totalChangedProps = this[OBSERVER_CONTROLLER_SYMBOL].onWillUpdate(changedProperties);

        // Finally, call super.willUpdate with the complete set of changes.
        super.willUpdate(totalChangedProps);
    }

    /**
     * Listens for the global "app-changed" event and updates the app property.
     */
    #listenForApp() {
        const appChangeListener = Symbol.for("WebComponent.appChangeListener");
        window.addEventListener("app-changed", this[appChangeListener] = (e: CustomEvent) => {
            window.removeEventListener("app-changed", this[appChangeListener]);
            this[appChangeListener] = null;

            this.requestUpdate("app", window.app);

            if (!this.app.service)
                this.#listenForService(this.app);
        });
    }

    /**
     * Listens for the "service-changed" event on the given app and updates the service property.
     * @param app The AppBase instance to listen on.
     */
    #listenForService(app: AppBase) {
        const serviceChangeListener = Symbol.for("WebComponent.serviceChangeListener");
        app.addEventListener("service-changed", this[serviceChangeListener] = (e: CustomEvent) => {
            // No direct update to 'this.service', willUpdate handles computed 'service'
            this.requestUpdate();
        });
    }

    /**
     * Registers a web component class with the specified configuration and tag name.
     * @param config The registration configuration object.
     * @param tagName The custom element tag name to register.
     * @returns A decorator function for the web component class.
     */
    static register(config: WebComponentRegistrationInfo, tagName: string) {
        return function <T extends typeof WebComponentLit>(targetClass: T): T | void {
            return registerWebComponent(config, tagName, targetClass);
        };
    }
}