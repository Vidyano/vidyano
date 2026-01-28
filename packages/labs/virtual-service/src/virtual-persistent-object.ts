import { Dto } from "@vidyano/core";
import type { VirtualService } from "./virtual-service.js";

/**
 * Conversion context for type conversion between DTO and JavaScript values
 */
export type ConversionContext = {
    getConvertedValue: (attr: Dto.PersistentObjectAttributeDto) => any;
    setConvertedValue: (attr: Dto.PersistentObjectAttributeDto, value: any) => void;
};

/**
 * VirtualPersistentObjectAttribute combines a PersistentObjectAttributeDto with helper methods
 * This allows clean syntax like attr.getValue() and attr.setValue() while keeping the underlying DTO unchanged
 */
export type VirtualPersistentObjectAttribute = Dto.PersistentObjectAttributeDto & {
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
};

/**
 * VirtualPersistentObject combines a PersistentObjectDto with helper methods
 * This allows clean syntax like obj.setAttributeValue() while keeping the underlying DTO unchanged
 */
export type VirtualPersistentObject = Dto.PersistentObjectDto & {
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
     * Sets a validation error for an attribute. Pass null/empty to clear.
     */
    setValidationError(name: string, error: string | null | undefined): void;

    /**
     * Sets a notification message on the persistent object
     */
    setNotification(message: string, type: Dto.NotificationType, duration?: number): void;

    /**
     * Reference to the VirtualService instance
     */
    readonly service: VirtualService;
};

/**
 * Creates a VirtualPersistentObjectAttribute by wrapping an attribute DTO with a Proxy
 * The Proxy intercepts property access to provide getValue/setValue methods
 * @param attr - The PersistentObjectAttributeDto to wrap
 * @param conversionContext - The conversion context for type conversions
 * @param persistentObject - The parent VirtualPersistentObject
 * @returns A VirtualPersistentObjectAttribute that combines DTO properties with helper methods
 */
export function createVirtualPersistentObjectAttribute(
    attr: Dto.PersistentObjectAttributeDto,
    conversionContext: ConversionContext,
    persistentObject: VirtualPersistentObject
): VirtualPersistentObjectAttribute {
    const helpers = {
        getValue() {
            return conversionContext.getConvertedValue(attr);
        },
        setValue(value: any) {
            conversionContext.setConvertedValue(attr, value);
        },
        setValidationError(error: string | null | undefined) {
            attr.validationError = error || undefined;
        },
        get persistentObject() {
            return persistentObject;
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
 * @param conversionContext - The conversion context for type conversions
 * @param service - The VirtualService instance
 * @returns A VirtualPersistentObject that combines DTO properties with helper methods
 */
export function createVirtualPersistentObject(
    dto: Dto.PersistentObjectDto,
    conversionContext: ConversionContext,
    service: VirtualService
): VirtualPersistentObject {
    // Create proxy first so we can reference it in helpers
    let proxy: VirtualPersistentObject;

    // Helper methods - logic is inlined here, only using conversionContext for type conversion
    const helpers = {
        getAttribute(name: string) {
            const attr = dto.attributes?.find(a => a.name === name);
            if (!attr)
                return undefined;

            return createVirtualPersistentObjectAttribute(attr, conversionContext, proxy);
        },
        getAttributeValue(name: string) {
            const attr = dto.attributes?.find(a => a.name === name);
            if (!attr)
                return undefined;

            return conversionContext.getConvertedValue(attr);
        },
        setAttributeValue(name: string, value: any) {
            const attr = dto.attributes?.find(a => a.name === name);
            if (attr)
                conversionContext.setConvertedValue(attr, value);
        },
        setValidationError(name: string, error: string | null | undefined) {
            const attr = dto.attributes?.find(a => a.name === name);
            if (attr)
                attr.validationError = error || undefined;
        },
        setNotification(message: string, type: Dto.NotificationType, duration?: number) {
            dto.notification = message;
            dto.notificationType = type;
            dto.notificationDuration = duration;
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
