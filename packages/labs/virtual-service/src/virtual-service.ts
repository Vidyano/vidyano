import { Service, Application } from "@vidyano/core";
import { fromServiceValue } from "./virtual-service-data-type.js";
import { VirtualServiceHooks } from "./virtual-service-hooks.js";
import { VirtualPersistentObjectConfig, VirtualQueryConfig, ActionConfig, ActionHandler } from "./types.js";
import { BusinessRuleValidator, RuleValidatorFn } from "./business-rules.js";
import { VirtualPersistentObjectActions } from "./virtual-persistent-object-actions.js";
import { VirtualPersistentObjectActionsRegistry } from "./registry/virtual-persistent-object-actions-registry.js";
import { VirtualPersistentObjectRegistry } from "./registry/virtual-persistent-object-registry.js";
import { VirtualQueryRegistry } from "./registry/virtual-query-registry.js";

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
    readonly #businessRuleValidator: BusinessRuleValidator;
    readonly #actionsRegistry: VirtualPersistentObjectActionsRegistry;
    readonly #persistentObjectRegistry: VirtualPersistentObjectRegistry;
    readonly #queryRegistry: VirtualQueryRegistry;
    readonly #actionDefinitions = new Map<string, { name: string; displayName: string; isPinned: boolean }>();
    readonly #actionHandlers = new Map<string, ActionHandler>();
    readonly #builtInActions = new Set(["New", "Delete", "SelectReference", "RefreshQuery", "Edit", "CancelEdit", "Save", "EndEdit"]);

    // Global (static) messages
    static #messages: Record<string, string> = {
        "Required": "This field is required",
        "NotEmpty": "This field cannot be empty",
        "IsEmail": "Email format is invalid",
        "IsUrl": "Value must be a valid URL",
        "MaxLength": "Maximum length is {0} characters",
        "MinLength": "Minimum length is {0} characters",
        "MaxValue": "Maximum value is {0}",
        "MinValue": "Minimum value is {0}",
        "IsBase64": "Value must be a valid base64 string",
        "IsRegex": "Value must be a valid regular expression",
        "IsWord": "Value must contain only word characters",
        "ValidationRulesFailed": "Some required information is missing or incorrect."
    };

    /**
     * Gets a copy of the global messages dictionary.
     */
    static get messages(): Record<string, string> {
        return { ...VirtualService.#messages };
    }

    /**
     * Sets the global messages dictionary.
     * Use this to provide translations or override default messages.
     * @example
     * VirtualService.messages = {
     *     "Required": "Dit veld is verplicht",
     *     "MaxLength": "Maximale lengte is {0} tekens"
     * };
     */
    static set messages(value: Record<string, string>) {
        VirtualService.#messages = { ...value };
    }

    /**
     * Converts a service string value to a primitive JavaScript type.
     * Unlike Service.fromServiceString, this returns number instead of BigNumber
     * for numeric types (Decimal, Double, Int64, etc.).
     */
    static override fromServiceString(value: string, typeName: string): any {
        return fromServiceValue(value, typeName);
    }

    /**
     * Gets a message by key with optional parameters.
     * Resolution: static messages → return key unchanged
     * @param key - The message key (e.g., "Required", "MaxLength")
     * @param params - Positional parameters for {0}, {1} placeholders
     * @returns The formatted message, or the key if not found
     */
    getMessage(key: string, ...params: any[]): string {
        const template = VirtualService.#messages[key];

        // Return key if not found
        if (!template)
            return key;

        // Replace {0}, {1}, etc. with params
        return template.replace(/\{(\d+)\}/g, (_, index) => {
            const paramIndex = parseInt(index, 10);
            return paramIndex < params.length ? String(params[paramIndex]) : `{${index}}`;
        });
    }

    /**
     * Creates a new VirtualService instance.
     * @param hooks - Optional custom hooks instance.
     */
    constructor(hooks?: VirtualServiceHooks) {
        super("http://virtual.local", hooks ?? new VirtualServiceHooks(), true);

        this.#businessRuleValidator = new BusinessRuleValidator(this);
        this.#actionsRegistry = new VirtualPersistentObjectActionsRegistry(this.#businessRuleValidator, this);
        this.#queryRegistry = new VirtualQueryRegistry();
        this.#persistentObjectRegistry = new VirtualPersistentObjectRegistry();
        this.#actionDefinitions.set("AddReference", { name: "AddReference", displayName: "Add", isPinned: false });
        this.#actionDefinitions.set("BulkEdit", { name: "BulkEdit", displayName: "Edit", isPinned: false });
        this.#actionDefinitions.set("CancelEdit", { name: "CancelEdit", displayName: "Cancel", isPinned: false });
        this.#actionDefinitions.set("CancelSave", { name: "CancelSave", displayName: "Cancel", isPinned: false });
        this.#actionDefinitions.set("Delete", { name: "Delete", displayName: "Delete", isPinned: false });
        this.#actionDefinitions.set("Edit", { name: "Edit", displayName: "Edit", isPinned: false });
        this.#actionDefinitions.set("EndEdit", { name: "EndEdit", displayName: "Save", isPinned: false });
        this.#actionDefinitions.set("Filter", { name: "Filter", displayName: "", isPinned: false });
        this.#actionDefinitions.set("New", { name: "New", displayName: "New", isPinned: false });
        this.#actionDefinitions.set("RefreshQuery", { name: "RefreshQuery", displayName: "", isPinned: false });
        this.#actionDefinitions.set("Remove", { name: "Remove", displayName: "Remove", isPinned: false });
        this.#actionDefinitions.set("Save", { name: "Save", displayName: "Save", isPinned: false });
        this.#actionDefinitions.set("SelectReference", { name: "SelectReference", displayName: "Select", isPinned: false });

        (this.hooks as VirtualServiceHooks).initialize(this);
    }

    /** @internal */
    get persistentObjectRegistry(): VirtualPersistentObjectRegistry {
        return this.#persistentObjectRegistry;
    }

    /** @internal */
    get queryRegistry(): VirtualQueryRegistry {
        return this.#queryRegistry;
    }

    /** @internal */
    get actionsRegistry(): VirtualPersistentObjectActionsRegistry {
        return this.#actionsRegistry;
    }

    /** @internal */
    get _actionDefinitions(): Map<string, { name: string; displayName: string; isPinned: boolean }> {
        return this.#actionDefinitions;
    }

    /** @internal */
    get actionHandlers(): Map<string, ActionHandler> {
        return this.#actionHandlers;
    }

    /**
     * Initializes the service and finalizes all registrations.
     * After this method is called, no more registrations are allowed.
     */
    public async initialize(): Promise<Application> {
        this.#isInitialized = true;
        return super.initialize(false);
    }

    /**
     * Registers a PersistentObject configuration.
     * Must be called before initialize().
     * @param config - The PersistentObject configuration.
     * @param lifecycle - Optional lifecycle class for hooks (onLoad, onSave, onNew, etc.).
     * @throws Error if called after initialize().
     */
    registerPersistentObject(config: VirtualPersistentObjectConfig, lifecycle?: typeof VirtualPersistentObjectActions): void {
        this.#ensureNotInitialized();

        if (!config.type)
            throw new Error("VirtualPersistentObjectConfig.type is required");
        if (!config.attributes || config.attributes.length === 0)
            throw new Error("VirtualPersistentObjectConfig.attributes must have at least one attribute");

        if (config.actions) {
            config.actions.forEach(actionName => {
                if (!this.#builtInActions.has(actionName) && !this.#actionHandlers.has(actionName))
                    throw new Error(`Action "${actionName}" is not registered. Call registerCustomAction first.`);
            });
        }

        if (config.queries) {
            config.queries.forEach(queryName => {
                if (!this.#queryRegistry.hasQuery(queryName))
                    throw new Error(`Query "${queryName}" is not registered. Call registerQuery first.`);
            });
        }

        if (config.attributes) {
            config.attributes.forEach(attr => {
                if (attr.lookup) {
                    if (!this.#queryRegistry.hasQuery(attr.lookup))
                        throw new Error(`Lookup query "${attr.lookup}" for attribute "${attr.name}" is not registered. Call registerQuery first.`);
                }
            });
        }

        this.#persistentObjectRegistry.register(config);

        if (lifecycle)
            this.#actionsRegistry.register(config.type, lifecycle);
    }

    /**
     * Registers a Query configuration.
     * Must be called before initialize().
     * @param config - The Query configuration.
     * @throws Error if called after initialize().
     */
    registerQuery(config: VirtualQueryConfig): void {
        this.#ensureNotInitialized();

        if (!config.name)
            throw new Error("VirtualQueryConfig.name is required");
        if (!config.persistentObject)
            throw new Error("VirtualQueryConfig.persistentObject is required");

        const persistentObjectConfig = this.#persistentObjectRegistry.getConfig(config.persistentObject);
        if (!persistentObjectConfig)
            throw new Error(`PersistentObject type '${config.persistentObject}' must be registered before creating a query. Call registerPersistentObject first.`);

        if (config.actions) {
            config.actions.forEach(actionName => {
                if (!this.#builtInActions.has(actionName) && !this.#actionHandlers.has(actionName))
                    throw new Error(`Action "${actionName}" is not registered. Call registerCustomAction first.`);
            });
        }

        if (config.itemActions) {
            config.itemActions.forEach(actionName => {
                if (!this.#builtInActions.has(actionName) && !this.#actionHandlers.has(actionName))
                    throw new Error(`Action "${actionName}" is not registered. Call registerCustomAction first.`);
            });
        }

        this.#queryRegistry.register(config, persistentObjectConfig);
    }

    /**
     * Registers a custom action that can be used on PersistentObjects and Queries.
     * Must be called before initialize().
     * @param name - The action name.
     * @param handler - The action handler function.
     * @throws Error if called after initialize().
     */
    registerCustomAction(name: string, handler: ActionHandler): void;
    /**
     * Registers a custom action that can be used on PersistentObjects and Queries.
     * Must be called before initialize().
     * @param config - The action configuration.
     * @param handler - The action handler function.
     * @throws Error if called after initialize().
     */
    registerCustomAction(config: ActionConfig, handler: ActionHandler): void;
    registerCustomAction(configOrName: ActionConfig | string, handler: ActionHandler): void {
        this.#ensureNotInitialized();

        const config = typeof configOrName === "string" ? { name: configOrName } : configOrName;

        if (!config.name)
            throw new Error("ActionConfig.name is required");
        if (!handler)
            throw new Error("ActionHandler is required");

        this.#actionDefinitions.set(config.name, {
            name: config.name,
            displayName: config.displayName || config.name,
            isPinned: config.isPinned || false
        });

        this.#actionHandlers.set(config.name, handler);
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
        this.#businessRuleValidator.registerCustomRule(name, validator);
    }

    #ensureNotInitialized(): void {
        if (this.#isInitialized)
            throw new Error("Cannot register after initialize() has been called");
    }
}
