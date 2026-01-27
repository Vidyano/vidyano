import { Dto } from "@vidyano/core";
import type { RuleValidationContext } from "./types.js";
import { fromServiceValue, toServiceValue } from "./virtual-service-data-type.js";
import { createVirtualPersistentObject, createVirtualPersistentObjectAttribute, type ConversionContext } from "./virtual-persistent-object.js";

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

    constructor() {
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
     * @param attr - The attribute to validate
     * @param po - The persistent object containing the attribute
     * @returns Error message if validation fails, null if valid
     */
    validateAttribute(attr: Dto.PersistentObjectAttributeDto, po: Dto.PersistentObjectDto): string | null {
        // Create conversion context for wrappers
        const conversionContext: ConversionContext = {
            getConvertedValue: (attribute: Dto.PersistentObjectAttributeDto) => this.#getConvertedValue(attribute),
            setConvertedValue: (attribute: Dto.PersistentObjectAttributeDto, value: any) => {
                attribute.value = toServiceValue(value, attribute.type);
                attribute.isValueChanged = true;
            }
        };

        // Create wrapped objects for the validation context
        const wrappedPo = createVirtualPersistentObject(po, conversionContext);
        const wrappedAttr = createVirtualPersistentObjectAttribute(attr, conversionContext);

        // Create validation context
        const context: RuleValidationContext = {
            persistentObject: wrappedPo,
            attribute: wrappedAttr
        };

        // Get the converted value (e.g., boolean from "True"/"False", number from string)
        const convertedValue = this.#getConvertedValue(attr);

        // Parse and validate rules string
        // Note: isRequired is auto-set from rules for UI purposes only (e.g., showing asterisks)
        // All validation logic is handled by the rules themselves
        if (!attr.rules)
            return null;

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

    // Helper to convert attribute values based on type
    #getConvertedValue(attr: Dto.PersistentObjectAttributeDto): any {
        return fromServiceValue(attr.value, attr.type);
    }

    // Built-in validators - throw errors instead of returning strings

    #validateIsBase64(value: any, context: RuleValidationContext): void {
        if (value == null || value === "")
            return;

        const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
        if (!base64Regex.test(String(value)))
            throw new Error("Value must be a valid base64 string");
    }

    #validateIsEmail(value: any, context: RuleValidationContext): void {
        if (value == null || value === "")
            return;

        // Only allow ASCII characters in email addresses
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        if (!emailRegex.test(String(value)))
            throw new Error("Email format is invalid");
    }

    #validateIsRegex(value: any, context: RuleValidationContext): void {
        if (value == null || value === "")
            return;

        try {
            new RegExp(String(value));
        } catch {
            throw new Error("Value must be a valid regular expression");
        }
    }

    #validateIsUrl(value: any, context: RuleValidationContext): void {
        if (value == null || value === "")
            return;

        try {
            new URL(String(value));
        } catch {
            throw new Error("Value must be a valid URL");
        }
    }

    #validateIsWord(value: any, context: RuleValidationContext): void {
        if (value == null || value === "")
            return;

        const wordRegex = /^\w+$/;
        if (!wordRegex.test(String(value)))
            throw new Error("Value must contain only word characters");
    }

    #validateMaxLength(value: any, context: RuleValidationContext, maxLength: number): void {
        if (value == null || value === "")
            return;

        const length = String(value).length;
        if (length > maxLength)
            throw new Error(`Maximum length is ${maxLength} characters`);
    }

    #validateMaxValue(value: any, context: RuleValidationContext, maximum: number): void {
        if (value == null || value === "")
            return;

        const num = Number(value);
        if (isNaN(num))
            throw new Error("Value must be a number");

        if (num > maximum)
            throw new Error(`Maximum value is ${maximum}`);
    }

    #validateMinLength(value: any, context: RuleValidationContext, minLength: number): void {
        if (value == null || value === "")
            return;

        const length = String(value).length;
        if (length < minLength)
            throw new Error(`Minimum length is ${minLength} characters`);
    }

    #validateMinValue(value: any, context: RuleValidationContext, minimum: number): void {
        if (value == null || value === "")
            return;

        const num = Number(value);
        if (isNaN(num))
            throw new Error("Value must be a number");

        if (num < minimum)
            throw new Error(`Minimum value is ${minimum}`);
    }

    #validateRequired(value: any, context: RuleValidationContext): void {
        if (value == null)
            throw new Error("This field is required");
    }

    #validateNotEmpty(value: any, context: RuleValidationContext): void {
        if (value == null || value === "" || (typeof value === "string" && value.trim() === ""))
            throw new Error("This field cannot be empty");
    }
}
