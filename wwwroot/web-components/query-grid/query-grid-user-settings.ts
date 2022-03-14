import * as Vidyano from "../../libs/vidyano/vidyano"
import { QueryGridColumn, IQueryGridUserSettingsColumnData } from "./query-grid-column"

export class QueryGridUserSettings extends Vidyano.Observable<QueryGridUserSettings> {
    private _columnsByName: { [key: string]: QueryGridColumn; } = {};
    private _columns: QueryGridColumn[] = [];

    private constructor(private _query: Vidyano.Query, data: { [key: string]: IQueryGridUserSettingsColumnData; } = {}) {
        super();

        this._columns = this._query.columns.filter(c => c.width !== "0").map(c => this._columnsByName[c.name] = new QueryGridColumn(c, data[c.name] || {
            offset: c.offset,
            isPinned: c.isPinned,
            isHidden: c.isHidden,
            width: c.width
        }));
    }

    getColumn(name: string): QueryGridColumn {
        return this._columnsByName[name];
    }

    get query(): Vidyano.Query {
        return this._query;
    }

    get columns(): QueryGridColumn[] {
        return this._columns;
    }

    async save(refreshOnComplete: boolean = true): Promise<any> {
        let queryData: { [key: string]: IQueryGridUserSettingsColumnData; };
        const columnData = (name: string) => (queryData || (queryData = {}))[name] || (queryData[name] = {});

        this._columns.forEach(c => {
            if (c.offset !== c.column.offset)
                columnData(c.name).offset = c.offset;

            if (c.isPinned !== c.column.isPinned)
                columnData(c.name).isPinned = c.isPinned;

            if (c.isHidden !== c.column.isHidden)
                columnData(c.name).isHidden = c.isHidden;

            if (c.width !== c.column.width)
                columnData(c.name).width = c.width;
        });

        if (queryData)
            this._query.service.application.userSettings["QueryGridSettings"][this._query.id] = queryData;
        else if (this._query.service.application.userSettings["QueryGridSettings"][this._query.id])
            delete this._query.service.application.userSettings["QueryGridSettings"][this._query.id];

        await this._query.service.application.saveUserSettings();
        if (refreshOnComplete)
            this.notifyPropertyChanged("columns", this._columns = this.columns.slice());
    }

    static Load(query: Vidyano.Query): QueryGridUserSettings {
        const queryGridSettings = query.service.application.service.application.userSettings["QueryGridSettings"] || (query.service.application.userSettings["QueryGridSettings"] = {});
        return new QueryGridUserSettings(query, queryGridSettings[query.id]);
    }
}