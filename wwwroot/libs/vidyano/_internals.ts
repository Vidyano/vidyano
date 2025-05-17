import type { PersistentObject } from "./persistent-object";
import type { PersistentObjectAttribute } from "./persistent-object-attribute";
import type { Query } from "./query";
import type { Dto } from "./vidyano";
import type { QueryResultItem } from "./query-result-item";

export const PersistentObjectSymbols = {
    Dto: Symbol("PersistentObject_Dto"),
    IsPersistentObject: Symbol("PersistentObject_IsPersistentObject"),
    PrepareAttributesForRefresh: Symbol("PersistentObject_PrepareAttributesForRefresh"),
    RefreshFromResult: Symbol("PersistentObject_RefreshFromResult"),
    RefreshTabsAndGroups: Symbol("PersistentObject_RefreshTabsAndGroups"),
};

export const PersistentObjectAttributeSymbols = {
    BackupServiceValue: Symbol("PersistentObjectAttribute_BackupServiceValue"),
    IsPersistentObjectAttribute: Symbol("PersistentObjectAttribute_IsPersistentObjectAttribute"),
    RefreshFromResult: Symbol("PersistentObjectAttribute_RefreshFromResult"),
    ToServiceObject: Symbol("PersistentObjectAttribute_ToServiceObject"),
};

export const QueryResultItemSymbols = {
    IsQueryResultItem: Symbol("QueryResultItem_IsQueryResultItem"),
    ToServiceObject: Symbol("QueryResultItem_ToServiceObject"),
};

export const QuerySymbols = {
    IsQuery: Symbol("Query_IsQuery"),
};

// Internal proxy symbol for accessing internal methods.
const InternalProxy = Symbol("InternalProxy");

export type InternalPersistentObject = PersistentObject & {
    /**
     * Gets the data transfer object for the persistent object.
     */
    get dto(): Dto.PersistentObject;

    /**
     * Prepares all attributes for a refresh by caching current service values.
     * @param sender The attribute initiating the refresh.
     */
    prepareAttributesForRefresh(sender: PersistentObjectAttribute): void;

    /**
     * Refreshes the object state from a new service result, merging changes.
     * @param result The new data from the service.
     * @param resultWins If true, the new data overrides current values.
     */
    refreshFromResult(po: PersistentObject | Dto.PersistentObject, resultWins?: boolean): void;

    /**
     * Rebuilds the tabs and groups UI structure based on changed attributes.
     * @param changedAttributes The attributes that have been modified.
     */
    refreshTabsAndGroups(...changedAttributes: PersistentObjectAttribute[]): void;
};

export type InternalPersistentObjectAttribute = PersistentObjectAttribute & {
    /**
     * Backs up the service value.
     */
    backupServiceValue(): void;

    /**
     * Refreshes the attribute from the service result.
     *
     * @param resultAttr - The result attribute data from the service.
     * @param resultWins - Flag indicating if the result value takes precedence.
     * @returns A flag indicating if visibility has changed.
     */
    refreshFromResult(attr: PersistentObjectAttribute | Dto.PersistentObjectAttribute, resultWins?: boolean): boolean;

    /**
     * Converts the attribute to a service object.
     */
    toServiceObject(): Dto.PersistentObjectAttribute;
};

export type InternalQueryResultItem = QueryResultItem & {
    /**
     * Converts the query result item to a service object.
     */
    toServiceObject(): Dto.QueryResultItem;
};

export type InternalQuery = Query & {
};

/**
 * Gets the internal proxy for the target.
 * @param target The target to get the internal proxy for.
 */
export function _internal(target: PersistentObject): InternalPersistentObject;
export function _internal(target: PersistentObjectAttribute): InternalPersistentObjectAttribute;
export function _internal(target: Query): InternalQuery;
export function _internal(target: QueryResultItem): InternalQueryResultItem;
export function _internal(target: any) {
    if (target[InternalProxy])
        return target[InternalProxy];

    if (target[PersistentObjectSymbols.IsPersistentObject]) {
        return target[InternalProxy] = new Proxy(target, {
            get: (obj, prop, receiver) => {
                switch (prop) {
                    case "dto":
                        return obj[PersistentObjectSymbols.Dto];

                    case "prepareAttributesForRefresh":
                        return (...args: any[]) => obj[PersistentObjectSymbols.PrepareAttributesForRefresh].apply(obj, args);

                    case "refreshFromResult":
                        return (...args: any[]) => obj[PersistentObjectSymbols.RefreshFromResult].apply(obj, args);
                    
                    case "refreshTabsAndGroups":
                        return (...args: any[]) => obj[PersistentObjectSymbols.RefreshTabsAndGroups].apply(obj, args);

                    default:
                        return Reflect.get(obj, prop, receiver);
                };
            }
        }) as InternalPersistentObject;
    } else if (target[PersistentObjectAttributeSymbols.IsPersistentObjectAttribute]) {
        return target[InternalProxy] = new Proxy(target, {
            get: (obj, prop, receiver) => {
                switch (prop) {
                    case "backupServiceValue":
                        return (...args: any[]) => obj[PersistentObjectAttributeSymbols.BackupServiceValue].apply(obj, args);

                    case "refreshFromResult":
                        return (...args: any[]) => obj[PersistentObjectAttributeSymbols.RefreshFromResult].apply(obj, args);

                    case "toServiceObject":
                        return (...args: any[]) => obj[PersistentObjectAttributeSymbols.ToServiceObject].apply(obj, args);

                    default:
                        return Reflect.get(obj, prop, receiver);
                };
            }
        }) as InternalPersistentObjectAttribute;
    } else if (target[QuerySymbols.IsQuery]) {
        return target[InternalProxy] = new Proxy(target, {
            get: (obj, prop, receiver) => {
                switch (prop) {
                    default:
                        return Reflect.get(obj, prop, receiver);
                };
            }
        }) as InternalPersistentObjectAttribute;
    } else if (target[QueryResultItemSymbols.IsQueryResultItem]) {
        return target[InternalProxy] = new Proxy(target, {
            get: (obj, prop, receiver) => {
                switch (prop) {
                    case "toServiceObject":
                        return (...args: any[]) => obj[QueryResultItemSymbols.ToServiceObject].apply(obj, args);

                    default:
                        return Reflect.get(obj, prop, receiver);
                }
            }
        }) as InternalQueryResultItem;
    } else
        throw new Error("Invalid target");
}