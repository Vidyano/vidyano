import { Dto, DataType } from "@vidyano/core";
import { VirtualQueryConfig, VirtualPersistentObjectConfig } from "../types.js";
import type { VirtualPersistentObjectActionsRegistry } from "./virtual-persistent-object-actions-registry.js";

import type { VirtualService } from "../virtual-service.js";

/**
 * Registry for managing Query configurations
 */
export class VirtualQueryRegistry {
    #configs = new Map<string, {
        config: VirtualQueryConfig;
        columns: Dto.QueryColumnDto[];
        persistentObjectConfig: VirtualPersistentObjectConfig;
        data: Record<string, any>[];
    }>();
    #actionsRegistry: VirtualPersistentObjectActionsRegistry | null;
    #service: VirtualService | null;

    constructor(actionsRegistry?: VirtualPersistentObjectActionsRegistry, service?: VirtualService) {
        this.#actionsRegistry = actionsRegistry || null;
        this.#service = service || null;
    }

    /**
     * Checks if a query is registered
     * @param name - The query name
     */
    hasQuery(name: string): boolean {
        return this.#configs.has(name);
    }

    /**
     * Gets a registered Query configuration
     * @param name - The query name
     */
    getQueryConfig(name: string): VirtualQueryConfig | undefined {
        return this.#configs.get(name)?.config;
    }

    /**
     * Registers a Query configuration
     */
    register(
        config: VirtualQueryConfig,
        persistentObjectConfig: VirtualPersistentObjectConfig
    ): void {
        // Validate required fields
        if (!config.name || config.name.trim() === "")
            throw new Error("Query configuration must have a 'name' property");

        if (!config.persistentObject || config.persistentObject.trim() === "")
            throw new Error("Query configuration must have a 'persistentObject' property");

        // Derive columns from PersistentObject configuration
        const columns = VirtualQueryRegistry.#deriveColumnsFromPersistentObject(persistentObjectConfig);

        this.#configs.set(config.name, {
            config,
            columns,
            persistentObjectConfig,
            data: config.data || []
        });
    }

    /**
     * Derives query columns from PersistentObject attributes
     */
    static #deriveColumnsFromPersistentObject(poConfig: VirtualPersistentObjectConfig): Dto.QueryColumnDto[] {
        return poConfig.attributes.map((attr, index) => {
            const offset = attr.offset ?? index;

            return {
                id: attr.name,
                name: attr.name,
                label: attr.label || this.#humanize(attr.name),
                type: attr.type || "String",
                offset,
                isHidden: this.#mapVisibilityToIsHidden(attr.visibility),
                isSensitive: false,

                // Query capabilities - following plan specifications
                canFilter: false,          // Not supported in mock implementation
                canSort: attr.canSort ?? true,  // Defaults to true
                canGroupBy: false,         // Not supported in mock implementation
                canListDistincts: false,   // Not supported (no filtering)

                // Filter arrays (empty for mock)
                includes: [],
                excludes: []

                // Note: typeHints are not stored on columns, only on QueryResultItemValueDto
            };
        });
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
     * Converts camelCase or PascalCase string to human-readable format
     */
    static #humanize(name: string): string {
        if (!name)
            return name;

        // Insert space before capital letters (except first) and between number/letter transitions
        return name
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
            .replace(/([a-zA-Z])(\d)/g, '$1 $2')
            .replace(/(\d)([a-zA-Z])/g, '$1 $2')
            .trim();
    }

    /**
     * Gets a QueryDto by name
     * @param name - The query name
     * @param parent - The parent PersistentObject (for detail queries) or null
     */
    async getQuery(name: string, parent?: Dto.PersistentObjectDto | null): Promise<Dto.QueryDto> {
        const entry = this.#configs.get(name);
        if (!entry)
            throw new Error(`Query '${name}' is not registered`);

        const { config, columns, persistentObjectConfig } = entry;

        // Build default actions
        const actions: string[] = ["RefreshQuery"];

        // Auto-add New if onNew is overridden for the PersistentObject type
        if (this.#actionsRegistry?.isMethodOverridden(persistentObjectConfig.type, "onNew")) {
            if (!actions.includes("New"))
                actions.push("New");
        }

        // Auto-add Delete if onDelete is overridden for the PersistentObject type
        if (this.#actionsRegistry?.isMethodOverridden(persistentObjectConfig.type, "onDelete")) {
            if (!actions.includes("Delete"))
                actions.push("Delete");
        }

        // Add custom query-level actions
        if (config.actions) {
            for (const actionName of config.actions)
                if (!actions.includes(actionName))
                    actions.push(actionName);
        }

        // Add custom item-level actions
        if (config.itemActions) {
            for (const actionName of config.itemActions)
                if (!actions.includes(actionName))
                    actions.push(actionName);
        }

        // Build the query DTO first (needed for onConstructQuery and executeQuery)
        const queryDto = buildQueryDto(config, columns, actions, persistentObjectConfig);

        // Call onConstructQuery lifecycle hook
        if (this.#actionsRegistry)
            this.#actionsRegistry.executeConstructQuery(queryDto, parent || null);

        // Handle autoQuery flag - execute query to get initial results
        if (config.autoQuery !== false && this.#actionsRegistry) {
            const result = await this.executeQuery(queryDto, parent || null);
            queryDto.result = result;
        }

        return queryDto;
    }

    /**
     * Executes a query by delegating to the actions registry's onExecuteQuery
     * @param query - The query DTO with textSearch, sortOptions, skip, top set
     * @param parent - The parent PersistentObject (for detail queries) or null
     */
    async executeQuery(
        query: Dto.QueryDto,
        parent: Dto.PersistentObjectDto | null
    ): Promise<Dto.QueryResultDto> {
        if (!this.#actionsRegistry)
            throw new Error("Actions registry is required for query execution");

        const entry = this.#configs.get(query.name!);
        if (!entry)
            throw new Error(`Query '${query.name}' is not registered`);

        const { columns, data } = entry;

        // Use registered columns (with isHidden) instead of request columns
        const queryWithColumns = { ...query, columns };

        // Delegate to actions registry to get items, passing default data from config
        const result = await this.#actionsRegistry.executeQuery(queryWithColumns, parent, data);

        // Convert data rows to QueryResultItemDto
        const items = result.items.map(row =>
            buildQueryResultItemDto(row, columns)
        );

        // Build and return QueryResultDto
        return buildQueryResultDto(
            items,
            columns,
            result.totalItems,
            undefined, // No continuation - use skip/top instead
            query.pageSize,
            query.skip,
            query.sortOptions
        );
    }
}

/**
 * Builds a QueryDto from configuration
 */
function buildQueryDto(
    config: VirtualQueryConfig,
    columns: Dto.QueryColumnDto[],
    actions: string[],
    persistentObjectConfig: VirtualPersistentObjectConfig
): Dto.QueryDto {
    // Build minimal PersistentObjectDto for the query
    const persistentObject: Dto.PersistentObjectDto = {
        type: persistentObjectConfig.type,
        id: crypto.randomUUID(),
        objectId: null,
        label: persistentObjectConfig.type,
        fullTypeName: `Mock.${persistentObjectConfig.type}`,
        isNew: false,
        isReadOnly: true,
        attributes: [],
        actions: [],
        tabs: {},
        queries: []
    };

    return {
        id: crypto.randomUUID(),
        name: config.name,
        label: config.label || config.name,
        columns,
        actions,
        allowTextSearch: config.allowTextSearch ?? true,
        disableBulkEdit: config.disableBulkEdit ?? false,
        autoQuery: config.autoQuery ?? true,
        pageSize: config.pageSize || 20,
        persistentObject,
        sortOptions: "",
        textSearch: "",
        skip: 0,
        top: config.pageSize || 20,
        totalItems: -1,
        canRead: true,
        canReorder: false,
        enableSelectAll: true
    };
}

/**
 * Builds a QueryResultDto from result data
 */
function buildQueryResultDto(
    items: Dto.QueryResultItemDto[],
    columns: Dto.QueryColumnDto[],
    totalItems: number,
    continuation?: string,
    pageSize?: number,
    skip?: number,
    sortOptions?: string
): Dto.QueryResultDto {
    return {
        items,
        columns,
        totalItems,
        continuation,
        pageSize,
        skip,
        sortOptions: sortOptions || "",
        charts: []
    };
}

/**
 * Builds a QueryResultItemDto from a data row
 */
function buildQueryResultItemDto(
    data: Record<string, any>,
    columns: Dto.QueryColumnDto[]
): Dto.QueryResultItemDto {
    // Extract or generate ID (check both lowercase "id" and capitalized "Id")
    let id: string;
    if (data["id"] != null && (typeof data["id"] === "string" || typeof data["id"] === "number"))
        id = String(data["id"]);
    else if (data["Id"] != null && (typeof data["Id"] === "string" || typeof data["Id"] === "number"))
        id = String(data["Id"]);
    else
        id = crypto.randomUUID();

    // Build values array
    const values: Dto.QueryResultItemValueDto[] = columns.map(column => {
        return buildQueryResultItemValueDto(
            column.name,
            data[column.name],
            column.type,
            data[column.name + "Id"],
            data[column.name + "$typeHints"]
        );
    });

    // Extract typeHints and tag from row if present
    const typeHints = data.$typeHints;
    const tag = data.$tag;

    return {
        id,
        values,
        typeHints,
        tag
    };
}

/**
 * Builds a QueryResultItemValueDto from a single value
 * Converts JavaScript primitives to service string format
 */
function buildQueryResultItemValueDto(
    key: string,
    rawValue: any,
    type: string,
    objectId?: string,
    typeHints?: Record<string, string>
): Dto.QueryResultItemValueDto {
    // Convert to service string format using DataType.toServiceString
    const value = rawValue == null
        ? null
        : DataType.toServiceString(rawValue, type);

    return {
        key,
        value,
        objectId,
        typeHints
    };
}
