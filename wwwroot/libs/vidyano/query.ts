import type * as Dto from "./typings/service.js"
import { Observable, IPropertyChangedObserver, ISubjectDisposer, PropertyChangedArgs } from "./common/observable.js"
import { QueryColumn, SortDirection } from "./query-column.js"
import { QueryResultItem } from "./query-result-item.js"
import type { Service } from "./service.js"
import { ServiceObjectWithActions } from "./service-object-with-actions.js"
import { QueryFilters } from "./query-filters.js"
import { QueryChart } from "./query-chart.js"
import { IQueryGroupingInfo, QueryResultItemGroup } from "./query-result-item-group.js"
import { PersistentObject } from "./persistent-object.js"
import { Action } from "./action.js"
import { ExpressionParser } from "./common/expression-parser.js"
import { ActionDefinition } from "./action-definition.js"

export interface ISortOption {
    column: QueryColumn;
    name: string;
    direction: SortDirection;
}

export interface IQuerySelectAll {
    isAvailable: boolean;
    allSelected: boolean;
    inverse: boolean;
}

class QuerySelectAllImpl extends Observable<IQuerySelectAll> implements IQuerySelectAll {
    private _allSelected: boolean = false;
    private _inverse: boolean = false;

    constructor(private _query: Query, private _isAvailable: boolean, observer: IPropertyChangedObserver<QuerySelectAllImpl>) {
        super();

        this.propertyChanged.attach(observer);
    }

    get isAvailable(): boolean {
        if (this._query.maxSelectedItems)
            return;

        return this._isAvailable;
    }

    set isAvailable(isAvailable: boolean) {
        if (this._query.maxSelectedItems)
            return;

        if (this._isAvailable === isAvailable)
            return;

        this.allSelected = this.inverse = false;

        const oldValue = this._isAvailable;
        this.notifyPropertyChanged("isAvailable", this._isAvailable = isAvailable, oldValue);
    }

    get allSelected(): boolean {
        return this._allSelected;
    }

    set allSelected(allSelected: boolean) {
        if (!this.isAvailable)
            return;

        if (this._allSelected === allSelected)
            return;

        const oldInverse = this._inverse;
        if (oldInverse)
            this._inverse = false;

        const oldValue = this._allSelected;
        this.notifyPropertyChanged("allSelected", this._allSelected = allSelected, oldValue);

        if (oldInverse)
            this.notifyPropertyChanged("inverse", this._inverse, oldValue);
    }

    get inverse(): boolean {
        return this._inverse;
    }

    set inverse(inverse: boolean) {
        if (!this.isAvailable)
            return;

        if (this._inverse === inverse)
            return;

        const oldValue = this._inverse;
        this.notifyPropertyChanged("inverse", this._inverse = inverse, oldValue);
    }
}

export class Query extends ServiceObjectWithActions {
    private _lastResult: Dto.QueryResult;
    private _asLookup: boolean;
    private _isSelectionModifying: boolean;
    private _totalItems: number;
    private _labelWithTotalItems: string;
    private _sortOptions: ISortOption[];
    private _queriedPages: Array<number> = [];
    private _filters: QueryFilters;
    private _allowTextSearch: boolean;
    private _canFilter: boolean;
    private _canRead: boolean;
    private _canReorder: boolean;
    private _charts: QueryChart[] = null;
    private _defaultChartName: string = null;
    private _currentChart: QueryChart = null;
    private _lastUpdated: Date;
    private _totalItem: QueryResultItem;
    private _isSystem: boolean;
    private _isFiltering: boolean;
    private _columnObservers: ISubjectDisposer[];
    private _hasMore: boolean = null;
    private _groupingInfo: IQueryGroupingInfo;
    private _items: QueryResultItem[];
    private _queuedLazyItemIndexes: number[];
    private _queuedLazyItemIndexesTimeout: any;

    persistentObject: PersistentObject;
    columns: QueryColumn[];
    id: string;
    name: string;
    autoQuery: boolean;
    isHidden: boolean;
    hasSearched: boolean;
    label: string;
    singularLabel: string;
    offset: number;
    textSearch: string;
    pageSize: number;
    skip: number;
    top: number;
    continuation: string;
    selectAll: IQuerySelectAll;
    disableLazyLoading: boolean;

    constructor(service: Service, query: Dto.Query, parent?: PersistentObject, asLookup?: boolean, maxSelectedItems?: number);
    constructor(service: Service, query: any, public parent?: PersistentObject, asLookup: boolean = false, public maxSelectedItems?: number) {
        super(service, query._actionNames || query.actions, query.actionLabels);

        this._asLookup = asLookup;
        this._isSystem = !!query.isSystem;
        this.id = query.id;
        this.name = query.name;
        this.autoQuery = query.autoQuery;

        this._allowTextSearch = query.allowTextSearch;
        this._canRead = !!query.canRead;
        this.isHidden = query.isHidden;
        this.label = query.label;
        this.setNotification(query.notification, query.notificationType, query.notificationDuration);
        this.offset = query.offset || 0;
        this.textSearch = query.textSearch || "";
        this.pageSize = query.pageSize;
        this.skip = query.skip;
        this.top = query.top;

        this.persistentObject = query.persistentObject instanceof PersistentObject ? query.persistentObject : service.hooks.onConstructPersistentObject(service, query.persistentObject);
        this.singularLabel = this.persistentObject.label;

        this._updateColumns(query.columns);
        this._initializeActions();

        this._canReorder = !!query.canReorder && !asLookup;

        this.selectAll = new QuerySelectAllImpl(this, (!!query.isSystem || !!query.enableSelectAll) && !query.maxSelectedItems && this.actions.some(a => a.isVisible && a.definition.selectionRule !== ExpressionParser.alwaysTrue), this._selectAllPropertyChanged.bind(this));

        this._setTotalItems(query.totalItems);
        this._setSortOptionsFromService(query.sortOptions);

        if (query.disableBulkEdit) {
            const bulkEdit = <Action>this.actions["BulkEdit"];
            if (bulkEdit)
                bulkEdit.selectionRule = count => count === 1;
        }

        if (query.filters) {
            if (query.filters instanceof QueryFilters)
                this._filters = asLookup ? query.filters.clone(this) : null;
            else
                this._filters = new QueryFilters(this, service.hooks.onConstructPersistentObject(service, query.filters));
        }
        else
            this._filters = null;

        this._canFilter = this.actions.some(a => a.name === "Filter") && this.columns.some(c => c.canFilter);

        if (query.result)
            this._setResult(query.result);
        else {
            this.items = [];
            this._labelWithTotalItems = this.label;
            this._lastUpdated = new Date();
        }

        if (query instanceof Query && query.groupingInfo)
            this._setGroupingInfo({ groupedBy: query.groupingInfo.groupedBy });
    }

    get isSystem(): boolean {
        return this._isSystem;
    }

    get allowTextSearch(): boolean {
        return this._allowTextSearch;
    }

    get filters(): QueryFilters {
        return this._filters;
    }

    get canFilter(): boolean {
        return this._canFilter;
    }

    private _setCanFilter(val: boolean) {
        if (this._canFilter === val)
            return;

        const oldValue = this._canFilter;
        this.notifyPropertyChanged("canFilter", this._canFilter = val, oldValue);
    }

    get hasMore(): boolean {
        return this._hasMore;
    }

    private _setHasMore(val: boolean) {
        const oldValue = this._hasMore;
        if (oldValue === val)
            return;

        this.notifyPropertyChanged("hasMore", this._hasMore = val, oldValue);
    }

    get canRead(): boolean {
        return this._canRead;
    }

    get canReorder(): boolean {
        return this._canReorder;
    }

    get charts(): QueryChart[] {
        return this._charts;
    }

    private _setCharts(charts: QueryChart[]) {
        if (this._charts && charts && this._charts.length > 0 && this._charts.length === charts.length && this._charts.orderBy(c => c.name).join("\n") === charts.orderBy(c => c.name).join("\n"))
            return;

        const oldCharts = this._charts;
        this.notifyPropertyChanged("charts", this._charts = charts, oldCharts);

        if (charts && this.defaultChartName && !this.currentChart)
            this.currentChart = this.charts.find(c => c.name === this._defaultChartName);
    }

    get currentChart(): QueryChart {
        return this._currentChart;
    }

    set currentChart(currentChart: QueryChart) {
        if (this._currentChart === currentChart)
            return;

        const oldCurrentChart = this._currentChart;
        this.notifyPropertyChanged("currentChart", this._currentChart = currentChart !== undefined ? currentChart : null, oldCurrentChart);
    }

    get defaultChartName(): string {
        return this._defaultChartName;
    }

    set defaultChartName(defaultChart: string) {
        if (this._defaultChartName === defaultChart)
            return;

        const oldDefaultChart = this._defaultChartName;
        this.notifyPropertyChanged("defaultChartName", this._defaultChartName = defaultChart !== undefined ? defaultChart : null, oldDefaultChart);

        if (this.charts && defaultChart && !this.currentChart)
            this.currentChart = this.charts.find(c => c.name === this._defaultChartName);
    }

    get groupingInfo(): IQueryGroupingInfo {
        return this._groupingInfo;
    }

    private _setGroupingInfo(groupingInfo: IQueryGroupingInfo) {
        const oldValue = this._groupingInfo;
        if (oldValue === groupingInfo)
            return;

        this.notifyPropertyChanged("groupingInfo", this._groupingInfo = groupingInfo, oldValue);
    }

    get lastUpdated(): Date {
        return this._lastUpdated;
    }

    private _setLastUpdated(date: Date = new Date()) {
        if (this._lastUpdated === date)
            return;

        const oldLastUpdated = this._lastUpdated;
        this.notifyPropertyChanged("lastUpdated", this._lastUpdated = date, oldLastUpdated);
    }

    get selectedItems(): QueryResultItem[] {
        return this.items ? this.items.filter(i => i.isSelected) : [];
    }

    set selectedItems(items: QueryResultItem[]) {
        try {
            this._isSelectionModifying = true;
            items = items.filter(i => !i.ignoreSelect) || [];

            const selectedItems = this.selectedItems;
            if (selectedItems && selectedItems.length > 0)
                selectedItems.forEach(item => item.isSelected = false);

            items.forEach(item => item.isSelected = true);
            this.notifyPropertyChanged("selectedItems", items);
        }
        finally {
            this._isSelectionModifying = false;
        }
    }

    private _selectAllPropertyChanged(selectAll: QuerySelectAllImpl, args: PropertyChangedArgs) {
        if (args.propertyName === "allSelected")
            this.selectedItems = this.selectAll.allSelected ? this.items : [];
    }

    async resetFilters() {
        if (!!this._filters || !this.actions["Filter"])
            return;

        await this.queueWork(async () => {
            this._filters = new QueryFilters(this, await this.service.getPersistentObject(null, "a0a2bd29-2921-43a6-a322-b2dcf4c895c2", this.id));
        });
    }

    selectRange(from: number, to: number): boolean {
        let selectionUpdated: boolean;

        try {
            this._isSelectionModifying = true;
            const itemsToSelect = this.items.slice(from, ++to);

            if (this.maxSelectedItems && this.selectedItems.concat(itemsToSelect).distinct().length > this.maxSelectedItems)
                return;

            // Detect if array has gaps
            if (Object.keys(itemsToSelect).length === to - from) {
                itemsToSelect.forEach(item => {
                    item.isSelected = true;
                });

                selectionUpdated = itemsToSelect.length > 0;
                this.notifyPropertyChanged("selectedItems", this.selectedItems);
                return true;
            }

            return false;
        }
        finally {
            this._isSelectionModifying = false;

            if (selectionUpdated)
                this._updateSelectAll();
        }
    }

    get asLookup(): boolean {
        return this._asLookup;
    }

    get totalItems(): number {
        return this._totalItems;
    }

    get labelWithTotalItems(): string {
        return this._labelWithTotalItems;
    }

    get sortOptions(): ISortOption[] {
        return this._sortOptions;
    }

    get totalItem(): QueryResultItem {
        return this._totalItem;
    }

    private _setTotalItem(item: QueryResultItem) {
        if (this._totalItem === item)
            return;

        const oldTotalItem = this._totalItem;
        this.notifyPropertyChanged("totalItem", this._totalItem = item, oldTotalItem);
    }

    set sortOptions(options: ISortOption[]) {
        if (this._sortOptions === options)
            return;

        const oldSortOptions = this._sortOptions;
        this.notifyPropertyChanged("sortOptions", this._sortOptions = options, oldSortOptions);
    }

    async group(column: QueryColumn): Promise<QueryResultItem[]>;
    async group(by: string): Promise<QueryResultItem[]>;
    async group(columnOrBy: (string | QueryColumn)): Promise<QueryResultItem[]> {
        const by = columnOrBy instanceof QueryColumn ? columnOrBy.name : columnOrBy;

        if (this.groupingInfo && this.groupingInfo.groupedBy === by)
            return;

        this._updateGroupingInfo({
            groupedBy: by,
            groups: []
        });

        return this.search();
    }

    async reorder(before: QueryResultItem, item: QueryResultItem, after: QueryResultItem): Promise<QueryResultItem[]> {
        if (!this.canReorder)
            throw "Unable to reorder, canReorder is set to false.";

        return await this.queueWork(async () => {
            try {
                const po = await this.service.executeAction("QueryOrder.Reorder", this.parent, this, [before, item, after]);
                this._setResult(po.queries[0]._lastResult);

                return this.items;
            }
            catch (e) {
                return [];
            }
        });
    }

    private _setSortOptionsFromService(options: string | ISortOption[]) {
        let newSortOptions: ISortOption[];
        if (typeof options === "string") {
            if (!String.isNullOrEmpty(options)) {
                newSortOptions = [];
                options.split(";").map(option => option.trim()).forEach(option => {
                    const optionParts = option.splitWithTail(" ", 2).map(option => option.trim());
                    const col = this.getColumn(optionParts[0]);
                    newSortOptions.push({
                        column: col,
                        name: optionParts[0],
                        direction: optionParts.length < 2 ? "ASC" : <SortDirection>optionParts[1]
                    });
                });
            }
        }
        else
            newSortOptions = !!options ? options.slice(0) : [];

        this.sortOptions = newSortOptions;
    }

    private _setTotalItems(items: number) {
        if (this._totalItems === items)
            return;

        const oldTotalItems = this._totalItems;
        this.notifyPropertyChanged("totalItems", this._totalItems = items, oldTotalItems);

        const oldLabelWithTotalItems = this._labelWithTotalItems;
        this._labelWithTotalItems = (this.totalItems != null ? this.totalItems + (this.hasMore ? "+" : "") + " " : "") + (this.totalItems !== 1 ? this.label : (this.singularLabel || this.persistentObject.label || this.persistentObject.type));
        this.notifyPropertyChanged("labelWithTotalItems", this._labelWithTotalItems, oldLabelWithTotalItems);
    }

    get isFiltering(): boolean {
        return this._isFiltering;
    }

    private _updateIsFiltering() {
        let isFiltering = !!this.columns.find(c => !!c.selectedDistincts && c.selectedDistincts.length > 0);
        if (isFiltering === this._isFiltering)
            return;

        const oldIsFiltering = this._isFiltering;
        this.notifyPropertyChanged("isFiltering", this._isFiltering = isFiltering, oldIsFiltering);
    }

    _toServiceObject() {
        const result = this.copyProperties(["id", "isSystem", "name", "label", "pageSize", "skip", "top", "textSearch", "continuation"]);
        if (this.selectAll.allSelected) {
            result["allSelected"] = true;
            if (this.selectAll.inverse)
                result["allSelectedInversed"] = true;
        }

        result["sortOptions"] = this.sortOptions ? this.sortOptions.filter(option => option.direction !== "").map(option => `${option.name}${option.direction === "DESC" ? " " + option.direction : ""}`).join("; ") : "";
        if (this.groupingInfo && this.groupingInfo.groupedBy)
            result["groupedBy"] = this.groupingInfo.groupedBy;

        if (this.persistentObject)
            result.persistentObject = this.persistentObject.toServiceObject();

        result.columns = this.columns.map(col => col._toServiceObject());

        return result;
    }

    _setResult(result: Dto.QueryResult) {
        this._lastResult = result;

        this.continuation = result.continuation;
        this.pageSize = result.pageSize || 0;

        if (this.pageSize > 0) {
            if (result.totalItems === -1) {
                result.totalItems = (this.skip || 0) + result.items.length;
                this._setHasMore(true);
            }
            else
                this._setHasMore(false);

            this._setTotalItems(result.totalItems || 0);
            this._queriedPages.push(Math.floor((this.skip || 0) / this.pageSize));
        }
        else
            this._setTotalItems(result.items.length);

        this.hasSearched = true;
        this._updateColumns(result.columns);
        this.items = result.items.map(item => this.service.hooks.onConstructQueryResultItem(this.service, item, this));
        this._updateGroupingInfo(result.groupingInfo);
        this._setSortOptionsFromService(result.sortOptions);

        this._setTotalItem(result.totalItem != null ? this.service.hooks.onConstructQueryResultItem(this.service, result.totalItem, this) : null);

        this.setNotification(result.notification, result.notificationType, result.notificationDuration);

        if ((this._charts && this._charts.length > 0) || (result.charts && result.charts.length > 0))
            this._setCharts(result.charts.map(c => new QueryChart(this, c.label, c.name, c.options, c.type)));

        this._setLastUpdated();
    }

    getColumn(name: string): QueryColumn {
        return this.columns.find(c => c.name === name);
    }

    get items(): QueryResultItem[] {
        return this._items;
    }

    private set items(items: QueryResultItem[]) {
        this.selectAll.inverse = this.selectAll.allSelected = false;
        this.selectedItems = [];

        const oldItems = this._items;
        this.notifyPropertyChanged("items", this._items = new Proxy(items, { get: this._getItemsLazy.bind(this) }), oldItems);
        this.notifyArrayChanged("items", 0, oldItems, items.length);
    }
    
    private _getItemsLazy(target: QueryResultItem[], property: string | symbol, receiver: any) {
        if (typeof property === "string") {
            const index = parseInt(property);
            if (!isNaN(index)) {
                const item = Reflect.get(target, index, receiver);
                if (item === undefined && !this.disableLazyLoading) {
                    if (this._queuedLazyItemIndexes)
                        this._queuedLazyItemIndexes.push(index);
                    else
                        this._queuedLazyItemIndexes = [index];
                    
                    clearTimeout(this._queuedLazyItemIndexesTimeout);
                    this._queuedLazyItemIndexesTimeout = setTimeout(async () => {
                        const queuedLazyItemIndexes = this._queuedLazyItemIndexes.filter(i => target[i] === null);
                        if (queuedLazyItemIndexes.length === 0)
                            return;

                        try {
                            await this.getItemsByIndex(...queuedLazyItemIndexes);
                        }
                        finally {
                            queuedLazyItemIndexes.forEach(i => {
                                if (target[i] == null)
                                    delete target[i];
                            });
                        }
                    }, 10);

                    return target[index] = null;
                }

                return item;
            }
            else if (property === "length")
                return this.totalItems;
            else if (property === "forEach") {
                // Run the forEach on target, which is a sparse array
                return (callback: (value: QueryResultItem, index: number, array: QueryResultItem[]) => void, thisArg?: any) => {
                    for (var key in target) {
                        const index = parseInt(key);
                        if (!isNaN(index)) {
                            const item = target[index];
                            if (item != null)
                                callback.call(thisArg, item, index, target);
                        }
                    }
                }
            }
            else if (property === "filter") {
                // Run the filter on target, which is a sparse array
                return (callback: (value: QueryResultItem, index: number, array: QueryResultItem[]) => boolean, thisArg?: any) => {
                    const result: QueryResultItem[] = [];
                    for (var key in target) {
                        const index = parseInt(key);
                        if (!isNaN(index)) {
                            const item = target[index];
                            if (item != null && callback.call(thisArg, item, index, target))
                                result.push(item);
                        }
                    }

                    return result;
                }
            }

            // Don't allow any of the other manipulations
            if (["push", "pop", "shift", "unshift", "splice", "reverse", "sort"].indexOf(property) >= 0)
                return undefined;
        }

        return Reflect.get(target, property, receiver);
    }

    async getItemsByIndex(...indexes: number[]): Promise<QueryResultItem[]> {
        if (!indexes || !indexes.length)
            return [];

        if (this.pageSize > 0) {
            const pages = indexes.sort((a, b) => a - b).reduce((acc: [page: number, top: number][], i) => {
                const page = Math.floor(i / this.pageSize);
                if (acc.length > 0) {
                    const last = acc[acc.length - 1];
                    if (last[0] * this.pageSize + last[1] <= i) {
                        if (last[0] * this.pageSize + last[1] + this.pageSize <= i)
                            acc.push([page, this.pageSize]);
                        else
                            last[1] += this.pageSize;
                    }
                }
                else
                    acc.push([page, this.pageSize]);
            
                return acc;
            }, []);

            await Promise.all(pages.map(page =>  this.getItems(page[0] * this.pageSize, page[1])));
        }

        return indexes.map(i => this.items[i]);
    }

    async getItems(start: number, length: number = this.pageSize, skipQueue: boolean = false): Promise<QueryResultItem[]> {
        if (!this.hasSearched) {
            await this.search({ delay: 0, throwExceptions: true });
            return this.getItems(start, length);
        }

        if (this.totalItems >= 0) {
            if (start > this.totalItems)
                start = this.totalItems;

            if (!this.hasMore && start + length > this.totalItems)
                length = this.totalItems - start;
        }

        if (this.pageSize <= 0 || length === 0)
            return this.items.slice(start, start + length);

        let startPage = Math.floor(start / this.pageSize);
        let endPage = Math.floor((start + length - 1) / this.pageSize);

        while (startPage < endPage && this._queriedPages.indexOf(startPage) >= 0)
            startPage++;
        while (endPage > startPage && this._queriedPages.indexOf(endPage) >= 0)
            endPage--;

        if (startPage === endPage && this._queriedPages.indexOf(startPage) >= 0)
            return this.items.slice(start, start + length);

        const clonedQuery = this.clone(this._asLookup);
        const skip = startPage * this.pageSize;
        clonedQuery.top = (endPage - startPage + 1) * this.pageSize;

        if (this.hasMore && this.items.length > 0 && this.continuation)
            clonedQuery.continuation = this.continuation;
        else
            clonedQuery.skip = skip;

        const work = async () => {
            if (!Array.range(startPage, endPage).some(p => this._queriedPages.indexOf(p) < 0))
                return this.items.slice(start, start + length);

            try {
                const result = await this.service.executeQuery(this.parent, clonedQuery, this._asLookup, true);

                if (result.totalItems === -1) {
                    this.continuation = result.continuation;
                    this._setHasMore(true);
                    result.totalItems = skip + result.items.length;
                    this._setTotalItems(result.totalItems);
                }
                else if (this.hasMore) {
                    this._setHasMore(false);
                    result.totalItems = skip + result.items.length;
                    this._setTotalItems(result.totalItems);
                }

                for (let p = startPage; p <= endPage; p++)
                    this._queriedPages.push(p);

                const isChanged = !this.hasMore && this.pageSize > 0 && result.totalItems !== this.totalItems;
                if (isChanged) {
                    // NOTE: Query has changed (items added/deleted) so remove old data
                    this._queriedPages = [];
                    for (let i = startPage; i <= endPage; i++)
                        this._queriedPages.push(i);

                    if (!this.selectAll.allSelected) {
                        /* tslint:disable:no-var-keyword */ var selectedItems = {}; /* tslint:enable:no-var-keyword */
                        this.selectedItems.forEach(i => selectedItems[i.id] = i);
                    }

                    this.items = [];
                    this._setTotalItems(result.totalItems);
                }

                let added: [number, any[], number];
                for (let n = 0; n < clonedQuery.top && (skip + n < result.totalItems); n++) {
                    const currentItem = this.items[skip + n];
                    if (currentItem == null) {
                        const item = this.items[skip + n] = this.service.hooks.onConstructQueryResultItem(this.service, result.items[n], this);
                        if (!added)
                            added = [skip, [], 0];

                        added[1].push(currentItem);
                        added[2]++;

                        if (this.selectAll.allSelected || (selectedItems && selectedItems[item.id]))
                            (<any>item)._isSelected = true;
                    }
                    else if (added) {
                        this.notifyArrayChanged("items", added[0], added[1], added[2]);
                        added = null;
                    }
                }

                if (!!added)
                    this.notifyArrayChanged("items", added[0], added[1], added[2]);

                this._updateGroupingInfo(result.groupingInfo);

                if (isChanged) {
                    const result = await this.getItems(start, length, true);
                    this.notifyPropertyChanged("items", this.items);

                    return result;
                }

                this._setLastUpdated();

                return this.items.slice(start, start + length);
            }
            catch (e) {
                this.setNotification(e);
                throw e;
            }
        };

        if (skipQueue)
            return work();
        
        return this.queueWork(work, false);
    }

    async search(options?: { delay?: number; throwExceptions?: boolean; keepSelection?: boolean }): Promise<QueryResultItem[]> {
        const selectedIds = options?.keepSelection ? this.selectedItems.map(i => i.id) : null;
        const search = () => {
            this.continuation = null;
            this._queriedPages = [];
            this.hasSearched = false;
            this._setTotalItems(null);
            this.items = [];

            const now = new Date();
            return this.queueWork(async () => {
                if (this._lastUpdated && this._lastUpdated > now)
                    return this.items;

                const result = await this.service.executeQuery(this.parent, this, this._asLookup, !!options?.throwExceptions);
                if (!result)
                    return null;

                if (!this._lastUpdated || this._lastUpdated <= now) {
                    this.hasSearched = true;
                    this._setResult(result);
                }

                return this.items;
            }, false).then(items => {
                if (selectedIds != null && selectedIds.length > 0) {
                    const newSelectionItems = selectedIds.map(id => items.find(i => i.id === id)).filter(i => i != null);
                    if (newSelectionItems.length === selectedIds.length)
                        this.selectedItems = newSelectionItems;
                }

                return items;
            });
        };

        if (options?.delay > 0) {
            const now = new Date();
            await new Promise(resolve => setTimeout(resolve, options?.delay));

            if (!this._lastUpdated || this._lastUpdated <= now)
                return search();
            else
                return this.items;
        }

        return search();
    }

    clone(asLookup: boolean = false): Query {
        return this.service.hooks.onConstructQuery(this.service, this, this.parent, asLookup);
    }

    private _updateColumns(_columns: any[] = []) {
        const oldColumns = this.columns ? this.columns.slice(0) : this.columns;
        const columns = this.columns || [];
        let columnsChanged = columns !== this.columns;

        const _columnsEnum = _columns || [];
        let i = columns.length;

        while (i--) {
            if (_columnsEnum.find(c => columns[i].name === c.name) == null) {
                let column = columns.splice(i, 1)[0];
                columns[column.name] = null;
                columnsChanged = true;
            }
        }
        _columns.forEach(c => {
            if (!columns[c.name]) {
                columns.push(columns[c.name] = this.service.hooks.onConstructQueryColumn(this.service, c, this));
                columnsChanged = true;
            }
        });

        columns.sort((c1, c2) => c1.offset - c2.offset);

        columns.forEach(c => {
            if (c.distincts)
                c.distincts.isDirty = true;
        });

        if (columnsChanged) {
            const newColumns = columns.slice();
            columns.forEach(c => newColumns[c.name] = c);

            this.notifyPropertyChanged("columns", this.columns = newColumns, oldColumns);
            if (this._columnObservers)
                this._columnObservers.forEach(c => c());

            this._columnObservers = this.columns.map(c => c.propertyChanged.attach(this._queryColumnPropertyChanged.bind(this)));
            this._updateIsFiltering();
        }

        this._setCanFilter(this.actions.some(a => a.name === "Filter") && this.columns.some(c => c.canFilter));
    }

    private _updateGroupingInfo(groupingInfo: Dto.QueryGroupingInfo) {
        if (!groupingInfo) {
            this._setGroupingInfo(null);
            return;
        }

        const currentGroupingInfo = this.groupingInfo;
        if (groupingInfo) {
            let start = 0;
            const notifier = () => this._setLastUpdated(new Date());
            this._setGroupingInfo({
                groupedBy: groupingInfo.groupedBy,
                groups: groupingInfo.groups.map(g => new QueryResultItemGroup(this, g, start, (start = start + g.count) - 1, notifier))
            });
        }
        else
            this._setGroupingInfo(null);

        if (currentGroupingInfo) {
            currentGroupingInfo.groups.forEach(oldGroup => {
                const newGroup = this.groupingInfo.groups.find(g => g.name === oldGroup.name);
                if (newGroup)
                    newGroup.isCollapsed = oldGroup.isCollapsed;
            });
        }
    }

    private _queryColumnPropertyChanged(sender: QueryColumn, args: PropertyChangedArgs) {
        if (args.propertyName === "selectedDistincts")
            this._updateIsFiltering();
    }

    _notifyItemSelectionChanged(item: QueryResultItem) {
        if (this._isSelectionModifying)
            return;

        let selectedItems = this.selectedItems;
        if (this.maxSelectedItems && selectedItems.length > this.maxSelectedItems) {
            try {
                this._isSelectionModifying = true;
                selectedItems.filter(i => i !== item && selectedItems.length > this.maxSelectedItems).forEach(i => i.isSelected = false);
                selectedItems = this.selectedItems;
            } finally {
                this._isSelectionModifying = false;
            }
        }

        this._updateSelectAll(item, selectedItems);

        this.notifyPropertyChanged("selectedItems", selectedItems);
    }

    private _updateSelectAll(item?: QueryResultItem, selectedItems: QueryResultItem[] = this.selectedItems) {
        if (this.selectAll.isAvailable) {
            if (this.selectAll.allSelected) {
                if (selectedItems.length > 0)
                    this.selectAll.inverse = selectedItems.length !== this.items.filter(i => !i.ignoreSelect).length;
                else
                    this.selectAll.allSelected = this.selectAll.inverse = false;
            }
            else if (selectedItems.length === this.totalItems)
                this.selectAll.allSelected = true;
        }
    }
}