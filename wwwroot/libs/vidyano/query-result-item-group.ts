import { Observable } from "./common/observable.js";
import type { Query } from "./query.js";
import type { QueryResultItem } from "./query-result-item.js";
import * as Dto from "./typings/service.js";

export interface IQueryGroupingInfo extends Dto.QueryGroupingInfo {
    groups?: QueryResultItemGroup[];
}

export class QueryResultItemGroup extends Observable<QueryResultItemGroup> implements Dto.QueryResultItemGroup {
    private _name: string;
    private _count: number;
    private _items: QueryResultItem[];
    private _isCollapsed: boolean;

    constructor(public readonly query: Query, group: Dto.QueryResultItemGroup, private _start: number, private _end: number, private _notifier: () => void) {
        super();

        this._name = group.name;
        this._count = group.count;

        this._items = new Array(this._count);
        const items = query.items.slice(_start, _end);
        this._items.splice(0, items.length, ...items);

        this._isCollapsed = false;
    }

    get name(): string {
        return this._name;
    }

    get count(): number {
        return this._count;
    }

    get start(): number {
        return this._start;
    }

    get end(): number {
        return this._end;
    }

    get items(): QueryResultItem[] {
        return this._items;
    }

    get isCollapsed(): boolean {
        return this._isCollapsed;
    }

    set isCollapsed(isCollapsed: boolean) {
        if (this._isCollapsed === isCollapsed)
            return;
        
        const oldIsCollapsed = this._isCollapsed;
        this.notifyPropertyChanged("isCollapsed", this._isCollapsed = isCollapsed, oldIsCollapsed);
        this._notifier();
    }

    update(group: Dto.QueryResultItemGroup, start: number, end: number) {
        this._count = group.count;
        this._start = start;
        this._end = end;

        this._items = new Array(this._count);
        const items = this.query.items.slice(start, end);
        this._items.splice(0, items.length, ...items);
    }
}