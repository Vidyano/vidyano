import { Dto } from "@vidyano/core";
import { fromServiceValue, toServiceValue } from "./virtual-service-data-type.js";
import type { VirtualService } from "./virtual-service.js";
import { createVirtualQuery, VirtualQuery } from "./virtual-query.js";

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
     * Gets the converted value of this attribute (e.g., Boolean as boolean, Int32 as number)
     */
    getValue(): any;

    /**
     * Sets the value of this attribute with automatic type conversion
     */
    setValue(value: any): void;

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
    getAttributeValue(name: string): any;

    /**
     * Sets the value of an attribute by name
     */
    setAttributeValue(name: string, value: any): void;

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
    const helpers = {
        getValue() {
            return fromServiceValue(attr.value, attr.type);
        },
        setValue(value: any) {
            attr.value = toServiceValue(value, attr.type);
            attr.isValueChanged = true;
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

    return new Proxy(attr, {
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
 * Unwraps a VirtualPersistentObject to get the underlying DTO
 * Since the Proxy wraps the DTO, we can safely cast it back
 * @param wrapped - The VirtualPersistentObject to unwrap
 * @returns The underlying PersistentObjectDto
 */
export function unwrapVirtualPersistentObject(wrapped: VirtualPersistentObject): Dto.PersistentObjectDto {
    // The wrapped object is a Proxy around the DTO
    // We can return it as-is since the DTO is the target of the Proxy
    return wrapped as Dto.PersistentObjectDto;
}
