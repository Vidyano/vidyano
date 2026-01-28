import { Dto } from "@vidyano/core";
import type { VirtualQueryConfig } from "./types.js";

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
     * Reference to config (internal use)
     */
    readonly __config?: VirtualQueryConfig;
};

/**
 * VirtualQueryResultItem combines a QueryResultItemDto with helper methods
 */
export type VirtualQueryResultItem = Dto.QueryResultItemDto & {
    /**
     * Gets a value from the item by column name
     */
    getValue(columnName: string): any;
};

/**
 * Creates a VirtualQuery by wrapping a QueryDto with a Proxy
 * The Proxy intercepts property access to provide helper methods
 * @param dto - The QueryDto to wrap
 * @param config - Optional query config for metadata
 * @returns A VirtualQuery that combines DTO properties with helper methods
 */
export function createVirtualQuery(
    dto: Dto.QueryDto,
    config?: VirtualQueryConfig
): VirtualQuery {
    const helpers = {
        getColumn(name: string): VirtualQueryColumn | undefined {
            return dto.columns?.find(c => c.name === name) as VirtualQueryColumn | undefined;
        },
        setNotification(message: string, type: Dto.NotificationType, duration?: number) {
            dto.notification = message;
            dto.notificationType = type;
            dto.notificationDuration = duration;
        },
        get __config() {
            return config;
        }
    };

    return new Proxy(dto, {
        get(target, prop) {
            if (prop in helpers)
                return helpers[prop as keyof typeof helpers];

            return target[prop as keyof typeof target];
        },

        set(target, prop, value) {
            (target as any)[prop] = value;
            return true;
        }
    }) as VirtualQuery;
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
 * @returns A VirtualQueryResultItem that combines DTO properties with helper methods
 */
export function createVirtualQueryResultItem(dto: Dto.QueryResultItemDto): VirtualQueryResultItem {
    const helpers = {
        getValue(columnName: string): any {
            const valueEntry = dto.values?.find((v: any) => v.key === columnName);
            return valueEntry?.value;
        }
    };

    return new Proxy(dto, {
        get(target, prop) {
            if (prop in helpers)
                return helpers[prop as keyof typeof helpers];

            return target[prop as keyof typeof target];
        },

        set(target, prop, value) {
            (target as any)[prop] = value;
            return true;
        }
    }) as VirtualQueryResultItem;
}
