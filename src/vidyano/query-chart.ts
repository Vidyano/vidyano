import { Observable } from "./common/observable.js";
import type { Query } from "./query.js";

/**
 * Represents a chart associated with a query.
 */
export class QueryChart extends Observable<QueryChart> {
    #query: Query;
    #label: string;
    #name: string;
    #options: any;
    #type: string;

    /**
     * Initializes a new instance of the QueryChart class.
     * @param query The parent query.
     * @param label The chart label.
     * @param name The chart name.
     * @param options The chart options.
     * @param type The chart type.
     */
    constructor(query: Query, label: string, name: string, options: any, type: string) {
        super();

        this.#query = query;
        this.#label = label;
        this.#name = name;
        this.#options = options;
        this.#type = type;
    }

    /**
     * Gets the parent query.
     */
    get query(): Query {
        return this.#query;
    }

    /**
     * Gets the chart label.
     */
    get label(): string {
        return this.#label;
    }

    /**
     * Gets the chart name.
     */
    get name(): string {
        return this.#name;
    }

    /**
     * Gets the chart options.
     */
    get options(): any {
        return this.#options;
    }

    /**
     * Gets the chart type.
     */
    get type(): string {
        return this.#type;
    }

    /**
     * Executes the chart action with the given parameters.
     * @param parameters The parameters for the chart action.
     * @returns The parsed chart data.
     */
    async execute(parameters: any = {}): Promise<any> {
        const result = await this.#query.service.executeAction(
            "QueryFilter.Chart",
            this.#query.parent,
            this.#query,
            null,
            Object.assign(parameters, { name: this.#name })
        );

        return JSON.parse(result.getAttributeValue("Data"));
    }
}