import { Observable } from "./common/observable.js";
import { Query } from "./query.js";

export class QueryChart extends Observable<QueryChart> {
    constructor(private _query: Query, private _label: string, private _name: string, private _options: any, private _type: string) {
        super();
    }

    get query(): Query {
        return this._query;
    }

    get label(): string {
        return this._label;
    }

    get name(): string {
        return this._name;
    }

    get options(): any {
        return this._options;
    }

    get type(): string {
        return this._type;
    }

    async execute(parameters: any = {}): Promise<any> {
        const result = await this._query.service.executeAction("QueryFilter.Chart", this._query.parent, this._query, null, Object.assign(parameters, { name: this.name }));
        return JSON.parse(result.getAttributeValue("Data"));
    }
}