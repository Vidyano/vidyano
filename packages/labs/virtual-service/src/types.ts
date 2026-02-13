import { Dto } from "@vidyano/core";
import type { VirtualPersistentObject } from "./virtual-persistent-object.js";
import type { VirtualQuery, VirtualQueryResultItem } from "./virtual-query.js";

export interface TypeConverter {
    toServiceValue(value: any): string;
    fromServiceValue(value: string): any;
}

/**
 * Simplified attribute configuration - converted to PersistentObjectAttributeDto
 */
export type VirtualPersistentObjectAttributeConfig = {
    /**
     * Optional fixed id for this attribute. If not provided, a random UUID is generated.
     */
    id?: string;

    /**
     * The unique name of the attribute.
     */
    name: string;

    /**
     * The type of the data. Defaults to "String".
     */
    type?: string;

    /**
     * The label of the attribute. Defaults to name.
     */
    label?: string;

    /**
     * Initial value for the attribute.
     */
    value?: any;

    /**
     * Indicates whether the value of this attribute can be changed. Defaults to false.
     */
    isReadOnly?: boolean;

    /**
     * A semicolon separated list of business rules that should be checked when saving this attribute.
     * @example "NotEmpty; MaxLength(40)"
     */
    rules?: string;

    /**
     * The visibility of this attribute.
     */
    visibility?: Dto.PersistentObjectAttributeVisibility;

    /**
     * The name of the group to which this attribute belongs. Defaults to "".
     */
    group?: string;

    /**
     * The name of the tab to which this attribute belongs. Defaults to "".
     */
    tab?: string;

    /**
     * Gets whether the persistent object is refreshed when this attribute is changed. Defaults to false.
     */
    triggersRefresh?: boolean;

    /**
     * A list of predefined options to choose the attribute value from.
     */
    options?: string[];

    /**
     * Type hints for this attribute.
     */
    typeHints?: Record<string, string>;

    /**
     * The column that should be used when displaying this attribute.
     */
    column?: number;

    /**
     * The column span that should be used when displaying this attribute. Defaults to 4.
     */
    columnSpan?: number;

    /**
     * The position of this attribute when displayed.
     */
    offset?: number;

    /**
     * Indicates whether this attribute can be used to sort the query. Defaults to true for most types.
     */
    canSort?: boolean;

    /**
     * For Reference attributes: the name of the registered query to use as a lookup.
     */
    lookup?: string;

    /**
     * For Reference attributes: the attribute name to use for displaying the reference value. Defaults to the first attribute.
     */
    displayAttribute?: string;

    /**
     * For Reference attributes: whether the user can add a new reference. Defaults to false.
     */
    canAddNewReference?: boolean;

    /**
     * For Reference attributes: whether to use a fixed list of possible references. Defaults to false.
     */
    selectInPlace?: boolean;
};

/**
 * Unified action handler arguments (matches C# CustomAction pattern)
 */
export type ActionArgs = {
    /**
     * The parent PersistentObject (like args.Parent in C#)
     * For PersistentObject actions: the PersistentObject itself
     * For Query actions: the parent PO that owns the query, or null for top-level queries
     */
    parent: VirtualPersistentObject | null;

    /**
     * The query context (like args.Query in C#) - present if action invoked from query
     */
    query?: VirtualQuery;

    /**
     * Selected items (like args.SelectedItems in C#) - present if query action with selections
     */
    selectedItems?: VirtualQueryResultItem[];

    /**
     * Additional parameters (like args.Parameters in C#)
     */
    parameters?: Record<string, any>;
};

/**
 * Unified action handler (matches C# CustomAction Execute signature)
 * Return the PersistentObject to refresh UI, or null to complete silently
 */
export type ActionHandler = (
    args: ActionArgs
) => Promise<VirtualPersistentObject | null> | VirtualPersistentObject | null;

/**
 * Action configuration
 */
export type ActionConfig = {
    /**
     * The name of the action.
     */
    name: string;

    /**
     * The display name for the action. Defaults to name.
     */
    displayName?: string;

    /**
     * Indicates whether the action is pinned. Defaults to false.
     */
    isPinned?: boolean;
};

/**
 * PersistentObject configuration - converted to PersistentObjectDto
 */
export type VirtualPersistentObjectConfig = {
    /**
     * The type of the persistent object.
     */
    type: string;

    /**
     * For singleton objects, the id.
     */
    id?: string;

    /**
     * The attributes of this persistent object.
     */
    attributes: VirtualPersistentObjectAttributeConfig[];

    /**
     * The actions allowed for this persistent object (reference by name).
     */
    actions?: string[];

    /**
     * Query names to attach as detail queries (reference by name).
     */
    queries?: string[];

    /**
     * The tab information for the persistent object.
     */
    tabs?: Record<string, Partial<Dto.PersistentObjectTabDto>>;

    /**
     * A set of extra options that influence the state of the persistent object.
     */
    stateBehavior?: Dto.PersistentObjectStateBehavior;

    /**
     * The label of the persistent object.
     */
    label?: string;
};

/**
 * Result returned from onExecuteQuery
 */
export type VirtualQueryExecuteResult = {
    /**
     * The items to display (already filtered, sorted, and paginated by your implementation)
     */
    items: Record<string, any>[];

    /**
     * Total number of items matching the query (before pagination)
     */
    totalItems: number;
};

/**
 * Query configuration - converted to QueryDto
 */
export type VirtualQueryConfig = {
    /**
     * Query name (e.g., "People")
     */
    name: string;

    /**
     * Display label (defaults to name)
     */
    label?: string;

    /**
     * Type name of already-registered PersistentObject (REQUIRED)
     * MUST reference an already-registered PersistentObject by type name
     */
    persistentObject: string;

    /**
     * Default data for the query. When executeQuery is not overridden in the
     * VirtualPersistentObjectActions class, this data will be used.
     * Text search, sorting, and pagination are applied automatically.
     */
    data?: Record<string, any>[];

    /**
     * Query-level actions (reference by name, e.g., "New", "Export")
     */
    actions?: string[];

    /**
     * Item-level actions (reference by name, e.g., "Edit", "Delete")
     */
    itemActions?: string[];

    /**
     * Enable text search (default: true)
     */
    allowTextSearch?: boolean;

    /**
     * Disable bulk edit (default: false)
     */
    disableBulkEdit?: boolean;

    /**
     * Auto-execute on load (default: true). If false, getQuery returns empty result
     */
    autoQuery?: boolean;

    /**
     * Page size (default: 20)
     */
    pageSize?: number;
};
