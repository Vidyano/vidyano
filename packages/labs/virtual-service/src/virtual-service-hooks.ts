import { ServiceHooks, Dto } from "@vidyano/core";
import { BusinessRuleValidator } from "./business-rules.js";
import { VirtualQueryRegistry } from "./registry/virtual-query-registry.js";
import { VirtualPersistentObjectAttributeConfig } from "./types.js";
import { createVirtualPersistentObject, createVirtualPersistentObjectAttribute, type InternalAttributeDto, unwrapVirtualPersistentObject, VirtualPersistentObject } from "./virtual-persistent-object.js";
import { VirtualQuery, createVirtualQuery, createVirtualQueryResultItem, unwrapVirtualQuery } from "./virtual-query.js";
import { fromServiceString } from "./virtual-service-data-type.js";
import type { VirtualService } from "./virtual-service.js";

/**
 * Virtual implementation of ServiceHooks for testing without a backend
 */
export class VirtualServiceHooks extends ServiceHooks {
    #service!: VirtualService;

    constructor() {
        super();
    }

    /** @internal */
    initialize(service: VirtualService): void {
        this.#service = service;
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

                case "GetQuery": {
                    const queryName = body.id;
                    const poConfig = this.#service.queryRegistry.getPersistentObjectConfig(queryName);
                    const type = poConfig?.type;
                    if (!type)
                        throw new Error(`Query "${queryName}" is not registered or has no persistentObject type`);

                    const instance = this.#service.actionsRegistry.createInstance(type);
                    const query = await instance.onGetQuery(queryName, null);
                    result = { query: unwrapVirtualQuery(query) };
                    break;
                }

                case "GetPersistentObject": {
                    const { persistentObjectTypeId: type, objectId, isNew } = body;
                    const wrappedParent = this.#wrapPersistentObject(body.parent);
                    const instance = this.#service.actionsRegistry.createInstance(type);

                    // Choose lifecycle based on isNew flag
                    const po = isNew
                        ? await instance.onNew(wrappedParent, null, null)
                        : await instance.onLoad(objectId || crypto.randomUUID(), wrappedParent);

                    // Execute detail queries AFTER onLoad/onNew completes (parent is fully set up)
                    await instance.executeIncludedQueries(po);

                    result = { result: unwrapVirtualPersistentObject(po) };
                    break;
                }

                case "ExecuteQuery": {
                    const wrappedQuery = this.#wrapQuery(body.query);
                    const wrappedParent = this.#wrapPersistentObject(body.parent);
                    const type = body.query?.persistentObject?.type;
                    if (!type)
                        throw new Error("Query does not have a persistentObject type");

                    const instance = this.#service.actionsRegistry.createInstance(type);
                    const data = this.#service.queryRegistry.getData(body.query.name);
                    const queryResult = await instance.onExecuteQuery(wrappedQuery!, wrappedParent, data);

                    // Convert to QueryResultDto
                    const columns = wrappedQuery!.columns || [];
                    const pageSize = body.query?.pageSize || 20;
                    result = {
                        result: VirtualQueryRegistry.buildQueryResultDto(queryResult, columns, pageSize)
                    };
                    break;
                }

                case "ExecuteAction": {
                    const actionName = body.action.split(".").pop()!;

                    // WRAP IMMEDIATELY at entry point
                    const wrappedParent = this.#wrapPersistentObject(body.parent);

                    // Query actions (have body.query)
                    if (body.query) {
                        const wrappedQuery = this.#wrapQuery(body.query);
                        const type = body.query.persistentObject?.type;
                        if (!type)
                            throw new Error("Query does not have a persistentObject type");

                        const instance = this.#service.actionsRegistry.createInstance(type);

                        if (actionName === "New") {
                            const po = await instance.onNew(wrappedParent, wrappedQuery, body.parameters);
                            await instance.executeIncludedQueries(po);
                            result = { result: unwrapVirtualPersistentObject(po) };
                        }
                        else if (actionName === "Delete") {
                            const wrappedItems = body.selectedItems?.map((item: Dto.QueryResultItemDto) =>
                                createVirtualQueryResultItem(item, wrappedQuery!)
                            ) || [];
                            await instance.onDelete(wrappedParent, wrappedQuery!, wrappedItems);
                            result = { result: wrappedParent ? unwrapVirtualPersistentObject(wrappedParent) : null };
                        }
                        else if (actionName === "SelectReference") {
                            if (!wrappedParent)
                                throw new Error("SelectReference requires a parent PersistentObject");

                            const attributeId = body.parameters?.PersistentObjectAttributeId;
                            if (!attributeId)
                                throw new Error("SelectReference requires PersistentObjectAttributeId parameter");

                            // Use parent's type for SelectReference (onSelectReference is on parent's actions class)
                            const parentInstance = this.#service.actionsRegistry.createInstance(wrappedParent.type);
                            const refAttr = createVirtualPersistentObjectAttribute(
                                wrappedParent.attributes!.find(a => a.id === attributeId)!,
                                wrappedParent,
                                this.#service
                            );
                            const selectedItem = body.selectedItems?.[0]
                                ? createVirtualQueryResultItem(body.selectedItems[0], wrappedQuery!)
                                : null;
                            await parentInstance.onSelectReference(wrappedParent, refAttr, wrappedQuery!, selectedItem);
                            result = { result: unwrapVirtualPersistentObject(wrappedParent) };
                        }
                        else {
                            // Custom query action - use action handler
                            result = await this.#executeCustomAction(actionName, wrappedParent, wrappedQuery, body);
                        }
                    }
                    // PersistentObject actions (no body.query)
                    else {
                        if (!wrappedParent)
                            throw new Error("ExecuteAction requires a parent PersistentObject");

                        const type = wrappedParent.type;
                        const instance = this.#service.actionsRegistry.createInstance(type);

                        if (actionName === "Save") {
                            const po = await instance.onSave(wrappedParent);
                            result = { result: unwrapVirtualPersistentObject(po) };
                        }
                        else if (actionName === "Refresh") {
                            const attr = body.parameters?.RefreshedPersistentObjectAttributeId
                                ? createVirtualPersistentObjectAttribute(
                                    wrappedParent.attributes!.find(a => a.id === body.parameters.RefreshedPersistentObjectAttributeId)!,
                                    wrappedParent,
                                    this.#service
                                )
                                : undefined;
                            const po = await instance.onRefresh(wrappedParent, attr);
                            result = { result: unwrapVirtualPersistentObject(po) };
                        }
                        else {
                            // Custom PO action - use action handler
                            result = await this.#executeCustomAction(actionName, wrappedParent, null, body);
                        }
                    }
                    break;
                }

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
     * Executes a custom action handler
     */
    async #executeCustomAction(
        actionName: string,
        parent: VirtualPersistentObject | null,
        query: VirtualQuery | null,
        body: any
    ): Promise<Dto.ExecuteActionResponse> {
        const handler = this.#service.actionHandlers.get(actionName);
        if (!handler)
            throw new Error(`Action "${actionName}" is not registered`);

        // Build unified action args
        const wrappedSelectedItems = body.selectedItems && query
            ? body.selectedItems.map((item: Dto.QueryResultItemDto) => createVirtualQueryResultItem(item, query))
            : undefined;

        const args = {
            parent,
            query: query || undefined,
            selectedItems: wrappedSelectedItems,
            parameters: body.parameters
        };

        // Execute handler and get result
        const handlerResult = await handler(args);

        // Unwrap result
        const contextPo = parent || (query ? query.persistentObject : null);
        let finalResult: Dto.PersistentObjectDto | null;
        if (handlerResult)
            finalResult = unwrapVirtualPersistentObject(handlerResult);
        else
            finalResult = contextPo as Dto.PersistentObjectDto;

        return { result: finalResult };
    }

    /**
     * Wraps an incoming PersistentObject DTO with config augmentation
     * @param dto - The incoming PersistentObject DTO from client
     * @returns The wrapped VirtualPersistentObject with config metadata applied
     */
    #wrapPersistentObject(dto: Dto.PersistentObjectDto | null | undefined): VirtualPersistentObject | null {
        if (!dto)
            return null;

        const config = this.#service.persistentObjectRegistry.getConfig(dto.type);
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
            dto.parent = unwrapVirtualPersistentObject(this.#wrapPersistentObject(dto.parent)!);

        return createVirtualPersistentObject(dto, this.#service);
    }

    /**
     * Merges a client attribute with config metadata
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
        clientAttr.isRequired = BusinessRuleValidator.hasRequiredRule(configAttr.rules);
        clientAttr.label = configAttr.label || configAttr.name;
        clientAttr.group = configAttr.group || "";
        clientAttr.tab = configAttr.tab || "";
        clientAttr.column = configAttr.column;
        clientAttr.columnSpan = configAttr.columnSpan;

        // Convert incoming service string to primitive
        if (clientAttr.value != null)
            (clientAttr as InternalAttributeDto).value = fromServiceString(clientAttr.value, clientAttr.type);

        // Reference attribute properties - only set if explicitly configured
        if (configAttr.lookup) {
            const refAttr = clientAttr as Dto.PersistentObjectAttributeWithReferenceDto;
            if (configAttr.displayAttribute !== undefined)
                refAttr.displayAttribute = configAttr.displayAttribute;
        }
    }

    /**
     * Maps attribute visibility to column isHidden property
     */
    static #mapVisibilityToIsHidden(visibility?: Dto.PersistentObjectAttributeVisibility): boolean {
        if (!visibility || visibility === "Always" || visibility === "Read" || visibility === "Query")
            return false;

        if (visibility === "New" || visibility === "Never")
            return true;

        // Handle compound visibility values
        if (visibility === "Read, Query" || visibility === "Query, New")
            return false;

        if (visibility === "Read, New")
            return true;

        return false;
    }

    /**
     * Wraps an incoming Query DTO with config augmentation
     * @param dto - The incoming Query DTO from client
     * @returns The wrapped VirtualQuery with config metadata applied
     */
    #wrapQuery(dto: Dto.QueryDto | null | undefined): VirtualQuery | null {
        if (!dto)
            return null;

        const queryConfig = this.#service.queryRegistry.getQueryConfig(dto.name!);
        if (!queryConfig)
            throw new Error(`Query "${dto.name}" is not registered`);

        const poConfig = this.#service.persistentObjectRegistry.getConfig(queryConfig.persistentObject);

        // Process columns - iterate over CLIENT columns only
        if (dto.columns && poConfig) {
            for (const clientCol of dto.columns) {
                const attrConfig = poConfig.attributes.find(a => a.name === clientCol.name);
                if (attrConfig) {
                    clientCol.canSort = attrConfig.canSort ?? true;
                    // Ensure isHidden is set from visibility config
                    clientCol.isHidden = VirtualServiceHooks.#mapVisibilityToIsHidden(attrConfig.visibility);
                }
            }
        }

        return createVirtualQuery(dto, queryConfig, this.#service);
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
        const actionItems: Dto.QueryResultItemDto[] = Array.from(this.#service._actionDefinitions.values()).map(action => ({
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
}
