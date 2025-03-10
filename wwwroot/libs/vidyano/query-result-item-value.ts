import type { Service } from "./service.js"
import { ServiceObject } from "./service-object.js"
import type { QueryResultItem } from "./query-result-item.js"
import type { QueryColumn } from "./query-column.js"
import { PersistentObjectAttribute } from "./persistent-object-attribute.js"
import { DataType } from "./service-data-type.js"

export class QueryResultItemValue extends ServiceObject {
    private _column: QueryColumn;
    private _value: any;
    private _valueParsed: boolean;

    key: string;
    value: string;
    typeHints: any;
    persistentObjectId: string;
    objectId: string;

    constructor(service: Service, private _item: QueryResultItem, value: any) {
        super(service);

        this.key = value.key;
        this._column = this._item.query.getColumn(this.key);
        this.value = value.value;
        this.persistentObjectId = value.persistentObjectId;
        this.objectId = value.objectId;
        this.typeHints = value.typeHints;
    }

    get item(): QueryResultItem {
        return this._item;
    }

    get column(): QueryColumn {
        return this._column;
    }

    getTypeHint(name: string, defaultValue?: string, typeHints?: any): string {
        return PersistentObjectAttribute.prototype.getTypeHint.apply(this, arguments);
    }

    getValue(): any {
        if (this._valueParsed)
            return this._value;

        this._value = DataType.fromServiceString(this.value, this._item.query.getColumn(this.key).type);
        this._valueParsed = true;

        return this._value;
    }

    _toServiceObject() {
        return this._copyPropertiesFromValues({
            key: this.key,
            value: this.value,
            persistentObjectId: this.persistentObjectId,
            objectId: this.objectId
        });
    }
}