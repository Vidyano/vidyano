import type { Service } from "./service.js"
import { ServiceObject } from "./service-object.js"
import type { QueryResultItem } from "./query-result-item.js"
import type { QueryColumn } from "./query-column.js"
import { PersistentObjectAttribute } from "./persistent-object-attribute.js"
import { DataType } from "./service-data-type.js"
import { QueryResultItemValueSymbols } from "./_internals.js"

/**
 * Represents a single value in a query result item.
 */
export class QueryResultItemValue extends ServiceObject {
    #item: QueryResultItem;
    #column: QueryColumn;
    #value: any;
    #valueParsed: boolean = false;
    #key: string;
    #rawValue: string;
    #typeHints: any;
    #persistentObjectId: string;
    #objectId: string;

    /**
     * Initializes a new instance of the QueryResultItemValue class.
     * 
     * @param service - The service instance to which this value belongs.
     * @param item - The parent QueryResultItem.
     * @param value - The raw value object from the service.
     */
    constructor(service: Service, item: QueryResultItem, value: any) {
        super(service);

        this[QueryResultItemValueSymbols.IsQueryResultItemValue] = true;
        this[QueryResultItemValueSymbols.ToServiceObject] = this.#toServiceObject.bind(this);

        this.#item = item;
        this.#key = value.key;
        this.#column = this.#item.query.getColumn(this.#key);
        this.#rawValue = value.value;
        this.#persistentObjectId = value.persistentObjectId;
        this.#objectId = value.objectId;
        this.#typeHints = value.typeHints;
    }

    /**
     * Gets the parent QueryResultItem.
     */
    get item(): QueryResultItem {
        return this.#item;
    }

    /**
     * Gets the column associated with this value.
     */
    get column(): QueryColumn {
        return this.#column;
    }

    /**
     * Gets the key (column name) for this value.
     */
    get key(): string {
        return this.#key;
    }

    /**
     * Gets the raw string value as received from the service.
     */
    get value(): string {
        return this.#rawValue;
    }

    /**
     * Gets the type hints for this value.
     */
    get typeHints(): any {
        return this.#typeHints;
    }

    /**
     * Gets the persistent object id associated with this value, if any.
     */
    get persistentObjectId(): string {
        return this.#persistentObjectId;
    }

    /**
     * Gets the object id associated with this value, if any.
     */
    get objectId(): string {
        return this.#objectId;
    }

    /**
     * Gets the type hint for a given name, with an optional default value.
     * @param name - The name of the type hint to retrieve.
     * @param defaultValue - The default value to return if the type hint is not found.
     * @param typeHints - Optional type hints object to use instead of the instance's typeHints.
     * @returns The type hint value or the default value if not found.
     */
    getTypeHint(name: string, defaultValue?: string, typeHints?: any): string {
        // Reuse the PersistentObjectAttribute's getTypeHint method to ensure consistent behavior
        return PersistentObjectAttribute.prototype.getTypeHint.apply(this, arguments);
    }

    /**
     * Gets the parsed value for this item, using the column's data type.
     * @returns The parsed value.
     */
    getValue(): any {
        if (this.#valueParsed)
            return this.#value;

        this.#value = DataType.fromServiceString(this.#rawValue, this.#column.type);
        this.#valueParsed = true;

        return this.#value;
    }

    /**
     * Internal: Converts the value to a service object representation.
     * @returns The service object representation ready for transmission.
     */
    #toServiceObject() {
        return this._copyPropertiesFromValues({
            key: this.#key,
            value: this.#rawValue,
            persistentObjectId: this.#persistentObjectId,
            objectId: this.#objectId
        });
    }
}