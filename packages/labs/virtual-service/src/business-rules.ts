import type { RuleValidationContext } from "./types.js";
import type { VirtualPersistentObject, VirtualPersistentObjectAttribute } from "./virtual-persistent-object.js";
import type { VirtualService } from "./virtual-service.js";

/**
 * Parsed business rule with name and parameters
 */
export type ParsedRule = {
    name: string;
    params: any[];
};

/**
 * Rule validator function that throws an error if invalid, or returns nothing if valid
 */
export type RuleValidatorFn = (value: any, context: RuleValidationContext, ...params: any[]) => void;

/**
 * Business rule validator that supports built-in and custom rules
 */
export class BusinessRuleValidator {
    #builtInRules = new Map<string, RuleValidatorFn>();
    #customRules = new Map<string, RuleValidatorFn>();
    #service: VirtualService;

    constructor(service: VirtualService) {
        this.#service = service;

        // Register all built-in rules
        this.#builtInRules.set("IsBase64", this.#validateIsBase64.bind(this));
        this.#builtInRules.set("IsEmail", this.#validateIsEmail.bind(this));
        this.#builtInRules.set("IsRegex", this.#validateIsRegex.bind(this));
        this.#builtInRules.set("IsUrl", this.#validateIsUrl.bind(this));
        this.#builtInRules.set("IsWord", this.#validateIsWord.bind(this));
        this.#builtInRules.set("MaxLength", this.#validateMaxLength.bind(this));
        this.#builtInRules.set("MaxValue", this.#validateMaxValue.bind(this));
        this.#builtInRules.set("MinLength", this.#validateMinLength.bind(this));
        this.#builtInRules.set("MinValue", this.#validateMinValue.bind(this));
        this.#builtInRules.set("NotEmpty", this.#validateNotEmpty.bind(this));
        this.#builtInRules.set("Required", this.#validateRequired.bind(this));
    }


    /**
     * Register a custom business rule
     * @throws Error if attempting to override a built-in rule
     */
    registerCustomRule(name: string, validator: RuleValidatorFn): void {
        if (this.#builtInRules.has(name))
            throw new Error(`Cannot override built-in rule: ${name}`);

        this.#customRules.set(name, validator);
    }

    /**
     * Validate an attribute against its rules
     * @param attr - The wrapped attribute to validate (has getValue/setValue methods)
     * @param po - The wrapped persistent object containing the attribute
     * @returns Error message if validation fails, null if valid
     */
    validateAttribute(attr: VirtualPersistentObjectAttribute, po: VirtualPersistentObject): string | null {
        // The attr already has rules from config (merged at entry point via #wrapPersistentObject)
        // Get the converted value using the wrapped attribute's getValue()
        const convertedValue = attr.getValue();

        if (!attr.rules)
            return null;

        // Create validation context using the already-wrapped objects
        const context: RuleValidationContext = {
            persistentObject: po,
            attribute: attr,
            service: this.#service!
        };

        const rules = this.parseRules(attr.rules);
        for (const rule of rules) {
            const validator = this.#builtInRules.get(rule.name) || this.#customRules.get(rule.name);
            if (!validator)
                throw new Error(`Unknown business rule: ${rule.name}`);

            try {
                validator(convertedValue, context, ...rule.params);
            } catch (error) {
                return error instanceof Error ? error.message : String(error);
            }
        }

        return null;
    }

    /**
     * Parse a rules string into individual rules with parameters
     * Example: "NotEmpty; MaxLength(40); IsEmail" -> [
     *   { name: "NotEmpty", params: [] },
     *   { name: "MaxLength", params: [40] },
     *   { name: "IsEmail", params: [] }
     * ]
     */
    parseRules(rulesString: string): ParsedRule[] {
        if (!rulesString?.trim())
            return [];

        return rulesString
            .split(";")
            .map(rule => rule.trim())
            .filter(rule => rule.length > 0)
            .map(rule => this.#parseRule(rule));
    }

    #parseRule(ruleString: string): ParsedRule {
        const match = ruleString.match(/^(\w+)(?:\(([^)]*)\))?$/);
        if (!match)
            throw new Error(`Invalid rule format: ${ruleString}`);

        const name = match[1];
        const paramsString = match[2];

        if (!paramsString) {
            return { name, params: [] };
        }

        // Parse parameters (can be comma-separated)
        const params = paramsString
            .split(",")
            .map(p => p.trim())
            .map(p => {
                // Try to parse as number
                const num = Number(p);
                if (p !== "" && !isNaN(num))
                    return num;

                // Try to parse as boolean
                if (p === "true")
                    return true;
                if (p === "false")
                    return false;

                // Otherwise return as string (remove quotes if present)
                return p.replace(/^["']|["']$/g, "");
            });

        return { name, params };
    }

    // Built-in validators - throw errors instead of returning strings

    #validateIsBase64(value: any, _context: RuleValidationContext): void {
        if (value == null || value === "")
            return;

        const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
        if (!base64Regex.test(String(value)))
            throw new Error(this.#service.getMessage("IsBase64"));
    }

    #validateIsEmail(value: any, _context: RuleValidationContext): void {
        if (value == null || value === "")
            return;

        // Only allow ASCII characters in email addresses
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        if (!emailRegex.test(String(value)))
            throw new Error(this.#service.getMessage("IsEmail"));
    }

    #validateIsRegex(value: any, _context: RuleValidationContext): void {
        if (value == null || value === "")
            return;

        try {
            new RegExp(String(value));
        } catch {
            throw new Error(this.#service.getMessage("IsRegex"));
        }
    }

    #validateIsUrl(value: any, _context: RuleValidationContext): void {
        if (value == null || value === "")
            return;

        try {
            new URL(String(value));
        } catch {
            throw new Error(this.#service.getMessage("IsUrl"));
        }
    }

    #validateIsWord(value: any, _context: RuleValidationContext): void {
        if (value == null || value === "")
            return;

        const wordRegex = /^\w+$/;
        if (!wordRegex.test(String(value)))
            throw new Error(this.#service.getMessage("IsWord"));
    }

    #validateMaxLength(value: any, _context: RuleValidationContext, maxLength: number): void {
        if (value == null || value === "")
            return;

        const length = String(value).length;
        if (length > maxLength)
            throw new Error(this.#service.getMessage("MaxLength", maxLength));
    }

    #validateMaxValue(value: any, _context: RuleValidationContext, maximum: number): void {
        if (value == null || value === "")
            return;

        const num = Number(value);
        if (isNaN(num))
            throw new Error("Value must be a number");

        if (num > maximum)
            throw new Error(this.#service.getMessage("MaxValue", maximum));
    }

    #validateMinLength(value: any, _context: RuleValidationContext, minLength: number): void {
        if (value == null || value === "")
            return;

        const length = String(value).length;
        if (length < minLength)
            throw new Error(this.#service.getMessage("MinLength", minLength));
    }

    #validateMinValue(value: any, _context: RuleValidationContext, minimum: number): void {
        if (value == null || value === "")
            return;

        const num = Number(value);
        if (isNaN(num))
            throw new Error("Value must be a number");

        if (num < minimum)
            throw new Error(this.#service.getMessage("MinValue", minimum));
    }

    #validateRequired(value: any, _context: RuleValidationContext): void {
        if (value == null)
            throw new Error(this.#service.getMessage("Required"));
    }

    #validateNotEmpty(value: any, _context: RuleValidationContext): void {
        if (value == null || value === "" || (typeof value === "string" && value.trim() === ""))
            throw new Error(this.#service.getMessage("NotEmpty"));
    }
}
