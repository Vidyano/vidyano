import { VirtualPersistentObject, VirtualPersistentObjectAttribute } from "./virtual-persistent-object.js";
import { VirtualQuery, VirtualQueryResultItem } from "./virtual-query.js";
import { VirtualQueryExecuteResult } from "./types.js";
import type { BusinessRuleValidator } from "./business-rules.js";
import type { VirtualService } from "./virtual-service.js";

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
     * Sets the validator instance (called by registry during instance creation)
     * @internal
     */
    setValidator(validator: BusinessRuleValidator): void {
        this.validator = validator;
    }

    /**
     * Sets the VirtualService instance (called by registry during instance creation)
     * @internal
     */
    setService(service: VirtualService): void {
        this.service = service;
    }

    /**
     * Gets a translated message using the service's getMessage method
     * Falls back to key if service is not set
     */
    protected getMessage(key: string, ...params: any[]): string {
        if (!this.service)
            return key;

        return this.service.getMessage(key, ...params);
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
     * Called when loading an existing PersistentObject by ID
     * Use this to load entity data and populate attribute values
     * @param obj - The constructed PersistentObject DTO (after onConstruct)
     * @param parent - The parent PersistentObject if loaded in a master-detail context, null otherwise
     * @returns The PersistentObject with loaded data
     */
    async onLoad(obj: VirtualPersistentObject, parent: VirtualPersistentObject | null): Promise<VirtualPersistentObject> {
        // Default implementation: return obj as-is
        return obj;
    }

    /**
     * Called when creating a new PersistentObject via the "New" action
     * Use this to create a fresh entity instance with default values
     * @param obj - The constructed PersistentObject DTO (after onConstruct)
     * @param parent - The parent PersistentObject if creating from a detail query, null otherwise
     * @param query - The Query from which the New action was invoked, null if not from a query
     * @param parameters - Optional parameters including "MenuOption" if NewOptions exist
     * @returns The PersistentObject with default values set
     */
    async onNew(
        obj: VirtualPersistentObject,
        parent: VirtualPersistentObject | null,
        query: VirtualQuery | null,
        parameters: Record<string, string> | null
    ): Promise<VirtualPersistentObject> {
        // Default implementation: return obj as-is
        return obj;
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
            obj.setNotification(this.getMessage("ValidationRulesFailed"), "Error");

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
}
