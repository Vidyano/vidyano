import { Dto } from "@vidyano/core";
import { VirtualQueryConfig, VirtualPersistentObjectConfig, VirtualQueryExecuteResult } from "../types.js";
import { VirtualService } from "../virtual-service.js";

/**
 * Registry for managing Query configurations (config + columns store)
 */
export class VirtualQueryRegistry {
    #configs = new Map<string, {
        config: VirtualQueryConfig;
        columns: Dto.QueryColumnDto[];
        persistentObjectConfig: VirtualPersistentObjectConfig;
        data: Record<string, any>[];
    }>();

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
     * Gets the PersistentObject configuration for a query
     * @param name - The query name
     */
    getPersistentObjectConfig(name: string): VirtualPersistentObjectConfig | undefined {
        return this.#configs.get(name)?.persistentObjectConfig;
    }

    /**
     * Gets the columns for a query
     * @param name - The query name
     */
    getColumns(name: string): Dto.QueryColumnDto[] {
        return this.#configs.get(name)?.columns || [];
    }

    /**
     * Gets the default data for a query
     * @param name - The query name
     */
    getData(name: string): Record<string, any>[] {
        return this.#configs.get(name)?.data || [];
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
     * Builds a QueryResultDto from execution result
     * @param result - The query execution result with items and totalItems
     * @param columns - The query columns
     * @param pageSize - The page size
     * @returns The QueryResultDto
     */
    static buildQueryResultDto(
        result: VirtualQueryExecuteResult,
        columns: Dto.QueryColumnDto[],
        pageSize: number
    ): Dto.QueryResultDto {
        const items = result.items.map(row =>
            VirtualQueryRegistry.buildQueryResultItemDto(row, columns)
        );

        return {
            items,
            columns,
            totalItems: result.totalItems,
            pageSize,
            sortOptions: "",
            charts: []
        };
    }

    /**
     * Builds a QueryResultItemDto from a data row
     * @param data - The data row
     * @param columns - The query columns
     * @returns The QueryResultItemDto
     */
    static buildQueryResultItemDto(
        data: Record<string, any>,
        columns: Dto.QueryColumnDto[]
    ): Dto.QueryResultItemDto {
        // Extract or generate ID
        let id: string;
        if (data["id"] != null && (typeof data["id"] === "string" || typeof data["id"] === "number"))
            id = String(data["id"]);
        else if (data["Id"] != null && (typeof data["Id"] === "string" || typeof data["Id"] === "number"))
            id = String(data["Id"]);
        else
            id = crypto.randomUUID();

        // Build values array
        const values: Dto.QueryResultItemValueDto[] = columns.map(column => {
            const rawValue = data[column.name];
            return {
                key: column.name,
                value: rawValue == null ? null : VirtualService.toServiceValue(rawValue, column.type),
                objectId: data[column.name + "Id"],
                typeHints: data[column.name + "$typeHints"]
            };
        });

        return {
            id,
            values,
            typeHints: data.$typeHints,
            tag: data.$tag
        };
    }
}
