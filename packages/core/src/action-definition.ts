import { ExpressionParser } from "./common/expression-parser.js";
import { QueryResultItem } from "./query-result-item.js";
import type { Service } from "./service.js";

/**
 * Parameters that define an action.
 */
export interface ActionDefinitionParams {
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
export class ActionDefinition {
    readonly #definition: ActionDefinitionParams;
    #groupDefinition: string | ActionDefinition;
    #selectionRule: (count: number) => boolean;
    readonly #service: Service;

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
    constructor(service: Service, itemOrDefinition: QueryResultItem | ActionDefinitionParams) {
        this.#service = service;

        if (itemOrDefinition instanceof QueryResultItem) {
            this.#definition = {
                name: itemOrDefinition.getValue("Name"),
                displayName: itemOrDefinition.getValue("DisplayName"),
                isPinned: itemOrDefinition.getValue("IsPinned"),
                isStreaming: itemOrDefinition.getValue("IsStreamingAction"),
                confirmation: itemOrDefinition.getValue("Confirmation"),
                refreshQueryOnCompleted: itemOrDefinition.getValue("RefreshQueryOnCompleted"),
                keepSelectionOnRefresh: itemOrDefinition.getValue("KeepSelectionOnRefresh"),
                offset: itemOrDefinition.getValue("Offset"),
                showedOn: (<string>itemOrDefinition.getValue("ShowedOn") || "").split(",").map(v => v.trim()),
                selectionRule: itemOrDefinition.getValue("SelectionRule"),
                options: itemOrDefinition.getValue("Options")?.split(";").filter(o => !!o) ?? [],
                icon: itemOrDefinition.getValue("Icon") || `Action_${itemOrDefinition.getValue("Name")}`
            };

            const groupAction = itemOrDefinition.getFullValue("GroupAction");
            if (groupAction != null)
                this.#groupDefinition = groupAction.objectId;
        }
        else {
            this.#definition = Object.assign({
                options: []
            }, itemOrDefinition);
        }

        this.#selectionRule = ExpressionParser.get(this.#definition.selectionRule);
    }

    /**
     * Gets the name of the action.
     */
    get name(): string {
        return this.#definition.name;
    }

    /**
     * Gets the display name of the action.
     */
    get displayName(): string {
        return this.#definition.displayName;
    }

    /**
     * Gets whether the action is pinned.
     */
    get isPinned(): boolean {
        return this.#definition.isPinned ?? false;
    }

    /**
     * Gets whether the action is streaming.
     */
    get isStreaming(): boolean {
        return !!this.#definition.isStreaming;
    }

    /**
     * Gets whether the query should be refreshed on completion.
     */
    get refreshQueryOnCompleted(): boolean {
        return this.#definition.refreshQueryOnCompleted;
    }

    /**
     * Gets whether to keep selection on refresh.
     */
    get keepSelectionOnRefresh(): boolean {
        return this.#definition.keepSelectionOnRefresh;
    }

    /**
     * Gets the offset value.
     */
    get offset(): number {
        return this.#definition.offset;
    }

    /**
     * Gets the confirmation message.
     */
    get confirmation(): string {
        return this.#definition.confirmation;
    }

    /**
     * Gets the available options for this action.
     */
    get options(): Array<string> {
        return this.#definition.options;
    }

    /**
     * Gets the selection rule function.
     */
    get selectionRule(): (count: number) => boolean {
        return this.#selectionRule;
    }

    /**
     * Gets the contexts where this action is shown.
     */
    get showedOn(): string[] {
        return this.#definition.showedOn;
    }

    /**
     * Gets the group definition this action belongs to.
     */
    get groupDefinition(): ActionDefinition {
        if (this.#groupDefinition == null)
            return null;

        if (typeof this.#groupDefinition === "string")
            this.#groupDefinition = this.#service.actionDefinitions[this.#groupDefinition];

        return <ActionDefinition>this.#groupDefinition;
    }

    /**
     * Gets the icon for this action.
     */
    get icon(): string {
        return this.#definition.icon;
    }
}