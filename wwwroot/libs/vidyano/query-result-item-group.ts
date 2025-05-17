import { Observable } from "./common/observable.js";
import type { Query } from "./query.js";
import type { QueryResultItem } from "./query-result-item.js";
import type * as Dto from "./typings/service.js";

/**
 * Extends the Dto.QueryGroupingInfo with an optional groups property.
 */
export interface IQueryGroupingInfo extends Dto.QueryGroupingInfo {
    groups?: QueryResultItemGroup[];
}

/**
 * Represents a group of query result items.
 */
export class QueryResultItemGroup extends Observable<QueryResultItemGroup> implements Dto.QueryResultItemGroup {
    readonly query: Query;
    #name: string;
    #count: number;
    #items: QueryResultItem[];
    #isCollapsed: boolean;
    #start: number;
    #end: number;
    #notifier: () => void;

    /**
     * Initializes a new instance of the QueryResultItemGroup class.
     * @param query The parent query.
     * @param group The group DTO.
     * @param start The start index.
     * @param end The end index.
     * @param notifier Callback to notify changes.
     */
    constructor(query: Query, group: Dto.QueryResultItemGroup, start: number, end: number, notifier: () => void) {
        super();

        this.query = query;
        this.#name = group.name;
        this.#count = group.count;
        this.#start = start;
        this.#end = end;
        this.#notifier = notifier;

        this.#items = new Array(this.#count);
        const items = query.items.slice(start, end);
        this.#items.splice(0, items.length, ...items);

        this.#isCollapsed = false;
    }

    /**
     * Gets the group name.
     */
    get name(): string {
        return this.#name;
    }

    /**
     * Gets the number of items in the group.
     */
    get count(): number {
        return this.#count;
    }

    /**
     * Gets the start index of the group.
     */
    get start(): number {
        return this.#start;
    }

    /**
     * Gets the end index of the group.
     */
    get end(): number {
        return this.#end;
    }

    /**
     * Gets the items in the group.
     */
    get items(): QueryResultItem[] {
        return this.#items;
    }

    /**
     * Gets or sets whether the group is collapsed.
     */
    get isCollapsed(): boolean {
        return this.#isCollapsed;
    }

    set isCollapsed(isCollapsed: boolean) {
        if (this.#isCollapsed === isCollapsed)
            return;

        const oldIsCollapsed = this.#isCollapsed;
        this.notifyPropertyChanged("isCollapsed", this.#isCollapsed = isCollapsed, oldIsCollapsed);
        this.#notifier();
    }
}