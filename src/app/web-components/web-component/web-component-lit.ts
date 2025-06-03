import { AppBase } from "components/app/app";
import { html, LitElement, PropertyValueMap } from "lit";
import { Observable, ForwardObservedPropertyChangedArgs, ForwardObservedArrayChangedArgs, Service } from "vidyano";

type ForwardObservedDetail = ForwardObservedPropertyChangedArgs | ForwardObservedArrayChangedArgs;

export interface WebComponentProperty {
    type: ObjectConstructor | StringConstructor | BooleanConstructor | DateConstructor | NumberConstructor | ArrayConstructor;
    reflectToAttribute?: boolean;
    readOnly?: boolean;
    computed?: string;
    observer?: string;
}

export interface WebComponentRegistrationInfo {
    properties?: Record<string, WebComponentProperty>;
    forwardObservers?: string[];
    listeners?: { [eventName: string]: string };
    sensitive?: boolean;
}

type ComputedPropertyConfig = {
  dependencies: string[];
  methodName: string;
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

export abstract class WebComponent extends LitElement {
    static properties = {
        app: { type: Object, noAccessor: true },
        service: { type: Object, noAccessor: true },
        translations: { type: Object, computed: "_computeTranslations(service.language.messages)" },
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
        
        const computedConfig = this.#staticComputedConfig;
        if (computedConfig) {
            for (const [prop, { dependencies, methodName }] of Object.entries(computedConfig)) {
                const args = dependencies.map(dep => this.#resolvePath(dep));
                if (typeof this[methodName] === "function") {
                    const computedValue = this[methodName](...args);
                    this[prop] = computedValue;
                } else {
                    console.warn(`[${this.tagName.toLowerCase()}] Compute method '${methodName}' not found for computed property '${prop}' during initial computation.`);
                }
            }

            this.requestUpdate();
        }

        const listeners = this.#staticListenersConfig;
        if (listeners) {
            for (const eventName in listeners) {
                const handlerName = listeners[eventName];
                if (typeof this[handlerName] === 'function') {
                    this.addEventListener(eventName, this[handlerName]);
                } else {
                    console.warn(`[${this.tagName.toLowerCase()}] Listener method '${handlerName}' for event '${eventName}' not found.`);
                }
            }
        }
    }

    override disconnectedCallback() {
        super.disconnectedCallback();

        this.#disposeAllForwarders();

        const listeners = this.#staticListenersConfig;
        if (listeners) {
            for (const eventName in listeners) {
                const handlerName = listeners[eventName];
                if (typeof this[handlerName] === 'function') {
                    this.removeEventListener(eventName, this[handlerName]);
                }
            }
        }

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

    get app(): AppBase {
        // @ts-ignore
        return window.app;
    }

    get service(): Service {
        return this.app?.service;
    }

    override willUpdate(changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>) {
        super.willUpdate?.(changedProperties);

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

        const computedConfig = this.#staticComputedConfig;
        const propertyObservers = this.#staticPropertyObserversConfig;

        if (computedConfig) {
            for (const [prop, { dependencies, methodName }] of Object.entries(computedConfig)) {
                const hasChangedTopLevelDep = dependencies.some(dep =>
                    changedProperties.has(dep.split('.')[0]) || changedProperties.has(dep)
                );
                const hasChangedDeepDep = dependencies.some(dep => this.#dirtyForwardedPaths.has(dep));

                if (hasChangedTopLevelDep || hasChangedDeepDep) {
                    const args = dependencies.map(dep => this.#resolvePath(dep));
                    if (typeof this[methodName] === "function") {
                        const oldVal = this[prop];
                        const computedValue = this[methodName](...args);
                        if (oldVal !== computedValue) {
                            this[prop] = computedValue;
                            this.requestUpdate(prop as PropertyKey, oldVal);

                            // If this computed property has an observer, call it.
                            if (propertyObservers?.[prop]) {
                                const observerName = propertyObservers[prop];
                                if (typeof this[observerName] === 'function') {
                                    this[observerName](computedValue, oldVal);
                                } else {
                                    console.warn(`[${this.tagName.toLowerCase()}] Observer method '${observerName}' not found for computed property '${prop}'.`);
                                }
                            }
                        }
                    } else {
                        console.warn(`[${this.tagName.toLowerCase()}] Compute method '${methodName}' not found for computed property '${prop}'.`);
                    }
                }
            }
        }
        this.#dirtyForwardedPaths.clear();
    }

    override updated(changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>) {
        super.updated?.(changedProperties);

        const propertyObservers = this.#staticPropertyObserversConfig;
        const computedConfig = this.#staticComputedConfig;

        if (propertyObservers) {
            for (const [prop, observerName] of Object.entries(propertyObservers)) {
                // If this property is a computed property, its observer was already handled in willUpdate.
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

    #setupForwardersForRoots(rootsToRebind?: Set<string>) {
        const staticObserversConfig = this.#staticObserversConfig;
        if (Object.keys(staticObserversConfig).length === 0)
            return;

        // 1. Build pathsToObserversMap
        const pathsToObserversMap = new Map<string, string[]>();
        for (const [observerIdentifier, dependencies] of Object.entries(staticObserversConfig)) {
            for (const depPath of dependencies) {
                if (!pathsToObserversMap.has(depPath)) {
                    pathsToObserversMap.set(depPath, []);
                }
                pathsToObserversMap.get(depPath)!.push(observerIdentifier);
            }
        }

        // 2. Determine Paths for Forwarder Setup/Disposal
        const setupAll = !rootsToRebind || rootsToRebind.size === 0;
        const pathsToDisposeAndRecreate: Set<string> = new Set();
        for (const dependencies of Object.values(staticObserversConfig)) {
            for (const depPath of dependencies) {
                const pathParts = depPath.split('.');
                if (pathParts.length < 1)
                    continue;

                const rootPropertyKey = pathParts[0];
                if (setupAll || rootsToRebind?.has(rootPropertyKey)) {
                    pathsToDisposeAndRecreate.add(depPath);
                }
            }
        }

        // 3. Dispose Old Forwarders
        for (const depPath of pathsToDisposeAndRecreate) {
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

        // 4. Setup New Forwarders
        for (const depPath of pathsToDisposeAndRecreate) {
            const pathParts = depPath.split('.');
            const rootPropertyKey = pathParts[0];
            const relativePathInSource = pathParts.slice(1).join('.');
            const sourceObject = this[rootPropertyKey];

            if (sourceObject instanceof Observable || (Array.isArray(sourceObject) && relativePathInSource === "*")) {
                try {
                    const disposer = Observable.forward(sourceObject, relativePathInSource, (detail: ForwardObservedDetail) => {
                        const observerIdentifiers = pathsToObserversMap.get(depPath);
                        if (observerIdentifiers) {
                            for (const observerIdentifier of observerIdentifiers) {
                                const isPathBasedObserver = observerIdentifier === depPath;
                                if (!isPathBasedObserver && typeof this[observerIdentifier] === 'function') {
                                    this[observerIdentifier](depPath, detail, observerIdentifier);
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
    }

    #disposeAllForwarders() {
        for (const [depPath, disposer] of this.#forwarderDisposers) {
            if (typeof disposer === 'function') {
                try {
                    disposer();
                } catch (error) {
                    console.warn(`[${this.tagName.toLowerCase()}] Error disposing forwarder for '${depPath}':`, error);
                }
            }
        }
        this.#forwarderDisposers.clear();
    }

    #resolvePath(path: string): any {
        return path.split('.').reduce((obj, key) => obj?.[key], this);
    }

    #listenForApp() {
        const appChangeListener = Symbol.for("WebComponent.appChangeListener");
        window.addEventListener("app-changed", this[appChangeListener] = (e: CustomEvent) => {
            window.removeEventListener("app-changed", this[appChangeListener]);
            this[appChangeListener] = null;

            // @ts-ignore
            this.requestUpdate("app", window.app);

            if (!this.app.service)
                this.#listenForService(this.app);
        });
    }

    #listenForService(app: AppBase) {
        const serviceChangeListener = Symbol.for("WebComponent.serviceChangeListener");
        app.addEventListener("service-changed", this[serviceChangeListener] = (e: CustomEvent) => {
            app.removeEventListener("service-changed", this[serviceChangeListener]);
            this[serviceChangeListener] = null;
            
            this.requestUpdate("service", app.service);
        });
    }

    private _computeTranslations(messages: Record<string, string>) {
        return messages;
    }

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
                            console.warn(`[${tagName}] Could not parse computed string for "${propName}": ${propConfig.computed}`);
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
                            console.warn(`[${tagName}] Could not parse computed string for "${propName}": ${polyPropConfig.computed}`);
                        }
                    }
                    if (polyPropConfig.observer) {
                        propertyObserversConfigForDecorator[propName] = polyPropConfig.observer;
                    }
                }
            }

            // --- Handle Lit's static properties (remains string-keyed "properties") ---
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

            const superCtor = Object.getPrototypeOf(targetClass.prototype)?.constructor as WebComponentConstructor | undefined;

            // --- Merge and assign 'computed' configuration ---
            if (Object.keys(computedConfigForDecorator).length > 0) {
                const inheritedComputed = collectFromInheritanceChain<StaticComputedConfig>(COMPUTED_CONFIG_SYMBOL);
                (targetClass as WebComponentConstructor)[COMPUTED_CONFIG_SYMBOL] = {
                    ...inheritedComputed,
                    ...computedConfigForDecorator
                };
            }

            // --- Parse and merge 'forwardObservers' ---
            if (Array.isArray(config.forwardObservers)) {
                config.forwardObservers.forEach((observerString: string) => {
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

            // --- Merge and assign 'propertyObservers' configuration ---
            if (Object.keys(propertyObserversConfigForDecorator).length > 0) {
                const inheritedPropObs = collectFromInheritanceChain<StaticPropertyObserversConfig>(PROPERTY_OBSERVERS_CONFIG_SYMBOL);
                (targetClass as WebComponentConstructor)[PROPERTY_OBSERVERS_CONFIG_SYMBOL] = {
                    ...inheritedPropObs,
                    ...propertyObserversConfigForDecorator
                };
            }

            // --- Assign 'listeners' configuration ---
            if (config.listeners && Object.keys(config.listeners).length > 0) {
                const inheritedListeners = collectFromInheritanceChain<StaticListenersConfig>(LISTENERS_CONFIG_SYMBOL);
                (targetClass as WebComponentConstructor)[LISTENERS_CONFIG_SYMBOL] = {
                    ...inheritedListeners,
                    ...config.listeners // Current config takes precedence
                };
            }

            // --- Assign 'sensitive' configuration ---
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
    forwardObservers: [
        "test.firstName",
        "test.items.*.index",
    ],
    listeners: {
        "click": "_handleClick",
    }
}, "my-test")
class Test extends WebComponent {
    declare fullName: string;
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
        console.log("Test component rendering. FullName:", this.fullName, "Item Index:", this.test.items?.[0]?.index);
        return html`<h1>Item Index: ${this.test.items?.[0]?.index}, FullName: ${this.fullName}!</h1>`;
    }

    private _computeFullName(firstName?: string, lastName?: string): string {
        if (firstName === undefined || lastName === undefined) {
            console.log(`Computing full name: returning "Loading..." (firstName: ${firstName}, lastName: ${lastName})`);
            return "Loading...";
        }
        console.log(`Computing full name from "${firstName}" and "${lastName}"`);
        return `${firstName} ${lastName}`;
    }

    private _fullNameChanged(newValue: string, oldValue: string): void {
        console.log(`Full name changed from "${oldValue}" to "${newValue}"`);
    }

    private _testChanged(newValue: TestObject, oldValue: TestObject | undefined): void {
        const oldFullName = oldValue ? `${oldValue.firstName} ${oldValue.lastName}` : "undefined";
        console.log(`Test object changed from "${oldFullName}" to "${newValue.firstName} ${newValue.lastName}"`);
    }

    private _handleClick(event: MouseEvent): void {
        if (this.test.items[0]) {
            this.test.items[0].index = ++this.n;
            if (this.n % 2 === 0) {
                this.test.firstName = `Even ${this.n}`;
            }
        }
    }
}
