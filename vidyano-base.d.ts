/**
 * @deprecated Use typescript `Record<string, T>` instead.
 */
declare type KeyValue<T> = {
    [key: string]: T;
};
/**
 * @deprecated Use typescript `Record<string, string>` instead.
 */
declare type KeyValueString = KeyValue<string>;
declare type KeyValuePair<T, U> = {
    key: T;
    value: U;
};

declare global {
    export interface Array<T> {
        index?: number;
        input?: string;
        distinct<T, U>(this: T[], selector?: (element: T) => T | U): U[];
        groupBy<T>(this: T[], selector: (element: T) => string): KeyValuePair<string, T[]>[];
        groupBy<T>(this: T[], selector: (element: T) => number): KeyValuePair<number, T[]>[];
        orderBy<T>(this: T[], selector: (element: T) => number | string): T[];
        orderBy<T>(this: T[], property: string): T[];
        orderByDescending<T>(this: T[], selector: (element: T) => number): T[];
        orderByDescending<T>(this: T[], property: string): T[];
        min<T>(this: T[], selector: (element: T) => number): number;
        max<T>(this: T[], selector: (element: T) => number): number;
        remove(s: T): boolean;
        removeAll(f: (t: T) => boolean, thisObject?: any): void;
        sum<T>(this: T[], selector: (element: T) => number): number;
    }
    export interface ArrayConstructor {
        range(start: number, end: number, step?: number): number[];
    }
}

declare module "bignumber.js" {
    interface BigNumber {
        format(format: string): string;
        localeFormat(format: string): string;
    }
}
declare global {
    export interface Number {
        format(format: string): string;
        localeFormat(format: string): string;
    }
}

declare global {
    export interface BooleanConstructor {
        parse(value: string): boolean;
    }
}

declare global {
    export interface Date {
        format(format: string): string;
        localeFormat(format: string, useDefault: boolean): string;
        netType(value: string): any;
        netType(): string;
        netOffset(value: string): any;
        netOffset(): string;
    }
}

declare class ExpressionParser {
    static readonly alwaysTrue: () => boolean;
    private static _cache;
    private static _operands;
    static get(expression: string): any;
    static parse(expression: string): any;
}

/**
 * Interface for subject notifier that receives notifications.
 * @template TSource - The type of the subject.
 * @template TDetail - The type of detail sent in notifications.
 */
interface ISubjectNotifier<TSource, TDetail> {
    notify?: (source: TSource, detail?: TDetail) => void;
}
/**
 * Represents a property change event.
 */
declare class PropertyChangedArgs {
    #private;
    /**
     * Creates an instance of PropertyChangedArgs.
     * @param {string} propertyName - Name of the property.
     * @param {*} newValue - New value of the property.
     * @param {*} oldValue - Old value of the property.
     */
    constructor(propertyName: string, newValue: any, oldValue: any);
    /**
     * Gets the property name.
     */
    get propertyName(): string;
    /**
     * Gets the new value.
     */
    get newValue(): any;
    /**
     * Gets the old value.
     */
    get oldValue(): any;
}
/**
 * Represents an array change event.
 */
declare class ArrayChangedArgs {
    #private;
    /**
     * Creates an instance of ArrayChangedArgs.
     * @param {string} arrayPropertyName - Name of the array property.
     * @param {number} index - Index at which the change occurred.
     * @param {any[]} [removedItems] - Items that were removed.
     * @param {number} [addedItemCount] - Number of items added.
     */
    constructor(arrayPropertyName: string, index: number, removedItems?: any[], addedItemCount?: number);
    /**
     * Gets the array property name.
     */
    get arrayPropertyName(): string;
    /**
     * Gets the index of the change.
     */
    get index(): number;
    /**
     * Gets the removed items.
     */
    get removedItems(): any[] | undefined;
    /**
     * Gets the count of added items.
     */
    get addedItemCount(): number | undefined;
}
/**
 * Interface for disposing an observer from a subject.
 * @callback ISubjectDisposer
 */
interface ISubjectDisposer {
    (): void;
}
/**
 * Represents a subject that notifies attached observers of changes.
 * @template TSource - The type of the subject.
 * @template TDetail - The type of detail sent in notifications.
 */
declare class Subject<TSource, TDetail> {
    #private;
    /**
     * Creates a new Subject instance.
     * @param {ISubjectNotifier<TSource, TDetail>} notifier - The notifier to wrap.
     */
    constructor(notifier: ISubjectNotifier<TSource, TDetail>);
    /**
     * Attaches an observer to the subject.
     * @param {ISubjectObserver<TSource, TDetail>} observer - The observer function to attach.
     * @returns {ISubjectDisposer} A function that detaches the observer.
     */
    attach(observer: ISubjectObserver<TSource, TDetail>): ISubjectDisposer;
}
/**
 * Represents an observer function for subject notifications.
 * @template TSource - The type of the subject.
 * @template TDetail - The type of detail sent in notifications.
 * @callback ISubjectObserver
 * @param {TSource} sender - The subject sending the notification.
 * @param {TDetail} detail - The detail of the notification.
 */
interface ISubjectObserver<TSource, TDetail> {
    (sender: TSource, detail: TDetail): void;
}
/**
 * Represents an observable object that notifies observers about property and array changes.
 * @template T - The type of the observable object.
 */
declare class Observable<T> {
    #private;
    readonly propertyChanged: Subject<T, PropertyChangedArgs>;
    readonly arrayChanged: Subject<T, ArrayChangedArgs>;
    /**
     * Creates a new observable instance.
     */
    constructor();
    /**
     * Notifies observers about a property change.
     * @protected
     * @param {string} propertyName - The name of the property that changed.
     * @param {*} newValue - The new value of the property.
     * @param {*} [oldValue] - The old value of the property.
     */
    protected notifyPropertyChanged(propertyName: string, newValue: any, oldValue?: any): void;
    /**
     * Notifies observers about an array change.
     * @protected
     * @param {string} arrayPropertyName - The name of the array property that changed.
     * @param {number} index - The index at which the change occurred.
     * @param {any[]} [removedItems=[]] - The items that were removed.
     * @param {number} addedCount - The number of items added.
     */
    protected notifyArrayChanged(arrayPropertyName: string, index: number, removedItems: any[], addedCount: number): void;
}
/**
 * Observer for property change events.
 * @template T - The type of the observable object.
 * @extends ISubjectObserver<T, PropertyChangedArgs>
 */
interface IPropertyChangedObserver<T> extends ISubjectObserver<T, PropertyChangedArgs> {
}

/**
 * Options for adding a task to the queue.
 * @template T The type of the result the promise will resolve to.
 */
interface IQueueAddOptions {
    /**
     * An optional function to notify about the status of the promise.
     * This can be used for logging or user notifications.
     * @param message Optional message to notify about the promise status.
     */
    notify?: (message?: any) => void;
}
/**
 * Represents a queue that processes promises sequentially,
 * with limits on concurrent pending promises and queue size.
 */
declare class Queue {
    #private;
    /**
     * Creates an instance of Queue.
     * @param maxPendingPromises - The maximum number of promises that can be pending (executing) at once. Defaults to Infinity.
     * @param maxQueuedPromises - The maximum number of promises that can be waiting in the queue. Defaults to Infinity.
     */
    constructor(maxPendingPromises?: number, maxQueuedPromises?: number);
    /**
     * Gets the number of promises currently pending (executing).
     */
    get pendingLength(): number;
    /**
     * Gets the number of promises currently in the queue (waiting to be executed).
     */
    get queueLength(): number;
    /**
     * Adds a promise generator to the queue.
     * The promise will be executed when its turn comes and concurrency limits allow.
     * @template T The type of the result the promise will resolve to.
     * @param promiseGenerator - A function that returns a Promise.
     * @param options - Optional parameters, including a `notify` callback.
     * @returns A Promise that resolves or rejects with the result of the generated promise.
     *          Rejects with an error if the queue limit is reached.
     */
    add<T>(promiseGenerator: () => Promise<T>, options?: IQueueAddOptions): Promise<T>;
}

/**
 * Callback function to handle messages sent via the service bus.
 * Use this to process messages broadcast across different parts of your app.
 * @param sender The originator of the message.
 * @param message The message content.
 * @param detail Extra data associated with the message.
 */
type ServiceBusCallback = (sender: any, message: string, detail: any) => void;
/**
 * Disposer interface for service bus subscriptions.
 * Allows you to clean up a subscription when it's no longer needed.
 */
interface ServiceBusSubscriptionDisposer extends ISubjectDisposer {
}
/**
 * The service bus is a central hub that enables decoupled communication across your application.
 * It lets different components send and subscribe to messages without tight coupling.
 */
interface IServiceBus {
    /**
     * Sends a message on the service bus.
     * If the message contains a colon, the part before it defines the topic.
     * @param message The message text or topic:message string.
     * @param detail Optional extra data to accompany the message.
     */
    send(message: string, detail?: any): void;
    /**
     * Sends a message from a specified sender on the service bus.
     * If the message contains a colon, the part before it defines the topic.
     * @param sender The sender of the message.
     * @param message The message text or topic:message string.
     * @param detail Optional extra data to accompany the message.
     */
    send(sender: any, message: string, detail?: any): void;
    /**
     * Subscribes to a message on the service bus.
     * You can subscribe to all messages in a topic using the "topic:*" syntax.
     * Optionally, the callback can be invoked immediately with the last message sent on that topic.
     * @param message The message to listen for, possibly with a topic prefix.
     * @param callback Function invoked when a matching message is sent.
     * @param receiveLast If true, immediately receive the last sent message on that topic if available.
     * @returns A disposer to cancel the subscription.
     */
    subscribe(message: string, callback: ServiceBusCallback, receiveLast?: boolean): ServiceBusSubscriptionDisposer;
}
declare const ServiceBus: IServiceBus;

declare global {
    export interface String {
        asDataUri(): string;
        contains(str: string): boolean;
        endsWith(suffix: string): boolean;
        insert(str: string, index: number): string;
        padLeft(width: number, str?: string): string;
        padRight(width: number, str?: string): string;
        splitWithTail(separator: string | RegExp, limit?: number): string[];
        toKebabCase(): string;
        trimEnd(char: string): string;
        trimStart(char: string): string;
    }
    export interface StringConstructor {
        isNullOrEmpty(str: string): boolean;
        isNullOrWhiteSpace(str: string): boolean;
        format(format: string, ...args: any[]): string;
        fromChar(ch: string, count: number): string;
    }
}

declare function extend(target: any, ...sources: any[]): any;

declare function noop(): void;

declare function sleep(ms: number): Promise<void>;

declare type NotificationType$1 = "" | "OK" | "Notice" | "Warning" | "Error";
declare type SortDirection$1 = "" | "ASC" | "DESC";
declare type Request$1 = {
    userName?: string;
    authToken?: string;
    clientVersion?: string;
    environment: "Web" | "Web,ServiceWorker";
    environmentVersion: string;
};
declare type Response$1 = {
    authToken?: string;
    exception?: string;
};
declare type GetApplicationRequest = {
    password?: string;
} & Request$1;
declare type GetQueryRequest = {
    id: string;
} & Request$1;
declare type GetQueryResponse = {
    query: Query$1;
} & Response$1;
declare type GetPersistentObjectRequest = {
    persistentObjectTypeId: string;
    objectId?: string;
    isNew?: boolean;
    parent?: PersistentObject$1;
} & Request$1;
declare type GetPersistentObjectResponse = {
    result: PersistentObject$1;
} & Response$1;
declare type ExecuteActionParameters = {
    [key: string]: string;
};
declare type ExecuteActionRequest = {
    action: string;
    parameters: ExecuteActionParameters;
    parent: PersistentObject$1;
} & Request$1;
declare type ExecuteActionRefreshParameters = {
    RefreshedPersistentObjectAttributeId: string;
} & ExecuteActionParameters;
declare type ExecuteQueryActionRequest = {
    parent: PersistentObject$1;
    query: Query$1;
    selectedItems: QueryResultItem$1[];
} & ExecuteActionRequest;
declare type ExecuteQueryFilterActionRequest = {
    query: Query$1;
} & ExecuteActionRequest;
declare type ExecutePersistentObjectActionRequest = {
    parent: PersistentObject$1;
} & ExecuteActionRequest;
declare type ExecuteActionResponse = {
    result: PersistentObject$1;
} & Response$1;
declare type ExecuteQueryRequest = {
    query: Query$1;
    parent: PersistentObject$1;
} & Request$1;
declare type ExecuteQueryResponse = {
    result: QueryResult;
} & Response$1;
declare type ProviderParameters = {
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
declare type ClientData = {
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
declare type Languages = {
    [culture: string]: Language$1;
};
declare type Language$1 = {
    name: string;
    isDefault: boolean;
    messages: Record<string, string>;
};
declare type ApplicationResponse = {
    application: PersistentObject$1;
    userCultureInfo: string;
    userLanguage: string;
    userName: string;
    hasSensitive: boolean;
} & Response$1;
declare type PersistentObjectStateBehavior = "None" | "OpenInEdit" | "StayInEdit" | "AsDialog";
declare type PersistentObject$1 = Partial<{
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
    attributes: PersistentObjectAttribute$1[];
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
    newOptions: string;
    /**
     * Gets the notification message.
     */
    notification: string;
    /**
     * Gets the notification type.
     */
    notificationType: NotificationType$1;
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
    parent: PersistentObject$1;
    /**
     * Gets the persistent object detail queries.
     */
    queries: Query$1[];
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
    stateBehavior: PersistentObjectStateBehavior;
    /**
     * Gets the tab information for the persistent object.
     */
    tabs: Record<string, PersistentObjectTab$1>;
    /**
     * Gets the type of the persistent object.
     */
    type: string;
    /**
     * Optional data that can be sent to the client.
     */
    tag: any;
}>;
declare type PersistentObjectAttributeVisibility = "Always" | "Read" | "New" | "Never" | "Query" | "Read, Query" | "Read, New" | "Query, New";
declare type PersistentObjectAttribute$1 = {
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
    visibility?: PersistentObjectAttributeVisibility;
    toolTip?: string;
    columnSpan?: number;
    typeHints?: Record<string, string>;
    validationError?: string;
    triggersRefresh?: boolean;
    options?: string[];
    tag?: any;
};
declare type PersistentObjectAttributeWithReference$1 = {
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
    lookup: Query$1;
    /**
     * Gets the object id of the reference.
     */
    objectId: string;
    /**
     * Indicates whether the end user can use a fixed list of possible references to choose from.
     */
    selectInPlace: boolean;
} & PersistentObjectAttribute$1;
declare type PersistentObjectAttributeAsDetail$1 = {
    /**
     * Gets the query used to lookup the related entities.
     */
    details: Query$1;
    /**
     * Gets the optional name of a lookup attribute that can be used to select a reference when adding a new detail.
     */
    lookupAttribute: string;
    /**
     * Gets the detail persistent objects for this instance.
     */
    objects: PersistentObject$1[];
} & PersistentObjectAttribute$1;
declare type PersistentObjectTab$1 = Partial<{
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
declare type Query$1 = Partial<{
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
    columns: QueryColumn$1[];
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
    filters: PersistentObject$1;
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
    notificationType: NotificationType$1;
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
    persistentObject: PersistentObject$1;
    /**
     * Gets the query result.
     */
    result: QueryResult;
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
declare type QueryColumn$1 = {
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
declare type QueryResult = {
    charts: QueryChart$1[];
    columns: QueryColumn$1[];
    continuation?: string;
    groupedBy?: string;
    groupingInfo?: QueryGroupingInfo;
    items: QueryResultItem$1[];
    notification?: string;
    notificationDuration?: number;
    notificationType?: NotificationType$1;
    pageSize?: number;
    skip?: number;
    sortOptions: string;
    totalItem?: QueryResultItem$1;
    totalItems?: number;
    tag?: any;
};
declare type QueryResultItem$1 = {
    id: string;
    values: QueryResultItemValue$1[];
    typeHints?: Record<string, string>;
    tag?: any;
};
declare type QueryResultItemValue$1 = {
    key: string;
    value: string;
    objectId?: string;
    typeHints?: Record<string, string>;
};
declare type QueryGroupingInfo = {
    groupedBy: string;
    groups?: QueryResultItemGroup$1[];
};
declare type QueryResultItemGroup$1 = {
    name: string;
    count: number;
};
declare type QueryChart$1 = {
    label: string;
    name: string;
    type: string;
    options: any;
};
declare type RetryAction = {
    cancelOption?: number;
    defaultOption?: number;
    message: string;
    options: string[];
    persistentObject?: PersistentObject$1;
    title: string;
};
declare type ProfilerRequest = {
    method: string;
    profiler: Profiler;
    request: any;
    response: any;
    transport: number;
    when: Date;
};
declare type Profiler = {
    elapsedMilliseconds: number;
    entries: ProfilerEntry[];
    exceptions: {
        id: string;
        message: string;
    }[];
    sql: ProfilerSql[];
    taskId: number;
};
declare type ProfilerEntry = {
    arguments: any[];
    elapsedMilliseconds: number;
    entries: ProfilerEntry[];
    exception: string;
    hasNPlusOne?: boolean;
    methodName: string;
    sql: string[];
    started: number;
};
declare type ProfilerSql = {
    commandId: string;
    commandText: string;
    elapsedMilliseconds: number;
    parameters: ProfilerSqlParameter[];
    recordsAffected: number;
    taskId: number;
    type: string;
};
declare type ProfilerSqlParameter = {
    name: string;
    type: string;
    value: string;
};

type service_ApplicationResponse = ApplicationResponse;
type service_ClientData = ClientData;
type service_ExecuteActionParameters = ExecuteActionParameters;
type service_ExecuteActionRefreshParameters = ExecuteActionRefreshParameters;
type service_ExecuteActionRequest = ExecuteActionRequest;
type service_ExecuteActionResponse = ExecuteActionResponse;
type service_ExecutePersistentObjectActionRequest = ExecutePersistentObjectActionRequest;
type service_ExecuteQueryActionRequest = ExecuteQueryActionRequest;
type service_ExecuteQueryFilterActionRequest = ExecuteQueryFilterActionRequest;
type service_ExecuteQueryRequest = ExecuteQueryRequest;
type service_ExecuteQueryResponse = ExecuteQueryResponse;
type service_GetApplicationRequest = GetApplicationRequest;
type service_GetPersistentObjectRequest = GetPersistentObjectRequest;
type service_GetPersistentObjectResponse = GetPersistentObjectResponse;
type service_GetQueryRequest = GetQueryRequest;
type service_GetQueryResponse = GetQueryResponse;
type service_Languages = Languages;
type service_PersistentObjectAttributeVisibility = PersistentObjectAttributeVisibility;
type service_PersistentObjectStateBehavior = PersistentObjectStateBehavior;
type service_Profiler = Profiler;
type service_ProfilerEntry = ProfilerEntry;
type service_ProfilerRequest = ProfilerRequest;
type service_ProfilerSql = ProfilerSql;
type service_ProfilerSqlParameter = ProfilerSqlParameter;
type service_ProviderParameters = ProviderParameters;
type service_QueryGroupingInfo = QueryGroupingInfo;
type service_QueryResult = QueryResult;
type service_RetryAction = RetryAction;
declare namespace service {
  export type { service_ApplicationResponse as ApplicationResponse, service_ClientData as ClientData, service_ExecuteActionParameters as ExecuteActionParameters, service_ExecuteActionRefreshParameters as ExecuteActionRefreshParameters, service_ExecuteActionRequest as ExecuteActionRequest, service_ExecuteActionResponse as ExecuteActionResponse, service_ExecutePersistentObjectActionRequest as ExecutePersistentObjectActionRequest, service_ExecuteQueryActionRequest as ExecuteQueryActionRequest, service_ExecuteQueryFilterActionRequest as ExecuteQueryFilterActionRequest, service_ExecuteQueryRequest as ExecuteQueryRequest, service_ExecuteQueryResponse as ExecuteQueryResponse, service_GetApplicationRequest as GetApplicationRequest, service_GetPersistentObjectRequest as GetPersistentObjectRequest, service_GetPersistentObjectResponse as GetPersistentObjectResponse, service_GetQueryRequest as GetQueryRequest, service_GetQueryResponse as GetQueryResponse, Language$1 as Language, service_Languages as Languages, NotificationType$1 as NotificationType, PersistentObject$1 as PersistentObject, PersistentObjectAttribute$1 as PersistentObjectAttribute, PersistentObjectAttributeAsDetail$1 as PersistentObjectAttributeAsDetail, service_PersistentObjectAttributeVisibility as PersistentObjectAttributeVisibility, PersistentObjectAttributeWithReference$1 as PersistentObjectAttributeWithReference, service_PersistentObjectStateBehavior as PersistentObjectStateBehavior, PersistentObjectTab$1 as PersistentObjectTab, service_Profiler as Profiler, service_ProfilerEntry as ProfilerEntry, service_ProfilerRequest as ProfilerRequest, service_ProfilerSql as ProfilerSql, service_ProfilerSqlParameter as ProfilerSqlParameter, service_ProviderParameters as ProviderParameters, Query$1 as Query, QueryChart$1 as QueryChart, QueryColumn$1 as QueryColumn, service_QueryGroupingInfo as QueryGroupingInfo, service_QueryResult as QueryResult, QueryResultItem$1 as QueryResultItem, QueryResultItemGroup$1 as QueryResultItemGroup, QueryResultItemValue$1 as QueryResultItemValue, Request$1 as Request, Response$1 as Response, service_RetryAction as RetryAction, SortDirection$1 as SortDirection };
}

declare function nameof<TObject>(key: keyof TObject): string;
/**
 * Represents a base class for objects that are used by the backend service.
 * This class provides common functionality for service objects, such as
 * copying properties to another object. It extends the Observable class
 * to support reactive programming patterns.
 */
declare abstract class ServiceObject extends Observable<ServiceObject> {
    #private;
    constructor(service: Service);
    /**
     * Gets the associated service.
     */
    get service(): Service;
    /**
     * Copy properties from a dictionary of values to an object.
     * @param values A dictionary of values to copy.
     * @param includeNullValues Include null values in the result.
     * @param result The object to copy the properties to.
     * @returns The object with the properties copied.
     */
    protected _copyPropertiesFromValues(values: {
        [key: string]: any;
    }, includeNullValues?: boolean, result?: any): any;
}

/**
 * Represents a single value in a query result item.
 */
declare class QueryResultItemValue extends ServiceObject {
    #private;
    /**
     * Initializes a new instance of the QueryResultItemValue class.
     *
     * @param service The service instance to which this value belongs.
     * @param item The parent QueryResultItem.
     * @param value The raw value object from the service.
     */
    constructor(service: Service, item: QueryResultItem, value: any);
    /**
     * Gets the parent QueryResultItem.
     */
    get item(): QueryResultItem;
    /**
     * Gets the column associated with this value.
     */
    get column(): QueryColumn;
    /**
     * Gets the key (column name) for this value.
     */
    get key(): string;
    /**
     * Gets the raw string value as received from the service.
     */
    get value(): string;
    /**
     * Gets the type hints for this value.
     */
    get typeHints(): any;
    /**
     * Gets the persistent object id associated with this value, if any.
     */
    get persistentObjectId(): string;
    /**
     * Gets the object id associated with this value, if any.
     */
    get objectId(): string;
    /**
     * Gets the type hint for a given name, with an optional default value.
     * @param name The name of the type hint to retrieve.
     * @param defaultValue The default value to return if the type hint is not found.
     * @param typeHints Optional type hints object to use instead of the instance's typeHints.
     * @returns The type hint value or the default value if not found.
     */
    getTypeHint(name: string, defaultValue?: string, typeHints?: any): string;
    /**
     * Gets the parsed value for this item, using the column's data type.
     * @returns The parsed value.
     */
    getValue(): any;
}

/**
 * Represents the distinct values for a query column.
 */
interface IQueryColumnDistincts {
    matching: string[];
    remaining: string[];
    isDirty: boolean;
    hasMore: boolean;
}
type SortDirection = SortDirection$1;
/**
 * Represents a column in a query, including metadata and filter/sort state.
 */
declare class QueryColumn extends ServiceObject {
    #private;
    query: Query;
    offset: number;
    isPinned: boolean;
    isHidden: boolean;
    width: string;
    typeHints: any;
    /**
     * Initializes a new instance of the QueryColumn class.
     * @param service The service instance.
     * @param col The column DTO or QueryColumn to copy from.
     * @param query The parent query.
     */
    constructor(service: Service, col: QueryColumn$1 | any, query: Query);
    /** Gets the column id. */
    get id(): string;
    /** Gets the column name. */
    get name(): string;
    /** Gets the column type. */
    get type(): string;
    /** Gets the column label. */
    get label(): string;
    /** Gets whether the column can be filtered. */
    get canFilter(): boolean;
    /** Gets whether the column can be sorted. */
    get canSort(): boolean;
    /** Gets whether the column can be grouped by. */
    get canGroupBy(): boolean;
    /** Gets whether the column can list distinct values. */
    get canListDistincts(): boolean;
    /** Gets the display attribute for the column. */
    get displayAttribute(): string;
    /** Gets whether the column is sensitive. */
    get isSensitive(): boolean;
    /** Gets whether the column is currently sorted. */
    get isSorting(): boolean;
    /** Gets the current sort direction. */
    get sortDirection(): SortDirection;
    /** Gets or sets the selected distinct values for the column. */
    get selectedDistincts(): string[];
    set selectedDistincts(selectedDistincts: string[]);
    /** Gets or sets whether the selected distincts are inversed (excludes instead of includes). */
    get selectedDistinctsInversed(): boolean;
    set selectedDistinctsInversed(selectedDistinctsInversed: boolean);
    /** Gets or sets the distinct values for the column. */
    get distincts(): IQueryColumnDistincts;
    set distincts(distincts: IQueryColumnDistincts);
    /** Gets the total value for the column. */
    get total(): QueryResultItemValue;
    /** Gets the tag associated with the column. */
    get tag(): any;
    /**
     * Gets the type hint for a given name, with an optional default value.
     * @param name The name of the type hint to retrieve.
     * @param defaultValue The default value to return if the type hint is not found.
     * @param typeHints Optional type hints object to use instead of the instance's typeHints.
     * @param ignoreCasing Optional flag to ignore casing.
     * @returns The type hint value or the default value if not found.
     */
    getTypeHint(name: string, defaultValue?: string, typeHints?: any, ignoreCasing?: boolean): string;
    /**
     * Refreshes the distinct values for the column, optionally with a search string.
     * @param search Optional search string to filter distincts.
     * @returns A promise resolving to the distincts.
     */
    refreshDistincts(search?: string): Promise<IQueryColumnDistincts>;
    /**
     * Sorts the query by this column.
     * @param direction The sort direction.
     * @param multiSort Whether to use multi-sort.
     * @returns A promise resolving to the query result items.
     */
    sort(direction: SortDirection, multiSort?: boolean): Promise<QueryResultItem[]>;
}

/**
 * Represents a service object that manages actions and notifications.
 */
declare class ServiceObjectWithActions extends ServiceObject {
    #private;
    /**
     * An array of actions associated with the service object.
     * Indexed both as an array and as a dictionary by action name.
     */
    actions: Array<Action> & Record<string, Action>;
    /**
     * Initializes a new instance of the ServiceObjectWithActions class.
     * @param service - The associated service.
     * @param actionNames - Names of actions to initialize.
     * @param actionLabels - Optional labels for actions.
     */
    constructor(service: Service, actionNames?: string[], actionLabels?: {
        [key: string]: string;
    });
    /**
     * Gets a value indicating whether the service object is busy.
     */
    get isBusy(): boolean;
    /**
     * Gets the current notification message.
     */
    get notification(): string;
    /**
     * Gets the current notification type.
     */
    get notificationType(): NotificationType;
    /**
     * Gets the current notification duration.
     */
    get notificationDuration(): number;
    /**
     * Retrieves an action by its name.
     * @param name - The name of the action.
     * @returns The requested Action.
     */
    getAction(name: string): Action;
    /**
     * Sets the notification for the service object.
     * Overload: Accepts a string message.
     */
    setNotification(notification?: string, type?: NotificationType, duration?: number, skipShowNotification?: boolean): void;
    /**
     * Sets the notification for the service object.
     * Overload: Accepts an Error object.
     */
    setNotification(notification?: Error, type?: NotificationType, duration?: number, skipShowNotification?: boolean): void;
    /**
     * Queues a work function to be executed asynchronously.
     * @param work - The asynchronous work function.
     * @param blockActions - If true, actions are blocked during execution.
     * @returns A promise that resolves with the result of the work.
     */
    queueWork<T>(work: () => Promise<T>, blockActions?: boolean): Promise<T>;
    /**
     * Initializes actions based on the provided action names and labels.
     */
    protected _initializeActions(): void;
}

/**
 * Represents a group of attributes in a persistent object.
 */
declare class PersistentObjectAttributeGroup extends Observable<PersistentObjectAttributeGroup> {
    #private;
    index: number;
    /**
     * Creates a new instance of PersistentObjectAttributeGroup.
     * @param service The service instance.
     * @param key The key for the group.
     * @param attributes The attributes in the group.
     * @param parent The parent persistent object.
     */
    constructor(service: Service, key: string, attributes: PersistentObjectAttribute[], parent: PersistentObject);
    /**
     * Gets the service.
     */
    get service(): Service;
    /**
     * Gets the parent.
     */
    get parent(): PersistentObject;
    /**
     * Gets or sets the attributes.
     */
    get attributes(): PersistentObjectAttribute[];
    set attributes(attributes: PersistentObjectAttribute[]);
    /**
     * Gets the key.
     */
    get key(): string;
    /**
     * Gets the label.
     */
    get label(): string;
}

/**
 * Represents a persistent object tab.
 */
declare abstract class PersistentObjectTab extends Observable<PersistentObjectTab> {
    #private;
    tabGroupIndex: number;
    /**
     * Creates a new persistent object tab.
     * @param service The service instance.
     * @param name The name for the tab.
     * @param label The label for the tab.
     * @param target The target for the tab.
     * @param parent The parent persistent object for the tab.
     * @param isVisible Whether the tab is visible.
     */
    constructor(service: Service, name: string, label: string, target: ServiceObjectWithActions, parent?: PersistentObject, isVisible?: boolean);
    /**
     * Gets the service.
     */
    get service(): Service;
    /**
     * Gets the name.
     */
    get name(): string;
    /**
     * Gets the label.
     */
    get label(): string;
    /**
     * Gets the target.
     */
    get target(): ServiceObjectWithActions;
    /**
     * Gets the parent.
     */
    get parent(): PersistentObject | undefined;
    /**
     * Gets or sets the visibility.
     */
    get isVisible(): boolean;
    set isVisible(val: boolean);
}
/**
 * Represents a persistent object attribute tab.
 */
declare class PersistentObjectAttributeTab extends PersistentObjectTab {
    #private;
    /**
     * Creates a new persistent object attribute tab.
     * @param service The service instance.
     * @param groups The attribute groups for the tab.
     * @param key The key for the tab.
     * @param id The id for the tab.
     * @param name The name for the tab.
     * @param layout The layout for the tab.
     * @param po The persistent object for the tab.
     * @param columnCount The amount of columns for the tab.
     * @param isVisible Whether the tab is visible.
     */
    constructor(service: Service, groups: PersistentObjectAttributeGroup[], key: string, id: string, name: string, layout: any, po: PersistentObject, columnCount: number, isVisible: boolean);
    /**
     * Gets or sets the visibility.
     */
    get isVisible(): boolean;
    set isVisible(val: boolean);
    /**
     * Gets the layout.
     */
    get layout(): any;
    /**
     * Gets the attributes.
     */
    get attributes(): PersistentObjectAttribute[];
    /**
     * Gets or sets the attribute groups.
     */
    get groups(): PersistentObjectAttributeGroup[];
    set groups(groups: PersistentObjectAttributeGroup[]);
    /**
     * Gets the key.
     */
    get key(): string;
    /**
     * Gets the id.
     */
    get id(): string;
    /**
     * Gets or sets the column count.
     */
    get columnCount(): number;
    set columnCount(val: number);
    /**
     * Saves the layout.
     */
    saveLayout(layout: any): Promise<any>;
}
/**
 * Represents a persistent object query tab.
 */
declare class PersistentObjectQueryTab extends PersistentObjectTab {
    #private;
    /**
     * Creates a new persistent object query tab.
     * @param service The service instance.
     * @param query The query for the tab.
     */
    constructor(service: Service, query: Query);
    /**
     * Gets the query.
     */
    get query(): Query;
    /**
     * Gets the visibility.
     */
    get isVisible(): boolean;
}

type PersistentObjectAttributeOption = KeyValuePair<string, string>;
/**
 * Represents an attribute of a persistent object.
 */
declare class PersistentObjectAttribute extends ServiceObject {
    #private;
    protected _shouldRefresh: boolean;
    /**
     * Initializes a new instance of the PersistentObjectAttribute class.
     *
     * @param service - The service instance providing backend functionality.
     * @param attr - The attribute data from the service.
     * @param parent - The parent persistent object that owns this attribute.
     */
    constructor(service: Service, attr: PersistentObjectAttribute$1, parent: PersistentObject);
    /**
     * Gets the unique identifier.
     */
    get id(): string;
    /**
     * Gets the name.
     */
    get name(): string;
    /**
     * Gets the data type.
     */
    get type(): string;
    /**
     * Gets or sets the label.
     */
    get label(): string;
    set label(label: string);
    /**
     * Gets the group key.
     */
    get groupKey(): string;
    /**
     * Gets or sets the group.
     */
    get group(): PersistentObjectAttributeGroup;
    set group(group: PersistentObjectAttributeGroup);
    /**
     * Gets the column number.
     */
    get column(): number;
    /**
     * Gets the column span.
     */
    get columnSpan(): number;
    /**
     * Gets the offset.
     */
    get offset(): number;
    /**
     * Gets the parent persistent object.
     */
    get parent(): PersistentObject;
    /**
     * Gets the tab key.
     */
    get tabKey(): string;
    /**
     * Gets or sets the tab.
     */
    get tab(): PersistentObjectAttributeTab;
    set tab(tab: PersistentObjectAttributeTab);
    /**
     * Gets whether the attribute is system-defined.
     */
    get isSystem(): boolean;
    /**
     * Gets or sets the visibility.
     */
    get visibility(): PersistentObjectAttributeVisibility;
    set visibility(visibility: PersistentObjectAttributeVisibility);
    /**
     * Gets the computed visibility status.
     */
    get isVisible(): boolean;
    /**
     * Gets or sets the options for the attribute.
     */
    get options(): string[] | PersistentObjectAttributeOption[];
    set options(options: string[]);
    /**
     * Gets or sets the validation error.
     */
    get validationError(): string;
    set validationError(error: string);
    /**
     * Gets the validation rules.
     */
    get rules(): string;
    /**
     * Gets or sets if the attribute value is required.
     */
    get isRequired(): boolean;
    /**
     * Gets the read-only status.
     */
    get isReadOnly(): boolean;
    /**
     * Gets the formatted display value.
     */
    get displayValue(): string;
    /**
     * Gets the flag indicating if a refresh is needed.
     */
    get shouldRefresh(): boolean;
    /**
     * Gets the tool tip.
     */
    get toolTip(): string;
    /**
     * Gets the flag indicating if changing the attribute's value triggers a refresh.
     */
    get triggersRefresh(): boolean;
    /**
     * Gets or sets the value.
     */
    get value(): any;
    set value(val: any);
    /**
     * Sets the value and handles necessary updates.
     *
     * @param val The new value.
     * @param allowRefresh Optional flag to allow refresh.
     * @returns A promise resolving to the updated value.
     */
    setValue(val: any, allowRefresh?: boolean): Promise<any>;
    /**
     * Gets or sets the flag indicating if the value has changed.
     */
    get isValueChanged(): boolean;
    set isValueChanged(isValueChanged: boolean);
    /**
     * Gets the sensitivity flag.
     */
    get isSensitive(): boolean;
    /**
     * Gets the input element associated with the attribute.
     */
    get input(): HTMLInputElement;
    /**
     * Gets the actions available for the attribute.
     */
    get actions(): Array<Action> & Record<string, Action>;
    /**
     * Gets the associated tag.
     */
    get tag(): any;
    /**
     * Gets the data type hints
     */
    get typeHints(): Record<string, string>;
    /**
     * Retrieves a type hint value.
     *
     * @param name The name of the type hint.
     * @param defaultValue The default value if the hint is not present.
     * @param typeHints Optional type hints to merge.
     * @param ignoreCasing Whether to ignore casing for the name.
     * @returns The type hint.
     */
    getTypeHint(name: string, defaultValue?: string, typeHints?: any, ignoreCasing?: boolean): string;
    /**
     * Triggers a refresh for the attribute.
     *
     * @param immediate Optional flag to perform immediate refresh.
     * @returns A promise that resolves when the refresh is complete.
     */
    triggerRefresh(immediate?: boolean): Promise<any>;
    /**
     * Converts the attribute to a service object representation.
     *
     * @param inheritedPropertyValues - Optional inherited property values to incorporate.
     * @returns The service object representation ready for transmission.
     */
    protected _toServiceObject(inheritedPropertyValues?: Record<string, any>): any;
    /**
     * Refreshes the attribute from the service result.
     *
     * @param resultAttr - The result attribute data from the service.
     * @param resultWins - Flag indicating if the result value takes precedence.
     * @returns A flag indicating if visibility has changed.
     */
    protected _refreshFromResult(resultAttr: PersistentObjectAttribute$1, resultWins: boolean): boolean;
}

/**
 * Represents a persistent object attribute that relates to a list of objects.
 */
declare class PersistentObjectAttributeAsDetail extends PersistentObjectAttribute {
    #private;
    /**
     * Initializes a new instance of PersistentObjectAttributeAsDetail.
     * @param service The service instance.
     * @param attr The attribute data.
     * @param parent The parent persistent object.
     */
    constructor(service: Service, attr: PersistentObjectAttributeAsDetail$1, parent: PersistentObject);
    /**
     * Handles change events and triggers refresh if allowed.
     * @param allowRefresh Indicates if refresh is allowed.
     */
    onChanged(allowRefresh: boolean): Promise<any>;
    /**
     * Gets the detail query.
     */
    get details(): Query;
    /**
     * Gets the lookup attribute.
     */
    get lookupAttribute(): string;
    /**
     * Gets the detail objects.
     */
    get objects(): PersistentObject[];
    /**
     * Creates a new detail object.
     * @returns A promise that resolves to the new detail object.
     */
    newObject(): Promise<PersistentObject>;
    /**
     * @inheritdoc
     */
    protected _refreshFromResult(resultAttr: PersistentObjectAttributeAsDetail$1, resultWins: boolean): boolean;
    /**
     * @inheritdoc
     */
    protected _toServiceObject(): any;
}

/**
 * Manages a collection of query filters for a query.
 */
declare class QueryFilters extends Observable<QueryFilters> {
    #private;
    /**
     * Initializes a new instance of the QueryFilters class.
     * @param query The parent query.
     * @param filtersPO The persistent object containing filters.
     */
    constructor(query: Query, filtersPO: PersistentObject);
    /**
     * Gets the list of filters.
     */
    get filters(): QueryFilter[];
    /**
     * Gets the details attribute as a PersistentObjectAttributeAsDetail.
     */
    get detailsAttribute(): PersistentObjectAttributeAsDetail;
    /**
     * Gets or sets the current filter.
     */
    get currentFilter(): QueryFilter;
    set currentFilter(filter: QueryFilter);
    /**
     * Clones the filters for a target query.
     * @param targetQuery The target query.
     */
    clone(targetQuery: Query): QueryFilters;
    /**
     * Gets a filter by name.
     * @param name The filter name.
     */
    getFilter(name: string): QueryFilter;
    /**
     * Creates a new filter.
     */
    createNew(): Promise<QueryFilter>;
    /**
     * Saves a filter.
     * @param filter The filter to save.
     */
    save(filter?: QueryFilter): Promise<boolean>;
    /**
     * Deletes a filter by name or instance.
     * @param name The filter name or instance.
     */
    delete(name: string | QueryFilter): Promise<any>;
}
/**
 * Represents a single query filter.
 */
declare class QueryFilter extends Observable<QueryFilter> {
    #private;
    /**
     * Initializes a new instance of the QueryFilter class.
     * @param persistentObject The persistent object for this filter.
     */
    constructor(persistentObject: PersistentObject);
    /**
     * Gets or sets the persistent object backing this filter.
     */
    get persistentObject(): PersistentObject;
    set persistentObject(po: PersistentObject);
    /**
     * Gets the name of the filter.
     */
    get name(): string;
    /**
     * Gets whether the filter is locked.
     */
    get isLocked(): boolean;
    /**
     * Gets whether the filter is the default filter.
     */
    get isDefault(): boolean;
}

/**
 * Represents a chart associated with a query.
 */
declare class QueryChart extends Observable<QueryChart> {
    #private;
    /**
     * Initializes a new instance of the QueryChart class.
     * @param query The parent query.
     * @param label The chart label.
     * @param name The chart name.
     * @param options The chart options.
     * @param type The chart type.
     */
    constructor(query: Query, label: string, name: string, options: any, type: string);
    /**
     * Gets the parent query.
     */
    get query(): Query;
    /**
     * Gets the chart label.
     */
    get label(): string;
    /**
     * Gets the chart name.
     */
    get name(): string;
    /**
     * Gets the chart options.
     */
    get options(): any;
    /**
     * Gets the chart type.
     */
    get type(): string;
    /**
     * Executes the chart action with the given parameters.
     * @param parameters The parameters for the chart action.
     * @returns The parsed chart data.
     */
    execute(parameters?: any): Promise<any>;
}

/**
 * Extends the Dto.QueryGroupingInfo with an optional groups property.
 */
interface IQueryGroupingInfo extends QueryGroupingInfo {
    groups?: QueryResultItemGroup[];
}
/**
 * Represents a group of query result items.
 */
declare class QueryResultItemGroup extends Observable<QueryResultItemGroup> implements QueryResultItemGroup$1 {
    #private;
    readonly query: Query;
    /**
     * Initializes a new instance of the QueryResultItemGroup class.
     * @param query The parent query.
     * @param group The group DTO.
     * @param start The start index.
     * @param end The end index.
     * @param notifier Callback to notify changes.
     */
    constructor(query: Query, group: QueryResultItemGroup$1, start: number, end: number, notifier: () => void);
    /**
     * Gets the group name.
     */
    get name(): string;
    /**
     * Gets the number of items in the group.
     */
    get count(): number;
    /**
     * Gets the start index of the group.
     */
    get start(): number;
    /**
     * Gets the end index of the group.
     */
    get end(): number;
    /**
     * Gets the items in the group.
     */
    get items(): QueryResultItem[];
    /**
     * Gets or sets whether the group is collapsed.
     */
    get isCollapsed(): boolean;
    set isCollapsed(isCollapsed: boolean);
}

/**
 * Represents a persistent object attribute that contains a reference to another persistent object.
 */
declare class PersistentObjectAttributeWithReference extends PersistentObjectAttribute {
    #private;
    /**
     * Initializes a new instance of the PersistentObjectAttributeWithReference class.
     * @param service - The service instance.
     * @param attr - The attribute data transfer object.
     * @param parent - The parent persistent object.
     */
    constructor(service: Service, attr: PersistentObjectAttributeWithReference$1, parent: PersistentObject);
    /**
     * Gets a value indicating whether a new reference can be added.
     */
    get canAddNewReference(): boolean;
    /**
     * Gets the display attribute of the reference.
     */
    get displayAttribute(): string;
    /**
     * Gets the lookup query for this attribute.
     */
    get lookup(): Query;
    /**
     * Gets the object id of the reference.
     */
    get objectId(): string;
    /**
     * Gets a value indicating whether the reference should be selected in place.
     */
    get selectInPlace(): boolean;
    /**
     * Adds a new reference through the associated lookup query.
     * Opens the resulting persistent object as a dialog.
     * @returns A promise that resolves when the operation is complete.
     */
    addNewReference(): Promise<void>;
    /**
     * Changes the reference to the selected items.
     * @param selectedItems - The items to set as the new reference.
     * @returns A promise that resolves to true when the reference has been changed.
     */
    changeReference(selectedItems: QueryResultItem[] | string[]): Promise<boolean>;
    /**
     * Gets the persistent object that this attribute references.
     * @returns A promise that resolves to the referenced persistent object, or null if none exists.
     */
    getPersistentObject(): Promise<PersistentObject>;
    /**
     * Refreshes this attribute from a result attribute.
     * @param resultAttr - The result attribute to refresh from.
     * @param resultWins - Whether the result attribute takes precedence over local changes.
     * @returns True if the attribute's visibility changed.
     */
    protected _refreshFromResult(resultAttr: PersistentObjectAttributeWithReference$1, resultWins: boolean): boolean;
    /**
     * Converts this attribute to a service object.
     * @returns The service object representation of this attribute.
     */
    protected _toServiceObject(): any;
}

/**
 * Represents the grouping information for a query.
 */
interface IQuerySelectAll {
    /**
     * Gets or sets whether selecting all items is available.
     */
    isAvailable: boolean;
    /**
     * Gets or sets whether all items are selected.
     */
    allSelected: boolean;
    /**
     * Gets or sets whether the selection is inverse.
     */
    inverse: boolean;
}

/**
 * Represents the options for sorting a query.
 */
interface ISortOption {
    /**
     * Gets or sets the column to sort by.
     */
    column: QueryColumn;
    /**
     * Gets or sets the name of the column to sort by.
     */
    name: string;
    /**
     * Gets or sets the direction of the sort.
     */
    direction: SortDirection;
}
/**
 * Represents a Vidyano query and provides methods to search, group, and manipulate its result set.
 * @inheritdoc
 */
declare class Query extends ServiceObjectWithActions {
    #private;
    parent?: PersistentObject;
    /**
     * Gets or sets the page size for the query.
     */
    pageSize: number;
    /**
     * Gets or sets the offset for the query.
     */
    skip: number;
    /**
     * Gets or sets the number of items to retrieve from the query.
     */
    top: number;
    /**
     * Constructs a new Query instance.
     * @param service The service instance.
     * @param queryDto The query DTO containing the initial data.
     * @param parent The parent persistent object, if any.
     * @param asLookup Whether the query is used as a lookup.
     * @param maxSelectedItems The maximum number of items that can be selected in the query.
     */
    constructor(service: Service, queryDto: Query$1, parent?: PersistentObject, asLookup?: boolean, maxSelectedItems?: number);
    /**
     * Gets whether this query is a system query.
     */
    get isSystem(): boolean;
    /**
     * Gets whether text search is allowed.
     */
    get allowTextSearch(): boolean;
    /**
     * Gets the filters associated with this query.
     */
    get filters(): QueryFilters;
    /**
     * Gets whether the query can be filtered.
     */
    get canFilter(): boolean;
    /**
     * Gets whether there are more items available for the query.
     */
    get hasMore(): boolean;
    /**
     * Gets whether the query can be read, i.e., whether the user has read permissions on the items.
     */
    get canRead(): boolean;
    /**
     * Gets whether the query can be reordered.
     */
    get canReorder(): boolean;
    /**
     * Gets the charts associated with this query.
     */
    get charts(): QueryChart[];
    /**
     * Gets or sets the current chart for this query.
     */
    get currentChart(): QueryChart;
    set currentChart(currentChart: QueryChart);
    /**
     * Gets or sets the default chart name for this query.
     */
    get defaultChartName(): string;
    set defaultChartName(defaultChart: string);
    /**
     * Gets the grouping information for this query.
     */
    get groupingInfo(): IQueryGroupingInfo;
    /**
     * Gets the tag associated with this query.
     */
    get tag(): any;
    /**
     * Gets the date and time when the query was last updated.
     */
    get lastUpdated(): Date;
    /**
     * Gets or sets the maximum number of selected items allowed.
     */
    get maxSelectedItems(): number;
    set maxSelectedItems(maxSelectedItems: number);
    /**
     * Gets or sets the selected items.
     */
    get selectedItems(): QueryResultItem[];
    set selectedItems(items: QueryResultItem[]);
    /**
     * Gets the persistent object associated with this query.
     */
    get persistentObject(): PersistentObject;
    /**
     * Gets the columns of the query.
     */
    get columns(): QueryColumn[];
    /**
     * Gets the unique identifier for this query.
     */
    get id(): string;
    /**
     * Gets the name of the query.
     */
    get name(): string;
    /**
     * Gets whether the query should be automatically executed.
     */
    get autoQuery(): boolean;
    /**
     * Gets whether the query is hidden.
     */
    get isHidden(): boolean;
    /**
     * Gets whether the query has been searched, i.e., whether the search has been executed at least once or got the result during loading.
     */
    get hasSearched(): boolean;
    /**
     * Gets the label for the query.
     */
    get label(): string;
    /**
     * Gets the singular label for the query.
     */
    get singularLabel(): string;
    /**
     * Gets the offset for the query.
     */
    get offset(): number;
    /**
     * Gets the select all helper for the query.
     */
    get selectAll(): IQuerySelectAll;
    /**
     * Gets the owner attribute with reference for the query.
     */
    get ownerAttributeWithReference(): PersistentObjectAttributeWithReference;
    /**
     * Gets or sets whether lazy loading is disabled.
     */
    get disableLazyLoading(): boolean;
    set disableLazyLoading(value: boolean);
    /**
     * Gets or sets the text search value for the query.
     */
    get textSearch(): string;
    set textSearch(value: string);
    /**
     * Gets whether the query is used as a lookup.
     */
    get asLookup(): boolean;
    /**
     * Gets the total number of items in the query.
     */
    get totalItems(): number;
    /**
     * Gets the label with the total number of items.
     */
    get labelWithTotalItems(): string;
    /**
     * Gets or sets the sort options for the query.
     */
    get sortOptions(): ISortOption[];
    set sortOptions(options: ISortOption[]);
    /**
     * Gets the total item for the query.
     */
    get totalItem(): QueryResultItem;
    /**
     * Gets whether the query is currently filtering.
     */
    get isFiltering(): boolean;
    /**
     * Resets the filters for the query.
     * @returns A promise that resolves when the filters are reset.
     */
    resetFilters(): Promise<void>;
    /**
     * Selects a range of items in the query.
     * @param from - The starting index.
     * @param to - The ending index.
     * @returns True if the selection was updated; otherwise, false.
     */
    selectRange(from: number, to: number): boolean;
    /**
     * Groups the query by the specified column or column name.
     * @param column The column to group by.
     * @returns A promise that resolves to the grouped query result items.
     */
    group(column: QueryColumn): Promise<QueryResultItem[]>;
    /**
     * Groups the query by the specified column name.
     * @param by The name of the column to group by.
     * @returns A promise that resolves to the grouped query result items.
     */
    group(by: string): Promise<QueryResultItem[]>;
    /**
     * Reorders items in the query.
     * @param before The item before the moved item.
     * @param item The item to move.
     * @param after The item after the moved item.
     * @returns A promise that resolves to the reordered query result items.
     */
    reorder(before: QueryResultItem, item: QueryResultItem, after: QueryResultItem): Promise<QueryResultItem[]>;
    /**
     * Gets the column with the specified name.
     * @param name The name of the column.
     * @returns The query column with the specified name.
     */
    getColumn(name: string): QueryColumn;
    /**
     * Gets the items of the query.
     */
    get items(): QueryResultItem[];
    /**
     * Gets the items by their indexes.
     * @param indexes The indexes of the items to retrieve.
     * @returns A promise that resolves to the query result items.
     */
    getItemsByIndex(...indexes: number[]): Promise<QueryResultItem[]>;
    /**
     * Gets a range of items from the query.
     * @param start The starting index.
     * @param length The number of items to retrieve.
     * @param skipQueue Whether to skip the queue.
     * @returns A promise that resolves to the query result items.
     */
    getItems(start: number, length?: number, skipQueue?: boolean): Promise<QueryResultItem[]>;
    /**
     * Searches the query with optional options.
     * @param options The search options.
     * @returns A promise that resolves to the query result items.
     */
    search(options?: {
        delay?: number;
        throwExceptions?: boolean;
        keepSelection?: boolean;
    }): Promise<QueryResultItem[]>;
    /**
     * Clones the query.
     * @param asLookup Whether to clone as a lookup query.
     * @returns The cloned query.
     */
    clone(asLookup?: boolean): Query;
}

/**
 * Represents a single item in a query result.
 */
declare class QueryResultItem extends ServiceObject {
    #private;
    query: Query;
    /**
     * Initializes a new instance of the QueryResultItem class.
     *
     * @param service The service instance to which this query result item belongs.
     * @param item The raw item data from the query result.
     * @param query The query that this result item is part of.
     * @param isSelected Indicates whether this item is selected in the query result.
     */
    constructor(service: Service, item: QueryResultItem$1, query: Query, isSelected: boolean);
    /**
     * Gets the unique identifier for this query result item.
     */
    get id(): string;
    /**
     * Returns a values object containing the deserialized values for each column in the query result item.
     */
    get values(): {
        [key: string]: any;
    };
    /**
     * Gets or sets whether this query result item is selected.
     * If `ignoreSelect` is true, setting this property will have no effect.
     * If `ignoreSelect` is true, the value will always return false.
     */
    get isSelected(): boolean;
    set isSelected(isSelected: boolean);
    /**
     * Determines if the select action should be ignored based on type hints.
     * If the type hint "extraclass" contains "DISABLED" or "READONLY", selection is ignored.
     */
    get ignoreSelect(): boolean;
    /**
     * Gets the tag associated with this query result item.
     */
    get tag(): any;
    /**
     * Gets the type hints for this query result item.
     */
    get typeHints(): any;
    /**
     * Gets the value for a given column name from the query result item.
     * @param columnName The name of the column to retrieve the value for.
     * @returns The value for the specified column name, or undefined if not found.
     */
    getValue(columnName: string): any;
    /**
     * Gets the full query result item value for a given key, including metadata.
     * If the value is not found, it returns null.
     * @param columnName The name of the column to retrieve the value for.
     * @returns The full value object or null if not found.
     */
    getFullValue(columnName: string): QueryResultItemValue;
    /**
     * Gets the type hint for a given name, with an optional default value.
     * @param name The name of the type hint to retrieve.
     * @param defaultValue The default value to return if the type hint is not found.
     * @param typeHints Optional type hints object to use instead of the instance's typeHints.
     * @returns The type hint value or the default value if not found.
     */
    getTypeHint(name: string, defaultValue?: string, typeHints?: any): string;
    /**
     * Gets the persistent object associated with this query result item from the service.
     * @param throwExceptions If true, exceptions will be thrown instead of being caught and returned as null.
     * @returns A promise that resolves to the persistent object associated with this query result item.
     */
    getPersistentObject(throwExceptions?: boolean): Promise<PersistentObject>;
}

/**
 * Parameters that define an action.
 */
interface ActionDefinitionParams {
    name: string;
    displayName?: string;
    isPinned?: boolean;
    isStreaming?: boolean;
    showedOn?: string[];
    confirmation?: string;
    refreshQueryOnCompleted?: boolean;
    keepSelectionOnRefresh?: boolean;
    offset?: number;
    selectionRule?: string;
    options?: ("PersistentObject" | "Query")[];
    icon?: string;
}
/**
 * Defines an action within the system.
 * Actions are operations that can be performed on queries or persistent objects.
 */
declare class ActionDefinition {
    #private;
    /**
     * Initializes a new instance of the ActionDefinition class from parameters.
     * @param service - The associated service.
     * @param definition - The action definition parameters.
     */
    constructor(service: Service, definition: ActionDefinitionParams);
    /**
     * Initializes a new instance of the ActionDefinition class from a query result item.
     * @param service - The associated service.
     * @param item - The query result item containing action definition data.
     */
    constructor(service: Service, item: QueryResultItem);
    /**
     * Gets the name of the action.
     */
    get name(): string;
    /**
     * Gets the display name of the action.
     */
    get displayName(): string;
    /**
     * Gets whether the action is pinned.
     */
    get isPinned(): boolean;
    /**
     * Gets whether the action is streaming.
     */
    get isStreaming(): boolean;
    /**
     * Gets whether the query should be refreshed on completion.
     */
    get refreshQueryOnCompleted(): boolean;
    /**
     * Gets whether to keep selection on refresh.
     */
    get keepSelectionOnRefresh(): boolean;
    /**
     * Gets the offset value.
     */
    get offset(): number;
    /**
     * Gets the confirmation message.
     */
    get confirmation(): string;
    /**
     * Gets the available options for this action.
     */
    get options(): Array<string>;
    /**
     * Gets the selection rule function.
     */
    get selectionRule(): (count: number) => boolean;
    /**
     * Gets the contexts where this action is shown.
     */
    get showedOn(): string[];
    /**
     * Gets the group definition this action belongs to.
     */
    get groupDefinition(): ActionDefinition;
    /**
     * Gets the icon for this action.
     */
    get icon(): string;
}

/**
 * Represents a group of related actions that share common visibility and execution state.
 */
declare class ActionGroup extends ServiceObject {
    #private;
    definition: ActionDefinition;
    /**
     * Initializes a new instance of the ActionGroup class.
     * @param service - The associated service.
     * @param definition - The action definition that describes this group.
     */
    constructor(service: Service, definition: ActionDefinition);
    /**
     * Adds an action to this group.
     * @param action - The action to add to this group.
     */
    addAction(action: Action): void;
    /**
     * Removes an action from this group.
     * @param action - The action to remove from this group.
     */
    removeAction(action: Action): void;
    /**
     * Gets all actions contained in this group.
     */
    get actions(): Action[];
    /**
     * Gets the name of this action group.
     */
    get name(): string;
    /**
     * Gets the display name of this action group.
     */
    get displayName(): string;
    /**
     * Gets whether any action in this group can be executed.
     */
    get canExecute(): boolean;
    /**
     * Gets whether this action group is visible.
     */
    get isVisible(): boolean;
    /**
     * Gets whether this action group is pinned based on its first action.
     */
    get isPinned(): boolean;
    /**
     * Gets available options for this action group.
     */
    get options(): string[];
}

/**
 * Options for executing an action.
 */
interface IActionExecuteOptions {
    /**
     * The selected menu option index, if applicable.
     */
    menuOption?: number;
    /**
     * Additional parameters for the action.
     */
    parameters?: any;
    /**
     * Selected query result items on which to execute the action.
     */
    selectedItems?: QueryResultItem[];
    /**
     * If true, the resulting object should not be opened.
     */
    skipOpen?: boolean;
    /**
     * If true, skip confirmation dialogs.
     */
    noConfirmation?: boolean;
    /**
     * If true, throw exceptions instead of setting the notification.
     */
    throwExceptions?: boolean;
}
/**
 * Arguments for selected items actions.
 */
interface ISelectedItemsActionArgs {
    /**
     * The name of the action.
     */
    name: string;
    /**
     * Flag indicating if the action is visible.
     */
    isVisible: boolean;
    /**
     * Flag indicating if the action can be executed.
     */
    canExecute: boolean;
    /**
     * Available options for the action.
     */
    options: string[];
}
/**
 * Handler for action execution.
 */
type ActionExecutionHandler = (action: Action, worker: Promise<PersistentObject>, args: IActionExecuteOptions) => boolean | void | Promise<void>;
/**
 * Function to dispose an action execution handler.
 */
type ActionExecutionHandlerDispose = () => void;
/**
 * Represents an executable Vidyano or custom action.
 */
declare class Action extends ServiceObject {
    #private;
    definition: ActionDefinition;
    owner: ServiceObjectWithActions;
    /**
     * Flag indicating if this action should appear in the pinned section.
     */
    protected _isPinned: boolean;
    /**
     * Function that determines if the action can execute based on selection count.
     */
    selectionRule: (count: number) => boolean;
    /**
     * The display name of the action.
     */
    displayName: string;
    /**
     * List of action names that depend on this action.
     */
    dependentActions: string[];
    /**
     * Initializes a new instance of the Action class.
     *
     * @param service - The service that provides backend functionality.
     * @param definition - The action definition.
     * @param owner - The owner of this action.
     */
    constructor(service: Service, definition: ActionDefinition, owner: ServiceObjectWithActions);
    /**
     * Gets the parent persistent object associated with this action.
     */
    get parent(): PersistentObject;
    /**
     * Gets the query associated with this action.
     */
    get query(): Query;
    /**
     * Gets or sets the display order offset.
     */
    get offset(): number;
    set offset(value: number);
    /**
     * Gets the name of the action.
     */
    get name(): string;
    /**
     * Gets the action group this action belongs to, if any.
     */
    get group(): ActionGroup;
    /**
     * Gets or sets whether this action can be executed.
     */
    get canExecute(): boolean;
    set canExecute(val: boolean);
    /**
     * Gets or sets the block state which temporarily disables the action.
     */
    get block(): boolean;
    set block(block: boolean);
    /**
     * Gets or sets whether this action is visible.
     */
    get isVisible(): boolean;
    set isVisible(val: boolean);
    /**
     * Gets whether this action should be shown in the pinned section.
     */
    get isPinned(): boolean;
    /**
     * Gets the options available for this action.
     */
    get options(): string[];
    /**
     * Subscribes to action execution events.
     * @param handler - The handler to call when the action executes.
     * @returns A function to dispose the subscription.
     */
    subscribe(handler: ActionExecutionHandler): ActionExecutionHandlerDispose;
    /**
     * Executes this action with the provided options.
     * @param options - Options for action execution.
     * @returns A promise that resolves to the resulting persistent object, or null.
     */
    execute(options?: IActionExecuteOptions): Promise<PersistentObject>;
    /**
     * Internal execution handler for the action.
     * @param options - Options for action execution.
     * @returns A promise that resolves to the resulting persistent object, or null.
     */
    protected _onExecute(options: IActionExecuteOptions): Promise<PersistentObject>;
    /**
     * Gets parameters for the action execution.
     * @param parameters - Base parameters.
     * @param option - Option index.
     * @returns Combined parameters.
     */
    _getParameters(parameters: any, option: any): any;
    /**
     * Handles changes to the parent's editing state.
     * @param isEditing - The new editing state.
     */
    protected _onParentIsEditingChanged(isEditing: boolean): void;
    /**
     * Handles changes to the parent's dirty state.
     * @param isDirty - The new dirty state.
     */
    protected _onParentIsDirtyChanged(isDirty: boolean): void;
    /**
     * Gets an action by name for the given owner.
     * @param service - The service instance.
     * @param name - The action name.
     * @param owner - The owner of the action.
     * @returns The action instance.
     */
    static get(service: Service, name: string, owner: ServiceObjectWithActions): Action;
    /**
     * Adds actions to the owner.
     * @param service - The service instance.
     * @param owner - The owner to add actions to.
     * @param actions - The array of actions.
     * @param actionNames - Names of actions to add.
     */
    static addActions(service: Service, owner: ServiceObjectWithActions, actions: Action[], actionNames: string[]): void;
}
/**
 * Registry of action implementations.
 */
declare let Actions: {
    [name: string]: typeof Action;
};

/**
 * Defines available layout modes when displaying persistent objects.
 */
declare enum PersistentObjectLayoutMode {
    FullPage = 0,
    MasterDetail = 1
}
/**
 * Handles the state and operations for persistent objects, including editing,
 * saving, refreshing data, and managing attributes and tabs.
 */
declare class PersistentObject extends ServiceObjectWithActions {
    #private;
    /**
     * The parent persistent object, if any.
     */
    parent: PersistentObject;
    /**
     * The owner detail attribute, if this object is part of a detail attribute.
     */
    ownerDetailAttribute: PersistentObjectAttributeAsDetail;
    /**
     * The owner attribute with reference, if this object is referenced by an attribute.
     */
    ownerAttributeWithReference: any;
    /**
     * The owner persistent object, if this object belongs to another.
     */
    ownerPersistentObject: PersistentObject;
    /**
     * The owner query, if this object belongs to a query.
     */
    ownerQuery: Query;
    /**
     * Array of object IDs for bulk operations.
     */
    readonly bulkObjectIds: string[];
    /**
     * Queries that need to be refreshed.
     */
    readonly queriesToRefresh: string[];
    /**
     * The attributes of this persistent object.
     * Indexed both as an array and as a dictionary by attribute name.
     */
    readonly attributes: PersistentObjectAttribute[] & Record<string, PersistentObjectAttribute>;
    /**
     * The queries associated with this persistent object.
     * Indexed both as an array and as a dictionary by query name.
     */
    readonly queries: Query[] & Record<string, Query>;
    /**
     * Flag indicating if this is a new object.
     */
    isNew: boolean;
    /**
     * Initializes a new instance of the PersistentObject class.
     *
     * @param service - The service context providing hooks and actions.
     * @param po - The data representing the persistent object.
     */
    constructor(service: Service, po: PersistentObject$1);
    /**
     * Unique identifier of the persistent object.
     */
    get id(): string;
    /**
     * Indicates if the object is defined by the system.
     */
    get isSystem(): boolean;
    /**
     * Provides type information for the persistent object.
     */
    get type(): string;
    /**
     * Determines if the object represents a bulk edit scenario.
     */
    get isBulkEdit(): boolean;
    /**
     * Gets whether the breadcrumb data should be treated as sensitive.
     */
    get isBreadcrumbSensitive(): boolean;
    /**
     * Gets the translated label of the persistent object.
     */
    get label(): string;
    /**
     * Gets the unique identifier of the object that is being represented by this persistent object.
     */
    get objectId(): string;
    /**
     * Gets or sets a set of extra options that influence the state of the persistent object.
     */
    get stateBehavior(): string;
    set stateBehavior(value: string);
    /**
     * Lists the tabs associated with the persistent object.
     */
    get tabs(): PersistentObjectTab[];
    set tabs(tabs: PersistentObjectTab[]);
    /**
     * Gets the action that should be executed when the dialog is saved.
     */
    get dialogSaveAction(): Action;
    /**
     * Gets the way in which this persistent object is rendered together with its detail queries.
     */
    get queryLayoutMode(): PersistentObjectLayoutMode;
    /**
     * Retrieves additional tag data attached to the object.
     */
    get tag(): any;
    /**
     * Flag indicating if the object is currently in edit mode.
     */
    get isEditing(): boolean;
    /**
     * Gets whether the attributes of this persistent object can be changed.
     */
    get isReadOnly(): boolean;
    /**
     * Navigation breadcrumb representing the object's location.
     */
    get breadcrumb(): string;
    /**
     * Gets whether the url for this persistent object should be a FromAction so that refreshing the page will not be able to see different data.
     * @example When the persistent object has a parent persistent object that is required. But not loaded during direct navigation;
     */
    get forceFromAction(): boolean;
    /**
     * Indicates if there are unsaved modifications.
     */
    get isDirty(): boolean;
    /**
     * Gets or sets whether this persistent object has been marked as deleted.
     * This is used when the persistent object is part of the list of objects of an as detail attribute.
     */
    get isDeleted(): boolean;
    set isDeleted(isDeleted: boolean);
    /**
     * Gets whether all of the persistent object attribute tabs will be hidden and only detail queries should be shown.
     */
    get isHidden(): boolean;
    /**
     * Shows if the object is in a frozen state.
     */
    get isFrozen(): boolean;
    /**
     * Full type name of the persistent object.
     * @example "MyProject.MyPersistentObject"
     */
    get fullTypeName(): string;
    /**
     * A semicolon separated list of translated options for the end user to pick when executing the New action.
     */
    get newOptions(): string;
    /**
     * Freezes the object to prevent modifications.
     */
    freeze(): void;
    /**
     * Unfreezes the object to allow modifications.
     */
    unfreeze(): void;
    /**
     * Retrieves an attribute by name.
     * @param name The attribute's name.
     */
    getAttribute(name: string): PersistentObjectAttribute;
    /**
     * Gets the current value of a specified attribute.
     * @param name The attribute's name.
     */
    getAttributeValue<T = any>(name: string): T;
    /**
     * Sets a new value for an attribute and optionally triggers a refresh.
     * @param name The attribute's name.
     * @param value The new value.
     * @param allowRefresh If true, a refresh may follow the update.
     */
    setAttributeValue(name: string, value: any, allowRefresh?: boolean): Promise<any>;
    /**
     * Timestamp marking the last update.
     */
    get lastUpdated(): Date;
    /**
     * Retrieves a query by name linked to this object.
     * @param name The query's name.
     */
    getQuery(name: string): Query;
    /**
     * Enters edit mode and saves the current state for potential rollback.
     */
    beginEdit(): void;
    /**
     * Cancels edit mode, reverts changes from backup, and resets notifications.
     */
    cancelEdit(): void;
    /**
     * Saves changes, refreshes state, and handles post-save notifications.
     * @param waitForOwnerQuery Optionally waits for the owner query to refresh.
     */
    save(waitForOwnerQuery?: boolean): Promise<boolean>;
    /**
     * Refreshes the object state from the service.
     */
    refresh(): Promise<void>;
    /**
     * Serializes the object into a service-friendly format.
     * @param skipParent If true, parent data is excluded.
     */
    toServiceObject(skipParent?: boolean): any;
    /**
     * Flags the object as dirty when in edit mode.
     */
    triggerDirty(): boolean;
    /**
     * Refreshes a given attribute by re-querying the service.
     * @param attr The attribute to refresh.
     * @param immediate If set to true, performs the refresh immediately.
     */
    triggerAttributeRefresh(attr: PersistentObjectAttribute, immediate?: boolean): Promise<boolean>;
}

/**
 * Represents a single item in a program unit.
 */
declare class ProgramUnitItem extends ServiceObject {
    #private;
    /**
     * Initializes a new instance of the ProgramUnitItem class.
     * @param service The service instance.
     * @param unitItem The raw unit item data.
     * @param path The path for this item.
     * @param nameKebab The kebab-case name for this item.
     */
    constructor(service: Service, unitItem: any, path?: string, nameKebab?: string);
    /**
     * Gets the unique identifier for this item.
     */
    get id(): string;
    /**
     * Gets the title for this item.
     */
    get title(): string;
    /**
     * Gets the name for this item.
     */
    get name(): string;
    /**
     * Gets or sets the path for this item.
     */
    get path(): string | undefined;
    set path(value: string | undefined);
    /**
     * Gets the kebab-case name for this item.
     */
    get nameKebab(): string | undefined;
}
/**
 * Represents a group of program unit items.
 */
declare class ProgramUnitItemGroup extends ProgramUnitItem {
    #private;
    /**
     * Initializes a new instance of the ProgramUnitItemGroup class.
     * @param service The service instance.
     * @param unitItem The raw unit item data.
     * @param items The items in this group.
     */
    constructor(service: Service, unitItem: any, items: ProgramUnitItem[]);
    /**
     * Gets the items in this group.
     */
    get items(): ProgramUnitItem[];
}
/**
 * Represents a query item in a program unit.
 */
declare class ProgramUnitItemQuery extends ProgramUnitItem {
    #private;
    /**
     * Initializes a new instance of the ProgramUnitItemQuery class.
     * @param service The service instance.
     * @param routes The application routes.
     * @param unitItem The raw unit item data.
     * @param parent The parent program unit.
     */
    constructor(service: Service, routes: IRoutes, unitItem: any, parent: ProgramUnit);
    /**
     * Gets the query id for this item.
     */
    get queryId(): string;
    private static _getPath;
}
/**
 * Represents a persistent object item in a program unit.
 */
declare class ProgramUnitItemPersistentObject extends ProgramUnitItem {
    #private;
    /**
     * Initializes a new instance of the ProgramUnitItemPersistentObject class.
     * @param service The service instance.
     * @param routes The application routes.
     * @param unitItem The raw unit item data.
     * @param parent The parent program unit.
     */
    constructor(service: Service, routes: IRoutes, unitItem: any, parent: ProgramUnit);
    /**
     * Gets the persistent object id for this item.
     */
    get persistentObjectId(): string;
    /**
     * Gets the persistent object object id for this item.
     */
    get persistentObjectObjectId(): string;
    private static _getPath;
}
/**
 * Represents a URL item in a program unit.
 */
declare class ProgramUnitItemUrl extends ProgramUnitItem {
    /**
     * Initializes a new instance of the ProgramUnitItemUrl class.
     * @param service The service instance.
     * @param unitItem The raw unit item data.
     */
    constructor(service: Service, unitItem: any);
}
/**
 * Represents a separator item in a program unit.
 */
declare class ProgramUnitItemSeparator extends ProgramUnitItem {
    /**
     * Initializes a new instance of the ProgramUnitItemSeparator class.
     * @param service The service instance.
     * @param unitItem The raw unit item data.
     */
    constructor(service: Service, unitItem: any);
}

/**
 * Represents a program unit, which can contain multiple items and groups.
 */
declare class ProgramUnit extends ProgramUnitItem {
    #private;
    /**
     * Initializes a new instance of the ProgramUnit class.
     * @param service The service instance.
     * @param routes The application routes.
     * @param unit The raw unit data.
     */
    constructor(service: Service, routes: IRoutes, unit: any);
    /**
     * Gets the offset of the program unit.
     */
    get offset(): number;
    /**
     * Gets whether the first item should be opened by default.
     */
    get openFirst(): boolean;
    /**
     * Gets the items of the program unit.
     */
    get items(): ProgramUnitItem[];
}

/**
 * Represents the application object that manages user settings, routes, and program units.
 */
declare class Application extends PersistentObject {
    #private;
    /**
     * Initializes a new instance of the Application class.
     * @param service - The associated service.
     * @param application - The application response data.
     * @param hasSensitive - Indicates if the application has sensitive data.
     */
    constructor(service: Service, { application, hasSensitive }: ApplicationResponse);
    /**
     * Gets the program units.
     */
    get programUnits(): ProgramUnit[];
    /**
     * Gets whether the application has sensitive data.
     */
    get hasSensitive(): boolean;
    /**
     * Gets the user ID.
     */
    get userId(): string;
    /**
     * Gets the friendly user name.
     */
    get friendlyUserName(): string;
    /**
     * Gets the feedback ID.
     */
    get feedbackId(): string;
    /**
     * Gets the user settings ID.
     */
    get userSettingsId(): string;
    /**
     * Gets the global search ID.
     */
    get globalSearchId(): string;
    /**
     * Gets the analytics key.
     */
    get analyticsKey(): string;
    /**
     * Gets the user settings.
     */
    get userSettings(): any;
    /**
     * Gets whether the user can profile.
     */
    get canProfile(): boolean;
    /**
     * Gets whether the application has the Vidyano management active.
     */
    get hasManagement(): boolean;
    /**
     * Gets the session for the application.
     */
    get session(): PersistentObject;
    /**
     * Gets the routes for the application.
     */
    get routes(): IRoutes;
    /**
     * Gets the regular expression for the persistent object.
     */
    get poRe(): RegExp;
    /**
     * Gets the regular expression for the query.
     */
    get queryRe(): RegExp;
    /**
     * Saves the user settings to the persistent object or local storage.
     * @returns A promise that resolves to the user settings.
     */
    saveUserSettings(): Promise<any>;
    /**
     * Updates the session with the provided session data.
     * @param session - The session data to update.
     */
    _updateSession(session: any): void;
}
/**
 * Represents the routes for the application.
 */
interface IRoutes {
    /**
     * The program units.
     */
    programUnits: {
        [name: string]: string;
    };
    /**
     * The persistent objects.
     */
    persistentObjects: {
        [type: string]: string;
    };
    /**
     * The keys for the persistent objects.
     */
    persistentObjectKeys: string[];
    /**
     * The queries.
     */
    queries: {
        [type: string]: string;
    };
    /**
     * The keys for the queries.
     */
    queryKeys: string[];
}

/**
 * Arguments for executing an action on a persistent object.
 */
declare class ExecuteActionArgs {
    #private;
    /**
     * Gets the persistent object on which the action is executed.
     */
    get persistentObject(): PersistentObject;
    /**
     * Gets the query context for the action.
     */
    get query(): Query;
    /**
     * Gets or sets the selected query result items.
     */
    get selectedItems(): QueryResultItem[];
    set selectedItems(value: QueryResultItem[]);
    /**
     * Gets or sets additional parameters for the action.
     */
    get parameters(): any;
    set parameters(value: any);
    /**
     * Gets the action name (without namespace).
     */
    get action(): string;
    /**
     * Gets or sets whether the action has been handled.
     */
    get isHandled(): boolean;
    set isHandled(value: boolean);
    /**
     * Gets the result persistent object after execution.
     */
    get result(): PersistentObject;
    /**
     * Initializes a new instance of ExecuteActionArgs.
     * @param service The service instance.
     * @param action The full action name (with namespace).
     * @param persistentObject The persistent object.
     * @param query The query context.
     * @param selectedItems The selected query result items.
     * @param parameters Additional parameters.
     */
    constructor(service: Service, action: string, persistentObject: PersistentObject, query: Query, selectedItems: QueryResultItem[], parameters: any);
    /**
     * Executes the service request for the action.
     * @returns The resulting persistent object.
     */
    executeServiceRequest(): Promise<PersistentObject>;
}

/**
 * Represents a language with culture, name, default status, and messages.
 */
declare class Language extends Observable<ServiceObject> implements Language$1 {
    #private;
    /**
     * Initializes a new instance of the Language class.
     * @param language The language DTO.
     * @param culture The culture string.
     */
    constructor(language: Language$1, culture: string);
    /**
     * Gets the culture of the language.
     */
    get culture(): string;
    /**
     * Gets the name of the language.
     */
    get name(): string;
    /**
     * Gets whether this language is the default.
     */
    get isDefault(): boolean;
    /**
     * Gets or sets the messages for this language.
     */
    get messages(): {
        [key: string]: string;
    };
    set messages(value: {
        [key: string]: string;
    });
}

/**
 * Represents a generator that yields action messages for streaming actions.
 * @returns An async generator that yields strings.
 */
type StreamingActionMessages = AsyncGenerator<string, void, unknown>;
/**
 * Provides extension points for customizing service behavior and object construction.
 */
declare class ServiceHooks {
    #private;
    constructor();
    /**
     * Gets the service instance associated with these hooks.
     */
    get service(): Service;
    /**
     * Allows custom data creation. This is the payload that is sent to the server.
     * @param data The data.
     */
    createData(data: any): void;
    /**
     * Handles fetch requests.
     * @param request The request to fetch.
     */
    onFetch(request: Request): Promise<Response>;
    /**
     * Tracks a custom event.
     * @param name The event name.
     * @param option The event option.
     * @param owner The owner object.
     */
    trackEvent(name: string, option: string, owner: ServiceObjectWithActions): void;
    /**
     * Called during client initialization.
     * @param clientData The client data received from the server.
     */
    onInitialize(clientData: ClientData): Promise<ClientData>;
    /**
     * Called when the session expires.
     */
    onSessionExpired(): Promise<boolean>;
    /**
     * Called to confirm an action.
     * @param action The action.
     * @param option The option index.
     */
    onActionConfirmation(action: Action, option: number): Promise<boolean>;
    /**
     * Called to execute an action.
     * @param args The execution arguments.
     */
    onAction(args: ExecuteActionArgs): Promise<PersistentObject>;
    /**
     * Called when an action definition is not found.
     * @param name The action name.
     */
    onActionDefinitionNotFound(name: string): ActionDefinition;
    /**
     * Called when a streaming action is executed.
     * @param action The action.
     * @param messages A function that returns an async generator for streaming messages.
     * @param abort An optional abort function to cancel the streaming.
     */
    onStreamingAction(action: string, messages: () => StreamingActionMessages, abort?: () => void): Promise<void>;
    /**
     * Called to instruct the user interface to open a service object.
     * @param obj The service object to open.
     * @param replaceCurrent Whether to replace the current object.
     * @param forceFromAction Whether to force opening from an action.
     */
    onOpen(obj: ServiceObject, replaceCurrent?: boolean, forceFromAction?: boolean): void;
    /**
     * Called to instruct the user interface to close a service object.
     * @param obj The service object to close.
     */
    onClose(obj: ServiceObject): void;
    /**
     * Called to construct an application object from the service data.
     * @param application The application data.
     */
    onConstructApplication(application: ApplicationResponse): Application;
    /**
     * Called to construct a persistent object from the service data.
     * @param service The service instance.
     * @param po The persistent object data.
     */
    onConstructPersistentObject(service: Service, po: PersistentObject$1): PersistentObject;
    /**
     * Called to construct a persistent object attribute tab.
     * @param service The service instance.
     * @param groups The attribute groups.
     * @param key The tab key.
     * @param id The tab ID.
     * @param name The tab name.
     * @param layout The tab layout.
     * @param parent The parent persistent object.
     * @param columnCount The number of columns in the layout.
     * @param isVisible Whether the tab is visible.
     */
    onConstructPersistentObjectAttributeTab(service: Service, groups: PersistentObjectAttributeGroup[], key: string, id: string, name: string, layout: any, parent: PersistentObject, columnCount: number, isVisible: boolean): PersistentObjectAttributeTab;
    /**
     * Called to construct a persistent object query tab.
     * @param service The service instance.
     * @param query The query data.
     */
    onConstructPersistentObjectQueryTab(service: Service, query: Query): PersistentObjectQueryTab;
    /**
     * Called to construct a persistent object attribute group.
     * @param service The service instance.
     * @param key The group key.
     * @param attributes The attributes in the group.
     * @param parent The parent persistent object.
     */
    onConstructPersistentObjectAttributeGroup(service: Service, key: string, attributes: PersistentObjectAttribute[], parent: PersistentObject): PersistentObjectAttributeGroup;
    /**
     * Called to construct a persistent object attribute.
     * @param service The service instance.
     * @param attr The attribute data.
     * @param parent The parent persistent object.
     */
    onConstructPersistentObjectAttribute(service: Service, attr: PersistentObjectAttribute$1, parent: PersistentObject): PersistentObjectAttribute;
    /**
     * Called to construct a persistent object attribute with reference.
     * @param service The service instance.
     * @param attr The attribute data.
     * @param parent The parent persistent object.
     */
    onConstructPersistentObjectAttributeWithReference(service: Service, attr: any, parent: PersistentObject): PersistentObjectAttributeWithReference;
    /**
     * Called to construct a persistent object attribute as detail.
     * @param service The service instance.
     * @param attr The attribute data.
     * @param parent The parent persistent object.
     */
    onConstructPersistentObjectAttributeAsDetail(service: Service, attr: any, parent: PersistentObject): PersistentObjectAttributeAsDetail;
    /**
     * Called to construct a query object.
     * @param service The service instance.
     * @param query The query data.
     * @param parent The parent persistent object, if any.
     * @param asLookup Whether the query is for a lookup.
     * @param maxSelectedItems The maximum number of selected items allowed.
     */
    onConstructQuery(service: Service, query: any, parent?: PersistentObject, asLookup?: boolean, maxSelectedItems?: number): Query;
    /**
     * Called to construct a query result item.
     * @param service The service instance.
     * @param item The item data.
     * @param query The query context.
     * @param isSelected Whether the item is selected.
     */
    onConstructQueryResultItem(service: Service, item: any, query: Query, isSelected?: boolean): QueryResultItem;
    /**
     * Called to construct a query result item value.
     * @param service The service instance.
     * @param item The query result item.
     * @param value The value of the item.
     */
    onConstructQueryResultItemValue(service: Service, item: QueryResultItem, value: any): QueryResultItemValue;
    /**
     * Called to construct a query column.
     * @param service The service instance.
     * @param col The column data.
     * @param query The query context.
     */
    onConstructQueryColumn(service: Service, col: any, query: Query): QueryColumn;
    /**
     * Called to construct a service object.
     * @param service The service instance.
     * @param obj The service object data.
     */
    onConstructAction(service: Service, action: Action): Action;
    /**
     * Called to sort persistent object tabs.
     * @param parent The parent persistent object.
     * @param attributeTabs The attribute tabs.
     * @param queryTabs The query tabs.
     * @returns An array of sorted persistent object tabs.
     */
    onSortPersistentObjectTabs(parent: PersistentObject, attributeTabs: PersistentObjectAttributeTab[], queryTabs: PersistentObjectQueryTab[]): PersistentObjectTab[];
    /**
     * Called to let the user interface show a message dialog.
     * @param title The dialog title.
     * @param message The dialog message.
     * @param rich Whether the message is rich text.
     * @param actions The action buttons to display.
     */
    onMessageDialog(title: string, message: string, rich: boolean, ...actions: string[]): Promise<number>;
    /**
     * Called to let the user interface show a notification.
     * @param notification The notification message.
     * @param type The type of notification.
     * @param duration The duration in milliseconds to show the notification.
     */
    onShowNotification(notification: string, type: NotificationType, duration: number): void;
    /**
     * Called to let the user interface select a query result item.
     * @param query The query context.
     * @returns A promise that resolves to an array of selected query result items.
     */
    onSelectReference(query: Query): Promise<QueryResultItem[]>;
    /**
     * Called to let the user interface navigate to a specific path.
     * @param path The path to navigate to.
     * @param replaceCurrent Whether to replace the current history entry.
     */
    onNavigate(path: string, replaceCurrent?: boolean): void;
    /**
     * Called to handle client operations.
     * @param operation The client operation to handle.
     */
    onClientOperation(operation: IClientOperation): void;
    /**
     * Called when selected items actions are performed.
     * @param query The query context.
     * @param selectedItems The selected query result items.
     * @param action The action arguments.
     */
    onSelectedItemsActions(query: Query, selectedItems: QueryResultItem[], action: ISelectedItemsActionArgs): void;
    /**
     * Called when a persistent object is refreshed from a service result.
     * @param po The persistent object that was refreshed.
     */
    onRefreshFromResult(po: PersistentObject): void;
    /**
     * Called when an update of the client library is available.
     */
    onUpdateAvailable(): void;
    /**
     * Called when a retry action is requested.
     * @param retry The retry action data.
     */
    onRetryAction(retry: RetryAction): Promise<string>;
    /**
     * Called to get the display value of a persistent object attribute.
     * @param attribute The persistent object attribute.
     * @param value The value of the attribute.
     * @returns The display value as a string.
     */
    onGetAttributeDisplayValue(attribute: PersistentObjectAttribute, value: any): string;
    /**
     * Sets default translations for the specified languages.
     * @param languages The languages to set default translations for.
     */
    setDefaultTranslations(languages: Language[]): void;
}

/**
 * Represents a generic client operation.
 */
interface IClientOperation {
    type: string;
}
/**
 * Represents a refresh operation for the client.
 */
interface IRefreshOperation extends IClientOperation {
    delay?: number;
    queryId?: string;
    fullTypeName?: string;
    objectId?: string;
}
/**
 * Represents an execute method operation.
 */
interface IExecuteMethodOperation extends IClientOperation {
    name: string;
    arguments: any[];
}
/**
 * Represents an open operation for a persistent object.
 */
interface IOpenOperation extends IClientOperation {
    persistentObject: any;
    replace?: boolean;
}
/**
 * Provides various client-side operations that can be triggered by the service.
 */
declare const ClientOperations: {
    /**
     * Enables Datadog RUM for the application.
     * @param hooks The service hooks.
     * @param applicationId The Datadog application ID.
     * @param clientToken The Datadog client token.
     * @param site The Datadog site (e.g., "datadoghq.com").
     * @param service The name of the service.
     * @param version Optional version of the application.
     * @param environment Optional environment (e.g., "production", "development").
     */
    enableDatadog: (hooks: ServiceHooks, applicationId: string, clientToken: string, site: string, service: string, version?: string, environment?: string) => void;
    /**
     * Navigates to a given path.
     * @param hooks The service hooks.
     * @param path The path to navigate to.
     * @param replaceCurrent Whether to replace the current history entry.
     */
    navigate: (hooks: ServiceHooks, path: string, replaceCurrent?: boolean) => void;
    /**
     * Opens a URL in a new browser tab.
     * @param hooks The service hooks.
     * @param url The URL to open.
     */
    openUrl: (hooks: ServiceHooks, url: string) => void;
    /**
     * Notifies that an update is available and triggers the update handler.
     * @param hooks The service hooks.
     * @param path The path related to the update.
     * @param replaceCurrent Whether to replace the current history entry.
     */
    refreshForUpdate: (hooks: ServiceHooks, path: string, replaceCurrent?: boolean) => void;
    /**
     * Reloads the current page.
     */
    reloadPage: () => void;
    /**
     * Shows a message dialog to the user.
     * @param hooks The service hooks.
     * @param title The dialog title.
     * @param message The dialog message.
     * @param rich Whether the message is rich text.
     * @param delay Delay in milliseconds before showing the dialog.
     */
    showMessageBox: (hooks: ServiceHooks, title: string, message: string, rich?: boolean, delay?: number) => void;
};

/**
 * The current version of the Vidyano client.
 */
declare let version: string;
/**
 * Represents the type of notification.
 */
declare type NotificationType = NotificationType$1;
/**
 * Options for retrieving a query.
 */
type GetQueryOptions = {
    /**
     * If true, the query is treated as a lookup query.
     * @defaultValue false
     */
    asLookup?: boolean;
    /**
     * Optional overrides for specific columns in the query.
     * Each override can specify which columns to include or exclude.
     */
    columnOverrides?: {
        /**
         * The name of the column to override.
         */
        name: string;
        /**
         * Optional list of includes.
         */
        includes?: string[];
        /**
         * Optional list excludes.
         */
        excludes?: string[];
    }[];
    /**
     * Optional parent persistent object if this is a detail query.
     */
    parent?: PersistentObject;
    /**
     * Optional text search string to filter query results.
     */
    textSearch?: string;
    /**
     * Optional sort options string to apply to the query results.
     */
    sortOptions?: string;
};
/**
 * Represents the service layer for interacting with the Vidyano backend.
 * Manages authentication, data fetching, and action execution.
 */
declare class Service extends Observable<Service> {
    #private;
    serviceUri: string;
    hooks: ServiceHooks;
    readonly isTransient: boolean;
    /**
     * Gets or sets a flag indicating whether to stay signed in.
     * This value is persisted in a cookie if not in transient mode.
     */
    staySignedIn: boolean;
    /**
     * Gets or sets a record of icon keys to their data (e.g., SVG content).
     * Populated after application initialization.
     */
    icons: Record<string, string>;
    /**
     * Gets or sets a record of action definitions, keyed by action name.
     * Populated after application initialization.
     */
    actionDefinitions: Record<string, ActionDefinition>;
    /**
     * Gets or sets the environment string sent to the backend (e.g., "Web").
     * @defaultValue "Web"
     */
    environment: string;
    /**
     * Gets or sets the environment version string sent to the backend.
     * @defaultValue "3"
     */
    environmentVersion: string;
    /**
     * Gets or sets a flag indicating whether site data should be cleared on sign-out.
     */
    clearSiteData: boolean;
    /**
     * Initializes a new instance of the Service class.
     * @param serviceUri The base URI of the Vidyano service.
     * @param hooks Optional service hooks for customizing behavior.
     * @param isTransient Optional flag indicating if the service is transient (true) or uses cookies for state (false). Defaults to false.
     */
    constructor(serviceUri: string, hooks?: ServiceHooks, isTransient?: boolean);
    /**
     * Gets or sets the global service token.
     * This is typically used for one-time token-based authentication.
     */
    static get token(): string;
    static set token(token: string);
    /**
     * Gets the array of queued client operations.
     */
    get queuedClientOperations(): IClientOperation[];
    /**
     * Gets the current Vidyano application instance.
     * This is populated after successful initialization or sign-in.
     */
    get application(): Application;
    /**
     * Gets the initial persistent object, if any, defined by the application.
     */
    get initial(): PersistentObject;
    /**
     * Gets or sets the current language used by the service.
     * Changing this property will notify observers.
     */
    get language(): Language;
    set language(l: Language);
    /**
     * Gets or sets the requested language.
     * This value is persisted in a cookie.
     */
    get requestedLanguage(): string;
    set requestedLanguage(val: string);
    /**
     * Gets a flag indicating whether the user is currently signed in.
     */
    get isSignedIn(): boolean;
    /**
     * Gets the array of available languages.
     */
    get languages(): Language[];
    /**
     * Gets a flag indicating whether Windows Authentication is enabled on the server.
     */
    get windowsAuthentication(): boolean;
    /**
     * Gets a dictionary of external authentication providers and their parameters.
     */
    get providers(): {
        [name: string]: ProviderParameters;
    };
    /**
     * Gets a flag indicating whether the service is currently using default credentials.
     */
    get isUsingDefaultCredentials(): boolean;
    /**
     * Gets or sets the current user name.
     */
    get userName(): string;
    set userName(val: string);
    /**
     * Gets the default user name, if configured on the server.
     */
    get defaultUserName(): string;
    /**
     * Gets the user name, if any, configured to use while registering a new user.
     */
    get registerUserName(): string;
    /**
     * Gets or sets the authentication token.
     */
    get authToken(): string;
    set authToken(val: string);
    /**
     * Gets the type of the current authentication token ("Basic", "JWT", or null).
     */
    get authTokenType(): "Basic" | "JWT" | null;
    /**
     * Gets or sets a flag indicating whether profiling is enabled.
     * If enabled, requests and responses will be logged.
     */
    get profile(): boolean;
    set profile(val: boolean);
    /**
     * Gets the list of profiled requests, if profiling is enabled.
     */
    get profiledRequests(): ProfilerRequest[];
    /**
     * Gets a translated message string for the given key, substituting parameters.
     * @param key The key of the message to translate.
     * @param params Optional parameters to substitute into the translated string.
     * @returns The translated string, or the key if no translation is found.
     */
    getTranslatedMessage(key: string, ...params: string[]): string;
    /**
     * Gets the credential type required for the specified user name.
     * @param userName The user name to check.
     * @returns A promise resolving to the credential type information.
     */
    getCredentialType(userName: string): Promise<any>;
    /**
     * Initializes the service by fetching client data and optionally attempting to sign in.
     * @param skipDefaultCredentialLogin If true, skips automatic login with default credentials. Defaults to false.
     * @returns A promise resolving to the Application instance if sign-in was successful, otherwise null or throws an error.
     */
    initialize(skipDefaultCredentialLogin?: boolean): Promise<Application>;
    /**
     * Initiates sign-in via an external authentication provider.
     * Redirects the browser to the provider's sign-in page.
     * @param providerName The name of the external provider.
     */
    signInExternal(providerName: string): void;
    /**
     * Signs in using user name and password credentials.
     * @param userName The user name.
     * @param password The password.
     * @param staySignedIn Optional: A boolean indicating whether to stay signed in.
     * @returns A promise resolving to the Application instance upon successful sign-in.
     */
    signInUsingCredentials(userName: string, password: string, staySignedIn?: boolean): Promise<Application>;
    /**
     * Signs in using user name, password, and a 2FA code.
     * @param userName The user name.
     * @param password The password.
     * @param code The 2FA code.
     * @param staySignedIn Optional: A boolean indicating whether to stay signed in.
     * @returns A promise resolving to the Application instance upon successful sign-in.
     */
    signInUsingCredentials(userName: string, password: string, code: string, staySignedIn?: boolean): Promise<Application>;
    /**
     * Signs in using default credentials, if available (e.g., Windows Authentication or pre-configured user).
     * @returns A promise resolving to the Application instance upon successful sign-in.
     */
    signInUsingDefaultCredentials(): Promise<Application>;
    /**
     * Signs out the current user.
     * @param skipAcs Optional flag to skip ACS (Access Control Service) sign-out. Defaults to false.
     * @returns A promise resolving to true if sign-out was successful.
     */
    signOut(skipAcs?: boolean): Promise<boolean>;
    /**
     * Retrieves a query definition and its initial data.
     * @param id The ID of the query.
     * @param optionsOrAsLookup Either an options object or a boolean indicating if the query is for lookup purposes.
     * @param parent Optional parent persistent object if this is a detail query.
     * @param textSearch Optional text search string.
     * @param sortOptions Optional sort options string.
     * @returns A promise resolving to the Query instance.
     */
    getQuery(id: string, optionsOrAsLookup?: boolean | GetQueryOptions, parent?: PersistentObject, textSearch?: string, sortOptions?: string): Promise<Query>;
    /**
     * Retrieves a persistent object.
     * @param parent Optional parent persistent object if this object is a detail.
     * @param id The type ID of the persistent object.
     * @param objectId Optional ID of an existing object to load.
     * @param isNew Optional flag indicating if a new object should be created.
     * @returns A promise resolving to the PersistentObject instance.
     */
    getPersistentObject(parent: PersistentObject, id: string, objectId?: string, isNew?: boolean): Promise<PersistentObject>;
    /**
     * Executes a query to retrieve or refresh its data.
     * @param parent Optional parent persistent object if this is a detail query.
     * @param query The query to execute.
     * @param asLookup Optional flag indicating if the query is for lookup purposes. Defaults to false.
     * @param throwExceptions Optional flag to throw exceptions instead of setting them as query notifications. Defaults to false.
     * @returns A promise resolving to the query result data.
     */
    executeQuery(parent: PersistentObject, query: Query, asLookup?: boolean, throwExceptions?: boolean): Promise<QueryResult>;
    /**
     * Executes an action on a persistent object or query.
     * @param action The name of the action to execute.
     * @param parent The parent persistent object (for object actions or context).
     * @param query The query (for query actions).
     * @param selectedItems An array of selected query result items (for query actions).
     * @param parameters Optional parameters for the action.
     * @param skipHooks Internal flag to skip hooks during retry.
     * @returns A promise resolving to the resulting PersistentObject, if any.
     */
    executeAction(action: string, parent: PersistentObject, query: Query, selectedItems: Array<QueryResultItem>, parameters?: any, skipHooks?: boolean): Promise<PersistentObject>;
    /**
     * Retrieves a data stream (e.g., a file download) associated with an action or object.
     * @param obj The persistent object context for the stream.
     * @param action The action that produces the stream.
     * @param parent Optional parent persistent object.
     * @param query Optional query context.
     * @param selectedItems Optional selected items from a query.
     * @param parameters Optional parameters for the stream action.
     * @returns A promise that resolves when the stream download is initiated.
     */
    getStream(obj: PersistentObject, action?: string, parent?: PersistentObject, query?: Query, selectedItems?: Array<QueryResultItem>, parameters?: any): Promise<void>;
    /**
     * Retrieves data for a report.
     * @param token The report token.
     * @param options Optional filtering, sorting, and pagination options for the report.
     * @returns A promise resolving to an array of report data.
     */
    getReport(token: string, { filter, orderBy, top, skip, hideIds, hideType }?: IReportOptions): Promise<any[]>;
    /**
     * Performs an instant search across the application.
     * @param search The search term.
     * @returns A promise resolving to an array of instant search results.
     */
    getInstantSearch(search: string): Promise<IInstantSearchResult[]>;
    /**
     * Initiates the "forgot password" process for a user.
     * @param userName The user name for which to reset the password.
     * @returns A promise resolving to the result of the forgot password request.
     */
    forgotPassword(userName: string): Promise<IForgotPassword>;
    /**
     * Converts a string value from the service to its appropriate JavaScript type.
     * @param value The string value from the service.
     * @param typeName The Vidyano data type name (e.g., "String", "Int32", "DateTimeOffset").
     * @returns The converted JavaScript value.
     */
    static fromServiceString(value: string, typeName: string): any;
    /**
     * Converts a JavaScript value to its string representation for the service.
     * @param value The JavaScript value.
     * @param typeName The Vidyano data type name.
     * @returns The string representation for the service.
     */
    static toServiceString(value: any, typeName: string): string;
}
/**
 * Interface for the forgot password response.
 */
interface IForgotPassword {
    /**
     * The user name for which the password reset was requested.
     */
    notification: string;
    /**
     * The type of notification (e.g., "Info", "Error").
     */
    notificationType: NotificationType;
    /**
     * The duration in milliseconds for which the notification should be displayed.
     */
    notificationDuration: number;
}
/**
 * Interface for report options, allowing filtering, sorting, and pagination.
 */
interface IReportOptions {
    /**
     * Optional filter string to apply to the report data.
     */
    filter?: string;
    /**
     * Optional order by string to sort the report data.
     */
    orderBy?: string;
    /**
     * Optional top count to limit the number of items returned.
     */
    top?: number;
    /**
     * Optional skip count to skip a number of items in the report data.
     */
    skip?: number;
    /**
     * Optional flag to hide IDs in the report data.
     */
    hideIds?: boolean;
    /**
     * Optional flag to hide the type information in the report data.
     */
    hideType?: boolean;
}
/**
 * Interface for instant search results, providing basic information about each result.
 */
interface IInstantSearchResult {
    /**
     * The type ID of the result.
     */
    id: string;
    /**
     * The label or display name of the result.
     */
    label: string;
    /**
     * The object ID of the result.
     */
    objectId: string;
    /**
     * The type name of the result.
     */
    breadcrumb: string;
}

type InternalPersistentObject = PersistentObject & {
    /**
     * Gets the data transfer object for the persistent object.
     */
    get dto(): PersistentObject$1;
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
    refreshFromResult(po: PersistentObject | PersistentObject$1, resultWins?: boolean): void;
    /**
     * Rebuilds the tabs and groups UI structure based on changed attributes.
     * @param changedAttributes The attributes that have been modified.
     */
    refreshTabsAndGroups(...changedAttributes: PersistentObjectAttribute[]): void;
};
type InternalPersistentObjectAttribute = PersistentObjectAttribute & {
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
    refreshFromResult(attr: PersistentObjectAttribute | PersistentObjectAttribute$1, resultWins?: boolean): boolean;
    /**
     * Converts the attribute to a service object.
     */
    toServiceObject(): PersistentObjectAttribute$1;
};
type InternalQueryColumn = QueryColumn & {
    /**
     * Converts the query column to a service object.
     */
    toServiceObject(): QueryColumn$1;
};
type InternalQueryResultItem = QueryResultItem & {
    /**
     * Converts the query result item to a service object.
     */
    toServiceObject(): QueryResultItem$1;
};
type InternalQueryResultItemValue = {
    /**
     * Converts the query result item value to a service object.
     */
    toServiceObject(): any;
};
type InternalQuery = Query & {
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
type InternalServiceHooks = ServiceHooks & {
    /**
     * Sets the service instance for the hooks.
     */
    setService(service: Service): any;
};
/**
 * Gets the internal proxy for the target.
 * @param target The target to get the internal proxy for.
 */
declare function _internal(target: PersistentObject): InternalPersistentObject;
declare function _internal(target: PersistentObjectAttribute): InternalPersistentObjectAttribute;
declare function _internal(target: Query): InternalQuery;
declare function _internal(target: QueryResultItem): InternalQueryResultItem;
declare function _internal(target: QueryResultItemValue): InternalQueryResultItemValue;
declare function _internal(target: QueryColumn): InternalQueryColumn;
declare function _internal(target: ServiceHooks): InternalServiceHooks;

/**
 * Gets or sets the cookie prefix used for storage keys and default cookie paths.
 * @param prefix Optional prefix to set.
 * @returns The current cookie prefix.
 */
declare function cookiePrefix(prefix?: string): string;
/**
 * Options for getting a cookie or storage value.
 */
interface CookieGetOptions {
    /** If true, forces reading from document.cookie, bypassing Web Storage. */
    force?: boolean;
    /** If true, does not decode the value (retrieves it as stored). */
    raw?: boolean;
}
/**
 * Options for setting a cookie or storage value.
 */
interface CookieSetOptions {
    /** If true, forces setting to document.cookie, bypassing Web Storage. */
    force?: boolean;
    /** If true, does not encode the value before storing. */
    raw?: boolean;
    /** The cookie path. Defaults to the current global cookie prefix. */
    path?: string;
    /** The cookie domain. */
    domain?: string;
    /** If true, marks the cookie as Secure (HTTPS only). */
    secure?: boolean;
    /**
     * Expiration time.
     * - Number: Days from now.
     * - Date: Specific expiration date.
     * - Omitted: Session cookie/storage.
     * - Negative number or past date: Deletes the cookie/storage item.
     */
    expires?: number | Date;
    /**
     * The SameSite attribute for the cookie. Defaults to 'Lax'.
     * If 'None', 'secure' must also be true.
     */
    sameSite?: 'Lax' | 'Strict' | 'None';
}
/**
 * Gets a cookie or storage value.
 * @param key The key for the cookie or storage.
 * @param options Optional settings for how to retrieve the value.
 * @returns The value string, or an empty string "" if not found/expired.
 */
declare function cookie(key: string, options?: CookieGetOptions): string;
/**
 * Sets a cookie or storage value.
 * @param key The key for the cookie or storage.
 * @param value The value to set. Use `null` or `undefined` along with a past/negative `expires` to delete.
 * @param options Additional options for setting the cookie.
 * @returns For Web Storage: The prefixed key. For document.cookie: The full cookie string.
 */
declare function cookie(key: string, value: string | null | undefined, options?: CookieSetOptions): string;

/**
 * Represents culture-specific information, including number and date formatting.
 */
declare class CultureInfo {
    name: string;
    numberFormat: ICultureInfoNumberFormat;
    dateFormat: ICultureInfoDateFormat;
    /**
     * The current culture in use.
     */
    static currentCulture: CultureInfo;
    /**
     * The invariant (culture-neutral) culture.
     */
    static invariantCulture: CultureInfo;
    /**
     * Registered cultures by name.
     */
    static cultures: Record<string, CultureInfo>;
    /**
     * Creates a new CultureInfo instance.
     * @param name The culture name (e.g., "en-US").
     * @param numberFormat Number formatting information.
     * @param dateFormat Date formatting information.
     */
    constructor(name: string, numberFormat: ICultureInfoNumberFormat, dateFormat: ICultureInfoDateFormat);
}
/**
 * Number formatting information for a culture.
 */
interface ICultureInfoNumberFormat {
    /** Symbol for Not-a-Number. */
    naNSymbol: string;
    /** Symbol for negative sign. */
    negativeSign: string;
    /** Symbol for positive sign. */
    positiveSign: string;
    /** Text for negative infinity. */
    negativeInfinityText: string;
    /** Text for positive infinity. */
    positiveInfinityText: string;
    /** Symbol for percent. */
    percentSymbol: string;
    /** Group sizes for percent values. */
    percentGroupSizes: number[];
    /** Decimal digits for percent values. */
    percentDecimalDigits: number;
    /** Decimal separator for percent values. */
    percentDecimalSeparator: string;
    /** Group separator for percent values. */
    percentGroupSeparator: string;
    /** Pattern for positive percent values. */
    percentPositivePattern: string;
    /** Pattern for negative percent values. */
    percentNegativePattern: string;
    /** Symbol for currency. */
    currencySymbol: string;
    /** Group sizes for currency values. */
    currencyGroupSizes: number[];
    /** Decimal digits for currency values. */
    currencyDecimalDigits: number;
    /** Decimal separator for currency values. */
    currencyDecimalSeparator: string;
    /** Group separator for currency values. */
    currencyGroupSeparator: string;
    /** Pattern for negative currency values. */
    currencyNegativePattern: string;
    /** Pattern for positive currency values. */
    currencyPositivePattern: string;
    /** Group sizes for number values. */
    numberGroupSizes: number[];
    /** Decimal digits for number values. */
    numberDecimalDigits: number;
    /** Decimal separator for number values. */
    numberDecimalSeparator: string;
    /** Group separator for number values. */
    numberGroupSeparator: string;
}
/**
 * Date formatting information for a culture.
 */
interface ICultureInfoDateFormat {
    /** AM designator. */
    amDesignator: string;
    /** PM designator. */
    pmDesignator: string;
    /** Date separator. */
    dateSeparator: string;
    /** Time separator. */
    timeSeparator: string;
    /** GMT date/time pattern. */
    gmtDateTimePattern: string;
    /** Universal date/time pattern. */
    universalDateTimePattern: string;
    /** Sortable date/time pattern. */
    sortableDateTimePattern: string;
    /** General date/time pattern. */
    dateTimePattern: string;
    /** Long date pattern. */
    longDatePattern: string;
    /** Short date pattern. */
    shortDatePattern: string;
    /** Long time pattern. */
    longTimePattern: string;
    /** Short time pattern. */
    shortTimePattern: string;
    /** Year/month pattern. */
    yearMonthPattern: string;
    /** First day of the week (0 = Sunday, 1 = Monday, ...). */
    firstDayOfWeek: number;
    /** Full day names. */
    dayNames: string[];
    /** Abbreviated day names. */
    shortDayNames: string[];
    /** Minimized day names. */
    minimizedDayNames: string[];
    /** Full month names. */
    monthNames: string[];
    /** Abbreviated month names. */
    shortMonthNames: string[];
}

/**
 * Represents a localized message shown when there is no internet connection.
 */
declare class NoInternetMessage {
    #private;
    title: string;
    message: string;
    tryAgain: string;
    /**
     * A dictionary of language codes to NoInternetMessage instances.
     */
    static messages: Record<string, NoInternetMessage>;
    /**
     * Initializes a new instance of the NoInternetMessage class.
     * @param language The language code.
     * @param title The title of the message.
     * @param message The message body.
     * @param tryAgain The label for the retry action.
     */
    constructor(language: string, title: string, message: string, tryAgain: string);
    /**
     * Gets the language code for this message.
     */
    get language(): string;
}

/**
 * Provides helpers for working with service data types.
 */
declare abstract class DataType {
    #private;
    /**
     * Determines if the type is a date or time type.
     * @param type The type string.
     */
    static isDateTimeType(type: string): boolean;
    /**
     * Determines if the type is a numeric type.
     * @param type The type string.
     */
    static isNumericType(type: string): boolean;
    /**
     * Determines if the type is a boolean type.
     * @param type The type string.
     */
    static isBooleanType(type: string): boolean;
    /**
     * Converts a service string value to a specific data type.
     * @param value The value to convert.
     * @param type The data type of the service string value.
     */
    static fromServiceString(value: string, type: string): any;
    /**
     * Converts a value to a service string based on the specified data type.
     * @param value The value to convert.
     * @param type The data type of the service string value.
     */
    static toServiceString(value: any, type: string): string;
}

export { Action, ActionDefinition, type ActionDefinitionParams, type ActionExecutionHandler, type ActionExecutionHandlerDispose, ActionGroup, Actions, Application, ArrayChangedArgs, ClientOperations, type CookieGetOptions, type CookieSetOptions, CultureInfo, DataType, service as Dto, ExecuteActionArgs, ExpressionParser, type GetQueryOptions, type IActionExecuteOptions, type IClientOperation, type ICultureInfoDateFormat, type ICultureInfoNumberFormat, type IExecuteMethodOperation, type IForgotPassword, type IInstantSearchResult, type IOpenOperation, type IPropertyChangedObserver, type IQueryColumnDistincts, type IQueryGroupingInfo, type IQueueAddOptions, type IRefreshOperation, type IReportOptions, type IRoutes, type ISelectedItemsActionArgs, type IServiceBus, type ISortOption, type ISubjectDisposer, type ISubjectNotifier, type ISubjectObserver, type KeyValue, type KeyValuePair, type KeyValueString, Language, NoInternetMessage, type NotificationType, Observable, PersistentObject, PersistentObjectAttribute, PersistentObjectAttributeAsDetail, PersistentObjectAttributeGroup, type PersistentObjectAttributeOption, PersistentObjectAttributeTab, PersistentObjectAttributeWithReference, PersistentObjectLayoutMode, PersistentObjectQueryTab, PersistentObjectTab, ProgramUnit, ProgramUnitItem, ProgramUnitItemGroup, ProgramUnitItemPersistentObject, ProgramUnitItemQuery, ProgramUnitItemSeparator, ProgramUnitItemUrl, PropertyChangedArgs, Query, QueryChart, QueryColumn, QueryFilter, QueryFilters, QueryResultItem, QueryResultItemGroup, QueryResultItemValue, Queue, Service, ServiceBus, type ServiceBusCallback, type ServiceBusSubscriptionDisposer, ServiceHooks, ServiceObject, ServiceObjectWithActions, type SortDirection, type StreamingActionMessages, Subject, _internal, cookie, cookiePrefix, extend, nameof, noop, sleep, version };
