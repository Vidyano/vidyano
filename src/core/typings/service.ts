// Union type definitions

export type NotificationType = "" | "OK" | "Notice" | "Warning" | "Error";
export type PersistentObjectLayoutMode = "Application" | "MasterDetail" | "FullPage";
export type PersistentObjectStateBehavior = "None" | "OpenInEdit" | "StayInEdit" | "AsDialog";
export type PersistentObjectAttributeVisibility = "Always" | "Read" | "New" | "Never" | "Query" | "Read, Query" | "Read, New" | "Query, New";

// Request and Response DTOs
export declare type RequestDto = {
    /**
     * The user name of the user making the request.
     */
    userName?: string;

    /**
     * The authentication token used to authenticate the request.
     */
    authToken?: string;

    /**
     * The client version of the application making the request.
     */
    clientVersion?: string;

    /**
     * The client environment of the application making the request.
     */
    environment: "Web" | "Web,ServiceWorker";

    /**
     * The version of the client environment.
     */
    environmentVersion: string;
};

export declare type ResponseDto = {
    /**
     * An optional authentication token that can be used to authenticate subsequent requests.
     */
    authToken?: string;

    /**
     * Any exception that occurred during the processing of the request.
     */
    exception?: string;
};

export declare type GetApplicationRequest = {
    /**
     * An optional password for the user to get the application persistent object.
     */
    password?: string;
} & RequestDto;

export declare type GetApplicationResponse = {
    /**
     * The application persistent object.
     */
    application: PersistentObjectDto;

    /**
     * The culture information of the user.
     */
    userCultureInfo: string;

    /**
     * The language of the user.
     */
    userLanguage: string;

    /**
     * The user name of the user making the request.
     */
    userName: string;

    /**
     * Indicates whether the application has sensitive information that should be handled with care.
     */
    hasSensitive: boolean;
} & ResponseDto;

export declare type GetQueryRequest = {
    /**
     * The id of the query to retrieve.
     */
    id: string;
} & RequestDto;

export declare type GetQueryResponse = {
    /**
     * The query.
     */
    query: QueryDto;
} & ResponseDto;

export declare type GetPersistentObjectRequest = {
    /**
     * The id of the persistent object to retrieve.
     */
    persistentObjectTypeId: string;

    /**
     * The id of the entity to retrieve.
     */
    objectId?: string;

    /**
     * Indicates whether the persistent object is new.
     */
    isNew?: boolean;

    /**
     * The parent persistent object from which this persistent object is loaded or created.
     */
    parent?: PersistentObjectDto;
} & RequestDto;

export declare type GetPersistentObjectResponse = {
    /**
     * The persistent object.
     */
    result: PersistentObjectDto;
} & ResponseDto;

export declare type ExecuteActionRequest = {
    /**
     * The name of the action to execute.
     */
    action: string;

    /**
     * The parameters to pass to the action.
     */
    parameters: Record<string, string>;

    /**
     * An optional parent persistent object of the query or persistent object that the action is executed on.
     */
    parent?: PersistentObjectDto;
} & RequestDto;

export declare type ExecuteActionResponse = {
    /**
     * The resulting persistent object of the action.
     */
    result: PersistentObjectDto;
} & ResponseDto;

export declare type ExecuteQueryActionRequest = {
    /**
     * The parent persistent object that contains the query.
     */
    parent: PersistentObjectDto;

    /**
     * The query to execute the action on.
     */
    query: QueryDto;

    /**
     * Any selected items to be used in the action.
     */
    selectedItems: QueryResultItemDto[];
} & ExecuteActionRequest;

export declare type ExecuteQueryFilterActionRequest = {
    /**
     * The query to filter.
     */
    query: QueryDto;
} & ExecuteActionRequest;

export declare type ExecutePersistentObjectActionRequest = {
    /**
     * The persistent object on which the action is executed.
     */
    parent: PersistentObjectDto;
} & ExecuteActionRequest;

export declare type ExecuteQueryRequest = {
    /**
     * The query to search.
     */
    query: QueryDto;

    /**
     * The parent persistent object that contains the query.
     */
    parent: PersistentObjectDto;
} & RequestDto;

export declare type ExecuteQueryResponse = {
    /**
     * The result set of the executed query.
     */
    result: QueryResultDto;
} & ResponseDto;

// DTO's

export declare type ProviderParametersDto = {
    /**
     * Gets the label of the authentication provider.
     */
    label: string;

    /**
     * Gets the description of the authentication provider.
     */
    description: string;

    /**
     * Get the uri to which the user should be redirected to authenticate.
     */
    requestUri: string;

    /**
     * Gets the uri to which the user should be redirected after signing out.
     */
    signOutUri: string;

    /**
     * Gets the id of the persistent object that should be used to register the user.
     */
    registerPersistentObjectId?: string;

    /**
     * Gets the name of the user that should be used to register a new user.
     */
    registerUser?: string;

    /**
     * Indicates whether the authentication provider supports password reset.
     */
    forgotPassword?: boolean;

    /**
     * Indicates whether the authentication provider supports getting the credential type.
     */
    getCredentialType?: boolean;
};

export declare type ClientDataDto = {
    /**
     * Gets the default user name to use when no user is authenticated.
     */
    defaultUser: string;

    /**
     * Any exception that occurred during the processing of the request. Usually when the service is not available.
     */
    exception: string;

    /**
     * Gets the languages supported by the application.
     */
    languages: Record<string, LanguageDto>;

    /**
     * Gets the providers available for authentication.
     */
    providers: {
        [name: string]: {
            /**
             * Gets the parameters for the authentication provider.
             */
            parameters: ProviderParametersDto;
        };
    };

    /**
     * Indicates whether the application supports Windows Authentication.
     */
    windowsAuthentication: boolean;
};

export declare type LanguageDto = {
    /**
     * Gets the name of the language.
     */
    name: string;

    /**
     * Indicates whether the language is the default language.
     */
    isDefault: boolean;

    /**
     * Gets translated messages for the language.
     */
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
    queryLayoutMode: PersistentObjectLayoutMode;

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
    stateBehavior: PersistentObjectStateBehavior;

    /**
     * Gets the tab information for the persistent object.
     */
    tabs: Record<string, PersistentObjectTabDto>;

    /**
     * Gets the type of the persistent object.
     */
    type: string;

    /**
     * Optional data sent to the client.
     */
    tag: any;
}>;

export declare type PersistentObjectAttributeDto = {
    /*
     * Gets the actions that should be invoked directly on the attribute.
     */
    actions?: string[];

    /**
     * Gets the unique identifier for this entity.
     */
    id?: string;

    /**
     * Gets the column that should be used when displaying this attribute.
     */
    column?: number;

    /**
     * Gets the unique name of the attribute.
     */
    name: string;

    /**
     * Gets the type of the data.
     */
    type: string;
    
    /**
     * Gets the name of the group to which this attribute belongs.
     */
    group?: string;

    /**
     * Gets the name of the tab to which this attribute belongs.
     */
    tab?: string;

    /**
     * Gets the label of the attribute.
     */
    label?: string;

    /**
     * Gets the value of the attribute.
     */
    value?: string;

    /**
     * Indicates whether the value of this attribute can be changed.
     */
    isReadOnly?: boolean;

    /**
     * Indicates whether this attribute is required.
     */
    isRequired?: boolean;

    /**
     * Gets whether this attribute contains sensitive information.
     */
    isSensitive?: boolean;

    /**
     * Gets whether this attribute is a system attribute.
     */
    isSystem?: boolean;

    /**
     * Gets whether the value of this attribute has changed since it was loaded.
     */
    isValueChanged?: boolean;

    /**
     * Gets the position of this attribute when displayed.
     */
    offset?: number;

    /**
     * Gets or sets the rules for this instance.
     * A semicolon separated list of business rules that should be checked when saving this attribute.
     * @example "NotEmpty; MaxLength(40)"
     */
    rules?: string;

    /**
     * Gets the visibility of this attribute.
     */
    visibility?: PersistentObjectAttributeVisibility;

    /**
     * Gets the tooltip for this attribute. For example, to show when the user hovers over the attribute.
     */
    toolTip?: string;

    /**
     * Gets the column span that should be used when displaying this attribute.
     */
    columnSpan?: number;

    /**
     * Gets the type hints for this attribute.
     */
    typeHints?: Record<string, string>;

    /**
     * Gets the validation error for this attribute.
     */
    validationError?: string;

    /**
     * Gets whether the persistent object is refreshed when this attribute is changed.
     */
    triggersRefresh?: boolean;

    /**
     * Gets a list of predefined options to choose the attribute value from.
     */
    options?: string[];

    /**
     * Optional data sent to the client.
     */
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
     * Optional data sent to the client.
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
    /**
     * Indicates whether the column can be used to filter the query.
     */
    canFilter: boolean;

    /**
     * Indicates whether the column can be used to group the query.
     */
    canGroupBy: boolean;

    /**
     * Indicates whether the column can be used to list distinct values.
     */
    canListDistincts: boolean;

    /**
     * Indicates whether the column can be used to sort the query.
     */
    canSort: boolean;

    /**
     * Gets the unique identifier for this column.
     */
    id: string;

    /**
     * Indicates whether the column is hidden.
     */
    isHidden: boolean;

    /**
     * Indicates whether the column contains sensitive information.
     */
    isSensitive?: boolean;

    /**
     * Gets the label of the column.
     */
    label: string;

    /**
     * Gets the name of the column.
     */
    name: string;

    /**
     * Gets the offset of the column.
     */
    offset: number;

    /**
     * Gets the id of the persistent object that this columns refers to.
     */
    persistentObjectId?: string;

    /**
     * Gets the data type of the column.
     */
    type: string;

    /**
     * Optional data sent to the client.
     */
    tag?: any;

    /**
     * Gets the includes used for the data filter.
     */    
    includes: string[];

    /**
     * Gets the excludes used for the data filter.
     */
    excludes: string[];
};

export declare type QueryResultDto = {
    charts: QueryChartDto[];

    /**
     * Gets the columns of the query result.
     */
    columns: QueryColumnDto[];

    /**
     * Gets the continuation token for the next page of results.
     * This is used to load more items when scrolling down.
     */
    continuation?: string;

    /**
     * Gets the groups information for the query.
     */
    groupingInfo?: QueryGroupingInfoDto;

    /**
     * Gets the items of the query result.
     */
    items: QueryResultItemDto[];

    /**
     * Gets the notification message.
     */
    notification?: string;

    /**
     * Gets the notification duration.
     */
    notificationDuration?: number;

    /**
     * Gets the notification type.
     */
    notificationType?: NotificationType;

    /*
     * Gets the size of the pages used to execute the query.
     */
    pageSize?: number;

    /**
     * Gets the number of items that were skipped to execute the query.
     */
    skip?: number;

    /**
     * Gets the sort options used when displaying this instance.
     * A semicolon seperated list of attributes to sort on. Each attribute can be ASC (Ascending) or DESC (Descending).
     * @example "LastName ASC; FirstName ASC"
     */
    sortOptions: string;

    /**
     * Gets the total item for the query result.
     * This will include a total count for each column that has a total.
     */
    totalItem?: QueryResultItemDto;

    /**
     * Gets the total number of items that can be returned by this query or -1 if the total number is unknown.
     */
    totalItems?: number;

    /**
     * Optional data sent to the client.
     */
    tag?: any;
};


export declare type QueryResultItemDto = {
    /**
     * Gets the id of the query result item.
     */
    id: string;

    /**
     * Gets the value of the query result item.
     */
    values: QueryResultItemValueDto[];

    /**
     * Gets optional type hints for this entity.
     */
    typeHints?: Record<string, string>;

    /**
     * Optional data sent to the client.
     */
    tag?: any;
};

export declare type QueryResultItemValueDto = {
    /**
     * Gets the key that represents the name of the column.
     */
    key: string;

    /**
     * Gets the value of the represented column for this query result item.
     */
    value: string;

    /**
     * Gets the id of the entity that this value represents.
     */
    objectId?: string;

    /**
     * Gets optional type hints for this value.
     */
    typeHints?: Record<string, string>;
};

export declare type QueryGroupingInfoDto = {
    /**
     * Gets the name of the column that is used to group the query.
     */
    groupedBy: string;

    /**
     * Gets the groups of the query result.
     */
    groups?: QueryResultItemGroupDto[];
};

export declare type QueryResultItemGroupDto = {
    /**
     * Gets the name of the group.
     */
    name: string;

    /**
     * Gets the number of items in the group.
     */
    count: number;
};

export declare type QueryChartDto = {
    /**
     * Gets the label of the chart.
     */
    label: string;

    /**
     * Gets the name of the chart.
     */
    name: string;

    /**
     * Gets the type of the chart.
     */
    type: string;

    /**
     * Gets any additional options for the chart.
     */
    options: any;
};

export declare type RetryActionDto = {
    /**
     * Gets the index of the cancel option for the retry action.
     */
    cancelOption?: number;

    /**
     * Gets the index of the default option for the retry action.
     */
    defaultOption?: number;

    /**
     * Gets the message to display in the retry action dialog.
     */
    message: string;

    /**
     * Gets the options available for the retry action.
     */
    options: string[];

    /**
     * Gets a persistent object which may require additional information to be provided by the user before retrying the action.
     */
    persistentObject?: PersistentObjectDto;

    /**
     * Gets the title of the retry action dialog.
     */
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