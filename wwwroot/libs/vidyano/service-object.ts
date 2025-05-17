import { Observable } from "./common/observable.js"
import type { Service } from "./service.js"

export function nameof<TObject>(key: keyof TObject): string;
export function nameof(key: any): any {
    return key;
}

/**
 * Represents a base class for objects that are used by the backend service.
 * This class provides common functionality for service objects, such as
 * copying properties to another object. It extends the Observable class
 * to support reactive programming patterns.
 */
export abstract class ServiceObject extends Observable<ServiceObject> {
    #service: Service;

    constructor(service: Service) {
        super();
        
        this.#service = service;
    }

    /**
     * Gets the associated service.
     */
    get service(): Service {
        return this.#service;
    }

    /**
     * Copy properties from a dictionary of values to an object. 
     * @param values A dictionary of values to copy.
     * @param includeNullValues Include null values in the result.
     * @param result The object to copy the properties to.
     * @returns The object with the properties copied.
     */
    protected _copyPropertiesFromValues(values: { [key: string]: any }, includeNullValues?: boolean, result?: any): any {
        result = result || {};
        Object.keys(values).forEach(key => {
            const value = values[key];
            if (!value || (Array.isArray(value) && value.length === 0))
                return;

            result[key] = value;
        });

        return result;
    }
}