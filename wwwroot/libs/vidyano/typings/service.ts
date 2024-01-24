import type { KeyValue, KeyValueString } from "./common.js"

export declare type NotificationType = "" | "OK" | "Notice" | "Warning" | "Error";
export declare type SortDirection = "" | "ASC" | "DESC";
export declare type Request = {
    userName?: string;
    authToken?: string;
    clientVersion?: string;
    environment: "Web" | "Web,ServiceWorker";
    environmentVersion: string;
};
export declare type Response = {
    authToken?: string;
    exception?: string;
};
export declare type GetApplicationRequest = {
    password?: string;
} & Request;
export declare type GetQueryRequest = {
    id: string;
} & Request;
export declare type GetQueryResponse = {
    query: Query;
} & Response;
export declare type GetPersistentObjectRequest = {
    persistentObjectTypeId: string;
    objectId?: string;
    isNew?: boolean;
    parent?: PersistentObject;
} & Request;
export declare type GetPersistentObjectResponse = {
    result: PersistentObject;
} & Response;
export declare type ExecuteActionParameters = {
    [key: string]: string;
};
export declare type ExecuteActionRequest = {
    action: string;
    parameters: ExecuteActionParameters;
    parent: PersistentObject;
} & Request;
export declare type ExecuteActionRefreshParameters = {
    RefreshedPersistentObjectAttributeId: string;
} & ExecuteActionParameters;
export declare type ExecuteQueryActionRequest = {
    parent: PersistentObject;
    query: Query;
    selectedItems: QueryResultItem[];
} & ExecuteActionRequest;
export declare type ExecuteQueryFilterActionRequest = {
    query: Query;
} & ExecuteActionRequest;
export declare type ExecutePersistentObjectActionRequest = {
    parent: PersistentObject;
} & ExecuteActionRequest;
export declare type ExecuteActionResponse = {
    result: PersistentObject;
} & Response;
export declare type ExecuteQueryRequest = {
    query: Query;
    parent: PersistentObject;
} & Request;
export declare type ExecuteQueryResponse = {
    result: QueryResult;
} & Response;
export declare type ProviderParameters = {
    label: string;
    description: string;
    requestUri: string;
    signOutUri: string;
    redirectUri: string;
    registerPersistentObjectId?: string;
    registerUser?: string;
    forgotPassword?: boolean;
    getCredentialType?: boolean;
};
export declare type ClientData = {
    defaultUser: string;
    exception: string;
    languages: Languages;
    providers: {
        [name: string]: {
            parameters: ProviderParameters;
        };
    };
    windowsAuthentication: boolean;
};
export declare type Languages = {
    [culture: string]: Language;
};
export declare type Language = {
    name: string;
    isDefault: boolean;
    messages: KeyValueString;
};
export declare type ApplicationResponse = {
    application: PersistentObject;
    userCultureInfo: string;
    userLanguage: string;
    userName: string;
    hasSensitive: boolean;
} & Response;
export declare type PersistentObjectStateBehavior = "None" | "OpenInEdit" | "StayInEdit" | "AsDialog";
export declare type PersistentObject = {
    actions?: string[];
    attributes?: PersistentObjectAttribute[];
    breadcrumb?: string;
    dialogSaveAction?: string;
    forceFromAction?: boolean;
    fullTypeName: string;
    id: string;
    isBreadcrumbSensitive?: boolean;
    isNew?: boolean;
    isSystem?: boolean;
    label?: string;
    newOptions?: string;
    notification?: string;
    notificationType?: NotificationType;
    notificationDuration?: number;
    objectId?: string;
    queries?: Query[];
    queryLayoutMode?: string;
    securityToken?: never;
    stateBehavior?: PersistentObjectStateBehavior;
    tabs?: KeyValue<PersistentObjectTab>;
    type: string;
};
export declare type PersistentObjectAttributeVisibility = "Always" | "Read" | "New" | "Never" | "Query" | "Read, Query" | "Read, New" | "Query, New";
export declare type PersistentObjectAttribute = {
    disableSort?: boolean;
    id?: string;
    column?: number;
    name: string;
    type: string;
    group?: string;
    tab?: string;
    label?: string;
    value?: string;
    isReadOnly?: boolean;
    isRequired?: boolean;
    isSensitive?: boolean;
    isSystem?: boolean;
    isValueChanged?: boolean;
    offset?: number;
    rules?: string;
    visibility?: PersistentObjectAttributeVisibility;
    toolTip?: string;
    columnSpan?: number;
    typeHints?: KeyValue<string>;
    validationError?: string;
    triggersRefresh?: boolean;
    options?: string[];
    actions?: string[];
};
export declare type PersistentObjectAttributeWithReference = {
    displayAttribute: string;
    lookup: Query;
    objectId: string;
} & PersistentObjectAttribute;
export declare type PersistentObjectTab = {
    columnCount: number;
    id?: string;
    name: string;
};
export declare type Query = {
    actionLabels?: KeyValueString;
    actions: string[];
    allowTextSearch: boolean;
    allSelected: boolean;
    allSelectedInversed: boolean;
    autoQuery: boolean;
    canRead: boolean;
    columns: QueryColumn[];
    disableBulkEdit: boolean;
    enableSelectAll: boolean;
    filters: PersistentObject;
    groupedBy: string;
    id: string;
    label: string;
    name: string;
    notification: string;
    notificationType: NotificationType;
    notificationDuration: number;
    pageSize: number;
    persistentObject: PersistentObject;
    result: QueryResult;
    sortOptions: string;
    textSearch: string;
};
export declare type QueryColumn = {
    canFilter: boolean;
    canGroupBy: boolean;
    canListDistincts: boolean;
    canSort: boolean;
    id: string;
    isHidden: boolean;
    isSensitive?: boolean;
    label: string;
    name: string;
    offset: number;
    persistentObjectId: string;
    type: string;
};
export declare type QueryResult = {
    charts: QueryChart[];
    columns: QueryColumn[];
    continuation?: string;
    groupedBy?: string;
    groupingInfo?: QueryGroupingInfo;
    items: QueryResultItem[];
    notification?: string;
    notificationDuration?: number;
    notificationType?: NotificationType;
    pageSize?: number;
    skip?: number;
    sortOptions: string;
    totalItem?: QueryResultItem;
    totalItems?: number;
};
export declare type QueryResultItem = {
    id: string;
    values: QueryResultItemValue[];
    typeHints?: KeyValueString;
};
export declare type QueryResultItemValue = {
    key: string;
    value: string;
    objectId?: string;
    typeHints?: KeyValueString;
};
export declare type QueryGroupingInfo = {
    groupedBy: string;
    groups?: QueryResultItemGroup[];
};
export declare type QueryResultItemGroup = {
    name: string;
    count: number;
};
export declare type QueryChart = {
    label: string;
    name: string;
    type: string;
    options: any;
};
export declare type RetryAction = {
    cancelOption?: number;
    defaultOption?: number;
    message: string;
    options: string[];
    persistentObject?: PersistentObject;
    title: string;
};
export declare type ProfilerRequest = {
    method: string;
    profiler: Profiler;
    request: any;
    response: any;
    transport: number;
    when: Date;
};
export declare type Profiler = {
    elapsedMilliseconds: number;
    entries: ProfilerEntry[];
    exceptions: {
        id: string;
        message: string;
    }[];
    sql: ProfilerSql[];
    taskId: number;
};
export declare type ProfilerEntry = {
    arguments: any[];
    elapsedMilliseconds: number;
    entries: ProfilerEntry[];
    exception: string;
    hasNPlusOne?: boolean;
    methodName: string;
    sql: string[];
    started: number;
};
export declare type ProfilerSql = {
    commandId: string;
    commandText: string;
    elapsedMilliseconds: number;
    parameters: ProfilerSqlParameter[];
    recordsAffected: number;
    taskId: number;
    type: string;
};
export declare type ProfilerSqlParameter = {
    name: string;
    type: string;
    value: string;
};

export {};