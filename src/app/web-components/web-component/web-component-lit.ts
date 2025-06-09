import { AppBase } from "components/app/app";
import { html, LitElement, PropertyValueMap } from "lit";
import { Observable, ForwardObservedPropertyChangedArgs, ForwardObservedArrayChangedArgs, Service } from "vidyano";

type ForwardObservedDetail = ForwardObservedPropertyChangedArgs | ForwardObservedArrayChangedArgs;

export interface WebComponentProperty {
    /**
     * The type of the property.
     * Can be one of the following constructors: Object, String, Boolean, Date, Number, Array.
     * This is used by LitElement to determine how to handle the property.
     */
    type: ObjectConstructor | StringConstructor | BooleanConstructor | DateConstructor | NumberConstructor | ArrayConstructor;

    /**
     * Indicates if the property should be reflected to the HTML attribute.
     * If true, changes to the property will update the corresponding attribute on the element.
     */
    reflectToAttribute?: boolean;

    /**
     * Indicates if the property is read-only.
     * If true, the property cannot be set directly and is typically computed or derived.
     */
    readOnly?: boolean

    /**
     *  Computed properties can be either:
     *  - A path string (e.g., "user.firstName") to observe property changes,
     *  - Or a function signature (e.g., "myObserver(user.firstName, user.lastName)") to call a method when dependencies change.
     */;
    computed?: string;

    /**
     * Observer method to call when the property changes.
     * The method should accept two parameters: the new value and the old value.
     */
    observer?: string;
}

export interface WebComponentRegistrationInfo {
    /**
     * The properties of the web component.
     */
    properties?: Record<string, WebComponentProperty>;

    /**
     * An array of observer strings to forward changes to.
     * Each string can be a method signature (e.g., "myObserver(user.firstName, user.lastName)") or a simple path (e.g., "user.firstName").
     * In case of a simple path, the requestUpdate will be called with the path as the first argument.
     */
    observers?: string[];

    /**
     * A map of event names to handler method names.
     * The handler methods should be defined in the web component class.
     */
    listeners?: { [eventName: string]: string };

    sensitive?: boolean;
}

type ComputedPropertyConfig = {
    dependencies: string[];
    methodName?: string; // When undefined, the value is forwarded from the first dependency
};

type StaticComputedConfig = Record<string, ComputedPropertyConfig>;

type StaticObserversConfig = Record<string, string[]>;

type StaticPropertyObserversConfig = Record<string, string>;

type StaticListenersConfig = Record<string, string>;

const COMPUTED_CONFIG_SYMBOL = Symbol.for("WebComponent.computedConfig");
const OBSERVERS_CONFIG_SYMBOL = Symbol.for("WebComponent.observersConfig");
const PROPERTY_OBSERVERS_CONFIG_SYMBOL = Symbol.for("WebComponent.propertyObserversConfig");
const SENSITIVE_CONFIG_SYMBOL = Symbol.for("WebComponent.sensitiveConfig");
const LISTENERS_CONFIG_SYMBOL = Symbol.for("WebComponent.listenersConfig");

/**
 * Parses a method signature string of the form "methodName(arg1, arg2, ...)".
 * Returns an object with the method name and an array of argument names.
 * If the signature is invalid, returns null.
 * @param signature The method signature string to parse.
 * @returns An object with methodName and args, or null if parsing fails.
 */
function parseMethodSignature(signature: string): { methodName: string; args: string[] } | null {
    const match = signature.match(/^([a-zA-Z0-9_]+)\((.*)\)$/);
    if (!match)
        return null;

    const [, methodName, argsString] = match;
    const args = argsString ? argsString.split(',').map(d => d.trim()).filter(Boolean) : [];

    return { methodName, args };
}

type WebComponentConstructor = typeof WebComponent & {
    properties?: Record<string, WebComponentProperty>;
    [COMPUTED_CONFIG_SYMBOL]?: StaticComputedConfig;
    [OBSERVERS_CONFIG_SYMBOL]?: StaticObserversConfig;
    [PROPERTY_OBSERVERS_CONFIG_SYMBOL]?: StaticPropertyObserversConfig;
    [SENSITIVE_CONFIG_SYMBOL]?: boolean;
    [LISTENERS_CONFIG_SYMBOL]?: StaticListenersConfig;
};

/**
 * Base class for all lit-based web components in a Vidyano application.
 */
export abstract class WebComponent extends LitElement {
    static properties = {
        app: { type: Object, noAccessor: true },
        service: { type: Object, noAccessor: true },
        translations: { type: Object, computed: "service.language.messages" },
    };

    #forwarderDisposers: Map<string, () => void> = new Map();

    #dirtyForwardedPaths: Set<string> = new Set();

    override connectedCallback() {
        if (!this.app)
            this.#listenForApp();
        else if (!this.app.service)
            this.#listenForService(this.app);

        super.connectedCallback();

        this.#setupForwardersForRoots();
        this.#updateComputedProperties();
        this.#registerConfiguredListeners();
    }

    override disconnectedCallback() {
        super.disconnectedCallback();

        this.#disposeForwarders();
        this.#unregisterConfiguredListeners();

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
        super.willUpdate(changedProperties);

        if (Object.keys(this.#staticObserversConfig).length > 0) {
            const observedRoots = new Set<string>();
            Object.values(this.#staticObserversConfig).forEach(deps =>
                deps.forEach(depPath => {
                    const root = depPath.split('.')[0];
                    if (root) observedRoots.add(root);
                })
            );

            const changedRoots = new Set<string>();
            for (const rootKey of observedRoots) {
                if (changedProperties.has(rootKey)) {
                    changedRoots.add(rootKey);
                }
            }

            if (changedRoots.size > 0) {
                this.#setupForwardersForRoots(changedRoots);
            }
        }

        const propertyObservers = this.#staticPropertyObserversConfig;
        const computedConfig = this.#staticComputedConfig;

        if (propertyObservers) {
            for (const [prop, observerName] of Object.entries(propertyObservers)) {
                // If this property is a computed property, its observer is handled inside #updateComputedProperties.
                if (computedConfig?.hasOwnProperty(prop))
                    continue;

                if (changedProperties.has(prop as PropertyKey)) {
                    const oldValue = changedProperties.get(prop as PropertyKey);
                    const newValue = this[prop];
                    
                    // Ensure value actually changed for non-computed properties before calling observer
                    if (oldValue !== newValue) {
                        if (typeof this[observerName] === 'function') {
                            this[observerName](newValue, oldValue);
                        } else {
                            console.warn(`[${this.tagName.toLowerCase()}] Observer method '${observerName}' not found for property '${prop}'.`);
                        }
                    }
                }
            }
        }

        const changedComputedProps = this.#updateComputedProperties(changedProperties);

        const observersConfig = this.#staticObserversConfig;
        if (observersConfig) {
            // Use a Set to ensure we don't call the same observer multiple times in one update cycle.
            const observersToCall = new Set<string>();

            for (const [observerIdentifier, dependencies] of Object.entries(observersConfig)) {
                // We only handle method-style observers here.
                // Simple paths (e.g., "someObject.someProp") are not functions and only serve to trigger updates via the forwarder.
                if (typeof this[observerIdentifier] !== "function")
                    continue;

                // Check if any of this observer's dependencies have changed.
                const hasChangedDep = dependencies.some(dep => {
                    const rootDep = dep.split('.')[0];
                    return (
                        changedProperties.has(dep as PropertyKey) || // The dependency itself is present in `changedProperties` (e.g., a direct property change).
                        changedProperties.has(rootDep as PropertyKey) || // The root property of a nested dependency path is present in `changedProperties` (e.g., the entire object was replaced).
                        this.#dirtyForwardedPaths.has(dep) || // The dependency is present in `#dirtyForwardedPaths`, indicating a deep path was notified by a forwarder.
                        changedComputedProps.has(dep) // The dependency is present in `changedComputedProps`, indicating a computed property has changed.
                    );
                });

                if (hasChangedDep) {
                    observersToCall.add(observerIdentifier);
                }
            }

            // Now, call the unique observers that need to be fired.
            for (const observerIdentifier of observersToCall) {
                const dependencies = observersConfig[observerIdentifier];
                const args = dependencies.map(d => this.#resolvePath(d));
                this[observerIdentifier](...args);
            }
        }
    }

    override updated(changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>) {
        super.updated(changedProperties);

        // Clear the dirty paths at the end of the update cycle.
        this.#dirtyForwardedPaths.clear();
    }

    get #staticObserversConfig(): StaticObserversConfig {
        return (this.constructor as WebComponentConstructor)[OBSERVERS_CONFIG_SYMBOL] || {};
    }

    get #staticComputedConfig(): StaticComputedConfig {
        return (this.constructor as WebComponentConstructor)[COMPUTED_CONFIG_SYMBOL] || {};
    }

    get #staticPropertyObserversConfig(): StaticPropertyObserversConfig {
        return (this.constructor as WebComponentConstructor)[PROPERTY_OBSERVERS_CONFIG_SYMBOL] || {};
    }

    get #staticListenersConfig(): StaticListenersConfig {
        return (this.constructor as WebComponentConstructor)[LISTENERS_CONFIG_SYMBOL] || {};
    }

    /**
     * Sets up forwarders for the specified root properties, or all if none specified.
     * @param rootsToRebind Optional set of root property names to rebind forwarders for.
     */
    #setupForwardersForRoots(rootsToRebind?: Set<string>) {
        const staticObserversConfig = this.#staticObserversConfig;
        if (Object.keys(staticObserversConfig).length === 0)
            return;

        // 1. Build pathsToObserversMap
        const pathsToObserversMap = new Map<string, string[]>();
        for (const [observerIdentifier, dependencies] of Object.entries(staticObserversConfig)) {
            for (const depPath of dependencies) {
                if (!pathsToObserversMap.has(depPath))
                    pathsToObserversMap.set(depPath, []);
                pathsToObserversMap.get(depPath)!.push(observerIdentifier);
            }
        }

        // 2. Determine Paths for Forwarder Setup/Disposal
        const setupAll = !rootsToRebind || rootsToRebind.size === 0;
        const pathsToDisposeAndRecreate: Set<string> = new Set();
        for (const dependencies of Object.values(staticObserversConfig)) {
            for (const depPath of dependencies) {
                const rootKey = depPath.split('.')[0];
                if (setupAll || (rootsToRebind && rootsToRebind.has(rootKey))) {
                    pathsToDisposeAndRecreate.add(depPath);
                }
            }
        }

        // 3. Dispose Old Forwarders (only those that will be recreated)
        this.#disposeForwarders(pathsToDisposeAndRecreate);

        // 4. Remove disposed paths from #forwarderDisposers to prevent memory leaks
        for (const depPath of pathsToDisposeAndRecreate) {
            this.#forwarderDisposers.delete(depPath);
        }

        // 5. Setup New Forwarders
        for (const depPath of pathsToDisposeAndRecreate) {
            const pathParts = depPath.split('.');
            const rootPropertyKey = pathParts[0];
            const relativePathInSource = pathParts.slice(1).join('.');
            const sourceObject = this[rootPropertyKey];

            try {
                const disposer = Observable.forward(sourceObject, relativePathInSource, (detail: ForwardObservedDetail) => {
                    const observerIdentifiers = pathsToObserversMap.get(depPath);
                    if (observerIdentifiers) {
                        for (const observerIdentifier of observerIdentifiers) {
                            if (typeof this[observerIdentifier] === "function") {
                                const deps = staticObserversConfig[observerIdentifier];
                                if (deps?.length) {
                                    const args = deps.map(d => this.#resolvePath(d));
                                    this[observerIdentifier](...args);
                                } else {
                                    this[observerIdentifier](detail);
                                }
                            } else if (!observerIdentifier.includes('.')) {
                                console.warn(`[${this.tagName.toLowerCase()}] Observer method '${observerIdentifier}' not found for path '${depPath}'.`);
                            }
                        }
                    }
                    this.#dirtyForwardedPaths.add(depPath);
                    this.requestUpdate();
                }, true);
                this.#forwarderDisposers.set(depPath, disposer);
            } catch (error) {
                console.warn(`[${this.tagName.toLowerCase()}] Error setting up forwarder for '${depPath}' on source:`, sourceObject, error);
            }
        }
    }

    /**
     * Computes and updates all computed properties.
     * @param changedProperties Optionally, only update properties whose dependencies have changed.
     *                         If omitted, all computed properties are updated (e.g., during initial connect).
     */
    #updateComputedProperties(changedProperties?: PropertyValueMap<any> | Map<PropertyKey, unknown>): Set<string> {
        const computedConfig = this.#staticComputedConfig;
        const propertyObservers = this.#staticPropertyObserversConfig;
        const changedComputedProps = new Set<string>();

        if (!computedConfig)
            return changedComputedProps;

        for (const [prop, { dependencies, methodName }] of Object.entries(computedConfig)) {
            let shouldUpdate = false;

            if (!changedProperties) {
                // Initial run: always update
                shouldUpdate = true;
            } else {
                // Only update if dependencies changed
                const hasChangedTopLevelDep = dependencies.some(dep =>
                    changedProperties.has(dep.split('.')[0]) || changedProperties.has(dep)
                );
                const hasChangedDeepDep = dependencies.some(dep => this.#dirtyForwardedPaths.has(dep));
                shouldUpdate = hasChangedTopLevelDep || hasChangedDeepDep;
            }

            if (shouldUpdate) {
                const args = dependencies.map(dep => this.#resolvePath(dep));
                const oldVal = this[prop];
                let computedValue: any;
                if (!methodName) {
                    computedValue = args[0];
                } else if (typeof this[methodName] === "function") {
                    computedValue = this[methodName](...args);
                } else {
                    console.warn(`[${this.tagName.toLowerCase()}] Compute method '${methodName}' not found for computed property '${prop}'.`);
                    continue;
                }

                if (oldVal !== computedValue) {
                    this[prop] = computedValue;
                    changedComputedProps.add(prop);
                    this.requestUpdate(prop as PropertyKey, oldVal);

                    // If this computed property has an observer, call it.
                    if (propertyObservers?.[prop]) {
                        const observerName = propertyObservers[prop];
                        if (typeof this[observerName] === 'function') {
                            this[observerName](computedValue, oldVal);
                        } else {
                            console.warn(`[${this.tagName.toLowerCase()}] Observer method '${observerName}' not found for property '${prop}'.`);
                        }
                    }
                }
            }
        }

        return changedComputedProps;
    }

    /**
     * Disposes forwarders for the specified dependency paths, or all if none specified.
     * @param depPaths Optional iterable of dependency paths to dispose forwarders for. If not provided, disposes all forwarders.
     */
    #disposeForwarders(depPaths?: Iterable<string>) {
        const paths = depPaths ? Array.from(depPaths) : Array.from(this.#forwarderDisposers.keys());
        for (const depPath of paths) {
            const disposer = this.#forwarderDisposers.get(depPath);
            if (typeof disposer === 'function') {
                try {
                    disposer();
                } catch (error) {
                    console.warn(`[${this.tagName.toLowerCase()}] Error disposing forwarder for '${depPath}':`, error);
                }
            }
            this.#forwarderDisposers.delete(depPath);
        }
    }

    /**
     * Resolves a dot-separated path string to a value starting from this instance.
     * @param path Dot-separated property path (e.g., "someObject.someProp").
     * @returns The resolved value or undefined.
     */
    #resolvePath(path: string): any {
        return path.split('.').reduce((obj, key) => obj?.[key], this);
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
            app.removeEventListener("service-changed", this[serviceChangeListener]);
            this[serviceChangeListener] = null;

            this.requestUpdate("service", app.service);
        });
    }

    /**
     * Registers event listeners defined in the static listeners config.
     */
    #registerConfiguredListeners() {
        const listeners = this.#staticListenersConfig;
        if (!listeners)
            return;

        for (const eventName in listeners) {
            const handlerName = listeners[eventName];
            if (typeof this[handlerName] === "function") {
                this.addEventListener(eventName, this[handlerName]);
            } else {
                console.warn(`[${this.tagName.toLowerCase()}] Listener method '${handlerName}' for event '${eventName}' not found.`);
            }
        }
    }

    /**
     * Unregisters event listeners defined in the static listeners config.
     */
    #unregisterConfiguredListeners() {
        const listeners = this.#staticListenersConfig;
        if (!listeners)
            return;

        for (const eventName in listeners) {
            const handlerName = listeners[eventName];
            if (typeof this[handlerName] === "function")
                this.removeEventListener(eventName, this[handlerName]);
        }
    }

    /**
     * Registers a web component class with the specified configuration and tag name.
     * @param config The registration configuration object.
     * @param tagName The custom element tag name to register.
     * @returns A decorator function for the web component class.
     */
    static register(config: WebComponentRegistrationInfo, tagName: string) {
        return function <T extends typeof WebComponent>(targetClass: T): T | void {
            const litPropertiesForStaticGetter: Record<string, any> = {};
            const computedConfigForDecorator: Record<string, ComputedPropertyConfig> = {};
            const observersConfigForDecorator: StaticObserversConfig = {};
            const propertyObserversConfigForDecorator: Record<string, string> = {};

            // Helper function to walk inheritance chain and collect configurations
            const collectFromInheritanceChain = <T>(symbolKey: symbol, merger?: (accumulated: T, current: T) => T): T => {
                let currentCtor = targetClass;
                let result = {} as T;
                
                while (currentCtor && currentCtor.prototype !== LitElement.prototype) {
                    const config = (currentCtor as WebComponentConstructor)[symbolKey];
                    if (config) {
                        if (merger) {
                            result = merger(result, config);
                        } else {
                            result = { ...config, ...result } as T; // Derived class takes precedence
                        }
                    }
                    currentCtor = Object.getPrototypeOf(currentCtor.prototype)?.constructor;
                }
                
                return result;
            };

            // First, extract computed properties from the entire inheritance chain
            const extractComputedFromStaticProperties = (ctor: typeof WebComponent) => {
                const computed: Record<string, ComputedPropertyConfig> = {};
                const propertyObservers: Record<string, string> = {};
                
                // Walk up the prototype chain to collect all static properties
                let currentCtor = ctor;
                const allProperties: Record<string, any> = {};
                
                while (currentCtor && currentCtor.prototype !== LitElement.prototype) {
                    const propsDescriptor = Object.getOwnPropertyDescriptor(currentCtor, 'properties');
                    let currentProps: Record<string, any> = {};
                    
                    if (propsDescriptor?.get) {
                        currentProps = propsDescriptor.get.call(currentCtor) || {};
                    } else if (propsDescriptor?.value) {
                        currentProps = propsDescriptor.value || {};
                    }
                    
                    // Merge properties (derived class properties take precedence)
                    Object.assign(allProperties, currentProps, allProperties);
                    
                    currentCtor = Object.getPrototypeOf(currentCtor.prototype)?.constructor;
                }
                
                // Process all collected properties for computed and observers
                for (const propName in allProperties) {
                    const propConfig = allProperties[propName];
                    
                    if (propConfig.computed) {
                        const parsed = parseMethodSignature(propConfig.computed);
                        if (parsed) {
                            const { methodName, args } = parsed;
                            computed[propName] = { dependencies: args, methodName };
                        } else {
                            const path = propConfig.computed.trim();
                            if (path) {
                                computed[propName] = { dependencies: [path] };
                            } else {
                                console.warn(`[${tagName}] Could not parse computed string for "${propName}": ${propConfig.computed}`);
                            }
                        }
                    }
                    
                    if (propConfig.observer) {
                        propertyObservers[propName] = propConfig.observer;
                    }
                }
                
                return { computed, propertyObservers };
            };

            const inheritedComputedAndObservers = extractComputedFromStaticProperties(targetClass);
            Object.assign(computedConfigForDecorator, inheritedComputedAndObservers.computed);
            Object.assign(propertyObserversConfigForDecorator, inheritedComputedAndObservers.propertyObservers);

            if (config.properties) {
                for (const propName in config.properties) {
                    const polyPropConfig = config.properties[propName];
                    const litPropOptions: any = {
                        type: polyPropConfig.type,
                        reflect: !!polyPropConfig.reflectToAttribute,
                    };

                    if (polyPropConfig.readOnly || polyPropConfig.computed) {
                        litPropOptions.noAccessor = true;
                    }
                    litPropertiesForStaticGetter[propName] = litPropOptions;

                    if (polyPropConfig.computed) {
                        const parsed = parseMethodSignature(polyPropConfig.computed);
                        if (parsed) {
                            const { methodName, args } = parsed;
                            computedConfigForDecorator[propName] = { dependencies: args, methodName };
                        } else {
                            const path = polyPropConfig.computed.trim();
                            if (path) {
                                computedConfigForDecorator[propName] = { dependencies: [path] };
                            } else {
                                console.warn(`[${tagName}] Could not parse computed string for "${propName}": ${polyPropConfig.computed}`);
                            }
                        }
                    }
                    if (polyPropConfig.observer) {
                        propertyObserversConfigForDecorator[propName] = polyPropConfig.observer;
                    }
                }
            }

            // Handle Lit's static properties (remains string-keyed "properties")
            const existingStaticPropertiesGetter = Object.getOwnPropertyDescriptor(targetClass, 'properties')?.get;
            Object.defineProperty(targetClass, 'properties', {
                get: () => {
                    let superProps = {};
                    if (existingStaticPropertiesGetter) { // If target already had a 'properties' getter
                        superProps = existingStaticPropertiesGetter.call(targetClass) || {};
                    } else { // Otherwise, look up the prototype chain
                        const superClassConstructor = Object.getPrototypeOf(targetClass.prototype)?.constructor;
                        if (superClassConstructor?.hasOwnProperty('properties')) {
                            const superDescriptor = Object.getOwnPropertyDescriptor(superClassConstructor, 'properties');
                            if (superDescriptor?.get) {
                                superProps = superDescriptor.get.call(superClassConstructor) || {};
                            } else if (superDescriptor?.value) {
                                superProps = superDescriptor.value || {};
                            }
                        }
                    }
                    return { ...superProps, ...litPropertiesForStaticGetter };
                },
                enumerable: true,
                configurable: true,
            });

            // Merge and assign 'computed' configuration
            if (Object.keys(computedConfigForDecorator).length > 0) {
                const inheritedComputed = collectFromInheritanceChain<StaticComputedConfig>(COMPUTED_CONFIG_SYMBOL);
                (targetClass as WebComponentConstructor)[COMPUTED_CONFIG_SYMBOL] = {
                    ...inheritedComputed,
                    ...computedConfigForDecorator
                };
            }

            // Parse and merge 'observers'
            if (Array.isArray(config.observers)) {
                config.observers.forEach((observerString: string) => {
                    const parsed = parseMethodSignature(observerString);
                    if (parsed) {
                        const { methodName, args } = parsed;
                        if (args.length > 0) {
                            observersConfigForDecorator[methodName] = [...(observersConfigForDecorator[methodName] || []), ...args];
                        } else {
                            if (!observersConfigForDecorator[methodName])
                                observersConfigForDecorator[methodName] = [];

                            console.warn(`[${tagName}] Observer method "${methodName}" has no dependencies specified. It will not observe any changes.`, observerString);
                        }
                    } else if (observerString.includes('.') || !observerString.includes('(')) {
                        const depPath = observerString.trim();
                        if (depPath)
                            observersConfigForDecorator[depPath] = [...(observersConfigForDecorator[depPath] || []), depPath];
                    } else {
                        console.warn(`[${tagName}] Could not parse observer string: "${observerString}". Expected format: "methodName(dependency1, dependency2,...)" or "dependencyPath"`);
                    }
                });

                if (Object.keys(observersConfigForDecorator).length > 0) {
                    // Collect observers from entire inheritance chain
                    const inheritedObservers = collectFromInheritanceChain<StaticObserversConfig>(
                        OBSERVERS_CONFIG_SYMBOL,
                        (accumulated, current) => {
                            const merged = { ...accumulated };
                            for (const methodName in current) {
                                const combinedDeps = new Set([...(merged[methodName] || []), ...(current[methodName] || [])]);
                                merged[methodName] = Array.from(combinedDeps);
                            }
                            return merged;
                        }
                    );

                    // Merge new from this decorator
                    const finalObservers = { ...inheritedObservers };
                    for (const methodName in observersConfigForDecorator) {
                        const combinedDeps = new Set([...(finalObservers[methodName] || []), ...(observersConfigForDecorator[methodName] || [])]);
                        finalObservers[methodName] = Array.from(combinedDeps);
                    }
                    (targetClass as WebComponentConstructor)[OBSERVERS_CONFIG_SYMBOL] = finalObservers;
                }
            }

            // Merge and assign 'propertyObservers' configuration
            if (Object.keys(propertyObserversConfigForDecorator).length > 0) {
                const inheritedPropObs = collectFromInheritanceChain<StaticPropertyObserversConfig>(PROPERTY_OBSERVERS_CONFIG_SYMBOL);
                (targetClass as WebComponentConstructor)[PROPERTY_OBSERVERS_CONFIG_SYMBOL] = {
                    ...inheritedPropObs,
                    ...propertyObserversConfigForDecorator
                };
            }

            // Assign 'listeners' configuration
            if (config.listeners && Object.keys(config.listeners).length > 0) {
                const inheritedListeners = collectFromInheritanceChain<StaticListenersConfig>(LISTENERS_CONFIG_SYMBOL);
                (targetClass as WebComponentConstructor)[LISTENERS_CONFIG_SYMBOL] = {
                    ...inheritedListeners,
                    ...config.listeners // Current config takes precedence
                };
            }

            // Assign 'sensitive' configuration
            if (config.hasOwnProperty('sensitive')) {
                (targetClass as WebComponentConstructor)[SENSITIVE_CONFIG_SYMBOL] = config.sensitive;
            }

            if (tagName && typeof tagName === 'string') {
                if (!customElements.get(tagName)) {
                    customElements.define(tagName, targetClass as unknown as CustomElementConstructor);
                } else {
                    console.warn(`[${tagName}] Element "${tagName}" is already defined. Skipping registration.`);
                }
            } else if (tagName) {
                 console.warn(`[${tagName}] tagName was invalid (not a string). Element not registered.`);
            }

            return targetClass;
        };
    }
}

class TestObjectItem extends Observable<TestObjectItem> {
    #index: number;

    constructor(index: number) {
        super();
        this.#index = index;
    }

    get index(): number {
        return this.#index;
    }

    set index(value: number) {
        if (this.#index !== value) {
            const oldValue = this.#index;
            this.#index = value;
            this.notifyPropertyChanged("index", value, oldValue);
        }
    }
}

class TestObject extends Observable<TestObject> {
    #firstName: string;
    #lastName: string;
    #items: TestObjectItem[] = [];

    constructor(firstName: string, lastName: string) {
        super();
        this.#firstName = firstName;
        this.#lastName = lastName;
    }

    get firstName(): string {
        return this.#firstName;
    }

    set firstName(value: string) {
        if (this.#firstName !== value) {
            const oldValue = this.#firstName;
            this.#firstName = value;
            this.notifyPropertyChanged("firstName", value, oldValue);
        }
    }

    get lastName(): string {
        return this.#lastName;
    }

    set lastName(value: string) {
        if (this.#lastName !== value) {
            const oldValue = this.#lastName;
            this.#lastName = value;
            this.notifyPropertyChanged("lastName", value, oldValue);
        }
    }

    addItem(item: TestObjectItem): void {
        const newIndex = this.#items.length;
        this.#items.push(item);
        this.notifyArrayChanged("items", newIndex, [], 1);
    }

    get items(): TestObjectItem[] {
        return this.#items;
    }
}

@WebComponent.register({
    properties: {
        fullName: {
            type: String,
            computed: "_computeFullName(test.firstName, test.lastName)",
            observer: "_fullNameChanged",
        },
        test: {
            type: Object,
            observer: "_testChanged",
        }
    },
    observers: [
        "test.firstName",
        "test.items.*.index",
        "_fullNameOrTestChanged(fullName, test)",
    ],
    listeners: {
        "click": "_handleClick",
    }
}, "my-test")
class Test extends WebComponent {
    declare readonly fullName: string;
    test = new TestObject("Jane", "Smith");
    n = 0;

    override connectedCallback(): void {
        super.connectedCallback();
        console.log("Test component connected");

        setTimeout(() => {
            console.log("Timeout 1: Changing test.firstName and adding item");
            this.test.firstName = (++this.n).toString();
            this.test.addItem(new TestObjectItem(++this.n));
        }, 1000);

        setTimeout(() => {
            console.log("Timeout 2: Replacing test object and adding item to new object");
            this.test = new TestObject("John", "Doe");
            this.test.addItem(new TestObjectItem(++this.n));
        }, 2000);
    }

    protected override render() {
        console.error("Test component rendering. FullName:", this.fullName, "Item Index:", this.test.items?.[0]?.index);
        return html`<h1>Item Index: ${this.test.items?.[0]?.index}, FullName: ${this.fullName}!</h1>`;
    }

    private _computeFullName(firstName?: string, lastName?: string): string {
        if (firstName === undefined || lastName === undefined) {
            console.log(`Computing full name: returning "Loading..." (firstName: ${firstName}, lastName: ${lastName})`);
            return "Loading...";
        }
        console.log(`Computing full name from "${firstName}" and "${lastName}"`);
        return `${this.translations.UserName}: ${firstName} ${lastName}`;
    }

    private _fullNameChanged(newValue: string, oldValue: string): void {
        console.log(`Full name changed from "${oldValue}" to "${newValue}"`);
    }

    private _fullNameOrTestChanged(fullName: string, test: TestObject): void {
        console.warn(`Full name or test changed. FullName: "${fullName}", Test: "${test?.firstName} ${test?.lastName}"`);
    }

    private _testChanged(newValue: TestObject, oldValue: TestObject | undefined): void {
        const oldFullName = oldValue ? `${oldValue.firstName} ${oldValue.lastName}` : "undefined";
        console.log(`Test object changed from "${oldFullName}" to "${newValue.firstName} ${newValue.lastName}"`);
    }

    private _handleClick(event: MouseEvent): void {
        this.test = new TestObject(`${++this.n}`, this.test.lastName);
    }
}