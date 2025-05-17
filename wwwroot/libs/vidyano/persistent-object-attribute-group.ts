import { Observable } from "./common/observable.js"
import type { PersistentObject } from "./persistent-object.js"
import type { PersistentObjectAttribute } from "./persistent-object-attribute.js"
import type { Service } from "./service.js"

/**
 * Represents a group of attributes in a persistent object.
 */
export class PersistentObjectAttributeGroup extends Observable<PersistentObjectAttributeGroup> {
    #attributes: PersistentObjectAttribute[];
    #key: string;
    #label: string;
    #service: Service;
    #parent: PersistentObject;
    index: number;

    /**
     * Creates a new instance of PersistentObjectAttributeGroup.
     * @param service The service instance.
     * @param key The key for the group.
     * @param attributes The attributes in the group.
     * @param parent The parent persistent object.
     */
    constructor(service: Service, key: string, attributes: PersistentObjectAttribute[], parent: PersistentObject) {
        super();

        this.#service = service;
        this.#parent = parent;
        this.#label = key || "";
        this.#key = key;
        this.attributes = attributes;
    }

    /**
     * Gets the service.
     */
    get service(): Service {
        return this.#service;
    }

    /**
     * Gets the parent.
     */
    get parent(): PersistentObject {
        return this.#parent;
    }

    /**
     * Gets or sets the attributes.
     */
    get attributes(): PersistentObjectAttribute[] {
        return this.#attributes;
    }

    set attributes(attributes: PersistentObjectAttribute[]) {
        const oldAttributes = this.#attributes;
        const newAttributes = attributes;
        newAttributes.forEach(attr => newAttributes[attr.name] = attr);

        this.notifyPropertyChanged("attributes", this.#attributes = newAttributes, oldAttributes);
    }

    /**
     * Gets the key.
     */
    get key(): string {
        return this.#key;
    }

    /**
     * Gets the label.
     */
    get label(): string {
        return this.#label;
    }
}