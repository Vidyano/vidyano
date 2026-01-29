import { VirtualPersistentObjectActions, initializeActions } from "../virtual-persistent-object-actions.js";
import type { BusinessRuleValidator } from "../business-rules.js";
import type { VirtualService } from "../virtual-service.js";

/** Lifecycle methods that can be overridden in VirtualPersistentObjectActions */
type LifecycleMethod = "onSave" | "onNew" | "onDelete" | "onRefresh" | "onLoad" | "onConstruct" | "onConstructQuery" | "onSelectReference" | "onExecuteQuery" | "getEntities";

/** Mapping of overridden lifecycle methods to actions */
interface OverrideInfo {
    overriddenMethods: Set<LifecycleMethod>;
}

/**
 * Registry for managing VirtualPersistentObjectActions classes
 * Provides methods to register actions classes and create instances
 */
export class VirtualPersistentObjectActionsRegistry {
    #actionsClasses = new Map<string, typeof VirtualPersistentObjectActions>();
    #overrideInfo = new Map<string, OverrideInfo>();
    #validator: BusinessRuleValidator;
    #service: VirtualService;

    constructor(validator: BusinessRuleValidator, service: VirtualService) {
        this.#validator = validator;
        this.#service = service;
    }

    /**
     * Registers a VirtualPersistentObjectActions class for a specific type
     * @param type - The PersistentObject type name
     * @param ActionsClass - The VirtualPersistentObjectActions class constructor
     */
    register(type: string, ActionsClass: typeof VirtualPersistentObjectActions): void {
        this.#actionsClasses.set(type, ActionsClass);

        // Detect overridden methods
        const overriddenMethods = this.#detectOverriddenMethods(ActionsClass);
        this.#overrideInfo.set(type, { overriddenMethods });
    }

    /**
     * Detects which lifecycle methods are overridden in the given class
     * @param ActionsClass - The VirtualPersistentObjectActions class constructor
     * @returns Set of overridden method names
     */
    #detectOverriddenMethods(ActionsClass: typeof VirtualPersistentObjectActions): Set<LifecycleMethod> {
        const overridden = new Set<LifecycleMethod>();
        const baseProto = VirtualPersistentObjectActions.prototype;
        const classProto = ActionsClass.prototype;

        const methodsToCheck: LifecycleMethod[] = [
            "onSave", "onNew", "onDelete", "onRefresh",
            "onLoad", "onConstruct", "onConstructQuery", "onSelectReference", "onExecuteQuery", "getEntities"
        ];

        for (const methodName of methodsToCheck) {
            if (classProto[methodName] !== baseProto[methodName])
                overridden.add(methodName);
        }

        return overridden;
    }

    /**
     * Checks if a specific lifecycle method is overridden for a type
     * @param type - The PersistentObject type name
     * @param methodName - The lifecycle method name
     * @returns true if the method is overridden, false otherwise
     */
    isMethodOverridden(type: string, methodName: LifecycleMethod): boolean {
        const info = this.#overrideInfo.get(type);
        if (!info)
            return false;

        return info.overriddenMethods.has(methodName);
    }

    /**
     * Checks if a type has registered actions
     * @param type - The PersistentObject type name
     * @returns true if the type has registered actions, false otherwise
     */
    has(type: string): boolean {
        return this.#actionsClasses.has(type);
    }

    /**
     * Creates a new instance of the actions class for a type
     * Returns a default VirtualPersistentObjectActions if no custom actions are registered
     * Injects validator, service, and type into the instance
     * @param type - The PersistentObject type name
     * @returns A new instance of the VirtualPersistentObjectActions class
     */
    createInstance(type: string): VirtualPersistentObjectActions {
        const ActionsClass = this.#actionsClasses.get(type);
        const instance = ActionsClass ? new ActionsClass() : new VirtualPersistentObjectActions();

        // Inject validator, service, and type via internal symbol
        instance[initializeActions](this.#validator, this.#service, type);

        return instance;
    }
}
