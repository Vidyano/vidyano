export type OperationType =
    | "GetApplication"
    | "GetPersistentObject"
    | "GetQuery"
    | "ExecuteQuery"
    | "ExecuteAction"
    | "Other";

export interface HarApiEntry {
    index: number;
    timestamp: string;
    url: string;
    operationType: OperationType;
    requestBody: Record<string, any>;
    responseBody: Record<string, any>;
}

export type InteractionType =
    | "Initialize"
    | "LoadPersistentObject"
    | "LoadQuery"
    | "SearchQuery"
    | "RefreshQuery"
    | "ReorderQuery"
    | "QueryAction"
    | "SelectReference"
    | "SetAttributeValues"
    | "Save"
    | "CustomAction";

export interface TrackedObject {
    varName: string;
    type: string;
    typeId: string;
    objectId: string | null;
    isNew: boolean;
    attributes: Map<string, TrackedAttribute>;
    parentVar: string | null;
}

export interface TrackedAttribute {
    id: string;
    name: string;
    type: string;
    value: any;
}

export interface TrackedQuery {
    varName: string;
    name: string;
    id: string;
    parentObjectVar: string | null;
    searched: boolean;
    lastColumnFilters?: Map<string, { includes: string[]; excludes: string[] }>;
    /** When set, this query comes from an AsDetail attribute's `details` property */
    asDetailAttributeName?: string;
}

export interface InteractionStep {
    index: number;
    type: InteractionType;
    description: string;
    entry: HarApiEntry;

    // For Initialize
    serviceUri?: string;

    // For LoadPersistentObject
    poVar?: string;
    typeName?: string;
    objectId?: string;
    parentVar?: string | null;

    // For LoadQuery
    queryId?: string;

    // For SearchQuery / RefreshQuery
    queryVar?: string;
    queryName?: string;
    queryParentVar?: string | null;
    isStandalone?: boolean;
    reorderQueryVar?: string;
    reorderItemIds?: (string | null)[];
    columnFilterChanges?: Array<{ columnName: string; selectedDistincts: string[]; inversed: boolean }>;

    // For QueryAction when using query.filters.createNew()
    filtersSourceQueryVar?: string;

    // For QueryAction (e.g. New)
    actionName?: string;
    resultVar?: string;
    sourceQueryVar?: string;
    /** When set, the query comes from an AsDetail attribute's details property */
    asDetailAttributeName?: string;
    asDetailParentVar?: string;

    // For SelectReference
    targetPoVar?: string;
    attributeName?: string;
    selectedItemIds?: string[];
    selectedDisplayValue?: string;

    // For SetAttributeValues
    targetVar?: string;
    attributeChanges?: Array<{ name: string; value: any; type: string }>;

    // For Save
    saveTargetVar?: string;
    asDetailChanges?: Array<{
        attributeName: string;
        attrVar: string;
        parentVar: string;
        newObjectVars: string[];
        deletedObjectIds: string[];
        modifiedObjects: Array<{
            objectId: string;
            changes: Array<{ name: string; value: any; type: string }>;
        }>;
    }>;

    // For CustomAction
    customActionName?: string;
    customActionTargetVar?: string;
    // When a query action needs to declare the query variable first
    queryDeclareVar?: string;
    queryDeclareParentVar?: string;
    queryDeclareName?: string;
    // Selected item IDs for query actions (e.g. Delete)
    queryActionSelectedItemIds?: string[];

    // Action execution options (for any action type)
    actionParameters?: Record<string, any>;
    actionMenuOption?: number;
}
