import { Dto } from "@vidyano/core";
import { VirtualPersistentObjectConfig, VirtualPersistentObjectAttributeConfig, ActionHandler, ActionContext } from "../types.js";
import { ConversionContext } from "../virtual-persistent-object.js";
import { BusinessRuleValidator } from "../business-rules.js";
import { convertFromDtoValue, convertToDtoValue } from "../data-type-conversion.js";
import type { VirtualQueryRegistry } from "./virtual-query-registry.js";
import type { VirtualPersistentObjectActionsRegistry } from "./virtual-persistent-object-actions-registry.js";

/**
 * Registry for managing PersistentObject configurations and instances
 */
export class VirtualPersistentObjectRegistry {
    #configs = new Map<string, VirtualPersistentObjectConfig>();
    #actionHandlers: Map<string, ActionHandler>;
    #validator: BusinessRuleValidator;
    #queryRegistry: VirtualQueryRegistry;
    #actionsRegistry: VirtualPersistentObjectActionsRegistry;

    constructor(validator: BusinessRuleValidator, actionHandlers: Map<string, ActionHandler>, queryRegistry: VirtualQueryRegistry, actionsRegistry: VirtualPersistentObjectActionsRegistry) {
        this.#validator = validator;
        this.#actionHandlers = actionHandlers;
        this.#queryRegistry = queryRegistry;
        this.#actionsRegistry = actionsRegistry;
    }

    /**
     * Registers a PersistentObject configuration
     */
    register(config: VirtualPersistentObjectConfig): void {
        this.#configs.set(config.type, config);
    }

    /**
     * Gets a registered PersistentObject configuration
     */
    getConfig(type: string): VirtualPersistentObjectConfig | undefined {
        return this.#configs.get(type);
    }

    /**
     * Gets or creates a PersistentObject DTO
     */
    async getPersistentObject(type: string, objectId: string, isNew: boolean, parent: Dto.PersistentObjectDto | null = null): Promise<Dto.PersistentObjectDto> {
        const config = this.#configs.get(type);
        if (!config)
            throw new Error(`PersistentObject type "${type}" is not registered`);

        // Create new instance
        let po = await buildPersistentObjectDto(config, this.#queryRegistry, objectId, isNew);

        // Auto-add actions based on overridden lifecycle methods
        if (this.#actionsRegistry.isMethodOverridden(config.type, "onSave")) {
            if (!po.actions.includes("Save"))
                po.actions.push("Save");
        }

        // Call lifecycle hooks
        const conversionContext = this.#createConversionContext();

        // Always call onConstruct
        this.#actionsRegistry.executeConstruct(po, conversionContext);

        // Call onLoad only for existing objects
        if (!isNew)
            po = await this.#actionsRegistry.executeLoad(po, parent, conversionContext);

        return po;
    }

    /**
     * Creates a new PersistentObject with the New action lifecycle
     * @param type - The PersistentObject type
     * @param parent - The parent PersistentObject (or null)
     * @param query - The Query from which New was invoked (or null)
     * @param parameters - Additional parameters (or null)
     * @returns The new PersistentObject DTO
     */
    async createNewPersistentObject(
        type: string,
        parent: Dto.PersistentObjectDto | null,
        query: Dto.QueryDto | null,
        parameters: Record<string, string> | null
    ): Promise<Dto.PersistentObjectDto> {
        const config = this.#configs.get(type);
        if (!config)
            throw new Error(`PersistentObject type "${type}" is not registered`);

        // Create new instance with a generated ID
        const objectId = crypto.randomUUID();
        let po = await buildPersistentObjectDto(config, this.#queryRegistry, objectId, true);

        // Auto-add actions based on overridden lifecycle methods
        if (this.#actionsRegistry.isMethodOverridden(config.type, "onSave")) {
            if (!po.actions.includes("Save"))
                po.actions.push("Save");
        }

        // Call lifecycle hooks
        const conversionContext = this.#createConversionContext();

        // Always call onConstruct first
        this.#actionsRegistry.executeConstruct(po, conversionContext);

        // Then call onNew for new objects
        po = await this.#actionsRegistry.executeNew(po, parent, query, parameters, conversionContext);

        return po;
    }

    /**
     * Executes an action on a PersistentObject
     */
    async executeAction(request: Dto.ExecuteActionRequest): Promise<Dto.ExecuteActionResponse> {
        let parent = request.parent;
        if (!parent)
            throw new Error("ExecuteAction requires a parent PersistentObject");

        const type = parent.type;
        const actionName = request.action.split(".").pop()!;

        // Handle refresh action
        if (actionName === "Refresh")
            return this.#handleRefresh(request);

        // Validate before Save action
        if (actionName === "Save") {
            const config = this.#configs.get(type);

            try {
                const validationFailed = this.#validateAttributes(parent, config);

                if (validationFailed) {
                    return {
                        result: parent
                    };
                }
            } catch (error) {
                parent.notification = error instanceof Error ? error.message : String(error);
                parent.notificationType = "Error";

                return {
                    result: parent
                };
            }

            // Call onSave from actions registry
            const conversionContext = this.#createConversionContext();
            parent = await this.#actionsRegistry.executeSave(parent, conversionContext);

            return {
                result: parent
            };
        }

        // Get custom action handler
        const handler = this.#actionHandlers.get(actionName);

        if (!handler)
            throw new Error(`Action "${actionName}" is not registered`);

        // Create action context
        const context = this.#createActionContext(parent);

        // Build unified action args for PersistentObject actions
        const args = {
            parent: parent,
            query: undefined,
            selectedItems: undefined,
            parameters: request.parameters,
            context: context
        };

        // Execute handler and get result
        const result = await handler(args);

        // Handle both old and new API formats for backwards compatibility
        // Old API: handler returns { result: PersistentObjectDto }
        // New API: handler returns PersistentObjectDto | null
        let finalResult: Dto.PersistentObjectDto;
        if (result && typeof result === "object" && "result" in result) {
            // Old API format - extract the result property
            finalResult = (result as any).result || parent;
        } else {
            // New API format - use directly
            finalResult = result || parent;
        }

        // Return response with result
        return {
            result: finalResult
        };
    }

    /**
     * Handles the PersistentObject.Refresh action
     */
    async #handleRefresh(request: Dto.ExecuteActionRequest): Promise<Dto.ExecuteActionResponse> {
        let parent = request.parent!;
        const type = parent.type;
        const config = this.#configs.get(type);

        if (!config)
            throw new Error(`PersistentObject type "${type}" is not registered`);

        // Get the attribute that triggered the refresh
        const refreshedAttributeId = request.parameters?.RefreshedPersistentObjectAttributeId;
        const triggeredAttribute = refreshedAttributeId
            ? parent.attributes?.find(a => a.id === refreshedAttributeId)
            : undefined;

        // Call onRefresh from actions registry
        const conversionContext = this.#createConversionContext();
        parent = await this.#actionsRegistry.executeRefresh(parent, triggeredAttribute, conversionContext);

        return {
            result: parent
        };
    }

    /**
     * Validates all attributes on a PersistentObject
     * @returns true if validation failed, false if all valid
     */
    #validateAttributes(po: Dto.PersistentObjectDto, config?: VirtualPersistentObjectConfig): boolean {
        if (!po.attributes || !config)
            return false;

        let hasErrors = false;

        for (const attr of po.attributes) {
            // Clear previous validation errors
            attr.validationError = undefined;

            // Find the attribute config to get rules and isRequired
            const attrConfig = config.attributes.find(a => a.name === attr.name);
            if (!attrConfig)
                continue;

            // Create a DTO with the rules and isRequired from config
            const attrWithRules: Dto.PersistentObjectAttributeDto = {
                ...attr,
                rules: attrConfig.rules,
                isRequired: attrConfig.isRequired || false
            };

            // Validate the attribute
            const error = this.#validator.validateAttribute(attrWithRules);
            if (error) {
                attr.validationError = error;
                hasErrors = true;
            }
        }

        return hasErrors;
    }

    /**
     * Creates an action context for custom action handlers
     */
    #createActionContext(po: Dto.PersistentObjectDto): ActionContext {
        return {
            getAttribute: (name: string) => {
                return po.attributes?.find(a => a.name === name);
            },

            getAttributeValue: (name: string) => {
                const attr = po.attributes?.find(a => a.name === name);
                if (!attr)
                    return undefined;

                return convertFromDtoValue(attr.value, attr.type);
            },

            setAttributeValue: (name: string, value: any) => {
                const attr = po.attributes?.find(a => a.name === name);
                if (attr) {
                    attr.value = convertToDtoValue(value, attr.type);
                    attr.isValueChanged = true;
                }
            },

            getConvertedValue: (attr: Dto.PersistentObjectAttributeDto) => {
                return convertFromDtoValue(attr.value, attr.type);
            },

            setConvertedValue: (attr: Dto.PersistentObjectAttributeDto, value: any) => {
                attr.value = convertToDtoValue(value, attr.type);
                attr.isValueChanged = true;
            },

            setValidationError: (name: string, error: string) => {
                const attr = po.attributes?.find(a => a.name === name);
                if (attr)
                    attr.validationError = error;
            },

            clearValidationError: (name: string) => {
                const attr = po.attributes?.find(a => a.name === name);
                if (attr)
                    attr.validationError = undefined;
            },

            setNotification: (message: string, type: Dto.NotificationType, duration?: number) => {
                po.notification = message;
                po.notificationType = type;
                po.notificationDuration = duration;
            }
        };
    }

    /**
     * Creates a conversion context for type conversions
     */
    #createConversionContext(): ConversionContext {
        return {
            getConvertedValue: (attr: Dto.PersistentObjectAttributeDto) => {
                return convertFromDtoValue(attr.value, attr.type);
            },
            setConvertedValue: (attr: Dto.PersistentObjectAttributeDto, value: any) => {
                attr.value = convertToDtoValue(value, attr.type);
                attr.isValueChanged = true;
            }
        };
    }
}

/**
 * Builds a PersistentObjectDto from configuration
 */
async function buildPersistentObjectDto(
    config: VirtualPersistentObjectConfig,
    queryRegistry: VirtualQueryRegistry,
    objectId: string,
    isNew: boolean
): Promise<Dto.PersistentObjectDto> {
    const id = crypto.randomUUID();
    const fullTypeName = `MockNamespace.${config.type}`;

    // Build attributes using existing DTO type
    const attributes = await Promise.all(
        config.attributes
            .filter(attr => shouldIncludeAttribute(attr, isNew))
            .map((attr, index) => buildAttributeDto(attr, index, queryRegistry))
    );

    // Build tabs using existing DTO type
    const tabs: Record<string, Dto.PersistentObjectTabDto> = {};
    if (config.tabs) {
        Object.entries(config.tabs).forEach(([key, tab]) => {
            tabs[key] = {
                name: tab.name || key,
                columnCount: tab.columnCount || 0,
                id: tab.id,
                layout: tab.layout
            };
        });
    } else {
        // Default tab
        tabs[""] = { name: "", columnCount: 0 };
    }

    // Build action names (reference by name)
    const actions = config.actions || [];

    // Build queries (detail queries)
    const queries: Dto.QueryDto[] = [];
    if (config.queries) {
        for (const queryName of config.queries) {
            const queryDto = await queryRegistry.getQuery(queryName);
            queries.push(queryDto);
        }
    }

    // Return proper PersistentObjectDto
    return {
        id,
        objectId,
        type: config.type,
        fullTypeName,
        label: config.label || config.type,
        isNew,
        isReadOnly: false,
        stateBehavior: config.stateBehavior || "StayInEdit",
        attributes,
        actions,
        tabs,
        queries
    };
}

/**
 * Builds a PersistentObjectAttributeDto from configuration
 */
async function buildAttributeDto(
    config: VirtualPersistentObjectAttributeConfig,
    index: number,
    queryRegistry?: VirtualQueryRegistry
): Promise<Dto.PersistentObjectAttributeDto> {
    const baseDto: Dto.PersistentObjectAttributeDto = {
        id: crypto.randomUUID(),
        name: config.name,
        type: config.type || "String",
        label: config.label || config.name,
        value: config.value,
        isRequired: config.isRequired || false,
        isReadOnly: config.isReadOnly || false,
        rules: config.rules,
        visibility: config.visibility || "Always",
        group: config.group || "",
        tab: config.tab || "",
        triggersRefresh: config.triggersRefresh || false,
        options: config.options,
        typeHints: config.typeHints,
        column: config.column,
        columnSpan: config.columnSpan || 4,
        offset: config.offset ?? index
    };

    // Handle Reference attributes with lookup
    if (config.lookup) {
        if (!queryRegistry)
            throw new Error(`Cannot build reference attribute "${config.name}" without queryRegistry`);

        const lookupQuery = await queryRegistry.getQuery(config.lookup);

        // Determine displayAttribute - use provided or first visible column from lookup query
        let displayAttribute = config.displayAttribute;
        if (!displayAttribute && lookupQuery.columns && lookupQuery.columns.length > 0) {
            // Find first non-Id visible column, or use first column
            const firstVisibleColumn = lookupQuery.columns.find(c => !c.isHidden && c.name !== "Id");
            displayAttribute = firstVisibleColumn?.name || lookupQuery.columns[0].name;
        }
        if (!displayAttribute)
            displayAttribute = "Id";

        // Build reference attribute DTO
        const refDto: Dto.PersistentObjectAttributeWithReferenceDto = {
            ...baseDto,
            type: "Reference",
            lookup: lookupQuery,
            objectId: config.value as string || null,
            displayAttribute,
            canAddNewReference: config.canAddNewReference ?? false,
            selectInPlace: config.selectInPlace ?? false
        };

        return refDto;
    }

    return baseDto;
}

/**
 * Determines if an attribute should be included based on visibility and isNew flag
 */
function shouldIncludeAttribute(attr: VirtualPersistentObjectAttributeConfig, isNew: boolean): boolean {
    if (!attr.visibility || attr.visibility === "Always")
        return true;
    if (attr.visibility === "Never")
        return false;
    if (attr.visibility === "New")
        return isNew;
    if (attr.visibility === "Read")
        return !isNew;
    // Handle compound visibilities like "Read, Query"
    const parts = attr.visibility.split(",").map(p => p.trim());
    if (isNew)
        return parts.includes("New");
    return parts.includes("Read");
}
