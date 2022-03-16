import { ExpressionParser } from "./common/expression-parser.js"
import { QueryResultItem } from "./query-result-item.js"
import { Service } from "./service.js"

export class ActionDefinition {
    private _name: string;
    private _displayName: string;
    private _isPinned: boolean;
    private _refreshQueryOnCompleted: boolean;
    private _keepSelectionOnRefresh: boolean;
    private _offset: number;
    private _confirmation: string;
    private _groupDefinition: string | ActionDefinition;
    private _options: Array<string> = [];
    private _selectionRule: (count: number) => boolean;
    private _showedOn: string[];

    constructor(private readonly _service: Service, item: QueryResultItem) {
        this._name = item.getValue("Name");
        this._displayName = item.getValue("DisplayName");
        this._isPinned = item.getValue("IsPinned");
        this._confirmation = item.getValue("Confirmation");
        this._selectionRule = ExpressionParser.get(item.getValue("SelectionRule"));
        this._refreshQueryOnCompleted = item.getValue("RefreshQueryOnCompleted");
        this._keepSelectionOnRefresh = item.getValue("KeepSelectionOnRefresh");
        this._offset = item.getValue("Offset");
        this._showedOn = (<string>item.getValue("ShowedOn") || "").split(",").map(v => v.trim());

        const groupAction = item.getFullValue("GroupAction");
        if (groupAction != null)
            this._groupDefinition = groupAction.objectId;

        const options = item.getValue("Options");
        this._options = options && options.trim().length > 0 ? options.split(";") : [];
    }

    get name(): string {
        return this._name;
    }

    get displayName(): string {
        return this._displayName;
    }

    get isPinned(): boolean {
        return this._isPinned;
    }

    get refreshQueryOnCompleted(): boolean {
        return this._refreshQueryOnCompleted;
    }

    get keepSelectionOnRefresh(): boolean {
        return this._keepSelectionOnRefresh;
    }

    get offset(): number {
        return this._offset;
    }

    get confirmation(): string {
        return this._confirmation;
    }

    get options(): Array<string> {
        return this._options;
    }

    get selectionRule(): (count: number) => boolean {
        return this._selectionRule;
    }

    get showedOn(): string[] {
        return this._showedOn;
    }

    get groupDefinition(): ActionDefinition {
        if (this._groupDefinition == null)
            return null;

        if (typeof this._groupDefinition === "string")
            this._groupDefinition = this._service.actionDefinitions[this._groupDefinition];

        return <ActionDefinition>this._groupDefinition;
    }
}