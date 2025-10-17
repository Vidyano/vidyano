import { ReactiveController, PropertyValueMap } from "lit";
import { Observable, ForwardObservedPropertyChangedArgs, ForwardObservedArrayChangedArgs } from "vidyano";
import type { WebComponent } from "./web-component";
import { ComputedConfig, getComputedConfig, getObserversConfig, getPropertyObserversConfig, getNotifyConfig } from "./web-component-registration";

type ForwardObservedDetail = ForwardObservedPropertyChangedArgs | ForwardObservedArrayChangedArgs;

interface UpdateContext {
    totalChangedProps: Map<PropertyKey, unknown>;
    dirtyPathsForThisUpdate: Set<string>;
    lastComplexObserverArgs: Map<string, any[]>;
}

interface ObserverExecutionResult {
    changedProperties: Map<string, any>;
    sideEffectChanges: Map<PropertyKey, unknown>;
}

const MAX_ITERATIONS = 10;

/**
 * A Reactive Controller that manages computed properties, observers, and deep path observation.
 */
export class WebComponentObserverController implements ReactiveController {
    #host: WebComponent;

    #forwarderDisposers: Map<string, () => void> = new Map();
    #dirtyForwardedPaths: Set<string> = new Set();
    #pendingComputedTokens: Map<string, number> = new Map();
    #tokenCounter = 0;

    constructor(host: WebComponent) {
        this.#host = host;
        this.#host.addController(this);
    }

    hostConnected(): void {
        this.#setupForwardersForRoots();
    }

    hostDisconnected(): void {
        this.#disposeForwarders();
    }

    /**
     * Executes the computed property and observer logic for a component update cycle.
     * This method orchestrates the reactive update process, handling computed properties,
     * observers, and side effects in a controlled iterative manner.
     * @param changedProperties The properties that initially triggered the update.
     * @returns A Map containing all properties that changed during the cycle, including derived and side-effect changes.
     */
    onWillUpdate(changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): Map<PropertyKey, unknown> {
        const context = this.#initializeUpdateContext(changedProperties);
        
        this.#rebindForwardersIfNeeded(changedProperties);
        
        return this.#executeUpdateLoop(context);
    }

    /**
     * Initializes the context for a single update cycle.
     * This consolidates the initial changed properties, captures the current set of
     * dirty paths from deep observers, and prepares a map to track observer arguments,
     * ensuring a clean state for the new update loop.
     * @param changedProperties The initial map of properties that Lit detected as changed.
     * @returns An UpdateContext object to be used throughout the update cycle.
     */
    #initializeUpdateContext(changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): UpdateContext {
        return {
            totalChangedProps: new Map(changedProperties.entries()),
            dirtyPathsForThisUpdate: new Set(this.#dirtyForwardedPaths),
            lastComplexObserverArgs: new Map<string, any[]>()
        };
    }

    /**
     * Checks if any root properties of complex observer paths have been replaced.
     * If a root object (e.g., `this.app` in an observer for `app.user.name`) has changed,
     * this method triggers the process to dispose of the old forwarders and set up new
     * ones on the new root object. This is crucial for preventing memory leaks and
     * ensuring continued observation on the correct data sources.
     * @param changedProperties The map of properties that have changed in this update cycle.
     */
    #rebindForwardersIfNeeded(changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        const observersConfig = getObserversConfig(this.#host);
        const computedConfig = getComputedConfig(this.#host);

        if (Object.keys(observersConfig).length === 0 && Object.keys(computedConfig).length === 0)
            return;

        const observedRoots = this.#extractObservedRoots(observersConfig, computedConfig);
        const changedRoots = this.#findChangedRoots(observedRoots, changedProperties);

        if (changedRoots.size > 0) {
            this.#setupForwardersForRoots(changedRoots);
        }
    }

    /**
     * Scans the static observer configurations and extracts the unique root property names.
     * For a dependency path like "app.user.name", the root is "app".
     * @param observersConfig The complete observer configuration for the component.
     * @returns A Set of unique root property names.
     */
    #extractObservedRoots(observersConfig: Record<string, { dependencies: string[], allowUndefined: boolean }>, computedConfig: ComputedConfig): Set<string> {
        const observedRoots = new Set<string>();

        Object.values(observersConfig).forEach(config =>
            config.dependencies.forEach(depPath => {
                const root = depPath.split('.')[0];
                if (root) observedRoots.add(root);
            })
        );

        Object.values(computedConfig).forEach(config => {
            config.dependencies.forEach(depPath => {
                const root = depPath.split('.')[0];
                if (root) observedRoots.add(root);
            })
        });

        return observedRoots;
    }

    /**
     * Compares the set of all observed roots against the currently changed properties
     * to determine which roots need their forwarders rebound.
     * @param observedRoots A Set of all root properties that are part of an observer.
     * @param changedProperties The map of properties that have changed in this cycle.
     * @returns A Set containing only the root properties that have actually changed.
     */
    #findChangedRoots(observedRoots: Set<string>, changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): Set<string> {
        const changedRoots = new Set<string>();
        for (const rootKey of observedRoots) {
            if (changedProperties.has(rootKey)) {
                changedRoots.add(rootKey);
            }
        }

        return changedRoots;
    }

    /**
     * Runs the main reactive update loop until the component's state stabilizes.
     *
     * The first pass is initiated by either Lit's initial `changedProperties` or by
     * deep-path changes captured in `context.dirtyPathsForThisUpdate`. Subsequent passes
     * run only if the previous pass generated new property changes (from computed properties
     * or observer side effects).
     *
     * Each pass in the loop:
     * 1. Calculates computed properties based on the changes from the previous pass (or initial triggers).
     * 2. Executes all relevant observers for those changes.
     * 3. Detects any side effects (properties changed by observers).
     *
     * This iterative process ensures that all cascading effects are fully resolved before
     * the component renders. It includes a safety break to prevent infinite loops.
     *
     * @param context The context for the current update cycle.
     * @returns The final, consolidated map of all properties that changed, including initial,
     * computed, and side-effect changes.
     */
    #executeUpdateLoop(context: UpdateContext): Map<PropertyKey, unknown> {
        this.#dirtyForwardedPaths.clear();

        let changedInLastPass = new Map(context.totalChangedProps.entries());
        let iteration = 0;

        // The first iteration is special: it runs if there are initial changes OR dirty paths.
        // Subsequent iterations only run if the last pass produced more changes.
        let shouldRunFirstPass = changedInLastPass.size > 0 || context.dirtyPathsForThisUpdate.size > 0;

        while ((shouldRunFirstPass || changedInLastPass.size > 0) && iteration < MAX_ITERATIONS) {
            iteration++;

            const passResult = this.#executeUpdatePass(
                changedInLastPass,
                context.dirtyPathsForThisUpdate,
                context.lastComplexObserverArgs
            );

            // The dirty paths have served their purpose of initiating the first-pass reaction.
            // Clear them so they don't cause re-runs in the next iteration.
            if (shouldRunFirstPass) {
                context.dirtyPathsForThisUpdate.clear();
                shouldRunFirstPass = false;
            }

            this.#mergeChangedProperties(context.totalChangedProps, passResult.changedProperties);
            this.#mergeChangedProperties(context.totalChangedProps, passResult.sideEffectChanges);

            changedInLastPass = new Map([
                ...passResult.changedProperties.entries(),
                ...passResult.sideEffectChanges.entries()
            ]);
        }

        if (iteration >= MAX_ITERATIONS) {
            console.warn(`[${this.#host.tagName.toLowerCase()}] Maximum update loops reached. Component properties may be unstable.`);
        }

        return context.totalChangedProps;
    }

    /**
     * Determines if the update loop should continue for another iteration.
     * The loop continues if properties were changed in the previous pass, or if it's the
     * first pass and there are pending deep-path changes.
     * @param changedInLastPass A map of properties that changed in the previous iteration.
     * @param isFirstIteration A flag indicating if this is the first iteration of the loop.
     * @param dirtyPaths The set of deep paths that were marked as dirty for this update cycle.
     * @returns True if the loop should continue, false otherwise.
     */
    #shouldContinueLoop(changedInLastPass: Map<PropertyKey, unknown>, isFirstIteration: boolean, dirtyPaths: Set<string>): boolean {
        return changedInLastPass.size > 0 || (isFirstIteration && dirtyPaths.size > 0);
    }

    /**
     * Executes a single pass of the update cycle, which involves updating computed
     * properties and then running all relevant observers.
     * @param changedProperties The properties that changed in the previous pass.
     * @param dirtyPaths The set of deep paths marked as dirty for this update cycle.
     * @param lastComplexObserverArgs A map tracking the last arguments passed to complex observers.
     * @returns An object containing newly changed computed properties and any side-effect changes.
     */
    #executeUpdatePass(changedProperties: Map<PropertyKey, unknown>, dirtyPaths: Set<string>,lastComplexObserverArgs: Map<string, any[]>): ObserverExecutionResult {
        const changedComputedProps = this.#updateComputedProperties(changedProperties, dirtyPaths);
        const allChangesToObserve = new Map([...changedProperties.entries(), ...changedComputedProps.entries()]);
        
        if (allChangesToObserve.size === 0 && dirtyPaths.size === 0) {
            return { changedProperties: changedComputedProps, sideEffectChanges: new Map() };
        }

        const sideEffectChanges = this.#executeObserversAndDetectSideEffects(
            allChangesToObserve, 
            dirtyPaths, 
            lastComplexObserverArgs
        );

        return { changedProperties: changedComputedProps, sideEffectChanges };
    }

    /**
     * Orchestrates the execution of all observers and the subsequent detection of side effects.
     * It captures the component's state, runs all property and complex observers, and then
     * compares the state to detect any properties that were changed by the observers.
     * @param changedProperties All properties that have changed so far in this pass.
     * @param dirtyPaths The set of deep paths marked as dirty.
     * @param lastComplexObserverArgs A map tracking the last arguments passed to complex observers.
     * @returns A map of properties that were changed as a side effect of running observers.
     */
    #executeObserversAndDetectSideEffects(changedProperties: Map<PropertyKey, unknown>, dirtyPaths: Set<string>,lastComplexObserverArgs: Map<string, any[]>): Map<PropertyKey, unknown> {
        const stateBeforeObservers = this.#capturePropertyState();

        this.#executePropertyObservers(changedProperties);
        this.#executeComplexObservers(changedProperties, dirtyPaths, lastComplexObserverArgs);
        this.#dispatchNotifyEvents(changedProperties);

        return this.#detectSideEffects(stateBeforeObservers);
    }

    /**
     * Captures the current value of all declared properties on the host component.
     * @returns A map where keys are property names and values are their current values.
     */
    #capturePropertyState(): Map<PropertyKey, any> {
        const allPropKeys = Array.from((this.#host.constructor as typeof WebComponent).elementProperties.keys());
        return new Map(allPropKeys.map(prop => [prop, this.#host[prop]]));
    }

    /**
     * Executes single-property observers for any property that has changed in this pass.
     * @param changedProperties A map of properties that have changed.
     */
    #executePropertyObservers(changedProperties: Map<PropertyKey, unknown>): void {
        const propertyObservers = getPropertyObserversConfig(this.#host);
        if (!propertyObservers) return;

        for (const [prop, oldVal] of changedProperties.entries()) {
            const observerFunction = propertyObservers[prop as string];
            if (!observerFunction) continue;

            const newVal = this.#host[prop as string];
            if (newVal === oldVal) continue;

            try {
                // Call the function with the host as `this` context
                observerFunction.call(this.#host, newVal, oldVal);
            } catch (e) {
                const observerName = observerFunction.name || '<anonymous>';
                console.error(`[${this.#host.tagName.toLowerCase()}] Error in property observer '${observerName}' for property '${String(prop)}':`, e);
            }
        }
    }

    /**
     * Dispatches notify events for properties that have the @notify decorator.
     * Converts camelCase property names to kebab-case-changed event names by default.
     * @param changedProperties A map of properties that have changed.
     */
    #dispatchNotifyEvents(changedProperties: Map<PropertyKey, unknown>): void {
        const notifyConfig = getNotifyConfig(this.#host);
        if (!notifyConfig || Object.keys(notifyConfig).length === 0) return;

        for (const [prop, oldVal] of changedProperties.entries()) {
            const eventConfig = notifyConfig[prop as string];
            if (eventConfig) {
                const newVal = this.#host[prop as string];
                if (newVal !== oldVal) {
                    // Determine event name: custom name or auto-generated kebab-case-changed
                    const eventName = eventConfig === true
                        ? this.#toKebabCaseChanged(prop as string)
                        : eventConfig;

                    try {
                        this.#host.dispatchEvent(new CustomEvent(eventName, {
                            detail: { value: newVal },
                            bubbles: false,
                            composed: true
                        }));
                    } catch (e) {
                        console.error(`[${this.#host.tagName.toLowerCase()}] Error dispatching notify event '${eventName}' for property '${String(prop)}':`, e);
                    }
                }
            }
        }
    }

    /**
     * Converts a camelCase property name to kebab-case-changed event name.
     * Example: "scrollTop" -> "scroll-top-changed"
     * @param propertyName The camelCase property name
     * @returns The kebab-case event name with -changed suffix
     */
    #toKebabCaseChanged(propertyName: string): string {
        return propertyName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase() + '-changed';
    }

    /**
     * Orchestrates the execution of complex (multi-property) observers. It first identifies
     * which observers need to run based on their dependencies and then calls them.
     * @param changedProperties A map of properties that have changed in this pass.
     * @param dirtyPaths The set of deep paths marked as dirty.
     * @param lastComplexObserverArgs A map tracking the last arguments passed to complex observers.
     */
    #executeComplexObservers(changedProperties: Map<PropertyKey, unknown>, dirtyPaths: Set<string>, lastComplexObserverArgs: Map<string, any[]>): void {
        const observersConfig = getObserversConfig(this.#host);
        if (!observersConfig) return;

        const observersToCall = this.#identifyObserversToCall(observersConfig, changedProperties, dirtyPaths);
        
        for (const observerIdentifier of observersToCall) {
            this.#executeComplexObserver(observerIdentifier, observersConfig, lastComplexObserverArgs);
        }
    }

    /**
     * Identifies which complex observers should be called based on their dependencies.
     * An observer is triggered if one of its dependency properties, the root of a dependency path,
     * or a full deep dependency path has changed.
     * @param observersConfig The complete observer configuration.
     * @param changedProperties A map of properties that have changed.
     * @param dirtyPaths The set of deep paths marked as dirty.
     * @returns A Set of observer method names that should be called.
     */
    #identifyObserversToCall(observersConfig: Record<string, { dependencies: string[], allowUndefined: boolean }>, changedProperties: Map<PropertyKey, unknown>, dirtyPaths: Set<string>): Set<string> {
        const observersToCall = new Set<string>();
        const allChangedKeys = new Set(changedProperties.keys());

        for (const [observerIdentifier, config] of Object.entries(observersConfig)) {
            if (typeof this.#host[observerIdentifier] !== 'function') continue;

            const hasChangedDep = config.dependencies.some(dep => {
                const rootDep = dep.split('.')[0];
                return (
                    allChangedKeys.has(dep) ||
                    allChangedKeys.has(rootDep) ||
                    dirtyPaths.has(dep)
                );
            });

            if (hasChangedDep) {
                observersToCall.add(observerIdentifier);
            }
        }

        return observersToCall;
    }

    /**
     * Executes a single complex observer method. It includes an optimization to prevent
     * redundant calls if the resolved values of its dependencies have not changed
     * since the last time it was called in this update cycle.
     *
     * By default, the observer is only called if none of the arguments are undefined.
     * If allowUndefined is true, the observer will be called regardless.
     *
     * @param observerIdentifier The name of the observer method to call.
     * @param observersConfig The complete observer configuration.
     * @param lastComplexObserverArgs A map for tracking observer arguments to prevent redundant calls.
     */
    #executeComplexObserver(observerIdentifier: string, observersConfig: Record<string, { dependencies: string[], allowUndefined: boolean }>, lastComplexObserverArgs: Map<string, any[]>): void {
        const config = observersConfig[observerIdentifier];
        const newArgs = config.dependencies.map(dep => this.#resolvePath(dep));

        // Check for undefined values unless allowUndefined is true
        if (!config.allowUndefined && newArgs.some(arg => arg === undefined)) {
            return;
        }

        const oldArgs = lastComplexObserverArgs.get(observerIdentifier);
        if (oldArgs && this.#areArgumentsEqual(oldArgs, newArgs)) {
            return;
        }

        lastComplexObserverArgs.set(observerIdentifier, newArgs);
        try {
            this.#host[observerIdentifier](...newArgs);
        } catch (e) {
            console.error(`[${this.#host.tagName.toLowerCase()}] Error in observer '${observerIdentifier}':`, e);
        }
    }

    /**
     * Performs a shallow comparison of two argument arrays.
     * @param oldArgs The previous array of arguments.
     * @param newArgs The new array of arguments.
     * @returns True if the arrays are of the same length and all corresponding values are strictly equal.
     */
    #areArgumentsEqual(oldArgs: any[], newArgs: any[]): boolean {
        return oldArgs.length === newArgs.length && 
               oldArgs.every((value, index) => value === newArgs[index]);
    }

    /**
     * Detects properties that were changed as a side effect of running observers.
     * It compares the component's property state from before the observers ran with the
     * state after they ran.
     * @param stateBeforeObservers A map of property values captured before observers were executed.
     * @returns A map of properties that were changed, with their original (pre-observer) values.
     */
    #detectSideEffects(stateBeforeObservers: Map<PropertyKey, any>): Map<PropertyKey, unknown> {
        const sideEffectChanges = new Map<PropertyKey, unknown>();
        
        for (const propKey of stateBeforeObservers.keys()) {
            const valueBefore = stateBeforeObservers.get(propKey);
            const valueAfter = this.#host[propKey];
            
            if (valueAfter !== valueBefore) {
                sideEffectChanges.set(propKey, valueBefore);
            }
        }

        return sideEffectChanges;
    }

    /**
     * Merges newly changed properties into a target map.
     * This ensures that the original "old value" of a property from the very start of the
     * update cycle is preserved, which is what Lit expects in `willUpdate`.
     * @param target The main map of all changed properties for the entire update cycle.
     * @param source The map of properties that changed in a more recent step.
     */
    #mergeChangedProperties(target: Map<PropertyKey, unknown>, source: Map<PropertyKey, unknown>): void {
        for (const [prop, oldVal] of source.entries()) {
            if (!target.has(prop)) {
                target.set(prop, oldVal);
            }
        }
    }

    /**
     * Sets up forwarders for the specified root properties, or all if none specified.
     * A "forwarder" is a deep observer that listens for changes on a nested path.
     * @param rootsToRebind Optional set of root property names to rebind forwarders for.
     */
    #setupForwardersForRoots(rootsToRebind?: Set<string>) {
        const staticObserversConfig = getObserversConfig(this.#host);
        const staticComputedConfig = getComputedConfig(this.#host);

        if (Object.keys(staticObserversConfig).length === 0 && Object.keys(staticComputedConfig).length === 0)
            return;

        const pathsToRebind = this.#determinePathsToRebind(staticObserversConfig, staticComputedConfig, rootsToRebind);
        this.#disposeForwarders(pathsToRebind);
        this.#createForwarders(pathsToRebind);
    }

    /**
     * Analyzes observer configurations to determine which specific dependency paths
     * require an active forwarder.
     * @param observersConfig The complete observer configuration.
     * @param computedConfig The computed properties configuration.
     * @param rootsToRebind An optional set of roots to scope the rebinding to.
     * @returns A Set of full dependency paths (e.g., "app.user.name") that need a forwarder.
     */
    #determinePathsToRebind(observersConfig: Record<string, { dependencies: string[], allowUndefined: boolean }>, computedConfig: ComputedConfig, rootsToRebind?: Set<string>): Set<string> {
        const allDependencies = new Set<string>();
        Object.values(observersConfig).forEach(config => config.dependencies.forEach(dep => allDependencies.add(dep)));
        Object.values(computedConfig).forEach(config => config.dependencies.forEach(dep => allDependencies.add(dep)));

        const setupAll = !rootsToRebind || rootsToRebind.size === 0;
        const pathsToRebind = new Set<string>();

        for (const depPath of allDependencies) {
            // Forwarders are only for deep paths. Simple properties are handled by Lit.
            if (!depPath.includes('.'))
                continue;

            const rootKey = depPath.split('.')[0];
            if (setupAll || (rootsToRebind && rootsToRebind.has(rootKey))) {
                pathsToRebind.add(depPath);
            }
        }

        return pathsToRebind;
    }

    /**
     * Creates deep-path observers (`forwarders`) for a given set of paths and
     * stores their disposer functions for future cleanup.
     * @param pathsToRebind A Set of dependency paths to create forwarders for.
     */
    #createForwarders(pathsToRebind: Set<string>): void {
        for (const depPath of pathsToRebind) {
            const pathParts = depPath.split('.');
            const rootPropertyKey = pathParts[0];
            const relativePathInSource = pathParts.slice(1).join('.');
            const sourceObject = this.#host[rootPropertyKey];

            if (!sourceObject)
                continue;

            try {
                const disposer = Observable.forward(
                    sourceObject, 
                    relativePathInSource, 
                    (detail: ForwardObservedDetail) => {
                        this.#dirtyForwardedPaths.add(depPath);
                        this.#host.requestUpdate();
                    }, 
                    true
                );

                this.#forwarderDisposers.set(depPath, disposer);
            } catch (error) {
                console.warn(`[${this.#host.tagName.toLowerCase()}] Error setting up forwarder for '${depPath}' on source:`, sourceObject, error);
            }
        }
    }

    /**
     * Calculates and updates all computed properties based on their dependencies.
     * If called with no arguments, it re-computes all properties.
     * If dependencies have changed, it recalculates the property's value and updates it on the host.
     * @param changedProperties The set of properties that changed, used to determine which computed properties to re-evaluate.
     * @param dirtyPaths The set of deep paths that changed, also used as a trigger.
     * @returns A Map of computed properties that changed, mapping to their old values.
     */
    #updateComputedProperties(changedProperties?: PropertyValueMap<any> | Map<PropertyKey, unknown>, dirtyPaths?: Set<string>): Map<string, any> {
        const computedConfig = getComputedConfig(this.#host);
        const changedComputedProps = new Map<string, any>();

        if (!computedConfig)
            return changedComputedProps;

        const changedKeys = changedProperties ? new Set(changedProperties.keys()) : null;

        for (const [prop, config] of Object.entries(computedConfig)) {
            const shouldUpdate = this.#shouldUpdateComputedProperty(config.dependencies, changedKeys, dirtyPaths);

            if (shouldUpdate) {
                const oldValue = this.#host[prop];
                const newValue = this.#computePropertyValue(config);

                if (newValue instanceof Promise) {
                    const token = ++this.#tokenCounter;
                    this.#pendingComputedTokens.set(prop, token);
                    newValue.then(resolved => {
                        if (this.#pendingComputedTokens.get(prop) !== token)
                            return;

                        this.#pendingComputedTokens.delete(prop);

                        const currentValue = this.#host[prop];
                        if (currentValue !== resolved) {
                            this.#host[prop] = resolved;
                            this.#host.requestUpdate(prop, currentValue);
                        }
                    }).catch(e => {
                        console.error(`[${this.#host.tagName.toLowerCase()}] Error computing '${String(prop)}':`, e);
                    });
                }
                else if (oldValue !== newValue) {
                    this.#host[prop] = newValue;
                    changedComputedProps.set(prop, oldValue);
                }
            }
        }

        return changedComputedProps;
    }

    /**
     * Determines if a computed property should be re-evaluated.
     * A re-evaluation is needed if any of its direct dependencies, the root of a deep dependency,
     * or a full deep dependency path has changed.
     * @param dependencies The list of dependency paths for the computed property.
     * @param changedKeys A Set of property keys that have changed.
     * @param dirtyPaths A Set of deep paths that have changed.
     * @returns True if the property should be updated, false otherwise.
     */
    #shouldUpdateComputedProperty(dependencies: string[], changedKeys: Set<PropertyKey> | null, dirtyPaths?: Set<string>): boolean {
        if (!changedKeys)
            return true; // Initial run: always update

        return dependencies.some(dep =>
            changedKeys.has(dep) ||
            changedKeys.has(dep.split('.')[0]) ||
            (dirtyPaths && dirtyPaths.has(dep))
        );
    }

    /**
     * Computes the new value for a property. It either forwards a single dependency's
     * value or calls a specified compute method with the resolved values of all dependencies.
     *
     * By default, computed properties are only calculated if none of the arguments are undefined.
     * If allowUndefined is true, the computation will proceed regardless.
     *
     * @param config The computed property configuration including dependencies, methodName, and allowUndefined.
     * @returns The newly computed value, or undefined if blocked by undefined dependencies.
     */
    #computePropertyValue(config: { dependencies: string[], methodName?: string, allowUndefined: boolean }): any {
        const args = config.dependencies.map(dep => this.#resolvePath(dep));

        // Check for undefined values unless allowUndefined is true
        if (!config.allowUndefined && args.some(arg => arg === undefined)) {
            return undefined;
        }

        if (!config.methodName)
            return args[0]; // Simple forwarding

        if (typeof this.#host[config.methodName] === 'function')
            return this.#host[config.methodName](...args);

        console.warn(`[${this.#host.tagName.toLowerCase()}] Compute method '${config.methodName}' not found.`);
        return undefined;
    }

    /**
     * Disposes of active forwarders to prevent memory leaks. This is critical for cleanup
     * when the component is disconnected or when a root dependency object is replaced.
     * @param depPaths Optional iterable of specific dependency paths to dispose. If not
     * provided, all active forwarders for the component are disposed.
     */
    #disposeForwarders(depPaths?: Iterable<string>) {
        const paths = depPaths ? Array.from(depPaths) : Array.from(this.#forwarderDisposers.keys());
        for (const depPath of paths) {
            const disposer = this.#forwarderDisposers.get(depPath);
            if (typeof disposer === 'function') {
                try {
                    disposer();
                } catch (error) {
                    console.warn(`[${this.#host.tagName.toLowerCase()}] Error disposing forwarder for '${depPath}':`, error);
                }
            }
            this.#forwarderDisposers.delete(depPath);
        }
    }

    /**
     * Resolves a dot-separated property path string to a value, starting from the host component.
     * @param path The dot-separated property path (e.g., "app.user.name").
     * @returns The resolved value, or undefined if any part of the path is nullish.
     */
    #resolvePath(path: string): any {
        return path.split('.').reduce((obj, key) => obj?.[key], this.#host);
    }
}
