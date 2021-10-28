import { Observable } from "./common/observable.js";
import type { Service } from "./service.js";

export class ServiceObject extends Observable<ServiceObject> {
    constructor(public service: Service) {
        super();
    }

    copyProperties(propertyNames: Array<string>, includeNullValues?: boolean, result?: any): any {
        result = result || {};
        propertyNames.forEach(p => {
            const value = (this as any)[p];
            if (includeNullValues || (value != null && value !== false && (value !== 0 || p === "pageSize") && (!Array.isArray(value) || value.length > 0)))
                result[p] = value;
        });
        return result;
    }
}