import type { Query } from "./query.js"
import type { Service } from "./service.js"
import { ServiceObject } from "./service-object.js"
import type { QueryResultItemValue } from "./query-result-item-value.js"
import type { PersistentObject } from "./persistent-object.js"
import { PersistentObjectAttribute } from "./persistent-object-attribute.js"
import { DataType } from "./service-data-type.js"
import { _internal, QueryResultItemSymbols } from "./_internals.js";
import type * as Dto from "./typings/service.js";

/**
 * Represents a single item in a query result.
 */
export class QueryResultItem extends ServiceObject {
    #id: string;
    #ignoreSelect: boolean;
    #fullValuesByName: any;
    #values: any;
    #tag: any;
    #isSelected: boolean;
    #rawValues: QueryResultItemValue[];
    #typeHints: Record<string | symbol, any>;

    /**
     * Initializes a new instance of the QueryResultItem class.
     * 
     * @param service - The service instance to which this query result item belongs.
     * @param item - The raw item data from the query result.
     * @param query - The query that this result item is part of.
     * @param isSelected - Indicates whether this item is selected in the query result.
     */
    constructor(service: Service, item: Dto.QueryResultItemDto, public query: Query, isSelected: boolean) {
        super(service);

        this[QueryResultItemSymbols.IsQueryResultItem] = true;
        this[QueryResultItemSymbols.ToServiceObject] = this.#toServiceObject.bind(this);

        this.#id = item.id;
        this.#isSelected = isSelected;

        if (item.values) {
            const columnNames = query.columns.map(c => c.name);
            this.#rawValues = item.values.filter(v => columnNames.indexOf(v.key) >= 0).map(value => service.hooks.onConstructQueryResultItemValue(this.service, this, value));
        }
        else
            this.#rawValues = [];

        this.#typeHints = item.typeHints;
        this.#tag = item.tag;
    }

    /**
     * Gets the unique identifier for this query result item.
     */
    get id(): string {
        return this.#id;
    }

    /**
     * Returns a values object containing the deserialized values for each column in the query result item.
     */
    get values(): { [key: string]: any; } {
        if (!this.#values) {
            this.#values = {};
            this.#rawValues.forEach(v => {
                const col = this.query.columns[v.key];
                if (!col)
                    return;

                this.#values[v.key] = DataType.fromServiceString(v.value, col.type);
            });
        }

        return this.#values;
    }

    /**
     * Gets or sets whether this query result item is selected.
     * If `ignoreSelect` is true, setting this property will have no effect.
     * If `ignoreSelect` is true, the value will always return false.
     */
    get isSelected(): boolean {
        if (this.#ignoreSelect)
            return false;

        return this.#isSelected;
    }

    set isSelected(isSelected: boolean) {
        if (isSelected && this.ignoreSelect)
            return;

        const oldIsSelected = this.#isSelected;
        this.notifyPropertyChanged("isSelected", this.#isSelected = isSelected, oldIsSelected);

        _internal(this.query).notifyItemSelectionChanged(this, isSelected);
    }

    /**
     * Determines if the select action should be ignored based on type hints.
     * If the type hint "extraclass" contains "DISABLED" or "READONLY", selection is ignored.
     */
    get ignoreSelect(): boolean {
        if (typeof this.#ignoreSelect === "undefined")
            this.#ignoreSelect = this.getTypeHint("extraclass", "").toUpperCase().split(" ").some(c => c === "DISABLED" || c === "READONLY");

        return this.#ignoreSelect;
    }

    /**
     * Gets the tag associated with this query result item.
     */
    get tag(): any {
        return this.#tag;
    }

    /**
     * Gets the type hints for this query result item.
     */
    get typeHints(): Record<string | symbol, any> {
        return this.#typeHints ?? (this.#typeHints = {});
    }

    /**
     * Gets the value for a given column name from the query result item.
     * @param columnName - The name of the column to retrieve the value for.
     * @returns The value for the specified column name, or undefined if not found.
     */
    getValue(columnName: string): any {
        return this.values[columnName];
    }

    /**
     * Gets the full query result item value for a given key, including metadata.
     * If the value is not found, it returns null.
     * @param columnName - The name of the column to retrieve the value for.
     * @returns The full value object or null if not found.
     */
    getFullValue(columnName: string): QueryResultItemValue {
        if (!this.#fullValuesByName) {
            this.#fullValuesByName = {};
            this.#rawValues.forEach(v => {
                this.#fullValuesByName[v.key] = v;
            });
        }

        return this.#fullValuesByName[columnName] || (this.#fullValuesByName[columnName] = null);
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
     * Gets the persistent object associated with this query result item from the service.
     * @param throwExceptions - If true, exceptions will be thrown instead of being caught and returned as null.
     * @returns A promise that resolves to the persistent object associated with this query result item.
     */
    getPersistentObject(throwExceptions?: boolean): Promise<PersistentObject> {
        return this.query.queueWork(async () => {
            try {
                const po = await this.service.getPersistentObject(this.query.parent, this.query.persistentObject.id, this.id);
                po.ownerQuery = this.query;

                return po;
            }
            catch (e) {
                this.query.setNotification(e);
                if (throwExceptions)
                    throw e;

                return null;
            }
        }, false);
    }

    /**
     * Converts the query result item to a service object representation.
     * @returns The service object representation ready for transmission.
     */
    #toServiceObject(): Dto.QueryResultItemDto {
        return this._copyPropertiesFromValues({
            id: this.id,
            values: this.#rawValues.map(value => _internal(value).toServiceObject()),
        });
    }
}