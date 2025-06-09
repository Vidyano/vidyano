import { AppBase } from "components/app/app";
import { LitElement, PropertyValueMap, PropertyDeclaration } from "lit";
import { Observable, ForwardObservedPropertyChangedArgs, ForwardObservedArrayChangedArgs, Service } from "vidyano";
import { ListenerController } from "./listener-controller";

type ForwardObservedDetail = ForwardObservedPropertyChangedArgs | ForwardObservedArrayChangedArgs;

export interface WebComponentProperty<T = unknown> extends PropertyDeclaration<T> {
    /**
     *  Computed properties can be either:
     *  - A path string (e.g., "user.firstName") to observe property changes,
     *  - Or a function signature (e.g., "myObserver(user.firstName, user.lastName)") to call a method when dependencies change.
     */
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

const LISTENER_CONTROLLER_SYMBOL = Symbol("WebComponent.listenerController");

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

type WebComponentConstructor = typeof WebComponentLit & {
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
export abstract class WebComponentLit extends LitElement {
    static properties = {
        app: { type: Object, noAccessor: true },
        service: { type: Object, noAccessor: true },
        translations: { type: Object, computed: "service.language.messages" },
    };

    #forwarderDisposers: Map<string, () => void> = new Map();

    #dirtyForwardedPaths: Set<string> = new Set();

    constructor() {
        super();

        this[LISTENER_CONTROLLER_SYMBOL] = new ListenerController(this, (this.constructor as WebComponentConstructor)[LISTENERS_CONFIG_SYMBOL] || {});
    }

    override connectedCallback() {
        if (!this.app)
            this.#listenForApp();
        else if (!this.app.service)
            this.#listenForService(this.app);

        super.connectedCallback();

        this.#setupForwardersForRoots();
        this.#updateComputedProperties();
    }

    override disconnectedCallback() {
        super.disconnectedCallback();

        this.#disposeForwarders();

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
        // This map will accumulate all properties that have changed during this update cycle,
        // mapping each property to its value *before* the cycle began.
        const totalChangedProps = new Map(changedProperties.entries());
    
        // This map holds the set of properties that changed in the *previous* pass,
        // which will be the input for the *current* pass.
        let changedInLastPass = new Map(changedProperties.entries());

        // CAPTURE AND CLEAR: Capture the dirty paths for this update cycle only, then clear the instance set.
        const dirtyPathsForThisUpdate = new Set(this.#dirtyForwardedPaths);
        this.#dirtyForwardedPaths.clear();
    
        let iteration = 0;
        const MAX_ITERATIONS = 10; // Safety break for infinite loops.

        const lastComplexObserverArgs = new Map<string, any[]>();
        let isFirstIteration = true;
    
        // Re-bind forwarders if a root object was part of the initial change.
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
    
        // The loop must run if there are changed properties OR if it's the first
        // iteration and the update was triggered by deep ("dirty") path changes.
        while ((changedInLastPass.size > 0 || (isFirstIteration && dirtyPathsForThisUpdate.size > 0)) && iteration < MAX_ITERATIONS) {
            isFirstIteration = false;
            iteration++;

            const changesToProcessThisPass = new Map(changedInLastPass.entries());
            changedInLastPass.clear(); // Reset for detecting new changes in this pass.
    
            // STEP 1: Compute derived properties based on the changes from the last pass.
            // Pass the local 'dirtyPathsForThisUpdate' set.
            const changedComputedPropsMap = this.#updateComputedProperties(changesToProcessThisPass, dirtyPathsForThisUpdate);
            for (const [prop, oldVal] of changedComputedPropsMap.entries()) {
                if (!totalChangedProps.has(prop)) {
                    totalChangedProps.set(prop, oldVal);
                }
            }
    
            // The set of changes that should trigger observers in this pass.
            const allChangesToObserve = new Map([...changesToProcessThisPass.entries(), ...changedComputedPropsMap.entries()]);
            if (allChangesToObserve.size === 0 && dirtyPathsForThisUpdate.size === 0) // Also check dirty paths
                continue;

            // Take a snapshot of all property values before running observers to detect side-effects.
            const allPropKeys = Array.from((this.constructor as typeof LitElement).elementProperties.keys());
            const stateBeforeObservers = new Map(allPropKeys.map(p => [p, this[p]]));
    
            // STEP 2: Call single-property observers.
            const propertyObservers = this.#staticPropertyObserversConfig;
            if (propertyObservers) {
                for (const [prop, oldVal] of allChangesToObserve.entries()) {
                    const observerName = propertyObservers[prop as string];
                    if (observerName && typeof this[observerName] === "function") {
                        const newVal = this[prop as string];
                        if (newVal !== oldVal) {
                            this[observerName](newVal, oldVal);
                        }
                    }
                }
            }
    
            // STEP 3: Call complex (multi-property) observers.
            const observersConfig = this.#staticObserversConfig;
            if (observersConfig) {
                const observersToCall = new Set<string>();
                const allChangedKeys = new Set(allChangesToObserve.keys());
    
                for (const [observerIdentifier, dependencies] of Object.entries(observersConfig)) {
                    if (typeof this[observerIdentifier] !== "function")
                        continue;
    
                    const hasChangedDep = dependencies.some(dep => {
                        const rootDep = dep.split('.')[0];
                        return (
                            allChangedKeys.has(dep) ||
                            allChangedKeys.has(rootDep) ||
                            dirtyPathsForThisUpdate.has(dep) // Check against the local set
                        );
                    });
    
                    if (hasChangedDep) {
                        observersToCall.add(observerIdentifier);
                    }
                }
    
                for (const observerIdentifier of observersToCall) {
                    const dependencies = observersConfig[observerIdentifier];
                    const newArgs = dependencies.map(d => this.#resolvePath(d));

                    const oldArgs = lastComplexObserverArgs.get(observerIdentifier);
                    if (oldArgs && oldArgs.length === newArgs.length && oldArgs.every((v, i) => v === newArgs[i])) {
                        continue; // Skip redundant call.
                    }

                    lastComplexObserverArgs.set(observerIdentifier, newArgs);
                    this[observerIdentifier](...newArgs);
                }
            }
    
            // STEP 4: Detect side-effects from observers and queue them for the next pass.
            for (const propKey of allPropKeys) {
                const valBefore = stateBeforeObservers.get(propKey);
                const valAfter = this[propKey];
                if (valAfter !== valBefore && !totalChangedProps.has(propKey)) {
                    totalChangedProps.set(propKey, valBefore);
                    changedInLastPass.set(propKey, valBefore);
                }
            }
        }
    
        if (iteration >= MAX_ITERATIONS) {
            console.warn(`[${this.tagName.toLowerCase()}] Maximum update loops reached. Component properties may be unstable.`);
        }
    
        // Finally, call super.willUpdate with the complete set of changes.
        super.willUpdate(totalChangedProps);
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

    /**
     * Sets up forwarders for the specified root properties, or all if none specified.
     * @param rootsToRebind Optional set of root property names to rebind forwarders for.
     */
    #setupForwardersForRoots(rootsToRebind?: Set<string>) {
        const staticObserversConfig = this.#staticObserversConfig;
        if (Object.keys(staticObserversConfig).length === 0)
            return;

        const allDependencies = new Set<string>();
        Object.values(staticObserversConfig).forEach(deps => deps.forEach(dep => allDependencies.add(dep)));

        const setupAll = !rootsToRebind || rootsToRebind.size === 0;
        const pathsToRebind = new Set<string>();
        for (const depPath of allDependencies) {
            const rootKey = depPath.split('.')[0];
            if (setupAll || (rootsToRebind && rootsToRebind.has(rootKey))) {
                pathsToRebind.add(depPath);
            }
        }

        this.#disposeForwarders(pathsToRebind);

        for (const depPath of pathsToRebind) {
            const pathParts = depPath.split('.');
            const rootPropertyKey = pathParts[0];
            const relativePathInSource = pathParts.slice(1).join('.');
            const sourceObject = this[rootPropertyKey];

            try {
                // The forwarder's only job is to mark a deep path as dirty and request a new update cycle.
                // The ordered logic in `willUpdate` will then handle all observer calls correctly.
                const disposer = Observable.forward(sourceObject, relativePathInSource, (detail: ForwardObservedDetail) => {
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
     * @returns A Map of changed computed properties to their old values.
     */
    #updateComputedProperties(changedProperties?: PropertyValueMap<any> | Map<PropertyKey, unknown>, dirtyPaths?: Set<string>): Map<string, any> {
        const computedConfig = this.#staticComputedConfig;
        const changedComputedProps = new Map<string, any>();

        if (!computedConfig)
            return changedComputedProps;

        const changedKeys = changedProperties ? new Set(changedProperties.keys()) : null;

        for (const [prop, { dependencies, methodName }] of Object.entries(computedConfig)) {
            let shouldUpdate = false;

            if (!changedProperties) {
                shouldUpdate = true; // Initial run: always update
            } else {
                // Update if a dependency (or its root) has changed directly, or if a deep path has changed.
                shouldUpdate = dependencies.some(dep =>
                    changedKeys.has(dep) ||
                    changedKeys.has(dep.split('.')[0]) ||
                    (dirtyPaths && dirtyPaths.has(dep)) // Check against the passed-in set
                );
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
                    changedComputedProps.set(prop, oldVal);
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
     * Registers a web component class with the specified configuration and tag name.
     * @param config The registration configuration object.
     * @param tagName The custom element tag name to register.
     * @returns A decorator function for the web component class.
     */
    static register(config: WebComponentRegistrationInfo, tagName: string) {
        return function <T extends typeof WebComponentLit>(targetClass: T): T | void {
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
            const extractComputedFromStaticProperties = (ctor: typeof WebComponentLit) => {
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
                    const propConfig = config.properties[propName];
                    const { computed, observer, ...litPropConfig } = propConfig;

                    litPropertiesForStaticGetter[propName] = { ...litPropConfig };

                    if (typeof computed === "string") {
                        const parsed = parseMethodSignature(computed);
                        if (parsed) {
                            const { methodName, args } = parsed;
                            computedConfigForDecorator[propName] = { dependencies: args, methodName };
                        } else {
                            const path = computed.trim();
                            if (path) {
                                computedConfigForDecorator[propName] = { dependencies: [path] };
                            } else {
                                console.warn(`[${tagName}] Could not parse computed string for "${propName}": ${computed}`);
                            }
                        }
                    }
                    if (observer) {
                        propertyObserversConfigForDecorator[propName] = observer;
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
