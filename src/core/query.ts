import type * as Dto from "./typings/service.js"
import { ISubjectDisposer, PropertyChangedArgs } from "./observable"
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
import { PersistentObjectAttributeWithReference } from "./persistent-object-attribute-with-reference.js"
import { _internal, QuerySymbols } from "./_internals.js"
import { QuerySelectAll, IQuerySelectAll } from "./query-select-all.js";
import { QueryItems, QueryItemsProxy } from "./query-items.js";
import { CultureInfo } from "./cultures.js";

const clonedFrom = Symbol("clonedFrom");

/**
 * Represents the options for sorting a query.
 */
export interface ISortOption {
    /**
     * Gets or sets the name of the column to sort by.
     */
    name: string;
    /**
     * Gets or sets the direction of the sort.
     */
    direction: SortDirection;
}

/**
 * Represents a Vidyano query and provides methods to search, group, and manipulate its result set.
 * @inheritdoc
 */
export class Query extends ServiceObjectWithActions {
    #dto: Dto.QueryDto; // Used to store the original DTO object when cloning.
    #lastResult: Dto.QueryResultDto;
    #asLookup: boolean;
    #isSelectionModifying: boolean;
    #totalItems: number;
    #labelWithTotalItems: string;
    #sortOptions: ISortOption[];
    #queriedPages: number[] = [];
    #filters: QueryFilters;
    #allowTextSearch: boolean;
    #canFilter: boolean;
    #canRead: boolean;
    #canReorder: boolean;
    #charts: QueryChart[] = null;
    #defaultChartName: string = null;
    #currentChart: QueryChart = null;
    #lastUpdated: Date;
    #maxSelectedItems: number;
    #totalItem: QueryResultItem;
    #isSystem: boolean;
    #isFiltering: boolean;
    #columnObservers: ISubjectDisposer[];
    #hasMore: boolean = null;
    #groupingInfo: IQueryGroupingInfo;
    #itemsProxy!: QueryItemsProxy;
    #tag: any;

    #persistentObject: PersistentObject;
    #columns: QueryColumn[];
    #id: string;
    #name: string;
    #autoQuery: boolean;
    #isHidden: boolean;
    #hasSearched: boolean;
    #label: string;
    #singularLabel: string;
    #disableLazyLoading: boolean;
    #offset: number;
    #continuation: string;
    #selectAll: IQuerySelectAll;
    #ownerAttributeWithReference: PersistentObjectAttributeWithReference;
    #textSearch: string;

    /**
     * Gets or sets the page size for the query.
     */
    pageSize: number;

    /**
     * Gets or sets the offset for the query.
     */
    skip: number;

    /**
     * Gets or sets the number of items to retrieve from the query.
     */
    top: number;

    /**
     * Constructs a new Query instance.
     * @param service - The service instance.
     * @param queryDto - The query DTO containing the initial data.
     * @param parent - The parent persistent object, if any.
     * @param asLookup - Whether the query is used as a lookup.
     * @param maxSelectedItems - The maximum number of items that can be selected in the query.
     */
    constructor(service: Service, queryDto: Dto.QueryDto, public parent?: PersistentObject, asLookup: boolean = false, maxSelectedItems?: number) {
        super(service, queryDto.actions, queryDto.actionLabels);

        this[QuerySymbols.IsQuery] = true;
        this[QuerySymbols.NotifyItemSelectionChanged] = this.#notifyItemSelectionChanged.bind(this);
        this[QuerySymbols.SetOwnerAttributeWithReference] = this.#setOwnerAttributeWithReference.bind(this);
        this[QuerySymbols.ToServiceObject] = this.#toServiceObject.bind(this);

        const { result, ...dtoWithoutResult } = queryDto;
        this.#dto = dtoWithoutResult;

        this.#itemsProxy = new QueryItemsProxy(this);
        this.#asLookup = asLookup;
        this.#isSystem = !!queryDto.isSystem;
        this.#id = queryDto.id;
        this.#name = queryDto.name;
        this.#autoQuery = queryDto.autoQuery;

        this.#allowTextSearch = queryDto.allowTextSearch;
        this.#canRead = !!queryDto.canRead;
        this.#isHidden = queryDto.isHidden;
        this.#label = queryDto.label;
        this.#offset = queryDto.offset || 0;
        this.textSearch = queryDto.textSearch || "";
        this.pageSize = queryDto.pageSize;
        this.skip = queryDto.skip;
        this.top = queryDto.top;
        this.#continuation = queryDto.continuation;

        this.#maxSelectedItems = maxSelectedItems;

        this.#persistentObject = queryDto.persistentObject instanceof PersistentObject ? queryDto.persistentObject : service.hooks.onConstructPersistentObject(service, queryDto.persistentObject);
        this.#singularLabel = this.#persistentObject.label;

        this._initializeActions();

        this.#canReorder = !!queryDto.canReorder && !asLookup;

        this.#selectAll = new QuerySelectAll(this, (!!queryDto.isSystem || !!queryDto.enableSelectAll) && !this.maxSelectedItems && this.actions.some(a => a.isVisible && a.definition.selectionRule !== ExpressionParser.alwaysTrue), this.#selectAllPropertyChanged.bind(this));

        if (queryDto.disableBulkEdit) {
            const bulkEdit = <Action>this.actions["BulkEdit"];
            if (bulkEdit)
                bulkEdit.selectionRule = count => count === 1;
        }

        if (!!queryDto.groupedBy)
            this.#setGroupingInfo({ groupedBy: queryDto.groupedBy });

        // Only initialize these properties if we don't have an immediate result
        // When we have a result, these will be set in #setResult
        if (!result) {
            this.#updateColumns(queryDto.columns);
            this.#setTotalItems(queryDto.totalItems);
            this.#setSortOptionsFromService(queryDto.sortOptions);
            this.setNotification(queryDto.notification, queryDto.notificationType, queryDto.notificationDuration);
            this.#canFilter = this.actions.some(a => a.name === "Filter") && this.columns.some(c => c.canFilter);
            this.#tag = queryDto.tag;

            this.#setItems([]);
            this.#labelWithTotalItems = this.label;
            this.#lastUpdated = new Date();
        }
        else {
            this.#setResult(result);
        }

        if (queryDto.filters) {
            if (queryDto.filters instanceof QueryFilters)
                this.#filters = asLookup ? queryDto.filters.clone(this) : null;
            else
                this.#filters = new QueryFilters(this, service.hooks.onConstructPersistentObject(service, queryDto.filters));
        }
        else
            this.#filters = null;
    }

    /**
     * Gets whether this query is a system query.
     */
    get isSystem(): boolean {
        return this.#isSystem;
    }

    /**
     * Gets whether this query is a clone of another query.
     */
    get isClone(): boolean {
        return !!this.#dto[clonedFrom];
    }

    /**
     * Gets whether text search is allowed.
     */
    get allowTextSearch(): boolean {
        return this.#allowTextSearch;
    }

    /**
     * Gets the filters associated with this query.
     */
    get filters(): QueryFilters {
        return this.#filters;
    }

    /**
     * Gets whether the query can be filtered.
     */
    get canFilter(): boolean {
        return this.#canFilter;
    }
    #setCanFilter(val: boolean) {
        if (this.#canFilter === val)
            return;

        const oldValue = this.#canFilter;
        this.notifyPropertyChanged("canFilter", this.#canFilter = val, oldValue);
    }

    /**
     * Gets whether there are more items available for the query.
     * 
     * When a query uses continuation tokens:
     * - `hasMore` will be `true` while more pages are available
     * - `totalItems` will be `-1` until all pages are loaded
     * - Once the last page is loaded, `hasMore` becomes `false` and `totalItems` is updated to the actual count
     */
    get hasMore(): boolean {
        return this.#hasMore;
    }
    #setHasMore(val: boolean) {
        const oldValue = this.#hasMore;
        if (oldValue === val)
            return;

        this.notifyPropertyChanged("hasMore", this.#hasMore = val, oldValue);
    }

    /**
     * Gets whether the query can be read, i.e., whether the user has read permissions on the items.
     */
    get canRead(): boolean {
        return this.#canRead;
    }

    /**
     * Gets whether the query can be reordered.
     */
    get canReorder(): boolean {
        return this.#canReorder;
    }

    /**
     * Gets the charts associated with this query.
     */
    get charts(): QueryChart[] {
        return this.#charts;
    }
    #setCharts(charts: QueryChart[]) {
        if (this.#charts && charts && this.#charts.length > 0 && this.#charts.length === charts.length && this.#charts.orderBy(c => c.name).join("\n") === charts.orderBy(c => c.name).join("\n"))
            return;

        const oldCharts = this.#charts;
        this.notifyPropertyChanged("charts", this.#charts = charts, oldCharts);

        if (charts && this.defaultChartName && !this.currentChart)
            this.currentChart = this.charts.find(c => c.name === this.#defaultChartName);
    }

    /**
     * Gets or sets the current chart for this query.
     */
    get currentChart(): QueryChart {
        return this.#currentChart;
    }
    set currentChart(currentChart: QueryChart) {
        if (this.#currentChart === currentChart)
            return;

        const oldCurrentChart = this.#currentChart;
        this.notifyPropertyChanged("currentChart", this.#currentChart = currentChart !== undefined ? currentChart : null, oldCurrentChart);
    }

    /**
     * Gets or sets the default chart name for this query.
     */
    get defaultChartName(): string {
        return this.#defaultChartName;
    }
    set defaultChartName(defaultChart: string) {
        if (this.#defaultChartName === defaultChart)
            return;

        const oldDefaultChart = this.#defaultChartName;
        this.notifyPropertyChanged("defaultChartName", this.#defaultChartName = defaultChart !== undefined ? defaultChart : null, oldDefaultChart);

        if (this.charts && defaultChart && !this.currentChart)
            this.currentChart = this.charts.find(c => c.name === this.#defaultChartName);
    }

    /**
     * Gets the grouping information for this query.
     */
    get groupingInfo(): IQueryGroupingInfo {
        return this.#groupingInfo;
    }
    #setGroupingInfo(groupingInfo: IQueryGroupingInfo) {
        const oldValue = this.#groupingInfo;
        if (oldValue === groupingInfo)
            return;

        this.notifyPropertyChanged("groupingInfo", this.#groupingInfo = groupingInfo, oldValue);
    }

    /**
     * Gets the tag associated with this query.
     */
    get tag(): any {
        return this.#tag;
    }

    /**
     * Gets the date and time when the query was last updated.
     */
    get lastUpdated(): Date {
        return this.#lastUpdated;
    }
    #setLastUpdated(date: Date = new Date()) {
        if (this.#lastUpdated === date)
            return;

        const oldLastUpdated = this.#lastUpdated;
        this.notifyPropertyChanged("lastUpdated", this.#lastUpdated = date, oldLastUpdated);
    }

    /**
     * Gets or sets the maximum number of selected items allowed.
     */
    get maxSelectedItems(): number {
        return this.#maxSelectedItems;
    }
    set maxSelectedItems(maxSelectedItems: number) {
        if (this.#maxSelectedItems === maxSelectedItems)
            return;

        const oldValue = this.#maxSelectedItems;
        this.notifyPropertyChanged("maxSelectedItems", this.#maxSelectedItems = maxSelectedItems, oldValue);
    }

    /**
     * Gets or sets the selected items.
     */
    get selectedItems(): QueryResultItem[] {
        return this.items ? this.items.filter(i => i.isSelected) : [];
    }
    set selectedItems(items: QueryResultItem[]) {
        try {
            this.#isSelectionModifying = true;
            items = items.filter(i => !i.ignoreSelect) || [];

            const selectedItems = this.selectedItems;
            if (selectedItems && selectedItems.length > 0)
                selectedItems.forEach(item => item.isSelected = false);

            items.forEach(item => item.isSelected = true);
            this.notifyPropertyChanged("selectedItems", items);
        }
        finally {
            this.#isSelectionModifying = false;
        }
    }

    /**
     * Gets the persistent object associated with this query.
     */
    get persistentObject(): PersistentObject {
        return this.#persistentObject;
    }

    /**
     * Gets the columns of the query.
     */
    get columns(): QueryColumn[] {
        return this.#columns;
    }

    /**
     * Gets the unique identifier for this query.
     */
    get id(): string {
        return this.#id;
    }

    /**
     * Gets the name of the query.
     */
    get name(): string {
        return this.#name;
    }

    /**
     * Gets whether the query should be automatically executed.
     */
    get autoQuery(): boolean {
        return this.#autoQuery;
    }

    /**
     * Gets whether the query is hidden.
     */
    get isHidden(): boolean {
        return this.#isHidden;
    }

    /**
     * Gets whether the query has been searched, i.e., whether the search has been executed at least once or got the result during loading.
     */
    get hasSearched(): boolean {
        return this.#hasSearched;
    }
    #setHasSearched(hasSearched: boolean) {
        if (this.#hasSearched === hasSearched)
            return;

        const oldHasSearched = this.#hasSearched;
        this.notifyPropertyChanged("hasSearched", this.#hasSearched = hasSearched, oldHasSearched);
    }

    /**
     * Gets the label for the query.
     */
    get label(): string {
        return this.#label;
    }

    /**
     * Gets the singular label for the query.
     */
    get singularLabel(): string {
        return this.#singularLabel;
    }

    /**
     * Gets the offset for the query.
     */
    get offset(): number {
        return this.#offset;
    }

    /**
     * Gets the select all helper for the query.
     */
    get selectAll(): IQuerySelectAll {
        return this.#selectAll;
    }

    /**
     * Gets the owner attribute with reference for the query.
     */
    get ownerAttributeWithReference(): PersistentObjectAttributeWithReference {
        return this.#ownerAttributeWithReference;
    }
    #setOwnerAttributeWithReference(ownerAttributeWithReference: PersistentObjectAttributeWithReference) {
        if (this.#ownerAttributeWithReference === ownerAttributeWithReference)
            return;

        const oldOwnerAttributeWithReference = this.#ownerAttributeWithReference;
        this.notifyPropertyChanged("ownerAttributeWithReference", this.#ownerAttributeWithReference = ownerAttributeWithReference, oldOwnerAttributeWithReference);
    }

    /**
     * Gets or sets whether lazy loading is disabled.
     */
    get disableLazyLoading(): boolean {
        return this.#disableLazyLoading;
    }
    set disableLazyLoading(value: boolean) {
        this.#disableLazyLoading = value;
    }

    /**
     * Gets or sets the text search value for the query.
     */
    get textSearch(): string {
        return this.#textSearch;
    }
    set textSearch(value: string) {
        if (this.#textSearch === value)
            return;

        const oldValue = this.#textSearch;
        this.notifyPropertyChanged("textSearch", this.#textSearch = value, oldValue);
    }

    /**
     * Gets whether the query is used as a lookup.
     */
    get asLookup(): boolean {
        return this.#asLookup;
    }

    /**
     * Gets the total number of items in the query.
     * 
     * When a query uses continuation tokens (`hasMore` is `true`), this will be `-1` 
     * until all pages have been loaded. Once the last page is loaded, it will be 
     * updated to reflect the actual total count.
     */
    get totalItems(): number {
        return this.#totalItems;
    }

    /**
     * Gets the label with the total number of items.
     */
    get labelWithTotalItems(): string {
        return this.#labelWithTotalItems;
    }

    /**
     * Gets or sets the sort options for the query.
     */
    get sortOptions(): ISortOption[] {
        return this.#sortOptions;
    }
    set sortOptions(options: ISortOption[]) {
        if (this.#sortOptions === options)
            return;

        const oldSortOptions = this.#sortOptions;
        this.notifyPropertyChanged("sortOptions", this.#sortOptions = options || [], oldSortOptions);
    }

    /**
     * Gets the total item for the query.
     */
    get totalItem(): QueryResultItem {
        return this.#totalItem;
    }
    #setTotalItem(item: QueryResultItem) {
        if (this.#totalItem === item)
            return;

        const oldTotalItem = this.#totalItem;
        this.notifyPropertyChanged("totalItem", this.#totalItem = item, oldTotalItem);
    }

    /**
     * Gets whether the query is currently filtering.
     */
    get isFiltering(): boolean {
        return this.#isFiltering;
    }
    #updateIsFiltering() {
        let isFiltering = !!this.columns.find(c => !!c.selectedDistincts && c.selectedDistincts.length > 0);
        if (isFiltering === this.#isFiltering)
            return;

        const oldIsFiltering = this.#isFiltering;
        this.notifyPropertyChanged("isFiltering", this.#isFiltering = isFiltering, oldIsFiltering);
    }

    /**
     * Resets the filters for the query.
     * @returns A promise that resolves when the filters are reset.
     */
    async resetFilters() {
        if (!!this.#filters || !this.actions["Filter"])
            return;

        await this.queueWork(async () => {
            this.#filters = new QueryFilters(this, await this.service.getPersistentObject(null, "a0a2bd29-2921-43a6-a322-b2dcf4c895c2", this.id));
        });
    }

    /**
     * Selects a range of items in the query.
     * @param from - The starting index.
     * @param to - The ending index.
     * @returns True if the selection was updated; otherwise, false.
     */
    selectRange(from: number, to: number): boolean {
        let selectionUpdated: boolean;

        try {
            this.#isSelectionModifying = true;
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
            this.#isSelectionModifying = false;

            if (selectionUpdated)
                this.#updateSelectAll();
        }
    }

    /**
     * Groups the query by the specified column or column name.
     * @param column - The column to group by.
     * @returns A promise that resolves to the grouped query result items.
     */
    async group(column: QueryColumn): Promise<QueryResultItem[]>;
    /**
     * Groups the query by the specified column name.
     * @param by - The name of the column to group by.
     * @returns A promise that resolves to the grouped query result items.
     */
    async group(by: string): Promise<QueryResultItem[]>;
    async group(columnOrBy: (string | QueryColumn)): Promise<QueryResultItem[]> {
        const by = columnOrBy instanceof QueryColumn ? columnOrBy.name : columnOrBy;

        if (this.groupingInfo && this.groupingInfo.groupedBy === by)
            return;

        this.#updateGroupingInfo({
            groupedBy: by,
            groups: []
        });

        return this.search();
    }

    /**
     * Reorders items in the query.
     * @param before - The item before the moved item.
     * @param item - The item to move.
     * @param after - The item after the moved item.
     * @returns A promise that resolves to the reordered query result items.
     */
    async reorder(before: QueryResultItem, item: QueryResultItem, after: QueryResultItem): Promise<QueryResultItem[]> {
        if (!this.canReorder)
            throw "Unable to reorder, canReorder is set to false.";

        return await this.queueWork(async () => {
            try {
                const po = await this.service.executeAction("QueryOrder.Reorder", this.parent, this, [before, item, after]);
                this.#setResult((po.queries[0] as Query).#lastResult);

                return this.items;
            }
            catch (e) {
                return [];
            }
        });
    }

    /**
     * Gets the column with the specified name.
     * @param name - The name of the column.
     * @returns The query column with the specified name.
     */
    getColumn(name: string): QueryColumn {
        return this.columns.find(c => c.name === name);
    }

    /**
     * Gets the items of the query.
     */
    get items(): QueryItems {
        return this.#itemsProxy.items;
    }

    /**
     * Gets the items at the specified indexes.
     * @param indexes - The individual indexes of the items to retrieve. Each parameter is a specific index, not a range.
     * @returns A promise that resolves to an array containing the query result items at the specified indexes.
     * @example
     * // Get single item at index 0
     * const [firstItem] = await query.getItemsByIndex(0);
     * 
     * // Get multiple specific items at indexes 0, 2, and 5
     * const items = await query.getItemsByIndex(0, 2, 5); // Returns 3 items
     */
    async getItemsByIndex(...indexes: number[]): Promise<QueryResultItem[]> {

        if (!indexes || !indexes.length)
            return [];

        // Initialize the query if it hasn't been searched yet
        if (!this.hasSearched) {
            // Find the minimum index to start loading from
            const minIndex = Math.min(...indexes);

            // Use getItems to initialize the query starting from the minimum index
            // This will trigger a search with appropriate skip/top values
            await this.getItems(minIndex, this.pageSize || 1);
        }

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

    /**
     * Gets a range of items from the query.
     * @param start - The starting index.
     * @param length - The number of items to retrieve.
     * @param skipQueue - Whether to skip the queue.
     * @returns A promise that resolves to the query result items.
     */
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

        while (startPage < endPage && this.#queriedPages.indexOf(startPage) >= 0)
            startPage++;
        while (endPage > startPage && this.#queriedPages.indexOf(endPage) >= 0)
            endPage--;

        if (startPage === endPage && this.#queriedPages.indexOf(startPage) >= 0)
            return this.items.slice(start, start + length);

        const clonedQuery = this.clone(this.#asLookup);
        const skip = startPage * this.pageSize;
        clonedQuery.top = (endPage - startPage + 1) * this.pageSize;

        if (this.hasMore && this.items.length > 0 && this.#continuation)
            clonedQuery.#continuation = this.#continuation;
        else
            clonedQuery.skip = skip;

        const work = async () => {
            if (!Array.range(startPage, endPage).some(p => this.#queriedPages.indexOf(p) < 0))
                return this.items.slice(start, start + length);

            try {
                const result = await this.service.executeQuery(this.parent, clonedQuery, this.#asLookup, true);

                if (result.totalItems === -1) {
                    this.#continuation = result.continuation;
                    this.#setHasMore(true);
                    result.totalItems = skip + result.items.length;
                    this.#setTotalItems(result.totalItems);
                }
                else if (this.hasMore) {
                    this.#setHasMore(false);
                    result.totalItems = skip + result.items.length;
                    this.#setTotalItems(result.totalItems);
                }

                for (let p = startPage; p <= endPage; p++)
                    this.#queriedPages.push(p);

                const isChanged = !this.hasMore && this.pageSize > 0 && result.totalItems !== this.totalItems;
                if (isChanged) {
                    // NOTE: Query has changed (items added/deleted) so remove old data
                    this.#queriedPages = [];
                    for (let i = startPage; i <= endPage; i++)
                        this.#queriedPages.push(i);

                    if (!this.selectAll.allSelected) {
                        /* tslint:disable:no-var-keyword */ var selectedItems = {}; /* tslint:enable:no-var-keyword */
                        this.selectedItems.forEach(i => selectedItems[i.id] = i);
                    }

                    this.#setItems([]);
                    this.#setTotalItems(result.totalItems);
                }

                let notify: {
                    index: number;
                    removedItems: QueryResultItem[];
                };

                for (let n = 0; n < clonedQuery.top && (skip + n < result.totalItems); n++) {
                    const currentItem = this.items[skip + n];
                    if (currentItem == null) {
                        const newItem = result.items[n];
                        const isSelected = this.selectAll.allSelected || (selectedItems && selectedItems[newItem.id]);
                        
                        this.items[skip + n] = this.service.hooks.onConstructQueryResultItem(this.service, newItem, this, isSelected);
                        notify ||= {
                            index: skip,
                            removedItems: [],
                        };

                        notify.removedItems.push(currentItem);
                    }
                    else if (notify) {
                        this.notifyArrayChanged("items", notify.index, notify.removedItems, notify.removedItems.length);
                        notify = null;
                    }
                }

                if (!!notify)
                    this.notifyArrayChanged("items", notify.index, notify.removedItems, notify.removedItems.length);

                this.#updateGroupingInfo(result.groupingInfo);

                if (isChanged) {
                    const result = await this.getItems(start, length, true);
                    this.notifyPropertyChanged("items", this.items);

                    return result;
                }

                this.#setLastUpdated();

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

    /**
     * Searches the query with optional options.
     * @param options - The search options.
     * @returns A promise that resolves to the query result items.
     */
    async search(options?: { delay?: number; throwExceptions?: boolean; keepSelection?: boolean }): Promise<QueryResultItem[]> {
        const selectedIds = options?.keepSelection ? this.selectedItems.map(i => i.id) : null;
        const search = () => {
            this.#continuation = null;
            this.#queriedPages = [];
            this.#setHasSearched(false);
            this.#setTotalItems(null);
            this.#setItems([]);

            const now = new Date();
            return this.queueWork(async () => {
                if (this.#lastUpdated && this.#lastUpdated > now)
                    return this.items;

                const result = await this.service.executeQuery(this.parent, this, this.#asLookup, !!options?.throwExceptions);
                if (!result)
                    return null;

                if (!this.#lastUpdated || this.#lastUpdated <= now) {
                    this.#setHasSearched(true);
                    this.#setResult(result);
                }

                return this.items;
            }, false).then((items: any) => {
                if (selectedIds != null && selectedIds.length > 0) {
                    const newSelectionItems = selectedIds.map(id => items.find((i: QueryResultItem) => i?.id === id)).filter(i => i != null);
                    if (newSelectionItems.length === selectedIds.length)
                        this.selectedItems = newSelectionItems;
                }

                return items;
            });
        };

        if (options?.delay > 0) {
            const now = new Date();
            await new Promise(resolve => setTimeout(resolve, options?.delay));

            if (!this.#lastUpdated || this.#lastUpdated <= now)
                return search();
            else
                return this.items;
        }

        return search();
    }

    /**
     * Clones the query.
     * @param asLookup - Whether to clone as a lookup query.
     * @returns The cloned query.
     */
    clone(asLookup: boolean = false): Query {
        // Create a new DTO object based on the current state of the query.
        const dto = Object.assign({}, this.#dto, this.#toServiceObject());
        dto[clonedFrom] = this.#dto; // Mark the DTO as cloned from the original query DTO.
        
        const cloned = this.service.hooks.onConstructQuery(this.service, dto, this.parent, asLookup);
        cloned.#setOwnerAttributeWithReference(this.#ownerAttributeWithReference);

        return cloned;
    }

    /**
     * Converts the query to a service object.
     * @internal
     * @returns The service object representation of the query.
     */
    #toServiceObject() {
        const result = this._copyPropertiesFromValues({
            "id": this.id,
            "isSystem": this.isSystem,
            "name": this.name,
            "label": this.label,
            "pageSize": this.pageSize,
            "skip": this.skip,
            "top": this.top,
            "textSearch": this.textSearch,
            "continuation": this.#continuation
        });

        if (this.selectAll.allSelected) {
            result["allSelected"] = true;

            if (this.selectAll.inverse)
                result["allSelectedInversed"] = true;
        }

        result["sortOptions"] = this.sortOptions ? this.sortOptions.filter(option => option.direction !== "").map(option => {
            return `${option.name}${option.direction === "DESC" ? " " + option.direction : ""}`;
        }).join("; ") : "";
        result["groupedBy"] = this.groupingInfo?.groupedBy;

        if (this.persistentObject)
            result.persistentObject = this.persistentObject.toServiceObject();

        result.columns = this.columns.map(col => _internal(col).toServiceObject());

        return result;
    }

    /**
     * Sets the result for the query.
     * @param result - The query result DTO.
     */
    #setResult(result: Dto.QueryResultDto) {
        this.#lastResult = result;

        this.#continuation = result.continuation;
        this.pageSize = result.pageSize || 0;

        if (this.pageSize > 0) {
            if (result.totalItems === -1) {
                result.totalItems = (this.skip || 0) + result.items.length;
                this.#setHasMore(true);
            }
            else
                this.#setHasMore(false);

            this.#setTotalItems(result.totalItems || 0);
            this.#queriedPages.push(Math.floor((this.skip || 0) / this.pageSize));
        }
        else
            this.#setTotalItems(result.items.length);

        this.#setHasSearched(true);
        this.#updateColumns(result.columns);
        this.#setItems(result.items.map(item => this.service.hooks.onConstructQueryResultItem(this.service, item, this)));
        this.#updateGroupingInfo(result.groupingInfo);
        this.#setSortOptionsFromService(result.sortOptions);

        this.#setTotalItem(result.totalItem != null ? this.service.hooks.onConstructQueryResultItem(this.service, result.totalItem, this) : null);

        this.setNotification(result.notification, result.notificationType, result.notificationDuration);

        if ((this.#charts && this.#charts.length > 0) || (result.charts && result.charts.length > 0))
            this.#setCharts(result.charts.map(c => new QueryChart(this, c.label, c.name, c.options, c.type)));

        this.#tag = result.tag;
        this.#setLastUpdated();
    }

    /**
     * Handles property changes for the select all functionality.
     * @param selectAll - The select all instance.
     * @param args - The property changed arguments.
     */
    #selectAllPropertyChanged(selectAll: QuerySelectAll, args: PropertyChangedArgs) {
        if (args.propertyName === "allSelected")
            this.selectedItems = selectAll.allSelected ? this.items : [];
    }

    /**
     * Sets the sort options from the service.
     * @param options - The sort options as a string or an array of ISortOption.
     */
    #setSortOptionsFromService(options: string | ISortOption[]) {
        let newSortOptions: ISortOption[];
        if (typeof options === "string") {
            if (!String.isNullOrEmpty(options)) {
                newSortOptions = [];
                options.split(";").map(option => option.trim()).forEach(option => {
                    const optionParts = option.splitWithTail(" ", 2).map(option => option.trim());
                    newSortOptions.push({
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

    /**
     * Sets the total number of items in the query.
     * @param items - The total number of items.
     */
    #setTotalItems(items: number) {
        if (this.#totalItems === items)
            return;

        const oldTotalItems = this.#totalItems;
        this.notifyPropertyChanged("totalItems", this.#totalItems = items, oldTotalItems);

        const oldLabelWithTotalItems = this.#labelWithTotalItems;
        let formattedTotal = "";
        if (this.totalItems != null) {
            // Format number with thousand separators according to current culture
            try {
                const culture = CultureInfo.currentCulture || CultureInfo.invariantCulture;
                formattedTotal = new Intl.NumberFormat(culture?.name || undefined).format(this.totalItems);
            } catch {
                // Fall back to browser's default locale if culture formatting fails
                formattedTotal = new Intl.NumberFormat().format(this.totalItems);
            }
            formattedTotal += (this.hasMore ? "+" : "") + " ";
        }
        this.#labelWithTotalItems = formattedTotal + (this.totalItems !== 1 ? this.label : (this.singularLabel || this.persistentObject.label || this.persistentObject.type));
        this.notifyPropertyChanged("labelWithTotalItems", this.#labelWithTotalItems, oldLabelWithTotalItems);
    }

    /**
     * Sets the items for the query.
     * @param items - The items to set.
     */
    #setItems(items: QueryResultItem[]) {
        this.selectAll.inverse = this.selectAll.allSelected = false;
        this.selectedItems = [];

        const oldItems = this.items;
        this.#itemsProxy.setItems(items);
        this.notifyPropertyChanged("items", this.items, oldItems);
        this.notifyArrayChanged("items", 0, oldItems, items.length);
    }
    
    /**
     * Updates the columns of the query.
     * @param newColumns - The new columns to update.
     */
    #updateColumns(newColumns: any[] = []) {
        const oldColumns = this.columns ? this.columns.slice(0) : this.columns;
        const columns = this.columns || [];
        let columnsChanged = columns !== this.columns;

        const _columnsEnum = newColumns || [];
        let i = columns.length;

        while (i--) {
            if (_columnsEnum.find(c => columns[i].name === c.name) == null) {
                let column = columns.splice(i, 1)[0];
                columns[column.name] = null;
                columnsChanged = true;
            }
        }
        newColumns.forEach(c => {
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

            this.notifyPropertyChanged("columns", this.#columns = newColumns, oldColumns);
            if (this.#columnObservers)
                this.#columnObservers.forEach(c => c());

            this.#columnObservers = this.columns.map(c => c.propertyChanged.attach(this.#queryColumnPropertyChanged.bind(this)));
            this.#updateIsFiltering();
        }

        this.#setCanFilter(this.actions.some(a => a.name === "Filter") && this.columns.some(c => c.canFilter));
    }

    /**
     * Updates the grouping information for the query.
     * @param groupingInfo - The grouping information to update.
     */
    #updateGroupingInfo(groupingInfo: Dto.QueryGroupingInfoDto) {
        if (!groupingInfo) {
            this.#setGroupingInfo(null);
            return;
        }

        // Preserve UI state by remembering which groups are currently collapsed.
        const oldCollapsedStates = new Map<string, boolean>();
        if (this.groupingInfo?.groups?.length) {
            for (const group of this.groupingInfo.groups.filter(g => g.isCollapsed))
                oldCollapsedStates.set(group.name, true);
        }

        // Calculates the running start index for each group's items.
        let start = 0;

        // Callback for group items to notify the query of state changes (e.g., collapse/expand).
        const notifier = () => this.#setLastUpdated(new Date());
        
        const newGroups = (groupingInfo.groups || []).map(g => {
            const group = new QueryResultItemGroup(this, g, start, (start = start + g.count) - 1, notifier);
            if (oldCollapsedStates.has(group.name)) {
                group.isCollapsed = true;
            }
            return group;
        });

        this.#setGroupingInfo({
            groupedBy: groupingInfo.groupedBy,
            groups: newGroups
        });
    }

    /**
     * Handles property changes for query columns.
     * @param sender - The query column that changed.
     * @param args - The property changed arguments.
     */
    #queryColumnPropertyChanged(sender: QueryColumn, args: PropertyChangedArgs) {
        if (args.propertyName === "selectedDistincts")
            this.#updateIsFiltering();
    }

    /**
     * Notifies that the selection of an item has changed.
     * @param item - The item whose selection has changed.
     */
    #notifyItemSelectionChanged(item: QueryResultItem) {
        if (this.#isSelectionModifying)
            return;

        let selectedItems = this.selectedItems;
        if (this.maxSelectedItems && selectedItems.length > this.maxSelectedItems) {
            try {
                this.#isSelectionModifying = true;
                selectedItems.filter(i => i !== item && selectedItems.length > this.maxSelectedItems).forEach(i => i.isSelected = false);
                selectedItems = this.selectedItems;
            } finally {
                this.#isSelectionModifying = false;
            }
        }

        this.#updateSelectAll(item, selectedItems);

        this.notifyPropertyChanged("selectedItems", selectedItems);
    }

    /**
     * Updates the select all helper based on the current selection.
     * @param item - The item that was selected or deselected, if any.
     * @param selectedItems - The currently selected items, defaults to the current selection.
     */
    #updateSelectAll(item?: QueryResultItem, selectedItems: QueryResultItem[] = this.selectedItems) {
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