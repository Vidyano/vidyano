import type { PersistentObject } from "./persistent-object";
import type { PersistentObjectAttribute } from "./persistent-object-attribute";
import type { Query } from "./query";
import type { Dto, PersistentObjectAttributeWithReference } from "./vidyano";
import type { QueryResultItem } from "./query-result-item";
import type { QueryResultItemValue } from "./query-result-item-value";
import type { QueryColumn } from "./query-column";
import type { Service } from "./service";
import type { ServiceHooks } from "./service-hooks";

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

export const QueryColumnSymbols = {
    IsQueryColumn: Symbol("QueryColumn_IsQueryColumn"),
    ToServiceObject: Symbol("QueryColumn_ToServiceObject"),
};

export const QueryResultItemSymbols = {
    IsQueryResultItem: Symbol("QueryResultItem_IsQueryResultItem"),
    ToServiceObject: Symbol("QueryResultItem_ToServiceObject"),
};

export const QueryResultItemValueSymbols = {
    IsQueryResultItemValue: Symbol("QueryResultItemValue_IsQueryResultItemValue"),
    ToServiceObject: Symbol("QueryResultItemValue_ToServiceObject"),
};

export const QuerySymbols = {
    IsQuery: Symbol("Query_IsQuery"),
    SetOwnerAttributeWithReference: Symbol("Query_SetOwnerAttributeWithReference"),
    NotifyItemSelectionChanged: Symbol("Query_NotifyItemSelectionChanged"),
    ToServiceObject: Symbol("Query_ToServiceObject"),
};

export const ServiceHooksSymbols = {
    IsServiceHooks: Symbol("ServiceHooks_IsServiceHooks"),
    SetService: Symbol("ServiceHooks_SetService"),
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

export type InternalQueryColumn = QueryColumn & {
    /**
     * Converts the query column to a service object.
     */
    toServiceObject(): Dto.QueryColumn;
};

export type InternalQueryResultItem = QueryResultItem & {
    /**
     * Converts the query result item to a service object.
     */
    toServiceObject(): Dto.QueryResultItem;
};

export type InternalQueryResultItemValue = {
    /**
     * Converts the query result item value to a service object.
     */
    toServiceObject(): any;
};

export type InternalQuery = Query & {
    /**
     * Notifies the query that an item selection has changed.
     * @param item The query result item that has changed selection state.
     * @param isSelected Indicates whether the item is now selected or not.
     */
    notifyItemSelectionChanged(item: QueryResultItem, isSelected: boolean): void;

    /**
     * Sets the owner attribute for the query, typically used for attributes with references.
     * @param attribute The attribute that owns this query.
     */
    setOwnerAttributeWithReference(attribute: PersistentObjectAttributeWithReference): void;

    /**
     * Converts the query to a service object.
     */
    toServiceObject(): any;
};

export type InternalServiceHooks = ServiceHooks & {
    /**
     * Sets the service instance for the hooks.
     */
    setService(service: Service);
};

/**
 * Gets the internal proxy for the target.
 * @param target The target to get the internal proxy for.
 */
export function _internal(target: PersistentObject): InternalPersistentObject;
export function _internal(target: PersistentObjectAttribute): InternalPersistentObjectAttribute;
export function _internal(target: Query): InternalQuery;
export function _internal(target: QueryResultItem): InternalQueryResultItem;
export function _internal(target: QueryResultItemValue): InternalQueryResultItemValue;
export function _internal(target: QueryColumn): InternalQueryColumn;
export function _internal(target: ServiceHooks): InternalServiceHooks;
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
    } else if (target[QueryColumnSymbols.IsQueryColumn]) {
        return target[InternalProxy] = new Proxy(target, {
            get: (obj, prop, receiver) => {
                switch (prop) {
                    case "toServiceObject":
                        return (...args: any[]) => obj[QueryColumnSymbols.ToServiceObject].apply(obj, args);

                    default:
                        return Reflect.get(obj, prop, receiver);
                }
            }
        }) as InternalQueryColumn;
    } else if (target[QuerySymbols.IsQuery]) {
        return target[InternalProxy] = new Proxy(target, {
            get: (obj, prop, receiver) => {
                switch (prop) {
                    case "notifyItemSelectionChanged":
                        return (...args: any[]) => obj[QuerySymbols.NotifyItemSelectionChanged].apply(obj, args);

                    case "setOwnerAttributeWithReference":
                        return (...args: any[]) => obj[QuerySymbols.SetOwnerAttributeWithReference].apply(obj, args);

                    case "toServiceObject":
                        return (...args: any[]) => obj[QuerySymbols.ToServiceObject].apply(obj, args);

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
    } else if (target[QueryResultItemValueSymbols.IsQueryResultItemValue]) {
        return target[InternalProxy] = new Proxy(target, {
            get: (obj, prop, receiver) => {
                switch (prop) {
                    case "toServiceObject":
                        return (...args: any[]) => obj[QueryResultItemValueSymbols.ToServiceObject].apply(obj, args);

                    default:
                        return Reflect.get(obj, prop, receiver);
                }
            }
        }) as InternalQueryResultItemValue;
    } else if (target[ServiceHooksSymbols.IsServiceHooks]) {
        return target[InternalProxy] = new Proxy(target, {
            get: (obj, prop, receiver) => {
                switch (prop) {
                    case "setService":
                        return (...args: any[]) => obj[ServiceHooksSymbols.SetService].apply(obj, args);

                    default:
                        return Reflect.get(obj, prop, receiver);
                }
            }
        }) as InternalServiceHooks;
    } else
        throw new Error("Invalid target");
}