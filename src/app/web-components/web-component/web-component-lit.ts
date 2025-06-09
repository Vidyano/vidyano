import { AppBase } from "components/app/app";
import { LitElement, PropertyValueMap } from "lit";
import { Service } from "vidyano";
import { WebComponentObserverController } from "./web-component-observer-controller";
import { WebComponentListenerController } from "./web-component-listener-controller";
import { WebComponentRegistrationInfo } from "./web-component-registration";
import { registerWebComponent, getListenersConfig, getComputedConfig, getPropertyObserversConfig, getObserversConfig } from "./web-component-registration";

const LISTENER_CONTROLLER_SYMBOL = Symbol("WebComponent.listenerController");
const OBSERVER_CONTROLLER_SYMBOL = Symbol("WebComponent.observerController");

const APP_CHANGE_LISTENER_SYMBOL = Symbol("WebComponent.appChangeListener");
const SERVICE_CHANGE_LISTENER_SYMBOL = Symbol("WebComponent.serviceChangeListener");

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

        const listenerConfig = getListenersConfig(this);
        if (Object.keys(listenerConfig).length > 0) {
            this.addController(this[LISTENER_CONTROLLER_SYMBOL] = new WebComponentListenerController(this));
        }

        if (Object.keys(getComputedConfig(this)).length > 0 ||
            Object.keys(getPropertyObserversConfig(this)).length > 0 ||
            Object.keys(getObserversConfig(this)).length > 0) {
            this[OBSERVER_CONTROLLER_SYMBOL] = new WebComponentObserverController(this);
        }
    }

    override connectedCallback() {
        if (!this.app) {
            this.#listenForApp();
        }
        else if (!this.app.service)
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

    override willUpdate(changedProperties: PropertyValueMap<any>) {
        // The ObserverController handles computed properties, observers, and side-effects,
        // returning the complete set of properties that have changed.
        const totalChangedProps = this[OBSERVER_CONTROLLER_SYMBOL]?.onWillUpdate(changedProperties) ?? changedProperties;

        // Finally, call super.willUpdate with the complete set of changes.
        super.willUpdate(totalChangedProps);
    }

    /**
     * Listens for the global "app-changed" event and updates the app property.
     */
    #listenForApp() {
        window.addEventListener("app-changed", this[APP_CHANGE_LISTENER_SYMBOL] = (e: CustomEvent) => {
            window.removeEventListener("app-changed", this[APP_CHANGE_LISTENER_SYMBOL]);
            this[APP_CHANGE_LISTENER_SYMBOL] = null;

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
        app.addEventListener("service-changed", this[SERVICE_CHANGE_LISTENER_SYMBOL] = (e: CustomEvent) => {
            app.removeEventListener("service-changed", this[SERVICE_CHANGE_LISTENER_SYMBOL]);
            this[SERVICE_CHANGE_LISTENER_SYMBOL] = null;

            this.requestUpdate("service", app.service);
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