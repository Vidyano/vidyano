import { Observable } from "./common/observable.js"
import type { PersistentObject } from "./persistent-object.js"
import type { PersistentObjectAttribute } from "./persistent-object-attribute.js"
import type { PersistentObjectAttributeGroup } from "./persistent-object-attribute-group.js"
import type { Query } from "./query.js"
import type { Service } from "./service.js"
import type { ServiceObjectWithActions } from "./service-object-with-actions.js"

/**
 * Represents a persistent object tab.
 */
export abstract class PersistentObjectTab extends Observable<PersistentObjectTab> {
    #service: Service;
    #name: string;
    #label: string;
    #target: ServiceObjectWithActions;
    #parent?: PersistentObject;
    #isVisible: boolean;

    tabGroupIndex: number;

    /**
     * Creates a new persistent object tab.
     * @param service The service instance.
     * @param name The name for the tab.
     * @param label The label for the tab.
     * @param target The target for the tab.
     * @param parent The parent persistent object for the tab.
     * @param isVisible Whether the tab is visible.
     */
    constructor(service: Service, name: string, label: string, target: ServiceObjectWithActions, parent?: PersistentObject, isVisible = true) {
        super();
        this.#service = service;
        this.#name = name;
        this.#label = label;
        this.#target = target;
        this.#parent = parent;
        this.#isVisible = isVisible;
    }

    /**
     * Gets the service.
     */
    get service(): Service {
        return this.#service;
    }

    /**
     * Gets the name.
     */
    get name(): string {
        return this.#name;
    }

    /**
     * Gets the label.
     */
    get label(): string {
        return this.#label;
    }

    /**
     * Gets the target.
     */
    get target(): ServiceObjectWithActions {
        return this.#target;
    }

    /**
     * Gets the parent.
     */
    get parent(): PersistentObject | undefined {
        return this.#parent;
    }

    /**
     * Gets or sets the visibility.
     */
    get isVisible(): boolean {
        return this.#isVisible;
    }

    set isVisible(val: boolean) {
        const oldIsVisible = this.#isVisible;
        if (oldIsVisible !== val)
            this.notifyPropertyChanged("isVisible", this.#isVisible = val, oldIsVisible);
    }
}

/**
 * Represents a persistent object attribute tab.
 */
export class PersistentObjectAttributeTab extends PersistentObjectTab {
    #attributes: PersistentObjectAttribute[];
    #groups: PersistentObjectAttributeGroup[];
    #layout: any;
    #key: string;
    #id: string;
    #columnCount: number;

    /**
     * Creates a new persistent object attribute tab.
     * @param service The service instance.
     * @param groups The attribute groups for the tab.
     * @param key The key for the tab.
     * @param id The id for the tab.
     * @param name The name for the tab.
     * @param layout The layout for the tab.
     * @param po The persistent object for the tab.
     * @param columnCount The amount of columns for the tab.
     * @param isVisible Whether the tab is visible.
     */
    constructor(service: Service, groups: PersistentObjectAttributeGroup[], key: string, id: string, name: string, layout: any, po: PersistentObject, columnCount: number, isVisible: boolean) {
        super(service, name, String.isNullOrEmpty(key) ? po.label : key, po, po, isVisible);

        this.tabGroupIndex = 0;
        this.#groups = groups;
        this.#key = key;
        this.#id = id;
        this.#layout = layout;
        if (typeof columnCount === "string")
            this.#columnCount = parseInt(columnCount as any);
        else
            this.#columnCount = columnCount;

        this.#attributes = this.#updateAttributes();
    }

    /**
     * Gets or sets the visibility.
     */
    get isVisible(): boolean {
        return !this.parent.isHidden && super.isVisible;
    }
    set isVisible(val: boolean) {
        super.isVisible = val;
    }

    /**
     * Gets the layout.
     */
    get layout(): any {
        return this.#layout;
    }

    /**
     * Gets the attributes.
     */
    get attributes(): PersistentObjectAttribute[] {
        return this.#attributes;
    }

    /**
     * Gets or sets the attribute groups.
     */
    get groups(): PersistentObjectAttributeGroup[] {
        return this.#groups;
    }
    set groups(groups: PersistentObjectAttributeGroup[]) {
        const oldGroups = this.#groups;
        this.notifyPropertyChanged("groups", this.#groups = groups, oldGroups);

        const oldAttributes = this.#attributes;
        this.notifyPropertyChanged("attributes", this.#attributes = this.#updateAttributes(), oldAttributes);
    }

    /**
     * Gets the key.
     */
    get key(): string {
        return this.#key;
    }

    /**
     * Gets the id.
     */
    get id(): string {
        return this.#id;
    }

    /**
     * Gets or sets the column count.
     */
    get columnCount(): number {
        return this.#columnCount;
    }
    set columnCount(val: number) {
        const oldColumnCount = this.#columnCount;
        if (oldColumnCount !== val)
            this.notifyPropertyChanged("columnCount", this.#columnCount = val, oldColumnCount);
    }

    /**
     * Saves the layout.
     */
    async saveLayout(layout: any): Promise<any> {
        await this.service.executeAction("System.SaveTabLayout", null, null, null, { "Id": this.id, "Layout": layout ? JSON.stringify(layout) : "" });
        this.#setLayout(layout);
    }

    #setLayout(layout: any) {
        const oldLayout = this.#layout;
        this.notifyPropertyChanged("layout", this.#layout = layout, oldLayout);
    }

    #updateAttributes(): PersistentObjectAttribute[] {
        const attributes = [].concat(...this.groups.map(grp => grp.attributes));
        attributes.forEach(attr => attributes[attr.name] = attr);

        this.isVisible = attributes.some(attr => attr.isVisible);

        return attributes;
    }
}

/**
 * Represents a persistent object query tab.
 */
export class PersistentObjectQueryTab extends PersistentObjectTab {
    #query: Query;

    /**
     * Creates a new persistent object query tab.
     * @param service The service instance.
     * @param query The query for the tab.
     */
    constructor(service: Service, query: Query) {
        super(service, query.name, query.label, query, query.parent, !query.isHidden);

        this.tabGroupIndex = 1;
        this.#query = query;
    }

    /**
     * Gets the query.
     */
    get query(): Query {
        return this.#query;
    }

    /**
     * Gets the visibility.
     */
    get isVisible(): boolean {
        return !this.query.isHidden;
    }
}