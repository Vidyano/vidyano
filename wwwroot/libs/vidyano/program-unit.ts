import type { IRoutes } from "./application.js";
import { ProgramUnitItem, ProgramUnitItemGroup, ProgramUnitItemPersistentObject, ProgramUnitItemQuery, ProgramUnitItemSeparator, ProgramUnitItemUrl } from "./program-unit-item.js";
import type { Service } from "./service.js";

/**
 * Represents a program unit, which can contain multiple items and groups.
 */
export class ProgramUnit extends ProgramUnitItem {
    #offset: number;
    #openFirst: boolean;
    #items: ProgramUnitItem[];

    /**
     * Initializes a new instance of the ProgramUnit class.
     * @param service The service instance.
     * @param routes The application routes.
     * @param unit The raw unit data.
     */
    constructor(service: Service, routes: IRoutes, unit: any) {
        super(service, unit, unit.name.toKebabCase(), unit.name.toKebabCase());

        this.#offset = unit.offset;
        this.#openFirst = unit.openFirst;

        if (unit.items) {
            this.#items = [];
            const usedGroups: { [key: string]: ProgramUnitItemGroup } = {};

            unit.items.forEach(itemData => {
                let itemsTarget = this.#items;

                if (!itemData.group) {
                    const pathIndex = itemData.name.lastIndexOf("\\");
                    if (pathIndex >= 0) {
                        const groupNames = <string[]>itemData.name.split("\\");
                        groupNames.pop();

                        let groupId = null;
                        groupNames.forEach(groupName => {
                            const parentGroup = usedGroups[groupId];
                            let group = usedGroups[groupId = groupId ? `${groupId}\\${groupName}` : groupName];

                            if (!group) {
                                usedGroups[groupId] = group = new ProgramUnitItemGroup(service, { id: groupId, title: groupName, name: groupId }, []);
                                if (parentGroup)
                                    parentGroup.items.push(group);
                                else
                                    this.#items.push(group);
                            }

                            itemsTarget = group.items;
                        });
                    }
                }
                else {
                    if (!usedGroups[itemData.group.id])
                        itemsTarget.push(usedGroups[itemData.group.id] = new ProgramUnitItemGroup(service, itemData.group, []));

                    itemsTarget = usedGroups[itemData.group.id].items;
                }

                itemsTarget.push(this.#createItem(routes, itemData));
            });
        }

        if (this.#openFirst && this.#items.length > 0 && (!(this.#items[0] instanceof ProgramUnitItemUrl) || !this.#items[0].path?.startsWith("http"))) {
            this.path = this.#items[0].path;

            if (this.#items[0].title === this.title)
                this.#items.splice(0, 1);
        }
    }

    /**
     * Gets the offset of the program unit.
     */
    get offset(): number {
        return this.#offset;
    }

    /**
     * Gets whether the first item should be opened by default.
     */
    get openFirst(): boolean {
        return this.#openFirst;
    }

    /**
     * Gets the items of the program unit.
     */
    get items(): ProgramUnitItem[] {
        return this.#items;
    }

    /**
     * Creates a program unit item based on the item data.
     * @param routes The application routes.
     * @param itemData The raw item data.
     * @returns The created ProgramUnitItem.
     */
    #createItem(routes: IRoutes, itemData: any): ProgramUnitItem {
        if (itemData.query)
            return new ProgramUnitItemQuery(this.service, routes, itemData, this);

        if (itemData.persistentObject)
            return new ProgramUnitItemPersistentObject(this.service, routes, itemData, this);

        if (itemData.isSeparator)
            return new ProgramUnitItemSeparator(this.service, itemData);

        return new ProgramUnitItemUrl(this.service, itemData);
    }
}