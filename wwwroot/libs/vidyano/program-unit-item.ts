import type { IRoutes } from "./application.js";
import type { ProgramUnit } from "./program-unit.js";
import type { Service } from "./service.js";
import { ServiceObject } from "./service-object.js";

/**
 * Represents a single item in a program unit.
 */
export class ProgramUnitItem extends ServiceObject {
    #id: string;
    #title: string;
    #name: string;
    #path?: string;
    #nameKebab?: string;

    /**
     * Initializes a new instance of the ProgramUnitItem class.
     * @param service The service instance.
     * @param unitItem The raw unit item data.
     * @param path The path for this item.
     * @param nameKebab The kebab-case name for this item.
     */
    constructor(service: Service, unitItem: any, path?: string, nameKebab?: string) {
        super(service);

        this.#id = unitItem.id;
        this.#title = unitItem.title;
        this.#name = unitItem.name;
        this.#path = path;
        this.#nameKebab = nameKebab;
    }

    /**
     * Gets the unique identifier for this item.
     */
    get id(): string {
        return this.#id;
    }

    /**
     * Gets the title for this item.
     */
    get title(): string {
        return this.#title;
    }

    /**
     * Gets the name for this item.
     */
    get name(): string {
        return this.#name;
    }

    /**
     * Gets or sets the path for this item.
     */
    get path(): string | undefined {
        return this.#path;
    }
    set path(value: string | undefined) {
        this.#path = value;
    }

    /**
     * Gets the kebab-case name for this item.
     */
    get nameKebab(): string | undefined {
        return this.#nameKebab;
    }
}

/**
 * Represents a group of program unit items.
 */
export class ProgramUnitItemGroup extends ProgramUnitItem {
    #items: ProgramUnitItem[];

    /**
     * Initializes a new instance of the ProgramUnitItemGroup class.
     * @param service The service instance.
     * @param unitItem The raw unit item data.
     * @param items The items in this group.
     */
    constructor(service: Service, unitItem: any, items: ProgramUnitItem[]) {
        super(service, unitItem);
        this.#items = items;
    }

    /**
     * Gets the items in this group.
     */
    get items(): ProgramUnitItem[] {
        return this.#items;
    }
}

/**
 * Represents a query item in a program unit.
 */
export class ProgramUnitItemQuery extends ProgramUnitItem {
    #queryId: string;

    /**
     * Initializes a new instance of the ProgramUnitItemQuery class.
     * @param service The service instance.
     * @param routes The application routes.
     * @param unitItem The raw unit item data.
     * @param parent The parent program unit.
     */
    constructor(service: Service, routes: IRoutes, unitItem: any, parent: ProgramUnit) {
        super(service, unitItem, parent.path + ProgramUnitItemQuery._getPath(routes, unitItem.query));
        this.#queryId = unitItem.query;
    }

    /**
     * Gets the query id for this item.
     */
    get queryId(): string {
        return this.#queryId;
    }

    private static _getPath(routes: IRoutes, id: string): string {
        for (const name in routes.queries) {
            if (routes.queries[name] === id)
                return "/" + name;
        }

        return "/query." + id;
    }
}

/**
 * Represents a persistent object item in a program unit.
 */
export class ProgramUnitItemPersistentObject extends ProgramUnitItem {
    #persistentObjectId: string;
    #persistentObjectObjectId: string;

    /**
     * Initializes a new instance of the ProgramUnitItemPersistentObject class.
     * @param service The service instance.
     * @param routes The application routes.
     * @param unitItem The raw unit item data.
     * @param parent The parent program unit.
     */
    constructor(service: Service, routes: IRoutes, unitItem: any, parent: ProgramUnit) {
        super(service, unitItem, parent.path + ProgramUnitItemPersistentObject._getPath(routes, unitItem.persistentObject, unitItem.objectId));
        this.#persistentObjectId = unitItem.persistentObject;
        this.#persistentObjectObjectId = unitItem.objectId;
    }

    /**
     * Gets the persistent object id for this item.
     */
    get persistentObjectId(): string {
        return this.#persistentObjectId;
    }

    /**
     * Gets the persistent object object id for this item.
     */
    get persistentObjectObjectId(): string {
        return this.#persistentObjectObjectId;
    }

    private static _getPath(routes: IRoutes, id: string, objectId: string): string {
        for (const name in routes.persistentObjects) {
            if (routes.persistentObjects[name] === id)
                return "/" + name + (objectId ? "/" + objectId : "");
        }

        return "/persistent-object." + id + (objectId ? "/" + objectId : "");
    }
}

/**
 * Represents a URL item in a program unit.
 */
export class ProgramUnitItemUrl extends ProgramUnitItem {
    /**
     * Initializes a new instance of the ProgramUnitItemUrl class.
     * @param service The service instance.
     * @param unitItem The raw unit item data.
     */
    constructor(service: Service, unitItem: any) {
        super(service, unitItem, unitItem.objectId);
    }
}

/**
 * Represents a separator item in a program unit.
 */
export class ProgramUnitItemSeparator extends ProgramUnitItem {
    /**
     * Initializes a new instance of the ProgramUnitItemSeparator class.
     * @param service The service instance.
     * @param unitItem The raw unit item data.
     */
    constructor(service: Service, unitItem: any) {
        super(service, unitItem);
    }
}