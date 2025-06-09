import { ReactiveController, PropertyValueMap } from "lit";
import { Observable, ForwardObservedPropertyChangedArgs, ForwardObservedArrayChangedArgs } from "vidyano";
import type { WebComponentLit } from "./web-component-lit";
import { getComputedConfig, getObserversConfig, getPropertyObserversConfig } from "./web-component-registration";

type ForwardObservedDetail = ForwardObservedPropertyChangedArgs | ForwardObservedArrayChangedArgs;

/**
 * A Reactive Controller that manages computed properties, observers, and deep path observation.
 */
export class WebComponentObserverController implements ReactiveController {
    private host: WebComponentLit;

    #forwarderDisposers: Map<string, () => void> = new Map();
    #dirtyForwardedPaths: Set<string> = new Set();

    constructor(host: WebComponentLit) {
        this.host = host;
        this.host.addController(this);
    }

    hostConnected(): void {
        this.#setupForwardersForRoots();
        this.#updateComputedProperties();
    }

    hostDisconnected(): void {
        this.#disposeForwarders();
    }

    /**
     * Executes the computed property and observer logic for a component update cycle.
     * This method is called from the host's `willUpdate`.
     * @param changedProperties The properties that initially triggered the update.
     * @returns A Map containing all properties that changed during the cycle, including derived and side-effect changes.
     */
    onWillUpdate(changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): Map<PropertyKey, unknown> {
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

        const observersConfig = getObserversConfig(this.host);

        // Re-bind forwarders if a root object was part of the initial change.
        if (Object.keys(observersConfig).length > 0) {
            const observedRoots = new Set<string>();
            Object.values(observersConfig).forEach(deps =>
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
            const allPropKeys = Array.from((this.host.constructor as typeof WebComponentLit).elementProperties.keys());
            const stateBeforeObservers = new Map(allPropKeys.map(p => [p, this.host[p]]));

            // STEP 2: Call single-property observers.
            const propertyObservers = getPropertyObserversConfig(this.host);
            if (propertyObservers) {
                for (const [prop, oldVal] of allChangesToObserve.entries()) {
                    const observerName = propertyObservers[prop as string];
                    if (observerName && typeof this.host[observerName] === "function") {
                        const newVal = this.host[prop as string];
                        if (newVal !== oldVal) {
                            this.host[observerName](newVal, oldVal);
                        }
                    }
                }
            }

            // STEP 3: Call complex (multi-property) observers.
            const observersConfig = getObserversConfig(this.host);
            if (observersConfig) {
                const observersToCall = new Set<string>();
                const allChangedKeys = new Set(allChangesToObserve.keys());

                for (const [observerIdentifier, dependencies] of Object.entries(observersConfig)) {
                    if (typeof this.host[observerIdentifier] !== "function")
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
                    this.host[observerIdentifier](...newArgs);
                }
            }

            // STEP 4: Detect side-effects from observers and queue them for the next pass.
            for (const propKey of allPropKeys) {
                const valBefore = stateBeforeObservers.get(propKey);
                const valAfter = this.host[propKey];
                if (valAfter !== valBefore && !totalChangedProps.has(propKey)) {
                    totalChangedProps.set(propKey, valBefore);
                    changedInLastPass.set(propKey, valBefore);
                }
            }
        }

        if (iteration >= MAX_ITERATIONS) {
            console.warn(`[${this.host.tagName.toLowerCase()}] Maximum update loops reached. Component properties may be unstable.`);
        }

        return totalChangedProps;
    }

    /**
     * Sets up forwarders for the specified root properties, or all if none specified.
     * @param rootsToRebind Optional set of root property names to rebind forwarders for.
     */
    #setupForwardersForRoots(rootsToRebind?: Set<string>) {
        const staticObserversConfig = getObserversConfig(this.host);
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
            const sourceObject = this.host[rootPropertyKey];

            try {
                // The forwarder's only job is to mark a deep path as dirty and request a new update cycle.
                // The ordered logic in `willUpdate` will then handle all observer calls correctly.
                const disposer = Observable.forward(sourceObject, relativePathInSource, (detail: ForwardObservedDetail) => {
                    this.#dirtyForwardedPaths.add(depPath);
                    this.host.requestUpdate();
                }, true);

                this.#forwarderDisposers.set(depPath, disposer);
            } catch (error) {
                console.warn(`[${this.host.tagName.toLowerCase()}] Error setting up forwarder for '${depPath}' on source:`, sourceObject, error);
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
        const computedConfig = getComputedConfig(this.host);
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
                const oldVal = this.host[prop];
                let computedValue: any;
                if (!methodName) {
                    computedValue = args[0];
                } else if (typeof this.host[methodName] === "function") {
                    computedValue = this.host[methodName](...args);
                } else {
                    console.warn(`[${this.host.tagName.toLowerCase()}] Compute method '${methodName}' not found for computed property '${prop}'.`);
                    continue;
                }

                if (oldVal !== computedValue) {
                    this.host[prop] = computedValue;
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
                    console.warn(`[${this.host.tagName.toLowerCase()}] Error disposing forwarder for '${depPath}':`, error);
                }
            }
            this.#forwarderDisposers.delete(depPath);
        }
    }

    /**
     * Resolves a dot-separated path string to a value starting from the host instance.
     * @param path Dot-separated property path (e.g., "someObject.someProp").
     * @returns The resolved value or undefined.
     */
    #resolvePath(path: string): any {
        return path.split('.').reduce((obj, key) => obj?.[key], this.host);
    }
}