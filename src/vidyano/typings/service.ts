// Enum type definitions
type NotificationType = "" | "OK" | "Notice" | "Warning" | "Error";

// Request and Response DTOs
export declare type RequestDto = {
    userName?: string;
    authToken?: string;
    clientVersion?: string;
    environment: "Web" | "Web,ServiceWorker";
    environmentVersion: string;
};
export declare type ResponseDto = {
    authToken?: string;
    exception?: string;
};
export declare type GetApplicationRequest = {
    password?: string;
} & RequestDto;
export declare type GetApplicationResponse = {
    application: PersistentObjectDto;
    userCultureInfo: string;
    userLanguage: string;
    userName: string;
    hasSensitive: boolean;
} & ResponseDto;
export declare type GetQueryRequest = {
    id: string;
} & RequestDto;
export declare type GetQueryResponse = {
    query: QueryDto;
} & ResponseDto;
export declare type GetPersistentObjectRequest = {
    persistentObjectTypeId: string;
    objectId?: string;
    isNew?: boolean;
    parent?: PersistentObjectDto;
} & RequestDto;
export declare type GetPersistentObjectResponse = {
    result: PersistentObjectDto;
} & ResponseDto;
export declare type ExecuteActionRequest = {
    action: string;
    parameters: Record<string, string>;
    parent: PersistentObjectDto;
} & RequestDto;
export declare type ExecuteActionResponse = {
    result: PersistentObjectDto;
} & ResponseDto;
export declare type ExecuteQueryActionRequest = {
    parent: PersistentObjectDto;
    query: QueryDto;
    selectedItems: QueryResultItemDto[];
} & ExecuteActionRequest;
export declare type ExecuteQueryFilterActionRequest = {
    query: QueryDto;
} & ExecuteActionRequest;
export declare type ExecutePersistentObjectActionRequest = {
    parent: PersistentObjectDto;
} & ExecuteActionRequest;
export declare type ExecuteQueryRequest = {
    query: QueryDto;
    parent: PersistentObjectDto;
} & RequestDto;
export declare type ExecuteQueryResponse = {
    result: QueryResultDto;
} & ResponseDto;
export declare type ProviderParametersDto = {
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

// DTO's

export declare type ClientDataDto = {
    defaultUser: string;
    exception: string;
    languages: Record<string, LanguageDto>;
    providers: {
        [name: string]: {
            parameters: ProviderParametersDto;
        };
    };
    windowsAuthentication: boolean;
};
export declare type LanguageDto = {
    name: string;
    isDefault: boolean;
    messages: Record<string, string>;
};
export declare type PersistentObjectDto = Partial<{
    /**
     * Gets the actions allowed for this persistent object.
     */
    actions: string[];

    /**
     * Gets a dictionary to change the default label for the specified action.
     */
    actionLabels: Record<string, string>;

    /**
     * Gets the attributes of this persistent object.
     */
    attributes: PersistentObjectAttributeDto[];

    /**
     * Gets the breadcrumb describing the persistent object at a glance.
     */
    breadcrumb: string;

    /**
     * If this persistent object is in bulk edit mode, this property will contain the object ids that are being edited.
     */
    bulkObjectIds: string[];

    /**
     * Gets the name of the action to use as "Save" action when showing this persistent object as dialog.
     */
    dialogSaveAction: string;

    /**
     * Indicates whether the url for this persistent object should be a FromAction so that refreshing the page will not be able to see different data.
     * @example When the persistent object has a parent persistent object that is required. But not loaded during direct navigation;
     */
    forceFromAction?: boolean;

    /**
     * Gets the full type name of the persistent object.
     */
    fullTypeName: string;

    /**
     * Gets the id of the persistent object.
     */
    id: string;

    /**
     * Indicates whether the breadcrumb data should be treated as sensitive.
     */
    isBreadcrumbSensitive: boolean;

    /**
     * Determines if the persistent object was flagged for deletion on a PersistentObjectAttributeAsDetail.
     */
    isDeleted: boolean;

    /**
     * Indicates whether all of the persistent object attribute tabs will be hidden and only detail queries should be shown.
     */
    isHidden: boolean;

    /**
     * Gets a value indicating whether the instance is new.
     */
    isNew: boolean;

    /**
     * Indicates whether the attributes of this persistent object can be changed.
     */
    isReadOnly: boolean;

    /**
     * Indicates whether this instance is system query.
     */
    isSystem: boolean;

    /**
     * Gets the label of the persistent object.
     */
    label: string;

    /**
     * Gets the metadata of the persistent object.
     */
    metadata: Record<string, string>;

    /*
     * A semicolon separated list of translated options for the end user to pick when executing the New action.
     */
    newOptions: string;

    /**
     * Gets the notification message.
     */
    notification: string;

    /**
     * Gets the notification type.
     */
    notificationType: NotificationType;

    /**
     * Gets the notification duration.
     */
    notificationDuration: number;

    /**
     * Gets the object id of the persistent object.
     */
    objectId: string;

    /**
     * Gets the parent persistent object that contains this persistent object was opened from (Load) or created by (New).
     */
    parent: PersistentObjectDto;

    /**
     * Gets the persistent object detail queries.
     */
    queries: QueryDto[];

    /**
     * Indicates the way in which this persistent object is rendered together with its detail queries.
     */
    queryLayoutMode: "Application" | "MasterDetail" | "FullPage";

    /**
     * The names of the queries that should be refreshed when an action on this persistent object is executed.
     */
    queriesToRefresh: string[];

    /**
     * The security token for verifying the state of this persistent object.
     */
    securityToken: never;

    /**
     * Gets a set of extra options that influence the state of the persistent object.
     */
    stateBehavior: "None" | "OpenInEdit" | "StayInEdit" | "AsDialog";

    /**
     * Gets the tab information for the persistent object.
     */
    tabs: Record<string, PersistentObjectTabDto>;

    /**
     * Gets the type of the persistent object.
     */
    type: string;

    /**
     * Optional data that can be sent to the client.
     */
    tag: any;
}>;
export declare type PersistentObjectAttributeDto = {
    /*
     * Gets the actions that should be invoked directly on the attribute.
     */
    actions: string[];
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
    visibility?: "Always" | "Read" | "New" | "Never" | "Query" | "Read, Query" | "Read, New" | "Query, New";
    toolTip?: string;
    columnSpan?: number;
    typeHints?: Record<string, string>;
    validationError?: string;
    triggersRefresh?: boolean;
    options?: string[];
    tag?: any;
};
export declare type PersistentObjectAttributeWithReferenceDto = {
    /**
     * Indicates whether the end user can add a new reference on this instance.
     */
    canAddNewReference: boolean;

    /**
     * Gets the name of an attribute used for display on the query.
     */
    displayAttribute: string;

    /**
     * Gets the lookup query for this instance.
     */
    lookup: QueryDto;

    /**
     * Gets the object id of the reference.
     */
    objectId: string;

    /**
     * Indicates whether the end user can use a fixed list of possible references to choose from.
     */
    selectInPlace: boolean;
} & PersistentObjectAttributeDto;
export declare type PersistentObjectAttributeAsDetailDto = {
    /**
     * Gets the query used to lookup the related entities.
     */
    details: QueryDto;

    /**
     * Gets the optional name of a lookup attribute that can be used to select a reference when adding a new detail.
     */
    lookupAttribute: string;

    /**
     * Gets the detail persistent objects for this instance.
     */
    objects: PersistentObjectDto[];
} & PersistentObjectAttributeDto;
export declare type PersistentObjectTabDto = Partial<{
    /**
     * The number of columns in the tab, 0 for auto.
     */
    columnCount: number;

    /**
     * The tab id.
     */
    id: string;

    /**
     * The tab layout. TODO: Document this property.
     */
    layout: any;

    /**
     * The tab name.
     */
    name: string;
}>;
export declare type QueryDto = Partial<{
    /**
     * Gets a dictionary to change the default label for the specified action.
     */
    actionLabels: Record<string, string>;

    /**
     * Gets the actions allowed for this query.
     */
    actions: string[];

    /**
     * Gets a value indicating whether text search is allowed for this query.
     */
    allowTextSearch: boolean;

    /**
     * A client-side value indicating whether all items are selected.
     */
    allSelected: boolean;

    /**
     * A client-side value indicating whether all items are selected and the selection is inversed.
     */
    allSelectedInversed: boolean;

    /**
     * Gets a value indicating whether the query should be executed when it's opened.
     */
    autoQuery: boolean;

    /**
     * Gets a value indicating whether the objects from this query can be read.
     */
    canRead: boolean;

    /**
     * Gets a value indicating whether the items can be reordered.
     */
    canReorder: boolean;

    /**
     * Gets the columns.
     */
    columns: QueryColumnDto[];

    /**
     * Gets the continuation token for the next page of results.
     * This is used to load more items when scrolling down.
     */
    continuation: string;

    /**
     * Indicates whether the Query should only allow the Edit action for a single QueryResultItem.
     */
    disableBulkEdit: boolean;

    /**
     * Indicates whether the Query should enable the option to select all items.
     */
    enableSelectAll: boolean;

    /**
     * Gets the filters persistent object for this query.
     */
    filters: PersistentObjectDto;

    /**
     * Indicated on which column the query should be grouped by.
     */
    groupedBy: string;

    /**
     * Gets the id of the query.
     */
    id: string;

    /**
     * Gets the label of the query.
     */
    label: string;

    /**
     * Gets the name of the query.
     */
    name: string;

    /**
     * Gets the notification message.
     */
    notification: string;

    /**
     * Gets the notification type.
     */
    notificationType: NotificationType;

    /**
     * Gets the notification duration.
     */
    notificationDuration: number;

    /**
     * Gets the offset of the query.
     */
    offset: number;

    /**
     * Gets the size of the pages.
     */
    pageSize: number;

    /**
     * Gets the persistent object.
     */
    persistentObject: PersistentObjectDto;

    /**
     * Gets the query result.
     */
    result: QueryResultDto;

    /**
     * Gets or sets the number of items that should be skipped when executing the query.
     */
    skip: number;

    /**
     * Gets the sort options used when displaying this instance.
     * A semicolon seperated list of attributes to sort on. Each attribute can be ASC (Ascending) or DESC (Descending).
     * @example "LastName ASC; FirstName ASC"
     */
    sortOptions: string;

    /**
     * Gets the text search value that was supplied by a user to filter the query.
     */
    textSearch: string;

    /**
     * Optional data that can be sent to the client.
     */
    tag: any;

    /**
     * Gets or sets the number of items that should be returned when executing the query.
     */
    top: number;

    /**
     * The total number of items that can be returned by this query or -1 if the total number is unknown.
     */
    totalItems: number;

    /**
     * Indicates whether this instance is system query.
     */
    isSystem: boolean;

    /**
     * Indicates whether this instance is hidden.
     */
    isHidden: boolean;
}>;
export declare type QueryColumnDto = {
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
    tag?: any;
    includes: string[];
    excludes: string[];
};
export declare type QueryResultDto = {
    charts: QueryChartDto[];
    columns: QueryColumnDto[];
    continuation?: string;
    groupedBy?: string;
    groupingInfo?: QueryGroupingInfoDto;
    items: QueryResultItemDto[];
    notification?: string;
    notificationDuration?: number;
    notificationType?: NotificationType;
    pageSize?: number;
    skip?: number;
    sortOptions: string;
    totalItem?: QueryResultItemDto;
    totalItems?: number;
    tag?: any;
};
export declare type QueryResultItemDto = {
    id: string;
    values: QueryResultItemValueDto[];
    typeHints?: Record<string, string>;
    tag?: any;
};
export declare type QueryResultItemValueDto = {
    key: string;
    value: string;
    objectId?: string;
    typeHints?: Record<string, string>;
};
export declare type QueryGroupingInfoDto = {
    groupedBy: string;
    groups?: QueryResultItemGroupDto[];
};
export declare type QueryResultItemGroupDto = {
    name: string;
    count: number;
};
export declare type QueryChartDto = {
    label: string;
    name: string;
    type: string;
    options: any;
};
export declare type RetryActionDto = {
    cancelOption?: number;
    defaultOption?: number;
    message: string;
    options: string[];
    persistentObject?: PersistentObjectDto;
    title: string;
};
export declare type ProfilerRequestDto = {
    method: string;
    profiler: ProfilerDto;
    request: any;
    response: any;
    transport: number;
    when: Date;
};
export declare type ProfilerDto = {
    elapsedMilliseconds: number;
    entries: ProfilerEntryDto[];
    exceptions: {
        id: string;
        message: string;
    }[];
    sql: ProfilerSqlDto[];
    taskId: number;
};
export declare type ProfilerEntryDto = {
    arguments: any[];
    elapsedMilliseconds: number;
    entries: ProfilerEntryDto[];
    exception: string;
    hasNPlusOne?: boolean;
    methodName: string;
    sql: string[];
    started: number;
};
export declare type ProfilerSqlDto = {
    commandId: string;
    commandText: string;
    elapsedMilliseconds: number;
    parameters: ProfilerSqlParameterDto[];
    recordsAffected: number;
    taskId: number;
    type: string;
};
export declare type ProfilerSqlParameterDto = {
    name: string;
    type: string;
    value: string;
};

export {};