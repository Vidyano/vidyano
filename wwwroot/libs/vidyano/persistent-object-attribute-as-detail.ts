import { PersistentObjectAttribute } from "./persistent-object-attribute.js"
import type * as Dto from "./typings/service.js"
import type { PersistentObject } from "./persistent-object.js"
import type { Query } from "./query.js"
import type { Service } from "./service.js"

/**
 * Represents a persistent object attribute that relates to a list of objects.
 */
export class PersistentObjectAttributeAsDetail extends PersistentObjectAttribute {
    #details: Query;
    #lookupAttribute: string;
    #objects: PersistentObject[];

    /**
     * Initializes a new instance of PersistentObjectAttributeAsDetail.
     * @param service The service instance.
     * @param attr The attribute data.
     * @param parent The parent persistent object.
     */
    constructor(service: Service, attr: Dto.PersistentObjectAttributeAsDetail, parent: PersistentObject) {
        super(service, attr, parent);

        this.#details = attr.details ? this.service.hooks.onConstructQuery(service, attr.details, parent, false, 1) : null;
        this.#lookupAttribute = attr.lookupAttribute;
        this.#objects = attr.objects ? attr.objects.map(po => {
            const detailObj = this.service.hooks.onConstructPersistentObject(service, po);
            detailObj.parent = parent;
            detailObj.ownerDetailAttribute = this;

            return detailObj;
        }) : [];

        this.parent.propertyChanged.attach((sender, args) => {
            if (args.propertyName === "isEditing" && args.newValue)
                this.objects.forEach(o => o.beginEdit());
            else if (args.propertyName === "isFrozen") {
                if (args.newValue)
                    this.objects.forEach(obj => obj.freeze());
                else
                    this.objects.forEach(obj => obj.unfreeze());
            }
        });
    }

    /**
     * Handles change events and triggers refresh if allowed.
     * @param allowRefresh Indicates if refresh is allowed.
     */
    async onChanged(allowRefresh: boolean): Promise<any> {
        if (!this.parent.isEditing || this.isReadOnly)
            return this.value;

        this.parent.triggerDirty();
        if (this.triggersRefresh) {
            if (allowRefresh)
                await this.triggerRefresh();
            else
                this._shouldRefresh = true;
        }

        return this.value;
    }

    /**
     * Gets the detail query.
     */
    get details(): Query {
        return this.#details;
    }

    /**
     * Gets the lookup attribute.
     */
    get lookupAttribute(): string {
        return this.#lookupAttribute;
    }

    /**
     * Gets the detail objects.
     */
    get objects(): PersistentObject[] {
        return this.#objects;
    }
    /**
     * Sets the detail objects and notifies a property change if they differ.
     * @param objects The new set of detail objects.
     */
    #setObjects(objects: PersistentObject[]) {
        if (objects === this.#objects) {
            if (!!objects && objects.length === this.#objects.length) {
                let hasDifferences: boolean;
                for (let n = 0; n < objects.length; n++) {
                    if (objects[n] !== this.objects[n]) {
                        hasDifferences = true;
                        break;
                    }
                }

                if (!hasDifferences)
                    return;
            }
        }

        const oldObjects = this.objects;
        this.notifyPropertyChanged("objects", this.#objects = objects, oldObjects);
    }

    /**
     * Creates a new detail object.
     * @returns A promise that resolves to the new detail object.
     */
    async newObject(): Promise<PersistentObject> {
        const po = await this.details.actions["New"].execute({ throwExceptions: true, skipOpen: true });
        if (!po)
            return null;

        po.ownerQuery = null;
        po.ownerDetailAttribute = this;

        return po;
    }

    /**
     * @inheritdoc
     */
    protected _refreshFromResult(resultAttr: Dto.PersistentObjectAttributeAsDetail, resultWins: boolean): boolean {
        const visibilityChanged = super._refreshFromResult(resultAttr, resultWins);

        if (this.objects != null && resultAttr.objects != null) {
            if (resultAttr.objects) {
                this.#objects = resultAttr.objects.map(po => {
                    const detailObj = this.service.hooks.onConstructPersistentObject(this.service, po);
                    detailObj.parent = this.parent;
                    detailObj.ownerDetailAttribute = this;

                    if (this.parent.isEditing)
                        detailObj.beginEdit();
    
                    return detailObj;
                });
            }
            else
                this.#setObjects([]);
        }

        return visibilityChanged;
    }

    /**
     * @inheritdoc
     */
    protected _toServiceObject() {
        const result = super._toServiceObject();

        if (this.objects != null) {
            result.objects = this.objects.map(obj => {
                const detailObj = obj.toServiceObject(true);
                if (obj.isDeleted)
                    detailObj.isDeleted = true;

                return detailObj;
            });
        }

        return result;
    }
}