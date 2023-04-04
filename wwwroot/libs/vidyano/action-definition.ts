import { ExpressionParser } from "./common/expression-parser.js"
import { QueryResultItem } from "./query-result-item.js"
import type { Service } from "./service.js"

export interface ActionDefinitionParams {
    name: string;
    displayName?: string;
    isPinned?: boolean;
    showedOn?: string[];
    confirmation?: string
    refreshQueryOnCompleted?: boolean;
    keepSelectionOnRefresh?: boolean
    offset?: number;
    selectionRule?: string
    options?: ("PersistentObject" | "Query")[];
    icon?: string;
}
export class ActionDefinition {
    private _groupDefinition: string | ActionDefinition;
    private _selectionRule: (count: number) => boolean;
    private readonly _definition: ActionDefinitionParams;

    constructor(service: Service, definition: ActionDefinitionParams);
    constructor(service: Service, item: QueryResultItem);
    constructor(private readonly _service: Service, itemOrDefinition: QueryResultItem | ActionDefinitionParams) {
        if (itemOrDefinition instanceof QueryResultItem) {
            this._definition = {
                name: itemOrDefinition.getValue("Name"),
                displayName: itemOrDefinition.getValue("DisplayName"),
                isPinned: itemOrDefinition.getValue("IsPinned"),
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
                this._groupDefinition = groupAction.objectId;
        }
        else {
            this._definition = Object.assign({
                options: []
            }, itemOrDefinition);
        }

        this._selectionRule = ExpressionParser.get(this._definition.selectionRule);
    }

    get name(): string {
        return this._definition.name;
    }

    get displayName(): string {
        return this._definition.displayName;
    }

    get isPinned(): boolean {
        return this._definition.isPinned ?? false;
    }

    get refreshQueryOnCompleted(): boolean {
        return this._definition.refreshQueryOnCompleted;
    }

    get keepSelectionOnRefresh(): boolean {
        return this._definition.keepSelectionOnRefresh;
    }

    get offset(): number {
        return this._definition.offset;
    }

    get confirmation(): string {
        return this._definition.confirmation;
    }

    get options(): Array<string> {
        return this._definition.options;
    }

    get selectionRule(): (count: number) => boolean {
        return this._selectionRule;
    }

    get showedOn(): string[] {
        return this._definition.showedOn;
    }

    get groupDefinition(): ActionDefinition {
        if (this._groupDefinition == null)
            return null;

        if (typeof this._groupDefinition === "string")
            this._groupDefinition = this._service.actionDefinitions[this._groupDefinition];

        return <ActionDefinition>this._groupDefinition;
    }

    get icon(): string {
        return this._definition.icon;
    }
}