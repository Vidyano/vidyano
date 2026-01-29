import { Dto } from "@vidyano/core";
import { BusinessRuleValidator } from "./business-rules.js";
import { VirtualQueryRegistry } from "./registry/virtual-query-registry.js";
import { VirtualPersistentObject, VirtualPersistentObjectAttribute, createVirtualPersistentObject } from "./virtual-persistent-object.js";
import { VirtualQuery, VirtualQueryResultItem, createVirtualQuery } from "./virtual-query.js";
import { VirtualQueryExecuteResult, VirtualPersistentObjectConfig, VirtualPersistentObjectAttributeConfig } from "./types.js";
import type { VirtualService } from "./virtual-service.js";

/**
 * @internal
 */
export const initializeActions = Symbol("initializeActions");

/**
 * Base class for PersistentObject lifecycle methods
 * Extend this class to override lifecycle hooks like onLoad, onSave, onRefresh, etc.
 * All methods have default implementations, so you only need to override what you need.
 */
export class VirtualPersistentObjectActions {
    /**
     * Validator instance for business rule validation (injected by registry)
     */
    protected validator?: BusinessRuleValidator;

    /**
     * VirtualService instance for message translation (injected by registry)
     */
    protected service?: VirtualService;

    /**
     * The PersistentObject type name (injected by registry during instance creation)
     */
    protected type?: string;

    /**
     * Internal initialization method (called by registry during instance creation)
     * @internal
     */
    [initializeActions](validator: BusinessRuleValidator, service: VirtualService, type?: string): void {
        this.validator = validator;
        this.service = service;
        this.type = type;
    }

    /**
     * Called every time a PersistentObject DTO is created (both new and existing objects)
     * Use this to set metadata on attributes that can only be known at runtime
     * @param obj - The PersistentObject DTO being constructed
     */
    onConstruct(obj: VirtualPersistentObject): void {
        // Default implementation: do nothing
    }

    /**
     * Called when loading an existing object.
     * @param objectId - The ID of the object to load
     * @param parent - The parent PersistentObject if loaded in a master-detail context, null otherwise
     * @returns The PersistentObject with loaded data
     */
    async onLoad(objectId: string, parent: VirtualPersistentObject | null): Promise<VirtualPersistentObject> {
        const obj = await this.buildPersistentObject(objectId, false);
        this.onConstruct(obj);
        return obj;
    }

    /**
     * Called when creating a new object.
     * @param parent - The parent PersistentObject if creating from a detail query, null otherwise
     * @param query - The Query from which the New action was invoked, null if not from a query
     * @param parameters - Optional parameters including "MenuOption" if NewOptions exist
     * @returns The PersistentObject with default values set
     */
    async onNew(
        parent: VirtualPersistentObject | null,
        query: VirtualQuery | null,
        parameters: Record<string, string> | null
    ): Promise<VirtualPersistentObject> {
        const obj = await this.buildPersistentObject(crypto.randomUUID(), true);
        this.onConstruct(obj);
        return obj;
    }

    /**
     * Full query lifecycle - builds query, calls onConstructQuery, auto-executes if configured
     * Override this to customize how queries are retrieved
     * @param queryName - The name of the query to get
     * @param parent - The parent PersistentObject if this is a detail query, null otherwise
     * @returns The Query with results if autoQuery is enabled
     */
    async onGetQuery(queryName: string, parent: VirtualPersistentObject | null): Promise<VirtualQuery> {
        const query = await this.buildQuery(queryName);
        this.onConstructQuery(query, parent);
        if (query.autoQuery) {
            const executeResult = await this.onExecuteQuery(query, parent, this.getQueryData(queryName));
            query.result = VirtualQueryRegistry.buildQueryResultDto(executeResult, query.columns || [], query.pageSize || 20);
        }

        return query;
    }

    /**
     * Called when an attribute with triggersRefresh: true is changed
     * Use this to update other attributes based on the changed attribute
     * @param obj - The PersistentObject DTO in edit mode
     * @param attribute - The attribute that triggered the refresh (the one with triggersRefresh=true that was changed), wrapped with getValue/setValue
     * @returns The PersistentObject with refreshed attributes
     */
    async onRefresh(
        obj: VirtualPersistentObject,
        attribute: VirtualPersistentObjectAttribute | undefined
    ): Promise<VirtualPersistentObject> {
        // Default implementation: return obj as-is
        return obj;
    }

    /**
     * Called when the Save action is executed
     * Orchestrates the save process by calling saveNew or saveExisting based on obj.isNew
     * @param obj - The PersistentObject DTO to save
     * @returns The saved PersistentObject
     */
    async onSave(obj: VirtualPersistentObject): Promise<VirtualPersistentObject> {
        // Validate first - return with errors if invalid
        if (!this.checkRules(obj))
            return obj;

        // Delegate to saveNew or saveExisting based on isNew flag
        if (obj.isNew)
            return await this.saveNew(obj);
        else
            return await this.saveExisting(obj);
    }

    /**
     * Validates all attributes against their business rules
     * Override this to customize validation behavior
     * @param obj - The wrapped PersistentObject to validate (already has config metadata merged)
     * @returns true if all rules pass, false if any validation errors
     */
    checkRules(obj: VirtualPersistentObject): boolean {
        if (!this.validator || !obj.attributes)
            return true;

        let hasErrors = false;
        for (const attr of obj.attributes) {
            // Clear previous errors
            attr.validationError = undefined;

            // Get wrapped attribute (has getValue/setValue methods)
            const wrappedAttr = obj.getAttribute(attr.name);
            if (!wrappedAttr)
                continue;

            // Note: wrappedAttr.rules is already set from config via #wrapPersistentObject
            const error = this.validator.validateAttribute(wrappedAttr, obj);
            if (error) {
                attr.validationError = error;
                hasErrors = true;
            }
        }

        if (hasErrors)
            obj.setNotification(this.service!.getMessage("ValidationRulesFailed"), "Error");

        return !hasErrors;
    }

    /**
     * Called by onSave when obj.isNew === true
     * Use this to save a new entity to the data store
     * @param obj - The new PersistentObject DTO to save
     * @returns The saved PersistentObject
     */
    protected async saveNew(obj: VirtualPersistentObject): Promise<VirtualPersistentObject> {
        // Default implementation: return obj as-is (no persistence in mock)
        return obj;
    }

    /**
     * Called by onSave when obj.isNew === false
     * Use this to update an existing entity in the data store
     * @param obj - The existing PersistentObject DTO to save
     * @returns The saved PersistentObject
     */
    protected async saveExisting(obj: VirtualPersistentObject): Promise<VirtualPersistentObject> {
        // Default implementation: return obj as-is (no persistence in mock)
        return obj;
    }

    /**
     * Called when a reference attribute is changed (via changeReference() on a PersistentObjectAttributeWithReference)
     * The base implementation sets objectId, value, and isValueChanged on the reference attribute.
     * Override this to add custom logic after the reference is set.
     * @param parent - The PersistentObject that contains the reference attribute
     * @param referenceAttribute - The reference attribute that was changed
     * @param query - The query that was used to select the reference
     * @param selectedItem - The QueryResultItem that was selected, or null if reference was cleared
     */
    async onSelectReference(
        _parent: VirtualPersistentObject,
        referenceAttribute: VirtualPersistentObjectAttribute,
        _query: VirtualQuery,
        selectedItem: VirtualQueryResultItem | null
    ): Promise<void> {
        // Access reference-specific properties via the underlying DTO
        const refAttr = referenceAttribute as any;

        if (selectedItem == null) {
            // Clear the reference
            refAttr.objectId = null;
            referenceAttribute.value = null;
        }
        else {
            // Set the reference to the selected item
            refAttr.objectId = selectedItem.id;

            // Get the display value from the item using displayAttribute
            const displayAttribute = refAttr.displayAttribute;
            referenceAttribute.value = selectedItem.getValue(displayAttribute) || selectedItem.id;
        }

        referenceAttribute.isValueChanged = true;
    }

    /**
     * Called when the Delete action is executed on selected items in a Query
     * Use this to handle deletion of entities
     * @param parent - The parent PersistentObject if deleting from a detail query, null for top-level queries
     * @param query - The query from which items are being deleted
     * @param selectedItems - The QueryResultItems that are selected for deletion
     */
    async onDelete(
        parent: VirtualPersistentObject | null,
        query: VirtualQuery,
        selectedItems: VirtualQueryResultItem[]
    ): Promise<void> {
        // Default implementation: do nothing (no persistence in mock)
    }

    /**
     * Called when a Query of this PersistentObject type is constructed
     * Use this to set metadata on query columns that can only be known at runtime
     * @param query - The Query DTO being constructed
     * @param parent - The parent PersistentObject if this is a detail query, null for top-level queries
     */
    onConstructQuery(query: VirtualQuery, parent: VirtualPersistentObject | null): void {
        // Default implementation: do nothing
    }

    /**
     * Called when a Query is executed.
     * The base implementation calls getEntities() and applies text search, sorting, and pagination.
     * @param query - The Query DTO with textSearch, sortOptions, skip, top properties set
     * @param parent - The parent PersistentObject if this is a detail query, null for top-level queries
     * @param data - Default data from the query config (used if getEntities is not overridden)
     * @returns The items matching the query criteria and the total count before pagination
     */
    async onExecuteQuery(
        query: VirtualQuery,
        parent: VirtualPersistentObject | null,
        data: Record<string, any>[]
    ): Promise<VirtualQueryExecuteResult> {
        // Get all items from subclass or use provided data
        let result = await this.getEntities(query, parent, data);

        // Apply text search if provided
        if (query.textSearch && query.textSearch.trim() !== "") {
            const searchLower = query.textSearch.toLowerCase();
            const stringColumns = query.columns?.filter(c => c.type === "String" && !c.isHidden) || [];

            result = result.filter(row => {
                for (const column of stringColumns) {
                    const value = String(row[column.name] || "").toLowerCase();
                    if (value.includes(searchLower))
                        return true;
                }
                return false;
            });
        }

        // Apply sorting if provided
        if (query.sortOptions && query.sortOptions.trim() !== "") {
            const sortParts = query.sortOptions.split(";").map(s => s.trim()).filter(Boolean);
            const sortOptions = sortParts.map(part => {
                const [name, dir] = part.split(/\s+/);
                return { name, direction: dir?.toUpperCase() === "DESC" ? "DESC" : "ASC" };
            });

            result = [...result].sort((a, b) => {
                for (const { name, direction } of sortOptions) {
                    const aVal = a[name];
                    const bVal = b[name];

                    // Null handling
                    if (aVal == null && bVal == null) continue;
                    if (aVal == null) return direction === "ASC" ? -1 : 1;
                    if (bVal == null) return direction === "ASC" ? 1 : -1;

                    // Type-aware comparison
                    let cmp = 0;
                    if (typeof aVal === "boolean")
                        cmp = aVal === bVal ? 0 : (aVal ? 1 : -1);
                    else if (aVal instanceof Date && bVal instanceof Date)
                        cmp = aVal.getTime() - bVal.getTime();
                    else if (typeof aVal === "number" && typeof bVal === "number")
                        cmp = aVal - bVal;
                    else
                        cmp = String(aVal).toLowerCase().localeCompare(String(bVal).toLowerCase());

                    if (cmp !== 0)
                        return direction === "ASC" ? cmp : -cmp;
                }
                return 0;
            });
        }

        // Apply pagination
        const skip = query.skip || 0;
        const top = query.top || query.pageSize || 20;
        const items = result.slice(skip, skip + top);

        return {
            items,
            totalItems: result.length
        };
    }

    /**
     * Override this to provide the full list of items for a query.
     * The base onExecuteQuery will handle text search, sorting, and pagination automatically.
     * @param query - The Query DTO with textSearch, sortOptions properties set
     * @param parent - The parent PersistentObject if this is a detail query, null for top-level queries
     * @param data - Default data from the query config
     * @returns All items matching the query criteria (before pagination)
     */
    async getEntities(
        _query: VirtualQuery,
        _parent: VirtualPersistentObject | null,
        data: Record<string, any>[]
    ): Promise<Record<string, any>[]> {
        // Default implementation: return provided data (from query config)
        return [...data];
    }

    // === Internal helpers (moved from registries) ===

    /**
     * Builds a PersistentObject from configuration
     * @param objectId - The object ID
     * @param isNew - Whether this is a new object
     * @returns The wrapped VirtualPersistentObject
     */
    protected async buildPersistentObject(objectId: string, isNew: boolean): Promise<VirtualPersistentObject> {
        if (!this.type)
            throw new Error("Type is not set on VirtualPersistentObjectActions instance");

        const config = this.service!.persistentObjectRegistry.getConfig(this.type);
        if (!config)
            throw new Error(`PersistentObject type "${this.type}" is not registered`);

        const dto = await this.#buildPersistentObjectDto(config, objectId, isNew);

        // Auto-add Save action if onSave is overridden
        if (this.service!.actionsRegistry.isMethodOverridden(this.type, "onSave")) {
            if (!dto.actions.includes("Save"))
                dto.actions.push("Save");
        }

        return createVirtualPersistentObject(dto, this.service!);
    }

    /**
     * Builds a Query from configuration
     * @param name - The query name
     * @returns The wrapped VirtualQuery
     */
    protected async buildQuery(name: string): Promise<VirtualQuery> {
        const queryConfig = this.service!.queryRegistry.getQueryConfig(name);
        if (!queryConfig)
            throw new Error(`Query '${name}' is not registered`);

        const poConfig = this.service!.persistentObjectRegistry.getConfig(queryConfig.persistentObject);
        if (!poConfig)
            throw new Error(`PersistentObject type '${queryConfig.persistentObject}' is not registered`);

        const columns = this.service!.queryRegistry.getColumns(name);
        const dto = this.#buildQueryDto(queryConfig, columns, poConfig);

        // Auto-add New/Delete actions if methods are overridden
        const type = poConfig.type;
        if (this.service!.actionsRegistry.isMethodOverridden(type, "onNew")) {
            if (!dto.actions.includes("New"))
                dto.actions.push("New");
        }
        if (this.service!.actionsRegistry.isMethodOverridden(type, "onDelete")) {
            if (!dto.actions.includes("Delete"))
                dto.actions.push("Delete");
        }

        return createVirtualQuery(dto, queryConfig, this.service!);
    }

    /**
     * Executes queries that have isIncludedInParentObject set (defaults to true).
     * Called automatically after onLoad/onNew completes.
     * @param obj - The PersistentObject to execute queries for
     */
    async executeIncludedQueries(obj: VirtualPersistentObject): Promise<void> {
        if (!obj.queries)
            return;

        for (const query of obj.queries) {
            // Default is true - only skip if explicitly set to false
            if (query.isIncludedInParentObject === false)
                continue;

            const data = this.getQueryData(query.name!);
            const executeResult = await this.onExecuteQuery(query, obj, data);
            query.result = VirtualQueryRegistry.buildQueryResultDto(executeResult, query.columns || [], query.pageSize || 20);
        }
    }

    /**
     * Gets the default data for a query from configuration
     * @param name - The query name
     * @returns The default data array
     */
    protected getQueryData(name: string): Record<string, any>[] {
        return this.service!.queryRegistry.getData(name);
    }

    // === Private DTO building helpers ===

    async #buildPersistentObjectDto(
        config: VirtualPersistentObjectConfig,
        objectId: string,
        isNew: boolean
    ): Promise<Dto.PersistentObjectDto> {
        const id = crypto.randomUUID();
        const fullTypeName = `MockNamespace.${config.type}`;

        // Build attributes
        const attributes = await Promise.all(
            config.attributes.map((attr, index) => this.#buildAttributeDto(attr, index))
        );

        // Build tabs
        const tabs: Record<string, Dto.PersistentObjectTabDto> = {};
        if (config.tabs) {
            Object.entries(config.tabs).forEach(([key, tab]) => {
                tabs[key] = {
                    name: tab.name || key,
                    columnCount: tab.columnCount || 0,
                    id: tab.id,
                    layout: tab.layout
                };
            });
        } else {
            tabs[""] = { name: "", columnCount: 0 };
        }

        // Build action names
        const actions = config.actions ? [...config.actions] : [];

        // Build queries (detail queries)
        const queries: Dto.QueryDto[] = [];
        if (config.queries) {
            for (const queryName of config.queries) {
                const queryConfig = this.service!.queryRegistry.getQueryConfig(queryName);
                if (!queryConfig)
                    throw new Error(`Query '${queryName}' is not registered`);

                const poConfig = this.service!.persistentObjectRegistry.getConfig(queryConfig.persistentObject);
                if (!poConfig)
                    throw new Error(`PersistentObject type '${queryConfig.persistentObject}' is not registered`);

                const columns = this.service!.queryRegistry.getColumns(queryName);
                const queryDto = this.#buildQueryDto(queryConfig, columns, poConfig);
                queries.push(queryDto);
            }
        }

        return {
            id,
            objectId,
            type: config.type,
            fullTypeName,
            label: config.label || config.type,
            isNew,
            isReadOnly: false,
            stateBehavior: config.stateBehavior || "StayInEdit",
            attributes,
            actions,
            tabs,
            queries
        };
    }

    #buildQueryDto(
        config: { name: string; label?: string; allowTextSearch?: boolean; disableBulkEdit?: boolean; autoQuery?: boolean; pageSize?: number; actions?: string[]; itemActions?: string[] },
        columns: Dto.QueryColumnDto[],
        poConfig: VirtualPersistentObjectConfig
    ): Dto.QueryDto {
        // Build default actions
        const actions: string[] = ["RefreshQuery"];

        // Add custom query-level actions
        if (config.actions) {
            for (const actionName of config.actions)
                if (!actions.includes(actionName))
                    actions.push(actionName);
        }

        // Add custom item-level actions
        if (config.itemActions) {
            for (const actionName of config.itemActions)
                if (!actions.includes(actionName))
                    actions.push(actionName);
        }

        // Build minimal PersistentObjectDto for the query
        const persistentObject: Dto.PersistentObjectDto = {
            type: poConfig.type,
            id: crypto.randomUUID(),
            objectId: null,
            label: poConfig.type,
            fullTypeName: `Mock.${poConfig.type}`,
            isNew: false,
            isReadOnly: true,
            attributes: [],
            actions: [],
            tabs: {},
            queries: []
        };

        return {
            id: crypto.randomUUID(),
            name: config.name,
            label: config.label || config.name,
            columns,
            actions,
            allowTextSearch: config.allowTextSearch ?? true,
            disableBulkEdit: config.disableBulkEdit ?? false,
            autoQuery: config.autoQuery ?? true,
            pageSize: config.pageSize || 20,
            persistentObject,
            sortOptions: "",
            textSearch: "",
            skip: 0,
            top: config.pageSize || 20,
            totalItems: -1,
            canRead: true,
            canReorder: false,
            enableSelectAll: true
        };
    }

    async #buildAttributeDto(
        config: VirtualPersistentObjectAttributeConfig,
        index: number
    ): Promise<Dto.PersistentObjectAttributeDto> {
        const isRequired = BusinessRuleValidator.hasRequiredRule(config.rules);

        const baseDto: Dto.PersistentObjectAttributeDto = {
            id: config.id || crypto.randomUUID(),
            name: config.name,
            type: config.type || "String",
            label: config.label || config.name,
            value: config.value,
            isRequired,
            isReadOnly: config.isReadOnly || false,
            rules: config.rules,
            visibility: config.visibility || "Always",
            group: config.group || "",
            tab: config.tab || "",
            triggersRefresh: config.triggersRefresh || false,
            options: config.options,
            typeHints: config.typeHints,
            column: config.column,
            columnSpan: config.columnSpan || 4,
            offset: config.offset ?? index
        };

        // Handle Reference attributes with lookup
        if (config.lookup) {
            const lookupQueryConfig = this.service!.queryRegistry.getQueryConfig(config.lookup);
            if (!lookupQueryConfig)
                throw new Error(`Lookup query "${config.lookup}" is not registered`);

            const lookupPoConfig = this.service!.persistentObjectRegistry.getConfig(lookupQueryConfig.persistentObject);
            if (!lookupPoConfig)
                throw new Error(`PersistentObject type '${lookupQueryConfig.persistentObject}' is not registered`);

            const lookupColumns = this.service!.queryRegistry.getColumns(config.lookup);
            const lookupQuery = this.#buildQueryDto(lookupQueryConfig, lookupColumns, lookupPoConfig);

            // Determine displayAttribute
            let displayAttribute = config.displayAttribute;
            if (!displayAttribute && lookupQuery.columns && lookupQuery.columns.length > 0) {
                const firstVisibleColumn = lookupQuery.columns.find(c => !c.isHidden && c.name !== "Id");
                displayAttribute = firstVisibleColumn?.name || lookupQuery.columns[0].name;
            }
            if (!displayAttribute)
                displayAttribute = "Id";

            const refDto: Dto.PersistentObjectAttributeWithReferenceDto = {
                ...baseDto,
                type: "Reference",
                lookup: lookupQuery,
                objectId: config.value as string || null,
                displayAttribute,
                canAddNewReference: config.canAddNewReference ?? false,
                selectInPlace: config.selectInPlace ?? false
            };

            return refDto;
        }

        return baseDto;
    }
}
