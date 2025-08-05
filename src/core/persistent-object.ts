import * as Dto from "./typings/service.js"
import type { Action } from "./action.js"
import type { Query } from "./query.js"
import type { Service } from "./service.js"
import type { PersistentObjectAttributeGroup } from "./persistent-object-attribute-group.js"
import { ServiceObjectWithActions } from "./service-object-with-actions.js"
import { PersistentObjectAttribute } from "./persistent-object-attribute.js"
import { PersistentObjectAttributeAsDetail } from "./persistent-object-attribute-as-detail.js"
import { PersistentObjectAttributeWithReference } from "./persistent-object-attribute-with-reference.js"
import { PersistentObjectTab, PersistentObjectAttributeTab, PersistentObjectQueryTab } from "./persistent-object-tab.js"
import { _internal, PersistentObjectSymbols } from "./_internals.js"

export { PersistentObjectLayoutMode, PersistentObjectStateBehavior } from "./typings/service.js";

/**
 * Symbol used to backup the DTO of a persistent object.
 * This is used to restore the state when canceling edits.
 */
const _dtoBackup = Symbol("PersistentObject_DtoBackup");

/**
 * Options for persistent object save action.
 */
export interface IPersistentObjectSaveOptions {    
    /**
     * If true, throw exceptions for when the notification type is "Error". Default is true.
     */
    throwExceptions?: boolean;

    /**
     * If true, wait for the owner query to refresh after save. Default is false.
     */
    waitForOwnerQuery?: boolean;
}

/**
 * Handles the state and operations for persistent objects, including editing,
 * saving, refreshing data, and managing attributes and tabs.
 */
export class PersistentObject extends ServiceObjectWithActions {
    readonly #isSystem: boolean;
    #lastUpdated: Date;
    #securityToken: string;
    #isEditing: boolean = false;
    #isDirty: boolean = false;
    readonly #id: string;
    readonly #type: string;
    #breadcrumb: string;
    #isDeleted: boolean;
    #tabs: PersistentObjectTab[];
    #isFrozen: boolean = false;
    #tag: any;
    readonly #isBreadcrumbSensitive: boolean;
    readonly #forceFromAction: boolean;
    readonly #fullTypeName: string;
    readonly #label: string;
    #objectId: string;
    readonly #isHidden: boolean;
    readonly #isReadOnly: boolean;
    readonly #queryLayoutMode: Dto.PersistentObjectLayoutMode;
    readonly #newOptions: string;
    #stateBehavior: string;
    readonly #dialogSaveAction: Action;
    
    /**
     * The parent persistent object, if any.
     */
    parent: PersistentObject;
    
    /**
     * The owner detail attribute, if this object is part of a detail attribute.
     */
    ownerDetailAttribute: PersistentObjectAttributeAsDetail;
    
    /**
     * The owner attribute with reference, if this object is referenced by an attribute.
     */
    ownerAttributeWithReference: PersistentObjectAttributeWithReference;
    
    /**
     * The owner persistent object, if this object belongs to another.
     */
    ownerPersistentObject: PersistentObject;
    
    /**
     * The owner query, if this object belongs to a query.
     */
    ownerQuery: Query;
    
    /**
     * Array of object IDs for bulk operations.
     */
    readonly bulkObjectIds: string[];
    
    /**
     * Queries that need to be refreshed.
     */
    readonly queriesToRefresh: string[] = [];
    
    /**
     * The attributes of this persistent object.
     * Indexed both as an array and as a dictionary by attribute name.
     */
    readonly attributes: PersistentObjectAttribute[] & Record<string, PersistentObjectAttribute>;
    
    /**
     * The queries associated with this persistent object.
     * Indexed both as an array and as a dictionary by query name.
     */
    readonly queries: Query[] & Record<string, Query>;
    
    /**
     * Flag indicating if this is a new object.
     */
    isNew: boolean;

    /**
     * Initializes a new instance of the PersistentObject class.
     * 
     * @param service - The service context providing hooks and actions.
     * @param po - The data representing the persistent object.
     */
    constructor(service: Service, po: Dto.PersistentObjectDto) {
        super(service, po.actions?.map(a => a === "Edit" && po.isNew ? "Save" : a), po.actionLabels);

        this[PersistentObjectSymbols.Dto] = po;
        this[PersistentObjectSymbols.IsPersistentObject] = true;
        this[PersistentObjectSymbols.PrepareAttributesForRefresh] = this.#prepareAttributesForRefresh.bind(this);
        this[PersistentObjectSymbols.RefreshTabsAndGroups] = this.#refreshTabsAndGroups.bind(this);
        this[PersistentObjectSymbols.RefreshFromResult] = this.#refreshFromResult.bind(this);

        this.#id = po.id;
        this.#isSystem = !!po.isSystem;
        this.#type = po.type;
        this.#label = po.label;
        this.#forceFromAction = po.forceFromAction;
        this.#fullTypeName = po.fullTypeName;
        this.#queryLayoutMode = po.queryLayoutMode;
        this.#objectId = po.objectId;
        this.#breadcrumb = po.breadcrumb;
        this.#isBreadcrumbSensitive = po.isBreadcrumbSensitive;
        this.setNotification(po.notification, po.notificationType, po.notificationDuration, true);
        this.isNew = !!po.isNew;
        this.#newOptions = po.newOptions;
        this.#isReadOnly = !!po.isReadOnly;
        this.#isHidden = !!po.isHidden;
        this.#isDeleted = !!po.isDeleted;
        this.#stateBehavior = po.stateBehavior || "None";
        this.#setIsEditing(false);
        this.#securityToken = po.securityToken;
        this.bulkObjectIds = po.bulkObjectIds;
        this.queriesToRefresh = po.queriesToRefresh || [];
        this.parent = po.parent != null ? service.hooks.onConstructPersistentObject(service, po.parent) : null;

        // Initialize attributes
        const attributes = po.attributes?.map(attr => this.#createPersistentObjectAttribute(attr)) || [];
        attributes.forEach(attr => attributes[attr.name] = attr);

        this.attributes = attributes as PersistentObjectAttribute[] & Record<string, PersistentObjectAttribute>;

        // Initialize queries
        const queries = po.queries?.map(query => service.hooks.onConstructQuery(service, query, this)).orderBy(q => q.offset) || []; 
        queries.forEach(query => queries[query.name] = query);

        this.queries = queries as Query[] & Record<string, Query>;

        // Initialize tabs
        const attributeTabs = po.tabs
            ? this.attributes
                  .orderBy(attr => attr.offset)
                  .groupBy(attr => attr.tabKey)
                  .map(attributesByTab => {
                      const groups = attributesByTab.value
                          .orderBy(attr => attr.offset)
                          .groupBy(attr => attr.groupKey)
                          .map(attributesByGroup => {
                              const newGroup = this.service.hooks.onConstructPersistentObjectAttributeGroup(service, attributesByGroup.key, attributesByGroup.value, this);
                              attributesByGroup.value.forEach(attr => (attr.group = newGroup));

                              return newGroup;
                          });
                      groups.forEach((g, n) => (g.index = n));

                      const serviceTab = po.tabs[attributesByTab.key] || {};
                      const newTab = this.service.hooks.onConstructPersistentObjectAttributeTab(service, groups, attributesByTab.key, serviceTab.id, serviceTab.name, serviceTab.layout, this, serviceTab.columnCount, !this.isHidden);
                      attributesByTab.value.forEach(attr => (attr.tab = newTab));

                      return newTab;
                  })
            : [];

        this.#tabs = this.service.hooks.onSortPersistentObjectTabs(
            this,
            <PersistentObjectAttributeTab[]>attributeTabs,
            this.queries.map(q => this.service.hooks.onConstructPersistentObjectQueryTab(this.service, q))
        );

        if (this.#tabs.length === 0)
            this.#tabs = [
                this.service.hooks.onConstructPersistentObjectAttributeTab(service, [], "", "", "", null, this, 0, true)
            ];

        this.#tag = po.tag;

        if (this.isNew || this.stateBehavior.indexOf("OpenInEdit") >= 0 || this.stateBehavior.indexOf("StayInEdit") >= 0)
            this.beginEdit();

        this._initializeActions();
        this.#dialogSaveAction = po.dialogSaveAction
            ? this.getAction(po.dialogSaveAction)
            : this.getAction("EndEdit") || this.getAction("Save");

        this.service.hooks.onRefreshFromResult(this);
        this.#setLastUpdated(new Date());
    }

    /**
     * Creates an attribute instance based on its properties, choosing between
     * standard, reference, or detail attribute types.
     * @param attr - The attribute DTO.
     */
    #createPersistentObjectAttribute(attr: Dto.PersistentObjectAttributeDto): PersistentObjectAttribute {
        if ((<Dto.PersistentObjectAttributeWithReferenceDto>attr).displayAttribute || (<Dto.PersistentObjectAttributeWithReferenceDto>attr).objectId)
            return this.service.hooks.onConstructPersistentObjectAttributeWithReference(this.service, attr, this);

        if ((<Dto.PersistentObjectAttributeAsDetailDto>attr).objects || (<Dto.PersistentObjectAttributeAsDetailDto>attr).details)
            return this.service.hooks.onConstructPersistentObjectAttributeAsDetail(this.service, attr, this);

        return this.service.hooks.onConstructPersistentObjectAttribute(this.service, attr, this);
    }

    /**
     * Unique identifier of the persistent object.
     */
    get id(): string {
        return this.#id;
    }

    /**
     * Indicates if the object is defined by the system.
     */
    get isSystem(): boolean {
        return this.#isSystem;
    }

    /**
     * Provides type information for the persistent object.
     */
    get type(): string {
        return this.#type;
    }

    /**
     * Determines if the object represents a bulk edit scenario.
     */
    get isBulkEdit(): boolean {
        return this.bulkObjectIds && this.bulkObjectIds.length > 0;
    }

    /**
     * Gets whether the breadcrumb data should be treated as sensitive.
     */
    get isBreadcrumbSensitive(): boolean {
        return this.#isBreadcrumbSensitive;
    }

    /**
     * Gets the translated label of the persistent object.
     */
    get label(): string {
        return this.#label;
    }

    /**
     * Gets the unique identifier of the object that is being represented by this persistent object.
     */
    get objectId(): string {
        return this.#objectId;
    }

    /**
     * Gets or sets a set of extra options that influence the state of the persistent object.
     */
    get stateBehavior(): string {
        return this.#stateBehavior;
    }
    set stateBehavior(value: string) {
        const oldValue = this.#stateBehavior;
        if (oldValue !== value)
            this.notifyPropertyChanged("stateBehavior", (this.#stateBehavior = value), oldValue);
    }

    /**
     * Lists the tabs associated with the persistent object.
     */
    get tabs(): PersistentObjectTab[] {
        return this.#tabs;
    }

    set tabs(tabs: PersistentObjectTab[]) {
        const oldTabs = this.#tabs;
        this.notifyPropertyChanged("tabs", (this.#tabs = tabs), oldTabs);
    }

    /**
     * Gets the action that should be executed when the dialog is saved.
     */
    get dialogSaveAction() {
        return this.#dialogSaveAction;
    }

    /**
     * Gets the way in which this persistent object is rendered together with its detail queries.
     */
    get queryLayoutMode(): Dto.PersistentObjectLayoutMode {
        return this.#queryLayoutMode;
    }

    /**
     * Retrieves additional tag data attached to the object.
     */
    get tag() {
        return this.#tag;
    }

    /**
     * Flag indicating if the object is currently in edit mode.
     */
    get isEditing(): boolean {
        return this.#isEditing;
    }

    /**
     * Gets whether the attributes of this persistent object can be changed.
     */
    get isReadOnly(): boolean {
        return this.#isReadOnly;
    }

    /**
     * Sets edit mode and notifies related actions.
     * @param value - Whether editing mode is enabled.
     */
    #setIsEditing(value: boolean) {
        this.#isEditing = value;
        this.notifyPropertyChanged("isEditing", value, !value);
    }

    /**
     * Navigation breadcrumb representing the object's location.
     */
    get breadcrumb(): string {
        return this.#breadcrumb;
    }

    /**
     * Updates the breadcrumb value and notifies listeners when it changes.
     * @param breadcrumb - The new breadcrumb.
     */
    #setBreadcrumb(breadcrumb: string) {
        const oldBreadcrumb = this.#breadcrumb;
        if (oldBreadcrumb !== breadcrumb)
            this.notifyPropertyChanged("breadcrumb", (this.#breadcrumb = breadcrumb), oldBreadcrumb);
    }

    /**
     * Gets whether the url for this persistent object should be a FromAction so that refreshing the page will not be able to see different data.
     * @example When the persistent object has a parent persistent object that is required. But not loaded during direct navigation;
     */
    get forceFromAction(): boolean {
        return this.#forceFromAction;
    }

    /**
     * Indicates if there are unsaved modifications.
     */
    get isDirty(): boolean {
        return this.#isDirty;
    }

    /**
     * Marks the object as having unsaved changes and alerts dependent actions.
     * @param value - The new dirty state.
     * @param force - Allows flagging as dirty even if not in edit mode.
     */
    #setIsDirty(value: boolean, force?: boolean) {
        if (value && (!this.isEditing && !force))
            throw "Cannot flag persistent object as dirty when not in edit mode.";

        const oldIsDirty = this.#isDirty;
        if (oldIsDirty !== value) {
            this.notifyPropertyChanged("isDirty", (this.#isDirty = value), oldIsDirty);

            if (this.ownerDetailAttribute instanceof PersistentObjectAttributeAsDetail && value)
                this.ownerDetailAttribute.onChanged(false);
        }
    }

    /**
     * Gets or sets whether this persistent object has been marked as deleted.
     * This is used when the persistent object is part of the list of objects of an as detail attribute.
     */
    get isDeleted(): boolean {
        return this.#isDeleted;
    }

    set isDeleted(isDeleted: boolean) {
        const oldIsDeleted = this.#isDeleted;
        if (oldIsDeleted !== isDeleted)
            this.notifyPropertyChanged("isDeleted", (this.#isDeleted = isDeleted), oldIsDeleted);
    }

    /**
     * Gets whether all of the persistent object attribute tabs will be hidden and only detail queries should be shown.
     */
    get isHidden(): boolean {
        return this.#isHidden;
    }

    /**
     * Shows if the object is in a frozen state.
     */
    get isFrozen(): boolean {
        return this.#isFrozen;
    }

    /**
     * Full type name of the persistent object.
     * @example "MyProject.MyPersistentObject"
     */
    get fullTypeName(): string {
        return this.#fullTypeName;
    }

    /**
     * A semicolon separated list of translated options for the end user to pick when executing the New action.
     */
    get newOptions(): string {
        return this.#newOptions;
    }

    /**
     * Freezes the object to prevent modifications.
     */
    freeze() {
        if (this.#isFrozen)
            return;

        this.notifyPropertyChanged("isFrozen", (this.#isFrozen = true), false);
    }

    /**
     * Unfreezes the object to allow modifications.
     */
    unfreeze() {
        if (!this.#isFrozen)
            return;

        this.notifyPropertyChanged("isFrozen", (this.#isFrozen = false), true);
    }

    /**
     * Retrieves an attribute by name.
     * @param name - The attribute's name.
     */
    getAttribute(name: string): PersistentObjectAttribute {
        return this.attributes[name];
    }

    /**
     * Gets the current value of a specified attribute.
     * @param name - The attribute's name.
     */
    getAttributeValue<T = any>(name: string): T {
        return this.attributes[name]?.value;
    }

    /**
     * Sets a new value for an attribute and optionally triggers a refresh.
     * @param name - The attribute's name.
     * @param value - The new value.
     * @param allowRefresh - If true, a refresh may follow the update.
     */
    setAttributeValue(name: string, value: any, allowRefresh?: boolean): Promise<any> {
        const attr = <PersistentObjectAttribute>this.attributes[name];
        if (!attr)
            return Promise.reject("Attribute does not exist.");

        return attr.setValue(value, allowRefresh);
    }

    /**
     * Timestamp marking the last update.
     */
    get lastUpdated(): Date {
        return this.#lastUpdated;
    }

    /**
     * Sets the last update time and alerts listeners.
     * @param lastUpdated - The new timestamp.
     */
    #setLastUpdated(lastUpdated: Date) {
        const oldLastUpdated = this.#lastUpdated;
        this.notifyPropertyChanged("lastUpdated", (this.#lastUpdated = lastUpdated), oldLastUpdated);
    }

    /**
     * Retrieves a query by name linked to this object.
     * @param name - The query's name.
     */
    getQuery(name: string): Query {
        return this.queries[name];
    }

    /**
     * Enters edit mode and saves the current state for potential rollback.
     */
    beginEdit() {
        if (!this.isEditing) {
            this[_dtoBackup] = this[PersistentObjectSymbols.Dto];
            this.#setIsEditing(true);
        }
    }

    /**
     * Cancels edit mode, reverts changes from backup, and resets notifications.
     */
    cancelEdit() {
        if (this.isEditing) {
            this.#setIsEditing(false);
            this.#setIsDirty(false);

            const backup = this[_dtoBackup];
            this[_dtoBackup] = null;
            this.#refreshFromResult(backup, true);

            if (!!this.notification)
                this.setNotification();

            if (this.stateBehavior === "StayInEdit" || this.stateBehavior.indexOf("StayInEdit") >= 0)
                this.beginEdit();
        }
    }

    /**
     * Saves changes, refreshes state, and handles post-save notifications.
     * @param options - Options for saving, such as throwing exceptions on errors.
     */
    save(options?: IPersistentObjectSaveOptions): Promise<boolean> {
        return this.queueWork(async () => {
            if (this.isEditing) {
                const attributesToRefresh = this.attributes.filter(attr => attr.shouldRefresh);
                for (let i = 0; i < attributesToRefresh.length; i++)
                    await attributesToRefresh[i].triggerRefresh(true);

                const po = await this.service.executeAction("PersistentObject.Save", this, null, null, null);
                if (!po)
                    return false;

                const wasNew = this.isNew;
                this.#refreshFromResult(po, true);

                const hasError = this.notification?.trim() && this.notificationType === "Error";
                if (!hasError) {
                    this.#setIsDirty(false);

                    if (!wasNew) {
                        this.#setIsEditing(false);
                        
                        const shouldStayInEdit = this.stateBehavior === "StayInEdit" || this.stateBehavior.indexOf("StayInEdit") >= 0;
                        if (shouldStayInEdit) {
                            this.beginEdit();
                        }
                    }

                    if (this.ownerAttributeWithReference) {
                        const ownerAttr = this.ownerAttributeWithReference;
                        
                        if (ownerAttr.objectId !== this.objectId) {
                            let parent = ownerAttr.parent;
                            if (parent.ownerDetailAttribute != null) {
                                parent = parent.ownerDetailAttribute.parent;
                            }

                            parent.beginEdit();
                            ownerAttr.changeReference([po.objectId]);
                        } else if (ownerAttr.value !== this.breadcrumb) {
                            ownerAttr.value = this.breadcrumb;
                        }
                    } else if (this.ownerQuery) {
                        const searchPromise = this.ownerQuery.search({ keepSelection: this.isBulkEdit });
                        if (options?.waitForOwnerQuery) {
                            await searchPromise;
                        }
                    }
                } else {
                    if (options?.throwExceptions === false) {
                        return false;
                    }
                    
                    throw this.notification;
                }
            }

            return true;
        });
    }

    /**
     * Refreshes the object state from the service.
     */
    async refresh() {
        const po = await this.service.getPersistentObject(this.parent, this.id, this.objectId);
        this.#refreshFromResult(po, true);
    }

    /**
     * Serializes the object into a service-friendly format.
     * @param skipParent - If true, parent data is excluded.
     */
    toServiceObject(skipParent: boolean = false): any {
        const result = this._copyPropertiesFromValues({
            "id": this.#id,
            "type": this.#type,
            "objectId": this.objectId,
            "isNew": this.isNew,
            "isHidden": this.isHidden,
            "bulkObjectIds": this.bulkObjectIds,
            "securityToken": this.#getSecurityToken(),
            "isSystem": this.#isSystem
        });

        if (this.ownerQuery)
            result.ownerQueryId = this.ownerQuery.id;

        if (this.parent && !skipParent)
            result.parent = this.parent.toServiceObject();
        if (this.attributes)
            result.attributes = this.attributes.map(attr => _internal(attr).toServiceObject());
        if (_internal(this).dto.metadata != null)
            result.metadata = _internal(this).dto.metadata;

        return result;
    }

    /**
     * Refreshes the object state from a new service result, merging changes.
     * @param result - The new data from the service.
     * @param resultWins - If true, the new data overrides current values.
     */
    #refreshFromResult(po: PersistentObject | Dto.PersistentObjectDto, resultWins: boolean = false) {
        const result = (po instanceof PersistentObject ? _internal(po).dto : po) as Dto.PersistentObjectDto;

        const changedAttributes: PersistentObjectAttribute[] = [];
        let isDirty = false;

        if (!this.isEditing && result.attributes.some(a => a.isValueChanged))
            this.beginEdit();

        this[PersistentObjectSymbols.Dto] = result;

        this.attributes.removeAll(attr => {
            if (!result.attributes.some(serviceAttr => serviceAttr.id === attr.id)) {
                delete this.attributes[attr.name];
                changedAttributes.push(attr);

                return true;
            }

            return false;
        });

        this.attributes.forEach(attr => {
            let serviceAttr = result.attributes.find(serviceAttr => serviceAttr.id === attr.id);
            if (serviceAttr && _internal(attr).refreshFromResult(serviceAttr, resultWins))
                changedAttributes.push(attr);

            if (attr.isValueChanged)
                isDirty = true;
        });

        result.attributes.forEach(serviceAttr => {
            if (!this.attributes.some(a => a.id === serviceAttr.id)) {
                const attr = this.#createPersistentObjectAttribute(serviceAttr);
                this.attributes.push(attr);
                this.attributes[attr.name] = attr;
                changedAttributes.push(attr);

                if (attr.isValueChanged)
                    isDirty = true;
            }
        });

        if (changedAttributes.length > 0)
            this.#refreshTabsAndGroups(...changedAttributes);

        this.setNotification(result.notification, result.notificationType, result.notificationDuration);
        this.#setIsDirty(isDirty, true);

        this.#objectId = result.objectId;
        if (this.isNew)
            this.isNew = result.isNew;

        this.#securityToken = result.securityToken;
        if (result.breadcrumb)
            this.#setBreadcrumb(result.breadcrumb);

        if (result.queriesToRefresh) {
            result.queriesToRefresh.forEach(async id => {
                const query = this.queries.find(q => q.id === id || q.name === id);
                if (query && (query.hasSearched || query.notification || query.totalItems != null))
                    await query.search();
            });
        }

        this.#tag = result.tag;

        this.service.hooks.onRefreshFromResult(this);
        this.#setLastUpdated(new Date());
    }

    #getSecurityToken(): string {
        return this.#securityToken;
    }

    /**
     * Rebuilds the tabs and groups UI structure based on changed attributes.
     * @param changedAttributes - The attributes that have been modified.
     */
    #refreshTabsAndGroups(...changedAttributes: PersistentObjectAttribute[]) {
        // Track which tabs and groups need to be refreshed
        const tabGroupsChanged = new Set<PersistentObjectAttributeTab>();
        const tabGroupAttributesChanged = new Set<PersistentObjectAttributeGroup>();
    
        let tabsRemoved = false;
        let tabsAdded = false;
    
        changedAttributes.forEach(attr => {           
            // Find the attribute's tab and group based on its keys.
            const tab = <PersistentObjectAttributeTab>this.tabs.find(t => t instanceof PersistentObjectAttributeTab && t.key === attr.tabKey);
            const group = tab?.groups.find(g => g.key === attr.groupKey);

            // Attribute removal logic:
            if (!this.attributes.hasOwnProperty(attr.name)) {
                if (group) {
                    // Remove attribute from the group
                    group.attributes.remove(attr);
                    delete group.attributes[attr.name];
                    tabGroupAttributesChanged.add(group);
    
                    // Remove attribute from the tab's flat list
                    tab.attributes.remove(attr);
                    delete tab.attributes[attr.name];
    
                    // If the group is now empty, remove it from the tab
                    if (group.attributes.length === 0) {
                        tab.groups.remove(group);
                        tabGroupsChanged.add(tab);
    
                        // Re-index remaining groups
                        tab.groups.forEach((g, n) => (g.index = n));
    
                        // If the tab is now empty, remove the tab itself
                        if (tab.groups.length === 0) {
                            this.tabs.remove(tab);
                            tabsRemoved = true;
                        }
                    }
                }

                return;
            }

            // Attribute addition or update logic:           
            let currentTab = tab;
            if (!currentTab) {
                // If the attribute is not visible, don't create a new tab for it.
                if (!attr.isVisible)
                    return;
    
                // Create a new group and tab for this attribute
                const newGroup = this.service.hooks.onConstructPersistentObjectAttributeGroup(this.service, attr.groupKey, [], this);
                const groups = [newGroup];
    
                const serviceTab = _internal(this).dto.tabs[attr.tabKey] || {};
                currentTab = this.service.hooks.onConstructPersistentObjectAttributeTab(this.service, groups, attr.tabKey, serviceTab.id, serviceTab.name, serviceTab.layout, this, serviceTab.columnCount, !this.isHidden);
                attr.tab = currentTab;
                
                this.tabs.push(currentTab);
                tabsAdded = true;
            }
            
            let currentGroup = currentTab.groups.find(g => g.key === attr.groupKey);
            if (!currentGroup) {
                // If the attribute is not visible, don't create a new group for it.
                if (!attr.isVisible)
                    return;

                // Create a new group since it doesn't exist in the tab.
                currentGroup = this.service.hooks.onConstructPersistentObjectAttributeGroup(this.service, attr.groupKey, [], this);
                currentTab.groups.push(currentGroup);

                // Sort groups by minimum offset of attributes to maintain order
                currentTab.groups.sort((g1, g2) => (g1.attributes.min(a => a.offset) || 0) - (g2.attributes.min(a => a.offset) || 0));
                currentTab.groups.forEach((g, n) => (g.index = n));
                tabGroupsChanged.add(currentTab);
            }

            // Add the attribute to the group if it's not already there.
            if (attr.isVisible && currentGroup.attributes.indexOf(attr) < 0) {
                currentGroup.attributes.push(attr);
                currentGroup.attributes.sort((x, y) => x.offset - y.offset);
                currentGroup.attributes[attr.name] = attr;
                tabGroupAttributesChanged.add(currentGroup);

                currentTab.attributes.push(attr);
                currentTab.attributes[attr.name] = attr;
            }
        });
    
        const attributeTabs = <PersistentObjectAttributeTab[]>this.tabs.filter(t => t instanceof PersistentObjectAttributeTab);    
        if (tabsAdded) {
            // Calculate optimal tab ordering based on attribute offsets
            const tabMinOffsets = new Map();
            attributeTabs.forEach(tab => {
                const minOffset = Math.min(...tab.groups.flatMap(group => group.attributes.map(attr => attr.offset)));
                tabMinOffsets.set(tab, minOffset);
            });
    
            attributeTabs.sort((t1, t2) => tabMinOffsets.get(t1) - tabMinOffsets.get(t2));
    
            const queryTabs = <PersistentObjectQueryTab[]>this.tabs.filter(t => t instanceof PersistentObjectQueryTab);
            queryTabs.sort((q1, q2) => q1.query.offset - q2.query.offset);
    
            // Allow service hooks to customize tab ordering
            this.tabs = this.service.hooks.onSortPersistentObjectTabs(this, attributeTabs, queryTabs);
        } else if (tabsRemoved) {
            // Create new array to trigger UI refresh
            this.tabs = this.tabs.slice();
        }
    
        // Create new arrays for changed collections to trigger UI updates
        if (tabGroupsChanged.size > 0)
            tabGroupsChanged.forEach(tab => (tab.groups = tab.groups.slice()));
    
        if (tabGroupAttributesChanged.size > 0) {
            tabGroupAttributesChanged.forEach(group => {
                group.attributes = group.attributes.slice();
            });
        }
    
        // Update tab visibility based on contained attributes
        attributeTabs.forEach(tab => (tab.isVisible = tab.attributes.some(a => a.isVisible)));
    }

    /**
     * Flags the object as dirty when in edit mode.
     */
    triggerDirty(): boolean {
        if (this.isEditing)
            this.#setIsDirty(true);

        return this.isDirty;
    }

    /**
     * Refreshes a given attribute by re-querying the service.
     * @param attr - The attribute to refresh.
     * @param immediate - If set to true, performs the refresh immediately.
     */
    triggerAttributeRefresh(attr: PersistentObjectAttribute, immediate?: boolean): Promise<boolean> {
        const attrValue = attr.value;
        const work = async () => {
            if (attrValue !== attr.value)
                return false;

            this.#prepareAttributesForRefresh(attr);
            const result = await this.service.executeAction("PersistentObject.Refresh", this, null, null, {
                RefreshedPersistentObjectAttributeId: attr.id 
            });

            if (this.isEditing)
                this.#refreshFromResult(result);

            return true;
        };

        const result = !immediate ? this.queueWork(work, false) : work();
        if (Boolean.parse(attr.getTypeHint("TriggerRefreshOnOwner", "false")?.toLowerCase()) && this.ownerDetailAttribute instanceof PersistentObjectAttributeAsDetail) {
            return result.then(async res => {
                await this.ownerDetailAttribute.triggerRefresh(immediate);
                return res;
            });
        }

        return result;
    }

    /**
     * Prepares all attributes for a refresh by caching current service values.
     * @param sender - The attribute initiating the refresh.
     */
    #prepareAttributesForRefresh(sender: PersistentObjectAttribute) {
        for (const attribute of this.attributes) {
            if (attribute.id !== sender.id)
                _internal(attribute).backupServiceValue();
        }
    }
}