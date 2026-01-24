import { Service, Application } from "@vidyano/core";
import { VirtualServiceHooks } from "./virtual-service-hooks.js";
import { VirtualPersistentObjectConfig, VirtualQueryConfig, ActionConfig } from "./types.js";
import { RuleValidatorFn } from "./business-rules.js";
import { VirtualPersistentObjectActions } from "./virtual-persistent-object-actions.js";

/**
 * A virtual service for testing without a backend.
 *
 * Register PersistentObjects, Queries, Actions, and BusinessRules before calling initialize().
 * Once initialize() is called, no more registrations are allowed.
 *
 * @example
 * ```typescript
 * const service = new VirtualService();
 * service.registerPersistentObject({ type: "Person", attributes: [...] });
 * service.registerQuery({ name: "AllPersons", persistentObject: "Person" });
 * await service.initialize();
 *
 * // Now use the service
 * const query = await service.getQuery("AllPersons");
 * ```
 */
export class VirtualService extends Service {
    #isInitialized = false;

    /**
     * Creates a new VirtualService instance.
     * @param hooks - Optional custom VirtualServiceHooks. If not provided, a default instance is created.
     */
    constructor(hooks?: VirtualServiceHooks) {
        super("http://virtual.local", hooks ?? new VirtualServiceHooks(), true);
    }

    /**
     * Gets the VirtualServiceHooks instance.
     */
    get virtualHooks(): VirtualServiceHooks {
        return this.hooks as VirtualServiceHooks;
    }

    /**
     * Initializes the service and finalizes all registrations.
     * After this method is called, no more registrations are allowed.
     */
    public async initialize(skipDefaultCredentialLogin?: boolean): Promise<Application>;
    public async initialize(oneTimeSignInToken: string): Promise<Application>;
    public async initialize(arg?: boolean | string): Promise<Application> {
        this.#isInitialized = true;
        return super.initialize(arg as any);
    }

    /**
     * Registers a PersistentObject configuration.
     * Must be called before initialize().
     * @param config - The PersistentObject configuration.
     * @throws Error if called after initialize().
     */
    registerPersistentObject(config: VirtualPersistentObjectConfig): void {
        this.#ensureNotInitialized();
        this.virtualHooks.registerPersistentObject(config);
    }

    /**
     * Registers a Query configuration.
     * Must be called before initialize().
     * @param config - The Query configuration.
     * @throws Error if called after initialize().
     */
    registerQuery(config: VirtualQueryConfig): void {
        this.#ensureNotInitialized();
        this.virtualHooks.registerQuery(config);
    }

    /**
     * Registers a custom action that can be used on PersistentObjects and Queries.
     * Must be called before initialize().
     * @param config - The action configuration with handler.
     * @throws Error if called after initialize().
     */
    registerAction(config: ActionConfig): void {
        this.#ensureNotInitialized();
        this.virtualHooks.registerAction(config);
    }

    /**
     * Registers a custom business rule for validation.
     * Must be called before initialize().
     * @param name - The rule name (cannot override built-in rules).
     * @param validator - The validation function.
     * @throws Error if called after initialize().
     */
    registerBusinessRule(name: string, validator: RuleValidatorFn): void {
        this.#ensureNotInitialized();
        this.virtualHooks.registerBusinessRule(name, validator);
    }

    /**
     * Registers a VirtualPersistentObjectActions class for a specific type.
     * Must be called before initialize().
     * @param type - The PersistentObject type name.
     * @param ActionsClass - The VirtualPersistentObjectActions class constructor.
     * @throws Error if called after initialize().
     */
    registerPersistentObjectActions(type: string, ActionsClass: typeof VirtualPersistentObjectActions): void {
        this.#ensureNotInitialized();
        this.virtualHooks.registerPersistentObjectActions(type, ActionsClass);
    }

    /**
     * Throws an error if the service has already been initialized.
     */
    #ensureNotInitialized(): void {
        if (this.#isInitialized)
            throw new Error("Cannot register after initialize() has been called");
    }
}
