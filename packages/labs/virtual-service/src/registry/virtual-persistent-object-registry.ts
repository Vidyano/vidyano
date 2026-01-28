import { Dto } from "@vidyano/core";
import { VirtualPersistentObjectConfig, VirtualPersistentObjectAttributeConfig, ActionHandler } from "../types.js";
import { createVirtualPersistentObject, unwrapVirtualPersistentObject } from "../virtual-persistent-object.js";
import type { VirtualQueryRegistry } from "./virtual-query-registry.js";
import type { VirtualPersistentObjectActionsRegistry } from "./virtual-persistent-object-actions-registry.js";
import type { VirtualService } from "../virtual-service.js";

/**
 * Registry for managing PersistentObject configurations and instances
 */
export class VirtualPersistentObjectRegistry {
    #configs = new Map<string, VirtualPersistentObjectConfig>();
    #actionHandlers: Map<string, ActionHandler>;
    #queryRegistry: VirtualQueryRegistry;
    #actionsRegistry: VirtualPersistentObjectActionsRegistry;
    #service: VirtualService;

    constructor(actionHandlers: Map<string, ActionHandler>, queryRegistry: VirtualQueryRegistry, actionsRegistry: VirtualPersistentObjectActionsRegistry, service: VirtualService) {
        this.#actionHandlers = actionHandlers;
        this.#queryRegistry = queryRegistry;
        this.#actionsRegistry = actionsRegistry;
        this.#service = service;
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

        // Always call onConstruct
        this.#actionsRegistry.executeConstruct(po);

        // Call onLoad only for existing objects
        if (!isNew)
            po = await this.#actionsRegistry.executeLoad(po, parent);

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

        // Always call onConstruct first
        this.#actionsRegistry.executeConstruct(po);

        // Then call onNew for new objects
        po = await this.#actionsRegistry.executeNew(po, parent, query, parameters);

        return po;
    }

    /**
     * Executes an action on a PersistentObject
     */
    async executeAction(request: Dto.ExecuteActionRequest): Promise<Dto.ExecuteActionResponse> {
        let parent = request.parent;
        if (!parent)
            throw new Error("ExecuteAction requires a parent PersistentObject");

        const actionName = request.action.split(".").pop()!;

        // Handle refresh action
        if (actionName === "Refresh")
            return this.#handleRefresh(request);

        // Handle Save action
        if (actionName === "Save") {
            // No need to merge config here - parent is already wrapped with config metadata
            // at entry point via #wrapPersistentObject in virtual-service-hooks.ts
            parent = await this.#actionsRegistry.executeSave(parent);
            return { result: parent };
        }

        // Get custom action handler
        const handler = this.#actionHandlers.get(actionName);

        if (!handler)
            throw new Error(`Action "${actionName}" is not registered`);

        // Wrap parent for the action handler
        const wrappedParent = createVirtualPersistentObject(parent, this.#service);

        // Build unified action args for PersistentObject actions
        const args = {
            parent: wrappedParent,
            query: undefined,
            selectedItems: undefined,
            parameters: request.parameters
        };

        // Execute handler and get result
        const result = await handler(args);

        // Unwrap result - handler returns VirtualPersistentObject | null
        let finalResult: Dto.PersistentObjectDto;
        if (result) {
            finalResult = unwrapVirtualPersistentObject(result);
        } else {
            finalResult = parent;
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
        parent = await this.#actionsRegistry.executeRefresh(parent, triggeredAttribute);

        return {
            result: parent
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
 * Checks if rules string contains NotEmpty or Required
 */
function hasRequiredRule(rules?: string): boolean {
    if (!rules)
        return false;

    // Parse the rules string (semicolon-separated)
    const ruleNames = rules
        .split(";")
        .map(rule => rule.trim())
        .map(rule => {
            // Extract just the rule name (before any parentheses)
            const match = rule.match(/^(\w+)/);
            return match ? match[1] : "";
        });

    return ruleNames.includes("NotEmpty") || ruleNames.includes("Required");
}

/**
 * Builds a PersistentObjectAttributeDto from configuration
 */
async function buildAttributeDto(
    config: VirtualPersistentObjectAttributeConfig,
    index: number,
    queryRegistry?: VirtualQueryRegistry
): Promise<Dto.PersistentObjectAttributeDto> {
    // Automatically set isRequired if rules contain NotEmpty or Required
    const isRequired = hasRequiredRule(config.rules);

    const baseDto: Dto.PersistentObjectAttributeDto = {
        id: config.id || crypto.randomUUID(),
        name: config.name,
        type: config.type || "String",
        label: config.label || config.name,
        value: config.value,
        isRequired,
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