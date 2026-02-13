import { Dto } from "@vidyano/core";
import { toServiceValue } from "./virtual-service-data-type.js";
import type { VirtualService } from "./virtual-service.js";
import { createVirtualQuery, unwrapVirtualQuery, VirtualQuery } from "./virtual-query.js";
import type { TypeConverter } from "./types.js";

/**
 * Primitive value types supported for attribute values.
 * Internally we store primitives; conversion to/from service strings happens at serialization boundaries.
 */
type PrimitiveValue = string | boolean | number | Date | null | undefined;

/**
 * Internal representation of an attribute DTO that allows primitive values.
 * The wire format uses strings, but internally we work with native types.
 */
export type InternalAttributeDto = Omit<Dto.PersistentObjectAttributeDto, "value"> & {
    value?: PrimitiveValue;
};

/**
 * VirtualPersistentObjectAttribute combines a PersistentObjectAttributeDto with helper methods
 * This allows clean syntax like attr.getValue() and attr.setValue() while keeping the underlying DTO unchanged
 */
export type VirtualPersistentObjectAttribute = Dto.PersistentObjectAttributeDto & VirtualPersistentObjectAttributeHelpers;

/**
 * VirtualPersistentObjectAttributeWithReference extends VirtualPersistentObjectAttribute with reference-specific properties
 * Use this type when the attribute type is "Reference"
 */
export type VirtualPersistentObjectAttributeWithReference = Dto.PersistentObjectAttributeWithReferenceDto & VirtualPersistentObjectAttributeHelpers;

/**
 * Helper methods added to VirtualPersistentObjectAttribute
 */
type VirtualPersistentObjectAttributeHelpers = {
    /**
     * Gets the value of this attribute
     */
    getValue<T = any>(): T;

    /**
     * Sets the value of this attribute
     */
    setValue<T = any>(value: T): void;

    /**
     * Sets a validation error on this attribute. Pass null/empty to clear.
     */
    setValidationError(error: string | null | undefined): void;

    /**
     * Reference to the parent persistent object
     */
    readonly persistentObject: VirtualPersistentObject;

    /**
     * Reference to the VirtualService instance
     */
    readonly service: VirtualService;
};

/**
 * VirtualPersistentObject combines a PersistentObjectDto with helper methods
 * This allows clean syntax like obj.setAttributeValue() while keeping the underlying DTO unchanged
 */
export type VirtualPersistentObject = Omit<Dto.PersistentObjectDto, "queries"> & {
    /**
     * Gets an attribute by name, wrapped with getValue/setValue methods
     */
    getAttribute(name: string): VirtualPersistentObjectAttribute | undefined;

    /**
     * Gets the value of an attribute by name
     */
    getAttributeValue<T = any>(name: string): T;

    /**
     * Sets the value of an attribute by name
     */
    setAttributeValue<T = any>(name: string, value: T): void;

    /**
     * Sets a notification message on the persistent object
     */
    setNotification(message: string, type: Dto.NotificationType, duration?: number): void;

    /**
     * Detail queries attached to this persistent object, wrapped as VirtualQuery
     */
    queries?: VirtualQuery[];

    /**
     * Reference to the VirtualService instance
     */
    readonly service: VirtualService;
};

/**
 * Creates a VirtualPersistentObjectAttribute by wrapping an attribute DTO with a Proxy
 * The Proxy intercepts property access to provide getValue/setValue methods
 * @param attr - The PersistentObjectAttributeDto to wrap
 * @param persistentObject - The parent VirtualPersistentObject
 * @param service - The VirtualService instance
 * @returns A VirtualPersistentObjectAttribute that combines DTO properties with helper methods
 */
export function createVirtualPersistentObjectAttribute(
    attr: Dto.PersistentObjectAttributeDto,
    persistentObject: VirtualPersistentObject,
    service: VirtualService
): VirtualPersistentObjectAttribute {
    const internalAttr = attr as InternalAttributeDto;

    const helpers = {
        getValue<T = any>(): T {
            return internalAttr.value as T;
        },
        setValue<T = any>(value: T): void {
            internalAttr.value = value as PrimitiveValue;
            internalAttr.isValueChanged = true;
        },
        setValidationError(error: string | null | undefined) {
            attr.validationError = error || undefined;
        },
        get persistentObject() {
            return persistentObject;
        },
        get service() {
            return service;
        }
    };

    return new Proxy(internalAttr, {
        get(target, prop) {
            if (prop in helpers) {
                const value = helpers[prop as keyof typeof helpers];
                return typeof value === "function" ? value : value;
            }

            return target[prop as keyof typeof target];
        },

        set(target, prop, newValue) {
            if (prop === "value") {
                const oldValue = target.value;
                const hasChanged = oldValue instanceof Date && newValue instanceof Date
                    ? oldValue.getTime() !== newValue.getTime()
                    : oldValue !== newValue;

                if (hasChanged) {
                    target.value = newValue;
                    target.isValueChanged = true;
                }
            }
            else
                (target as Record<string, unknown>)[prop as string] = newValue;

            return true;
        }
    }) as VirtualPersistentObjectAttribute;
}

/**
 * Creates a VirtualPersistentObject by wrapping a DTO with a Proxy
 * The Proxy intercepts property access to provide helper methods while keeping the underlying DTO unchanged
 * @param dto - The PersistentObjectDto to wrap
 * @param service - The VirtualService instance
 * @returns A VirtualPersistentObject that combines DTO properties with helper methods
 */
export function createVirtualPersistentObject(
    dto: Dto.PersistentObjectDto,
    service: VirtualService
): VirtualPersistentObject {
    // Create proxy first so we can reference it in helpers
    let proxy: VirtualPersistentObject;

    // Cache wrapped queries to ensure same instance is returned
    let wrappedQueries: VirtualQuery[] | undefined;

    // Helper methods - delegate to attribute helpers where possible
    const helpers = {
        getAttribute(name: string) {
            const attr = dto.attributes?.find(a => a.name === name);
            if (!attr)
                return undefined;

            return createVirtualPersistentObjectAttribute(attr, proxy, service);
        },
        getAttributeValue(name: string) {
            return proxy.getAttribute(name)?.getValue();
        },
        setAttributeValue(name: string, value: any) {
            proxy.getAttribute(name)?.setValue(value);
        },
        setNotification(message: string, type: Dto.NotificationType, duration?: number) {
            dto.notification = message;
            dto.notificationType = type;
            dto.notificationDuration = duration;
        },
        get queries() {
            if (!dto.queries)
                return undefined;

            // Wrap queries lazily and cache them
            if (!wrappedQueries)
                wrappedQueries = dto.queries.map(q => createVirtualQuery(q, undefined, service));

            return wrappedQueries;
        },
        get service() {
            return service;
        }
    };

    // Create a Proxy that intercepts property access
    proxy = new Proxy(dto, {
        get(target, prop) {
            // If accessing a helper method, return it
            if (prop in helpers) {
                const value = helpers[prop as keyof typeof helpers];
                return typeof value === "function" ? value : value;
            }

            // Otherwise, return the DTO property
            return target[prop as keyof typeof target];
        },

        set(target, prop, value) {
            // Allow setting DTO properties directly
            (target as any)[prop] = value;
            return true;
        }
    }) as VirtualPersistentObject;

    return proxy;
}

/**
 * Unwraps a VirtualPersistentObject to get a DTO suitable for wire transmission.
 * Converts primitive values to service string format.
 * Also accepts raw DTOs for recursive handling of parent/nested objects.
 */
export function unwrapVirtualPersistentObject(
    wrapped: VirtualPersistentObject | Dto.PersistentObjectDto,
    typeConverters?: ReadonlyMap<string, TypeConverter>
): Dto.PersistentObjectDto {
    const dto = wrapped as Dto.PersistentObjectDto;

    return {
        ...dto,
        attributes: dto.attributes?.map(attr => ({
            ...attr,
            value: attr.value != null ? toServiceValue(attr.value, attr.type, typeConverters) : attr.value
        })),
        parent: dto.parent ? unwrapVirtualPersistentObject(dto.parent, typeConverters) : undefined,
        queries: dto.queries?.map(q => unwrapVirtualQuery(q))
    };
}
