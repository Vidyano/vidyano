import { ServiceHooks, Dto } from "@vidyano/core";
import { VirtualPersistentObjectConfig, VirtualQueryConfig, ActionConfig, ActionHandler, TranslateFunction, VirtualPersistentObjectAttributeConfig } from "./types.js";
import { ConversionContext, VirtualQuery, createVirtualQuery } from "./virtual-persistent-object.js";
import { VirtualPersistentObjectRegistry } from "./registry/virtual-persistent-object-registry.js";
import { VirtualQueryRegistry } from "./registry/virtual-query-registry.js";
import { VirtualPersistentObjectActionsRegistry } from "./registry/virtual-persistent-object-actions-registry.js";
import { BusinessRuleValidator, RuleValidatorFn } from "./business-rules.js";
import { VirtualPersistentObjectActions } from "./virtual-persistent-object-actions.js";
import { fromServiceValue, toServiceValue } from "./virtual-service-data-type.js";

/**
 * Virtual implementation of ServiceHooks for testing without a backend
 */
export class VirtualServiceHooks extends ServiceHooks {
    #persistentObjectRegistry: VirtualPersistentObjectRegistry;
    #queryRegistry: VirtualQueryRegistry;
    #actionDefinitions = new Map<string, { name: string; displayName: string; isPinned: boolean }>();
    #actionHandlers = new Map<string, ActionHandler>();
    #validator: BusinessRuleValidator;
    #persistentObjectActionsRegistry: VirtualPersistentObjectActionsRegistry;
    #builtInActions = new Set(["New", "Delete", "SelectReference", "RefreshQuery", "Edit", "CancelEdit", "Save", "EndEdit"]);

    constructor() {
        super();
        this.#validator = new BusinessRuleValidator();
        this.#persistentObjectActionsRegistry = new VirtualPersistentObjectActionsRegistry(this.#validator);
        this.#queryRegistry = new VirtualQueryRegistry(this.#persistentObjectActionsRegistry);
        this.#persistentObjectRegistry = new VirtualPersistentObjectRegistry(this.#actionHandlers, this.#queryRegistry, this.#persistentObjectActionsRegistry);

        // Register default action definitions (these are built-in actions without custom handlers)
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
    }

    /**
     * Sets the translation function for system messages
     */
    setTranslate(translate: TranslateFunction): void {
        this.#validator.setTranslate(translate);
    }

    /**
     * Intercepts fetch requests and routes them to virtual handlers
     */
    async onFetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        const pathname = url.pathname;
        const method = pathname.includes("GetClientData") ? "GetClientData" : pathname.split('/').pop();
        const body = request.method === "POST" ? await request.clone().json() : null;

        let result: any;

        try {
            // Route to appropriate handler based on service method
            switch (method) {
                case "GetClientData":
                    result = this.#handleGetClientData();
                    break;
                case "GetApplication":
                    result = this.#handleGetApplication();
                    break;
                case "GetQuery":
                    result = await this.#handleGetQuery(body as Dto.GetQueryRequest);
                    break;
                case "ExecuteQuery":
                    result = await this.#handleExecuteQuery(body as Dto.ExecuteQueryRequest);
                    break;
                case "GetPersistentObject":
                    result = await this.#handleGetPersistentObject(body as Dto.GetPersistentObjectRequest);
                    break;
                case "ExecuteAction":
                    result = await this.#handleExecuteAction(body as Dto.ExecuteActionRequest);
                    break;
                default:
                    throw new Error(`Virtual handler not implemented for method: ${method}`);
            }

            return new Response(JSON.stringify(result), {
                headers: { "content-type": "application/json" }
            });
        } catch (error) {
            const errorResponse: Dto.ResponseDto = {
                exception: error instanceof Error ? error.message : String(error)
            };
            // Return 200 OK with exception in JSON body (like real service does)
            return new Response(JSON.stringify(errorResponse), {
                status: 200,
                headers: { "content-type": "application/json" }
            });
        }
    }

    /**
     * Registers a PersistentObject configuration
     */
    registerPersistentObject(config: VirtualPersistentObjectConfig): void {
        // Validate configuration
        if (!config.type)
            throw new Error("VirtualPersistentObjectConfig.type is required");
        if (!config.attributes || config.attributes.length === 0)
            throw new Error("VirtualPersistentObjectConfig.attributes must have at least one attribute");

        // Validate that referenced actions are registered (skip built-in actions)
        if (config.actions) {
            config.actions.forEach(actionName => {
                if (!this.#builtInActions.has(actionName) && !this.#actionHandlers.has(actionName))
                    throw new Error(`Action "${actionName}" is not registered. Call registerAction first.`);
            });
        }

        // Validate that referenced queries are registered
        if (config.queries) {
            config.queries.forEach(queryName => {
                if (!this.#queryRegistry.hasQuery(queryName))
                    throw new Error(`Query "${queryName}" is not registered. Call registerQuery first.`);
            });
        }

        // Validate that lookup queries for reference attributes are registered
        if (config.attributes) {
            config.attributes.forEach(attr => {
                if (attr.lookup) {
                    if (!this.#queryRegistry.hasQuery(attr.lookup))
                        throw new Error(`Lookup query "${attr.lookup}" for attribute "${attr.name}" is not registered. Call registerQuery first.`);
                }
            });
        }

        // Register with registry
        this.#persistentObjectRegistry.register(config);
    }

    /**
     * Registers a Query configuration
     */
    registerQuery(config: VirtualQueryConfig): void {
        // Validate configuration
        if (!config.name)
            throw new Error("VirtualQueryConfig.name is required");
        if (!config.persistentObject)
            throw new Error("VirtualQueryConfig.persistentObject is required");

        // Verify PersistentObject is already registered
        const persistentObjectConfig = this.#persistentObjectRegistry.getConfig(config.persistentObject);
        if (!persistentObjectConfig)
            throw new Error(`PersistentObject type '${config.persistentObject}' must be registered before creating a query. Call registerPersistentObject first.`);

        // Validate that referenced actions are registered (skip built-in actions)
        if (config.actions) {
            config.actions.forEach(actionName => {
                if (!this.#builtInActions.has(actionName) && !this.#actionHandlers.has(actionName))
                    throw new Error(`Action "${actionName}" is not registered. Call registerAction first.`);
            });
        }

        if (config.itemActions) {
            config.itemActions.forEach(actionName => {
                if (!this.#builtInActions.has(actionName) && !this.#actionHandlers.has(actionName))
                    throw new Error(`Action "${actionName}" is not registered. Call registerAction first.`);
            });
        }

        // Register with query registry
        this.#queryRegistry.register(config, persistentObjectConfig);
    }

    /**
     * Registers a custom action that can be used on PersistentObjects and Queries
     * @param config - The action configuration with handler
     */
    registerAction(config: ActionConfig): void {
        // Validate configuration
        if (!config.name)
            throw new Error("ActionConfig.name is required");
        if (!config.handler)
            throw new Error("ActionConfig.handler is required");

        // Register action definition
        this.#actionDefinitions.set(config.name, {
            name: config.name,
            displayName: config.displayName || config.name,
            isPinned: config.isPinned || false
        });

        // Register action handler
        this.#actionHandlers.set(config.name, config.handler);
    }

    /**
     * Registers a custom business rule for validation
     * @param name - The rule name (cannot override built-in rules)
     * @param validator - The validation function
     */
    registerBusinessRule(name: string, validator: RuleValidatorFn): void {
        this.#validator.registerCustomRule(name, validator);
    }

    /**
     * Registers a VirtualPersistentObjectActions class for a specific type
     * @param type - The PersistentObject type name
     * @param ActionsClass - The VirtualPersistentObjectActions class constructor
     */
    registerPersistentObjectActions(type: string, ActionsClass: typeof VirtualPersistentObjectActions): void {
        this.#persistentObjectActionsRegistry.register(type, ActionsClass);
    }

    /**
     * Wraps an incoming PersistentObject DTO with config augmentation
     * Merges server config metadata with client DTO values.
     * Only processes attributes that exist in the client DTO (client defines shape).
     * @param dto - The incoming PersistentObject DTO from client
     * @returns The augmented DTO with config metadata applied
     */
    #wrapPersistentObject(dto: Dto.PersistentObjectDto | null | undefined): Dto.PersistentObjectDto | null {
        if (!dto)
            return null;

        const config = this.#persistentObjectRegistry.getConfig(dto.type);
        if (!config)
            throw new Error(`PersistentObject type "${dto.type}" is not registered`);

        // Process attributes - iterate over CLIENT attributes only
        if (dto.attributes) {
            for (const clientAttr of dto.attributes) {
                const configAttr = config.attributes.find(a => a.name === clientAttr.name);
                if (!configAttr)
                    throw new Error(`Attribute "${clientAttr.name}" is not registered for PersistentObject type "${dto.type}"`);

                this.#mergeAttributeWithConfig(clientAttr, configAttr);
            }
        }

        // Recursively wrap parent if present
        if (dto.parent)
            dto.parent = this.#wrapPersistentObject(dto.parent)!;

        return dto;
    }

    /**
     * Merges a client attribute with config metadata
     * Server provides all metadata, client provides runtime values only
     */
    #mergeAttributeWithConfig(
        clientAttr: Dto.PersistentObjectAttributeDto,
        configAttr: VirtualPersistentObjectAttributeConfig
    ): void {
        // SERVER PROVIDES (all metadata):
        clientAttr.type = configAttr.type || "String";
        clientAttr.rules = configAttr.rules;
        clientAttr.typeHints = configAttr.typeHints;
        clientAttr.isReadOnly = configAttr.isReadOnly || false;
        clientAttr.triggersRefresh = configAttr.triggersRefresh || false;
        clientAttr.isRequired = this.#hasRequiredRule(configAttr.rules);
        clientAttr.label = configAttr.label || configAttr.name;
        clientAttr.group = configAttr.group || "";
        clientAttr.tab = configAttr.tab || "";
        clientAttr.column = configAttr.column;
        clientAttr.columnSpan = configAttr.columnSpan;
        clientAttr.options = configAttr.options;

        // Reference attribute properties - only set if explicitly configured
        if (configAttr.lookup) {
            const refAttr = clientAttr as Dto.PersistentObjectAttributeWithReferenceDto;
            // Only override displayAttribute if explicitly configured
            if (configAttr.displayAttribute !== undefined)
                refAttr.displayAttribute = configAttr.displayAttribute;
            // Note: lookup query is set by server, not merged from client
        }

        // CLIENT PROVIDES (runtime state only):
        // - value (kept from client)
        // - isValueChanged (kept from client)
        // - objectId for references (kept from client)
        // Note: validationError is NOT sent by client - it's server-set only
    }

    /**
     * Checks if rules string contains NotEmpty or Required
     */
    #hasRequiredRule(rules?: string): boolean {
        if (!rules)
            return false;

        const ruleNames = rules
            .split(";")
            .map(rule => rule.trim())
            .map(rule => {
                const match = rule.match(/^(\w+)/);
                return match ? match[1] : "";
            });

        return ruleNames.includes("NotEmpty") || ruleNames.includes("Required");
    }

    /**
     * Wraps an incoming Query DTO with config augmentation
     * @param dto - The incoming Query DTO from client
     * @returns The augmented VirtualQuery with config metadata applied
     */
    #wrapQuery(dto: Dto.QueryDto | null | undefined): VirtualQuery | null {
        if (!dto)
            return null;

        const queryConfig = this.#queryRegistry.getQueryConfig(dto.name!);
        if (!queryConfig)
            throw new Error(`Query "${dto.name}" is not registered`);

        const poConfig = this.#persistentObjectRegistry.getConfig(queryConfig.persistentObject);

        // Process columns - iterate over CLIENT columns only
        if (dto.columns && poConfig) {
            for (const clientCol of dto.columns) {
                const attrConfig = poConfig.attributes.find(a => a.name === clientCol.name);
                if (attrConfig) {
                    // SERVER PROVIDES: canSort, type
                    clientCol.canSort = attrConfig.canSort ?? true;
                    // CLIENT PROVIDES: includes, excludes (filter state)
                }
            }
        }

        return createVirtualQuery(dto, queryConfig);
    }

    /**
     * Handles GetClientData requests
     */
    #handleGetClientData(): Dto.ClientDataDto {
        return {
            defaultUser: "VirtualUser",
            exception: null,
            languages: {
                "en": {
                    name: "English",
                    isDefault: true,
                    messages: {
                        "OK": "OK",
                        "Cancel": "Cancel",
                        "Save": "Save"
                    }
                }
            },
            providers: {
                "Vidyano": {
                    parameters: {
                        label: "Vidyano",
                        description: "Vidyano Provider",
                        requestUri: null,
                        signOutUri: null
                    }
                }
            },
            windowsAuthentication: false
        };
    }

    /**
     * Handles GetApplication requests
     */
    #handleGetApplication(): Dto.GetApplicationResponse {
        // Build action definition items
        const actionItems: Dto.QueryResultItemDto[] = Array.from(this.#actionDefinitions.values()).map(action => ({
            id: crypto.randomUUID(),
            values: [
                { key: "Name", value: action.name },
                { key: "DisplayName", value: action.displayName },
                { key: "IsPinned", value: String(action.isPinned) }
            ]
        }));

        // Create a minimal application PersistentObject with required attributes
        const appPo: Dto.PersistentObjectDto = {
            id: crypto.randomUUID(),
            objectId: "Application",
            type: "Application",
            fullTypeName: "Vidyano.Application",
            label: "Virtual Application",
            isNew: false,
            isReadOnly: true,
            stateBehavior: "StayInEdit",
            attributes: [
                { name: "UserId", type: "String", value: "VirtualUserId", id: crypto.randomUUID(), offset: 0, label: "", visibility: "Always", toolTip: "", group: "", tab: "" },
                { name: "FriendlyUserName", type: "String", value: "Virtual User", id: crypto.randomUUID(), offset: 1, label: "", visibility: "Always", toolTip: "", group: "", tab: "" },
                { name: "FeedbackId", type: "String", value: null, id: crypto.randomUUID(), offset: 2, label: "", visibility: "Always", toolTip: "", group: "", tab: "" },
                { name: "UserSettingsId", type: "String", value: null, id: crypto.randomUUID(), offset: 3, label: "", visibility: "Always", toolTip: "", group: "", tab: "" },
                { name: "GlobalSearchId", type: "String", value: null, id: crypto.randomUUID(), offset: 4, label: "", visibility: "Always", toolTip: "", group: "", tab: "" },
                { name: "AnalyticsKey", type: "String", value: null, id: crypto.randomUUID(), offset: 5, label: "", visibility: "Always", toolTip: "", group: "", tab: "" },
                { name: "Routes", type: "String", value: JSON.stringify({ programUnits: {}, persistentObjects: {}, queries: {}, persistentObjectKeys: [], queryKeys: [] }), id: crypto.randomUUID(), offset: 6, label: "", visibility: "Always", toolTip: "", group: "", tab: "" },
                { name: "UserSettings", type: "String", value: "{}", id: crypto.randomUUID(), offset: 7, label: "", visibility: "Always", toolTip: "", group: "", tab: "" },
                { name: "CanProfile", type: "Boolean", value: "False", id: crypto.randomUUID(), offset: 8, label: "", visibility: "Always", toolTip: "", group: "", tab: "" },
                { name: "ProgramUnits", type: "String", value: JSON.stringify({ hasManagement: false, units: [] }), id: crypto.randomUUID(), offset: 9, label: "", visibility: "Always", toolTip: "", group: "", tab: "" }
            ],
            actions: [],
            tabs: {},
            queries: [
                // Empty Resources query
                {
                    id: crypto.randomUUID(),
                    name: "Resources",
                    label: "Resources",
                    columns: [],
                    persistentObject: {
                        type: "Resource",
                        id: crypto.randomUUID(),
                        objectId: null,
                        label: "Resource",
                        isReadOnly: true,
                        attributes: [],
                        actions: [],
                        tabs: {},
                        queries: [],
                        fullTypeName: "Vidyano.Resource"
                    },
                    result: {
                        charts: [],
                        columns: [],
                        items: [],
                        sortOptions: ""
                    }
                },
                // Actions query with registered actions
                {
                    id: crypto.randomUUID(),
                    name: "Actions",
                    label: "Actions",
                    columns: [
                        { id: "Name", name: "Name", label: "Name", type: "String", offset: 0, canFilter: false, canGroupBy: false, canListDistincts: false, canSort: false, isHidden: false, includes: [], excludes: [] },
                        { id: "DisplayName", name: "DisplayName", label: "Display Name", type: "String", offset: 1, canFilter: false, canGroupBy: false, canListDistincts: false, canSort: false, isHidden: false, includes: [], excludes: [] },
                        { id: "IsPinned", name: "IsPinned", label: "Is Pinned", type: "Boolean", offset: 2, canFilter: false, canGroupBy: false, canListDistincts: false, canSort: false, isHidden: false, includes: [], excludes: [] }
                    ],
                    persistentObject: {
                        type: "ActionDefinition",
                        id: crypto.randomUUID(),
                        objectId: null,
                        label: "Action Definition",
                        isReadOnly: true,
                        attributes: [],
                        actions: [],
                        tabs: {},
                        queries: [],
                        fullTypeName: "Vidyano.ActionDefinition"
                    },
                    result: {
                        charts: [],
                        columns: [
                            { id: "Name", name: "Name", label: "Name", type: "String", offset: 0, canFilter: false, canGroupBy: false, canListDistincts: false, canSort: false, isHidden: false, includes: [], excludes: [] },
                            { id: "DisplayName", name: "DisplayName", label: "Display Name", type: "String", offset: 1, canFilter: false, canGroupBy: false, canListDistincts: false, canSort: false, isHidden: false, includes: [], excludes: [] },
                            { id: "IsPinned", name: "IsPinned", label: "Is Pinned", type: "Boolean", offset: 2, canFilter: false, canGroupBy: false, canListDistincts: false, canSort: false, isHidden: false, includes: [], excludes: [] }
                        ],
                        items: actionItems,
                        sortOptions: ""
                    }
                }
            ]
        };

        return {
            application: appPo,
            userCultureInfo: "en-US",
            userLanguage: "en",
            userName: "VirtualUser",
            hasSensitive: false
        };
    }

    /**
     * Handles GetQuery requests
     */
    async #handleGetQuery(request: Dto.GetQueryRequest): Promise<Dto.GetQueryResponse> {
        const queryName = request.id;
        const queryDto = await this.#queryRegistry.getQuery(queryName);

        return {
            query: queryDto
        };
    }

    /**
     * Handles ExecuteQuery requests
     */
    async #handleExecuteQuery(request: Dto.ExecuteQueryRequest): Promise<Dto.ExecuteQueryResponse> {
        // WRAP at entry point
        const wrappedQuery = this.#wrapQuery(request.query);
        const wrappedParent = this.#wrapPersistentObject(request.parent);

        const result = await this.#queryRegistry.executeQuery(
            wrappedQuery as Dto.QueryDto,
            wrappedParent
        );

        return {
            result
        };
    }

    /**
     * Handles GetPersistentObject requests
     */
    async #handleGetPersistentObject(request: Dto.GetPersistentObjectRequest): Promise<Dto.GetPersistentObjectResponse> {
        const type = request.persistentObjectTypeId;
        const objectId = request.objectId || crypto.randomUUID();
        const isNew = request.isNew || false;

        // WRAP parent at entry point
        const wrappedParent = this.#wrapPersistentObject(request.parent);

        const po = await this.#persistentObjectRegistry.getPersistentObject(type, objectId, isNew, wrappedParent);

        return {
            result: po
        };
    }

    /**
     * Handles ExecuteAction requests
     */
    async #handleExecuteAction(request: Dto.ExecuteActionRequest): Promise<Dto.ExecuteActionResponse> {
        const actionName = request.action.split(".").pop()!;

        // WRAP IMMEDIATELY at entry point
        const wrappedParent = this.#wrapPersistentObject(request.parent);

        // Check if this is a query action
        const queryActionRequest = request as Dto.ExecuteQueryActionRequest;
        if (queryActionRequest.query) {
            const queryDto = await this.#queryRegistry.getQuery(queryActionRequest.query.name!);
            return await this.#executeQueryAction(
                { ...request, parent: wrappedParent },
                queryDto,
                actionName
            );
        }

        // PersistentObject action - must have parent
        return await this.#persistentObjectRegistry.executeAction({
            ...request,
            parent: wrappedParent
        });
    }

    /**
     * Executes an action from a query context
     */
    async #executeQueryAction(
        request: Dto.ExecuteActionRequest,
        query: Dto.QueryDto,
        actionName: string
    ): Promise<Dto.ExecuteActionResponse> {
        // Note: query.persistentObject is the TEMPLATE/SCHEMA, not the parent!
        const parent = request.parent;

        // Handle built-in New action
        if (actionName === "New") {
            const type = query.persistentObject?.type;
            if (!type)
                throw new Error("Query does not have a persistentObject type");

            // Create a new PersistentObject with the full lifecycle
            const newPo = await this.#persistentObjectRegistry.createNewPersistentObject(
                type,
                parent,
                query,
                request.parameters || null
            );

            return {
                result: newPo
            };
        }

        // Handle built-in SelectReference action
        if (actionName === "SelectReference") {
            if (!parent)
                throw new Error("SelectReference requires a parent PersistentObject");

            const attributeId = request.parameters?.PersistentObjectAttributeId;
            if (!attributeId)
                throw new Error("SelectReference requires PersistentObjectAttributeId parameter");

            // Find the reference attribute
            const refAttr = parent.attributes?.find(a => a.id === attributeId) as Dto.PersistentObjectAttributeWithReferenceDto;
            if (!refAttr)
                throw new Error(`Attribute with id "${attributeId}" not found`);

            // Get selected items from the request
            const queryActionRequest = request as Dto.ExecuteQueryActionRequest;
            const selectedItems = queryActionRequest.selectedItems || [];

            const selectedItem = selectedItems.length > 0 ? selectedItems[0] : null;

            // Call onSelectReference - base implementation sets objectId/value
            const conversionContext = this.#createConversionContext();
            await this.#persistentObjectActionsRegistry.executeSelectReference(
                parent,
                refAttr,
                query,
                selectedItem,
                conversionContext
            );

            return {
                result: parent
            };
        }

        // Handle built-in Delete action
        if (actionName === "Delete") {
            const type = query.persistentObject?.type;
            if (!type)
                throw new Error("Query does not have a persistentObject type");

            // Get selected items from the request
            const queryActionRequest = request as Dto.ExecuteQueryActionRequest;
            const selectedItems = queryActionRequest.selectedItems || [];

            if (selectedItems.length === 0)
                throw new Error("Delete requires at least one selected item");

            // Call onDelete lifecycle hook
            await this.#persistentObjectActionsRegistry.executeDelete(
                parent || null,
                query,
                selectedItems
            );

            // Return parent or empty result
            return {
                result: parent || null
            };
        }

        // Get action handler
        const handler = this.#actionHandlers.get(actionName);
        if (!handler)
            throw new Error(`Action "${actionName}" is not registered`);

        // Create action context - use parent if provided, otherwise fall back to query's template PO
        const contextPo = parent || query.persistentObject;
        const context = this.#createActionContext(contextPo);

        // Build unified action args
        const queryActionRequest = request as Dto.ExecuteQueryActionRequest;
        const args = {
            parent: parent ?? null,
            query: query,
            selectedItems: queryActionRequest.selectedItems,
            parameters: request.parameters,
            context: context
        };

        // Execute handler
        const result = await handler(args);

        // Handle result - use parent if available, otherwise use template
        const finalResult = this.#normalizeActionResult(result, contextPo);

        return {
            result: finalResult
        };
    }

    /**
     * Creates an action context for attribute manipulation
     */
    #createActionContext(po: Dto.PersistentObjectDto): any {
        return {
            getAttribute: (name: string) => {
                return po.attributes?.find(a => a.name === name);
            },

            getAttributeValue: (name: string) => {
                const attr = po.attributes?.find(a => a.name === name);
                if (!attr)
                    return undefined;

                return fromServiceValue(attr.value, attr.type);
            },

            setAttributeValue: (name: string, value: any) => {
                const attr = po.attributes?.find(a => a.name === name);
                if (attr) {
                    attr.value = toServiceValue(value, attr.type);
                    attr.isValueChanged = true;
                }
            },

            getConvertedValue: (attr: Dto.PersistentObjectAttributeDto) => {
                return fromServiceValue(attr.value, attr.type);
            },

            setConvertedValue: (attr: Dto.PersistentObjectAttributeDto, value: any) => {
                attr.value = toServiceValue(value, attr.type);
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
                return fromServiceValue(attr.value, attr.type);
            },
            setConvertedValue: (attr: Dto.PersistentObjectAttributeDto, value: any) => {
                attr.value = toServiceValue(value, attr.type);
                attr.isValueChanged = true;
            }
        };
    }

    /**
     * Normalizes action result (handles both old and new API formats)
     */
    #normalizeActionResult(result: any, defaultParent: Dto.PersistentObjectDto): Dto.PersistentObjectDto {
        // Handle both old and new API formats for backwards compatibility
        // Old API: handler returns { result: PersistentObjectDto }
        // New API: handler returns PersistentObjectDto | null
        if (result && typeof result === "object" && "result" in result) {
            // Old API format - extract the result property
            return (result as any).result || defaultParent;
        }

        // New API format - use directly
        return result || defaultParent;
    }
}
