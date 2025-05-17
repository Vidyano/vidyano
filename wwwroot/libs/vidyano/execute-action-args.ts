import type { PersistentObject } from "./persistent-object.js";
import type { Query } from "./query.js";
import type { QueryResultItem } from "./query-result-item.js";
import type { Service } from "./service.js";

/**
 * Arguments for executing an action on a persistent object.
 */
export class ExecuteActionArgs {
    #action: string;
    #actionName: string;
    #isHandled = false;
    #result: PersistentObject;
    #service: Service;
    #parameters: any;
    #persistentObject: PersistentObject;
    #query: Query;
    #selectedItems: QueryResultItem[];

    /**
     * Gets the persistent object on which the action is executed.
     */
    get persistentObject(): PersistentObject {
        return this.#persistentObject;
    }

    /**
     * Gets the query context for the action.
     */
    get query(): Query {
        return this.#query;
    }

    /**
     * Gets or sets the selected query result items.
     */
    get selectedItems(): QueryResultItem[] {
        return this.#selectedItems;
    }
    set selectedItems(value: QueryResultItem[]) {
        this.#selectedItems = value;
    }

    /**
     * Gets or sets additional parameters for the action.
     */
    get parameters(): any {
        return this.#parameters;
    }
    set parameters(value: any) {
        this.#parameters = value;
    }

    /**
     * Gets the action name (without namespace).
     */
    get action(): string {
        return this.#actionName;
    }

    /**
     * Gets or sets whether the action has been handled.
     */
    get isHandled(): boolean {
        return this.#isHandled;
    }
    set isHandled(value: boolean) {
        this.#isHandled = value;
    }

    /**
     * Gets the result persistent object after execution.
     */
    get result(): PersistentObject {
        return this.#result;
    }

    /**
     * Initializes a new instance of ExecuteActionArgs.
     * @param service The service instance.
     * @param action The full action name (with namespace).
     * @param persistentObject The persistent object.
     * @param query The query context.
     * @param selectedItems The selected query result items.
     * @param parameters Additional parameters.
     */
    constructor(service: Service, action: string, persistentObject: PersistentObject, query: Query, selectedItems: QueryResultItem[], parameters: any) {
        this.#service = service;
        this.#action = action;
        this.#actionName = action.split(".")[1];
        this.#persistentObject = persistentObject;
        this.#query = query;
        this.#selectedItems = selectedItems;
        this.#parameters = parameters;
    }

    /**
     * Executes the service request for the action.
     * @returns The resulting persistent object.
     */
    async executeServiceRequest(): Promise<PersistentObject> {
        this.#result = await this.#service.executeAction(this.#action, this.persistentObject, this.query, this.selectedItems, this.#parameters, true);
        this.#isHandled = true;

        return this.#result;
    }
}