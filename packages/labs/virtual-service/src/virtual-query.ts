import { Dto } from "@vidyano/core";
import type { VirtualQueryConfig } from "./types.js";
import type { VirtualService } from "./virtual-service.js";

/**
 * VirtualQueryColumn combines a QueryColumnDto with helper methods
 */
export type VirtualQueryColumn = Dto.QueryColumnDto & {
    /**
     * Reference to config metadata (internal use)
     */
    readonly __configMeta?: {
        canSort?: boolean;
    };

    /**
     * Reference to the parent query
     */
    readonly query: VirtualQuery;

    /**
     * Reference to the VirtualService instance
     */
    readonly service: VirtualService;
};

/**
 * VirtualQuery combines a QueryDto with helper methods
 * This allows clean syntax for query manipulation while keeping the underlying DTO unchanged
 */
export type VirtualQuery = Dto.QueryDto & {
    /**
     * Gets a column by name
     */
    getColumn(name: string): VirtualQueryColumn | undefined;

    /**
     * Sets a notification message on the query
     */
    setNotification(message: string, type: Dto.NotificationType, duration?: number): void;

    /**
     * Whether the query results should be included when loading the parent PersistentObject.
     * Defaults to true for detail queries - set to false to skip pre-execution.
     */
    isIncludedInParentObject: boolean;

    /**
     * Reference to config (internal use)
     */
    readonly __config?: VirtualQueryConfig;

    /**
     * Reference to the VirtualService instance
     */
    readonly service: VirtualService;
};

/**
 * VirtualQueryResultItem combines a QueryResultItemDto with helper methods
 */
export type VirtualQueryResultItem = Dto.QueryResultItemDto & {
    /**
     * Gets a value from the item by column name
     */
    getValue(columnName: string): any;

    /**
     * Reference to the parent query
     */
    readonly query: VirtualQuery;

    /**
     * Reference to the VirtualService instance
     */
    readonly service: VirtualService;
};

/**
 * Creates a VirtualQueryColumn by wrapping a QueryColumnDto with a Proxy
 * @param dto - The QueryColumnDto to wrap
 * @param query - The parent VirtualQuery
 * @returns A VirtualQueryColumn that combines DTO properties with helper methods
 */
export function createVirtualQueryColumn(
    dto: Dto.QueryColumnDto,
    query: VirtualQuery
): VirtualQueryColumn {
    const helpers = {
        get query() {
            return query;
        },
        get service() {
            return query.service;
        }
    };

    return new Proxy(dto, {
        get(target, prop) {
            if (prop in helpers) {
                const value = helpers[prop as keyof typeof helpers];
                return typeof value === "function" ? value : value;
            }

            return target[prop as keyof typeof target];
        },

        set(target, prop, value) {
            (target as any)[prop] = value;
            return true;
        }
    }) as VirtualQueryColumn;
}

/**
 * Creates a VirtualQuery by wrapping a QueryDto with a Proxy
 * The Proxy intercepts property access to provide helper methods
 * @param dto - The QueryDto to wrap
 * @param config - Optional query config for metadata
 * @param service - The VirtualService instance
 * @returns A VirtualQuery that combines DTO properties with helper methods
 */
export function createVirtualQuery(
    dto: Dto.QueryDto,
    config?: VirtualQueryConfig,
    service?: VirtualService
): VirtualQuery {
    // Create proxy first so we can reference it in helpers
    let proxy: VirtualQuery;

    const helpers = {
        getColumn(name: string): VirtualQueryColumn | undefined {
            const col = dto.columns?.find(c => c.name === name);
            if (!col)
                return undefined;

            return createVirtualQueryColumn(col, proxy);
        },
        setNotification(message: string, type: Dto.NotificationType, duration?: number) {
            dto.notification = message;
            dto.notificationType = type;
            dto.notificationDuration = duration;
        },
        get __config() {
            return config;
        },
        get service() {
            return service;
        }
    };

    proxy = new Proxy(dto, {
        get(target, prop) {
            if (prop in helpers) {
                const value = helpers[prop as keyof typeof helpers];
                return typeof value === "function" ? value : value;
            }

            return target[prop as keyof typeof target];
        },

        set(target, prop, value) {
            (target as any)[prop] = value;
            return true;
        }
    }) as VirtualQuery;

    return proxy;
}

/**
 * Unwraps a VirtualQuery to get the underlying DTO
 * @param wrapped - The VirtualQuery to unwrap
 * @returns The underlying QueryDto
 */
export function unwrapVirtualQuery(wrapped: VirtualQuery): Dto.QueryDto {
    return wrapped as Dto.QueryDto;
}

/**
 * Creates a VirtualQueryResultItem by wrapping a QueryResultItemDto with a Proxy
 * @param dto - The QueryResultItemDto to wrap
 * @param query - The parent VirtualQuery
 * @returns A VirtualQueryResultItem that combines DTO properties with helper methods
 */
export function createVirtualQueryResultItem(
    dto: Dto.QueryResultItemDto,
    query: VirtualQuery
): VirtualQueryResultItem {
    const helpers = {
        getValue(columnName: string): any {
            const valueEntry = dto.values?.find((v: any) => v.key === columnName);
            return valueEntry?.value;
        },
        get query() {
            return query;
        },
        get service() {
            return query.service;
        }
    };

    return new Proxy(dto, {
        get(target, prop) {
            if (prop in helpers) {
                const value = helpers[prop as keyof typeof helpers];
                return typeof value === "function" ? value : value;
            }

            return target[prop as keyof typeof target];
        },

        set(target, prop, value) {
            (target as any)[prop] = value;
            return true;
        }
    }) as VirtualQueryResultItem;
}
