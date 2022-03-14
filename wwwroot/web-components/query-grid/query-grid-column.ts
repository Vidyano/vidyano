import * as Vidyano from "../../libs/vidyano/vidyano"

export interface IQueryGridUserSettingsColumnData {
    offset?: number;
    isPinned?: boolean;
    isHidden?: boolean;
    width?: string;
}

export class QueryGridColumn extends Vidyano.Observable<QueryGridColumn> implements IQueryGridUserSettingsColumnData {
    calculatedWidth: number;
    calculatedOffset: number;

    constructor(private _column: Vidyano.QueryColumn, private _userSettingsColumnData: IQueryGridUserSettingsColumnData) {
        super();
    }

    get column(): Vidyano.QueryColumn {
        return this._column;
    }

    get query(): Vidyano.Query {
        return this._column.query;
    }

    get name(): string {
        return this._column.name;
    }

    get label(): string {
        return this._column.label;
    }

    get type(): string {
        return this._column.type;
    }

    get canSort(): boolean {
        return this._column.canSort;
    }

    get canGroupBy(): boolean {
        return this._column.canGroupBy;
    }

    get canFilter(): boolean {
        return this._column.canFilter;
    }

    get canListDistincts(): boolean {
        return this._column.canListDistincts;
    }

    get sortDirection(): Vidyano.SortDirection {
        return this._column.sortDirection;
    }

    get distincts(): Vidyano.IQueryColumnDistincts {
        return this._column.distincts;
    }

    get offset(): number {
        return this._userSettingsColumnData.offset != null ? this._userSettingsColumnData.offset : this._column.offset;
    }

    set offset(offset: number) {
        this._userSettingsColumnData.offset = offset;
    }

    get isPinned(): boolean {
        return this._userSettingsColumnData.isPinned != null ? this._userSettingsColumnData.isPinned : this._column.isPinned;
    }

    set isPinned(isPinned: boolean) {
        const wasPinned = !!this._userSettingsColumnData.isPinned;
        if (wasPinned === isPinned)
            return;

        this.notifyPropertyChanged("isPinned", this._userSettingsColumnData.isPinned = isPinned, wasPinned);
    }

    get isHidden(): boolean {
        return this._userSettingsColumnData.isHidden != null ? this._userSettingsColumnData.isHidden : this._column.isHidden;
    }

    set isHidden(isHidden: boolean) {
        this._userSettingsColumnData.isHidden = isHidden;
    }

    get width(): string {
        return this._userSettingsColumnData.width != null ? this._userSettingsColumnData.width : this._column.width;
    }

    set width(width: string) {
        this._userSettingsColumnData.width = width;
    }

    reset() {
        this.calculatedWidth = this.calculatedOffset = undefined;
    }
}