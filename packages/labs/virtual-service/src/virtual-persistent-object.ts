import { Dto } from "@vidyano/core";

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
     * Sets a validation error on this attribute
     */
    setValidationError(error: string): void;

    /**
     * Clears the validation error on this attribute
     */
    clearValidationError(): void;
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
     * Sets a validation error for an attribute
     */
    setValidationError(name: string, error: string): void;

    /**
     * Clears a validation error for an attribute
     */
    clearValidationError(name: string): void;

    /**
     * Sets a notification message on the persistent object
     */
    setNotification(message: string, type: Dto.NotificationType, duration?: number): void;
};

/**
 * Creates a VirtualPersistentObjectAttribute by wrapping an attribute DTO with a Proxy
 * The Proxy intercepts property access to provide getValue/setValue methods
 * @param attr - The PersistentObjectAttributeDto to wrap
 * @param conversionContext - The conversion context for type conversions
 * @returns A VirtualPersistentObjectAttribute that combines DTO properties with helper methods
 */
export function createVirtualPersistentObjectAttribute(
    attr: Dto.PersistentObjectAttributeDto,
    conversionContext: ConversionContext
): VirtualPersistentObjectAttribute {
    const helpers = {
        getValue() {
            return conversionContext.getConvertedValue(attr);
        },
        setValue(value: any) {
            conversionContext.setConvertedValue(attr, value);
        },
        setValidationError(error: string) {
            attr.validationError = error;
        },
        clearValidationError() {
            attr.validationError = undefined;
        }
    };

    return new Proxy(attr, {
        get(target, prop) {
            if (prop in helpers)
                return helpers[prop as keyof typeof helpers];

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
 * @returns A VirtualPersistentObject that combines DTO properties with helper methods
 */
export function createVirtualPersistentObject(
    dto: Dto.PersistentObjectDto,
    conversionContext: ConversionContext
): VirtualPersistentObject {
    // Helper methods - logic is inlined here, only using conversionContext for type conversion
    const helpers = {
        getAttribute(name: string) {
            const attr = dto.attributes?.find(a => a.name === name);
            if (!attr)
                return undefined;

            return createVirtualPersistentObjectAttribute(attr, conversionContext);
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
        setValidationError(name: string, error: string) {
            const attr = dto.attributes?.find(a => a.name === name);
            if (attr)
                attr.validationError = error;
        },
        clearValidationError(name: string) {
            const attr = dto.attributes?.find(a => a.name === name);
            if (attr)
                attr.validationError = undefined;
        },
        setNotification(message: string, type: Dto.NotificationType, duration?: number) {
            dto.notification = message;
            dto.notificationType = type;
            dto.notificationDuration = duration;
        }
    };

    // Create a Proxy that intercepts property access
    return new Proxy(dto, {
        get(target, prop) {
            // If accessing a helper method, return it
            if (prop in helpers)
                return helpers[prop as keyof typeof helpers];

            // Otherwise, return the DTO property
            return target[prop as keyof typeof target];
        },

        set(target, prop, value) {
            // Allow setting DTO properties directly
            (target as any)[prop] = value;
            return true;
        }
    }) as VirtualPersistentObject;
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
