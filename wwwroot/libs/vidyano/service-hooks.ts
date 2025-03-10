import type * as Dto from "./typings/service.js"
import type { NotificationType, Service } from "./service.js"
import type { ServiceObjectWithActions } from "./service-object-with-actions.js"
import type { Action, ISelectedItemsActionArgs } from "./action.js"
import { ActionDefinition } from "./action-definition.js"
import { ClientOperations, IClientOperation, IExecuteMethodOperation, IOpenOperation } from "./client-operations.js"
import { PersistentObject } from "./persistent-object.js"
import type { ExecuteActionArgs } from "./execute-action-args.js"
import type { ServiceObject } from "./service-object.js"
import { Application } from "./application.js"
import { PersistentObjectAttributeGroup } from "./persistent-object-attribute-group.js"
import { PersistentObjectAttributeTab, PersistentObjectQueryTab, PersistentObjectTab } from "./persistent-object-tab.js"
import { Query } from "./query.js"
import { PersistentObjectAttribute } from "./persistent-object-attribute.js"
import { PersistentObjectAttributeWithReference } from "./persistent-object-attribute-with-reference.js"
import { PersistentObjectAttributeAsDetail } from "./persistent-object-attribute-as-detail.js"
import { QueryResultItem } from "./query-result-item.js"
import { QueryResultItemValue } from "./query-result-item-value.js"
import { QueryColumn } from "./query-column.js"
import type { Language } from "./language.js"
import { cookiePrefix } from "./cookie.js"
import messages from "./client-messages.js"

export type StreamingActionMessages = AsyncGenerator<string, void, unknown>;

export class ServiceHooks {
    private _service: Service;

    get service(): Service {
        return this._service;
    }

    createData(data: any) {
        // Noop
    }

    onFetch(request: Request): Promise<Response> {
        return fetch(request);
    }

    trackEvent(name: string, option: string, owner: ServiceObjectWithActions) {
        // Noop
    }

    onInitialize(clientData: Dto.ClientData): Promise<Dto.ClientData> {
        return Promise.resolve(clientData);
    }

    onSessionExpired(): Promise<boolean> {
        return Promise.resolve(false);
    }

    onActionConfirmation(action: Action, option: number): Promise<boolean> {
        return Promise.resolve(true);
    }

    onAction(args: ExecuteActionArgs): Promise<PersistentObject> {
        return Promise.resolve(null);
    }

    onActionDefinitionNotFound(name: string): ActionDefinition {
        console.error(`No action definition found for ${name}`);
        return null;
    }

    async onStreamingAction(action: string, messages: () => StreamingActionMessages, abort?: () => void): Promise<void> {
        // Noop
    }

    onOpen(obj: ServiceObject, replaceCurrent: boolean = false, forceFromAction?: boolean) {
        // Noop
    }

    onClose(obj: ServiceObject) {
        // Noop
    }

    onConstructApplication(application: Dto.ApplicationResponse): Application {
        return new Application(this.service, application);
    }

    onConstructPersistentObject(service: Service, po: Dto.PersistentObject): PersistentObject {
        return new PersistentObject(service, po);
    }

    onConstructPersistentObjectAttributeTab(service: Service, groups: PersistentObjectAttributeGroup[], key: string, id: string, name: string, layout: any, parent: PersistentObject, columnCount: number, isVisible: boolean): PersistentObjectAttributeTab {
        return new PersistentObjectAttributeTab(service, groups, key, id, name, layout, parent, columnCount, isVisible);
    }

    onConstructPersistentObjectQueryTab(service: Service, query: Query): PersistentObjectQueryTab {
        return new PersistentObjectQueryTab(service, query);
    }

    onConstructPersistentObjectAttributeGroup(service: Service, key: string, attributes: PersistentObjectAttribute[], parent: PersistentObject): PersistentObjectAttributeGroup {
        return new PersistentObjectAttributeGroup(service, key, attributes, parent);
    }

    onConstructPersistentObjectAttribute(service: Service, attr: Dto.PersistentObjectAttribute, parent: PersistentObject): PersistentObjectAttribute {
        return new PersistentObjectAttribute(service, attr, parent);
    }

    onConstructPersistentObjectAttributeWithReference(service: Service, attr: any, parent: PersistentObject): PersistentObjectAttributeWithReference {
        return new PersistentObjectAttributeWithReference(service, attr, parent);
    }

    onConstructPersistentObjectAttributeAsDetail(service: Service, attr: any, parent: PersistentObject): PersistentObjectAttributeAsDetail {
        return new PersistentObjectAttributeAsDetail(service, attr, parent);
    }

    onConstructQuery(service: Service, query: any, parent?: PersistentObject, asLookup: boolean = false, maxSelectedItems?: number): Query {
        return new Query(service, query, parent, asLookup, maxSelectedItems);
    }

    onConstructQueryResultItem(service: Service, item: any, query: Query, isSelected: boolean = false): QueryResultItem {
        return new QueryResultItem(service, item, query, isSelected);
    }

    onConstructQueryResultItemValue(service: Service, item: QueryResultItem, value: any): QueryResultItemValue {
        return new QueryResultItemValue(service, item, value);
    }

    onConstructQueryColumn(service: Service, col: any, query: Query): QueryColumn {
        return new QueryColumn(service, col, query);
    }

    onConstructAction(service: Service, action: Action): Action {
        return action;
    }

    onSortPersistentObjectTabs(parent: PersistentObject, attributeTabs: PersistentObjectAttributeTab[], queryTabs: PersistentObjectQueryTab[]): PersistentObjectTab[] {
        return (<PersistentObjectTab[]>attributeTabs).concat(queryTabs);
    }

    onMessageDialog(title: string, message: string, rich: boolean, ...actions: string[]): Promise<number> {
        return Promise.resolve(-1);
    }

    onShowNotification(notification: string, type: NotificationType, duration: number) {
        // Noop
    }

    onSelectReference(query: Query): Promise<QueryResultItem[]> {
        return Promise.resolve([]);
    }

    onNavigate(path: string, replaceCurrent: boolean = false) {
        // Noop
    }

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
                this.onOpen(this.onConstructPersistentObject(this.service, open.persistentObject), open.replace);
                break;

            default:
                if (window.console && console.log)
                    console.log("Missing client operation type: " + operation.type, operation);
                break;
        }
    }

    onSelectedItemsActions(query: Query, selectedItems: QueryResultItem[], action: ISelectedItemsActionArgs) {
        // Noop
    }

    onRefreshFromResult(po: PersistentObject) {
        // Noop
    }

    onUpdateAvailable() {
        localStorage.setItem("vi-updateAvailable", cookiePrefix());
        localStorage.removeItem("vi-updateAvailable");
    }

    onRetryAction(retry: Dto.RetryAction): Promise<string> {
        return Promise.resolve(null);
    }

    onGetAttributeDisplayValue(attribute: PersistentObjectAttribute, value: any): string {
        return undefined;
    }

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