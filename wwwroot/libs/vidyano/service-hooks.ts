import type * as Dto from "./typings/service.js";
import type { NotificationType, Service } from "./service.js";
import type { ServiceObjectWithActions } from "./service-object-with-actions.js";
import type { Action, ISelectedItemsActionArgs } from "./action.js";
import { ActionDefinition } from "./action-definition.js";
import { ClientOperations, IClientOperation, IExecuteMethodOperation, IOpenOperation } from "./client-operations.js";
import { PersistentObject } from "./persistent-object.js";
import type { ExecuteActionArgs } from "./execute-action-args.js";
import type { ServiceObject } from "./service-object.js";
import { Application } from "./application.js";
import { PersistentObjectAttributeGroup } from "./persistent-object-attribute-group.js";
import { PersistentObjectAttributeTab, PersistentObjectQueryTab, PersistentObjectTab } from "./persistent-object-tab.js";
import { Query } from "./query.js";
import { PersistentObjectAttribute } from "./persistent-object-attribute.js";
import { PersistentObjectAttributeWithReference } from "./persistent-object-attribute-with-reference.js";
import { PersistentObjectAttributeAsDetail } from "./persistent-object-attribute-as-detail.js";
import { QueryResultItem } from "./query-result-item.js";
import { QueryResultItemValue } from "./query-result-item-value.js";
import { QueryColumn } from "./query-column.js";
import type { Language } from "./language.js";
import { cookiePrefix } from "./cookie.js";
import messages from "./client-messages.js";
import { ServiceHooksSymbols } from "./_internals.js";

/**
 * Represents a generator that yields action messages for streaming actions.
 * @returns An async generator that yields strings.
 */
export type StreamingActionMessages = AsyncGenerator<string, void, unknown>;

/**
 * Provides extension points for customizing service behavior and object construction.
 */
export class ServiceHooks {
    #service: Service;

    constructor() {
        this[ServiceHooksSymbols.IsServiceHooks] = true;
        this[ServiceHooksSymbols.SetService] = this.#setService.bind(this);
    }

    /**
     * Gets the service instance associated with these hooks.
     */
    get service(): Service {
        return this.#service;
    }
    #setService(service: Service) {
        this.#service = service;
    }

    /**
     * Allows custom data creation. This is the payload that is sent to the server.
     * @param data The data.
     */
    createData(data: any) {
        // Noop
    }

    /**
     * Handles fetch requests.
     * @param request The request to fetch.
     */
    onFetch(request: Request): Promise<Response> {
        return fetch(request);
    }

    /**
     * Tracks a custom event.
     * @param name The event name.
     * @param option The event option.
     * @param owner The owner object.
     */
    trackEvent(name: string, option: string, owner: ServiceObjectWithActions) {
        // Noop
    }

    /**
     * Called during client initialization.
     * @param clientData The client data received from the server.
     */
    onInitialize(clientData: Dto.ClientData): Promise<Dto.ClientData> {
        return Promise.resolve(clientData);
    }

    /**
     * Called when the session expires.
     */
    onSessionExpired(): Promise<boolean> {
        return Promise.resolve(false);
    }

    /**
     * Called to confirm an action.
     * @param action The action.
     * @param option The option index.
     */
    onActionConfirmation(action: Action, option: number): Promise<boolean> {
        return Promise.resolve(true);
    }

    /**
     * Called to execute an action.
     * @param args The execution arguments.
     */
    onAction(args: ExecuteActionArgs): Promise<PersistentObject> {
        return Promise.resolve(null);
    }

    /**
     * Called when an action definition is not found.
     * @param name The action name.
     */
    onActionDefinitionNotFound(name: string): ActionDefinition {
        console.error(`No action definition found for ${name}`);
        return null;
    }

    /**
     * Called when a streaming action is executed.
     * @param action The action.
     * @param messages A function that returns an async generator for streaming messages.
     * @param abort An optional abort function to cancel the streaming.
     */
    async onStreamingAction(action: string, messages: () => StreamingActionMessages, abort?: () => void) {
        // Noop
    }

    /**
     * Called to instruct the user interface to open a service object.
     * @param obj The service object to open.
     * @param replaceCurrent Whether to replace the current object.
     * @param forceFromAction Whether to force opening from an action.
     */
    onOpen(obj: ServiceObject, replaceCurrent: boolean = false, forceFromAction?: boolean) {
        // Noop
    }

    /**
     * Called to instruct the user interface to close a service object.
     * @param obj The service object to close.
     */
    onClose(obj: ServiceObject) {
        // Noop
    }

    /**
     * Called to construct an application object from the service data.
     * @param application The application data.
     */
    onConstructApplication(application: Dto.ApplicationResponse): Application {
        return new Application(this.#service, application);
    }

    /**
     * Called to construct a persistent object from the service data.
     * @param service The service instance.
     * @param po The persistent object data.
     */
    onConstructPersistentObject(service: Service, po: Dto.PersistentObject): PersistentObject {
        return new PersistentObject(service, po);
    }

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
    onConstructPersistentObjectAttributeTab(service: Service, groups: PersistentObjectAttributeGroup[], key: string, id: string, name: string, layout: any, parent: PersistentObject, columnCount: number, isVisible: boolean): PersistentObjectAttributeTab {
        return new PersistentObjectAttributeTab(service, groups, key, id, name, layout, parent, columnCount, isVisible);
    }

    /**
     * Called to construct a persistent object query tab.
     * @param service The service instance.
     * @param query The query data.
     */
    onConstructPersistentObjectQueryTab(service: Service, query: Query): PersistentObjectQueryTab {
        return new PersistentObjectQueryTab(service, query);
    }

    /**
     * Called to construct a persistent object attribute group.
     * @param service The service instance.
     * @param key The group key.
     * @param attributes The attributes in the group.
     * @param parent The parent persistent object.
     */
    onConstructPersistentObjectAttributeGroup(service: Service, key: string, attributes: PersistentObjectAttribute[], parent: PersistentObject): PersistentObjectAttributeGroup {
        return new PersistentObjectAttributeGroup(service, key, attributes, parent);
    }

    /**
     * Called to construct a persistent object attribute.
     * @param service The service instance.
     * @param attr The attribute data.
     * @param parent The parent persistent object.
     */
    onConstructPersistentObjectAttribute(service: Service, attr: Dto.PersistentObjectAttribute, parent: PersistentObject): PersistentObjectAttribute {
        return new PersistentObjectAttribute(service, attr, parent);
    }

    /**
     * Called to construct a persistent object attribute with reference.
     * @param service The service instance.
     * @param attr The attribute data.
     * @param parent The parent persistent object.
     */
    onConstructPersistentObjectAttributeWithReference(service: Service, attr: any, parent: PersistentObject): PersistentObjectAttributeWithReference {
        return new PersistentObjectAttributeWithReference(service, attr, parent);
    }

    /**
     * Called to construct a persistent object attribute as detail.
     * @param service The service instance.
     * @param attr The attribute data.
     * @param parent The parent persistent object.
     */
    onConstructPersistentObjectAttributeAsDetail(service: Service, attr: any, parent: PersistentObject): PersistentObjectAttributeAsDetail {
        return new PersistentObjectAttributeAsDetail(service, attr, parent);
    }

    /**
     * Called to construct a query object.
     * @param service The service instance.
     * @param query The query data.
     * @param parent The parent persistent object, if any.
     * @param asLookup Whether the query is for a lookup.
     * @param maxSelectedItems The maximum number of selected items allowed.
     */
    onConstructQuery(service: Service, query: any, parent?: PersistentObject, asLookup: boolean = false, maxSelectedItems?: number): Query {
        return new Query(service, query, parent, asLookup, maxSelectedItems);
    }

    /**
     * Called to construct a query result item.
     * @param service The service instance.
     * @param item The item data.
     * @param query The query context.
     * @param isSelected Whether the item is selected.
     */
    onConstructQueryResultItem(service: Service, item: any, query: Query, isSelected: boolean = false): QueryResultItem {
        return new QueryResultItem(service, item, query, isSelected);
    }

    /**
     * Called to construct a query result item value.
     * @param service The service instance.
     * @param item The query result item.
     * @param value The value of the item.
     */
    onConstructQueryResultItemValue(service: Service, item: QueryResultItem, value: any): QueryResultItemValue {
        return new QueryResultItemValue(service, item, value);
    }

    /**
     * Called to construct a query column.
     * @param service The service instance.
     * @param col The column data.
     * @param query The query context.
     */
    onConstructQueryColumn(service: Service, col: any, query: Query): QueryColumn {
        return new QueryColumn(service, col, query);
    }

    /**
     * Called to construct a service object.
     * @param service The service instance.
     * @param obj The service object data.
     */
    onConstructAction(service: Service, action: Action): Action {
        return action;
    }

    /**
     * Called to sort persistent object tabs.
     * @param parent The parent persistent object.
     * @param attributeTabs The attribute tabs.
     * @param queryTabs The query tabs.
     * @returns An array of sorted persistent object tabs.
     */
    onSortPersistentObjectTabs(parent: PersistentObject, attributeTabs: PersistentObjectAttributeTab[], queryTabs: PersistentObjectQueryTab[]): PersistentObjectTab[] {
        return (<PersistentObjectTab[]>attributeTabs).concat(queryTabs);
    }

    /**
     * Called to let the user interface show a message dialog.
     * @param title The dialog title.
     * @param message The dialog message.
     * @param rich Whether the message is rich text.
     * @param actions The action buttons to display.
     */
    onMessageDialog(title: string, message: string, rich: boolean, ...actions: string[]): Promise<number> {
        return Promise.resolve(-1);
    }

    /**
     * Called to let the user interface show a notification.
     * @param notification The notification message.
     * @param type The type of notification.
     * @param duration The duration in milliseconds to show the notification.
     */
    onShowNotification(notification: string, type: NotificationType, duration: number) {
        // Noop
    }

    /**
     * Called to let the user interface select a query result item.
     * @param query The query context.
     * @returns A promise that resolves to an array of selected query result items.
     */
    onSelectReference(query: Query): Promise<QueryResultItem[]> {
        return Promise.resolve([]);
    }

    /**
     * Called to let the user interface navigate to a specific path.
     * @param path The path to navigate to.
     * @param replaceCurrent Whether to replace the current history entry.
     */
    onNavigate(path: string, replaceCurrent: boolean = false) {
        // Noop
    }

    /**
     * Called to handle client operations.
     * @param operation The client operation to handle.
     */
    onClientOperation(operation: IClientOperation) {
        switch (operation.type) {
            case "ExecuteMethod":
                const executeMethod = <IExecuteMethodOperation>operation;
                const method: Function = ClientOperations[executeMethod.name];
                if (typeof (method) === "function") {
                    method.apply(ClientOperations, [this].concat(executeMethod.arguments));
                }
                else if (window.console && console.error)
                    console.error("Method not found: " + executeMethod.name, executeMethod);

                break;

            case "Open":
                const open = <IOpenOperation>operation;
                this.onOpen(this.onConstructPersistentObject(this.#service, open.persistentObject), open.replace);
                break;

            default:
                if (window.console && console.log)
                    console.log("Missing client operation type: " + operation.type, operation);
                break;
        }
    }

    /**
     * Called when selected items actions are performed.
     * @param query The query context.
     * @param selectedItems The selected query result items.
     * @param action The action arguments.
     */
    onSelectedItemsActions(query: Query, selectedItems: QueryResultItem[], action: ISelectedItemsActionArgs) {
        // Noop
    }

    /**
     * Called when a persistent object is refreshed from a service result.
     * @param po The persistent object that was refreshed.
     */
    onRefreshFromResult(po: PersistentObject) {
        // Noop
    }

    /**
     * Called when an update of the client library is available.
     */
    onUpdateAvailable() {
        localStorage.setItem("vi-updateAvailable", cookiePrefix());
        localStorage.removeItem("vi-updateAvailable");
    }

    /**
     * Called when a retry action is requested.
     * @param retry The retry action data.
     */
    onRetryAction(retry: Dto.RetryAction): Promise<string> {
        return Promise.resolve(null);
    }

    /**
     * Called to get the display value of a persistent object attribute.
     * @param attribute The persistent object attribute.
     * @param value The value of the attribute.
     * @returns The display value as a string.
     */
    onGetAttributeDisplayValue(attribute: PersistentObjectAttribute, value: any): string {
        return undefined;
    }

    /**
     * Sets default translations for the specified languages.
     * @param languages The languages to set default translations for.
     */
    setDefaultTranslations(languages: Language[]) {
        languages.forEach(lang => {
            Object.keys(messages).forEach(key => {
                if (!lang.messages.hasOwnProperty(key)) {
                    lang.messages[key] = messages[key];
                }
            });
        });
    }
}