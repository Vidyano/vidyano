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
        (this.hooks as VirtualServiceHooks).initialize(this);
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
     * @param lifecycle - Optional lifecycle class for hooks (onLoad, onSave, onNew, etc.).
     * @throws Error if called after initialize().
     */
    registerPersistentObject(config: VirtualPersistentObjectConfig, lifecycle?: typeof VirtualPersistentObjectActions): void {
        this.#ensureNotInitialized();
        (this.hooks as VirtualServiceHooks).registerPersistentObject(config, lifecycle);
    }

    /**
     * Registers a Query configuration.
     * Must be called before initialize().
     * @param config - The Query configuration.
     * @throws Error if called after initialize().
     */
    registerQuery(config: VirtualQueryConfig): void {
        this.#ensureNotInitialized();
        (this.hooks as VirtualServiceHooks).registerQuery(config);
    }

    /**
     * Registers a custom action that can be used on PersistentObjects and Queries.
     * Must be called before initialize().
     * @param config - The action configuration with handler.
     * @throws Error if called after initialize().
     */
    registerAction(config: ActionConfig): void {
        this.#ensureNotInitialized();
        (this.hooks as VirtualServiceHooks).registerAction(config);
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
        (this.hooks as VirtualServiceHooks).registerBusinessRule(name, validator);
    }

    /**
     * Throws an error if the service has already been initialized.
     */
    #ensureNotInitialized(): void {
        if (this.#isInitialized)
            throw new Error("Cannot register after initialize() has been called");
    }
}
