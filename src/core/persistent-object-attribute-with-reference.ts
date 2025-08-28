import { _internal } from "./_internals.js";
import { PersistentObjectAttribute } from "./persistent-object-attribute.js";
import type { PersistentObject } from "./persistent-object.js";
import type { Query } from "./query.js";
import type { QueryResultItem } from "./query-result-item.js";
import type { Service } from "./service.js";
import type * as Dto from "./typings/service.js";

/**
 * Represents a persistent object attribute that contains a reference to another persistent object.
 */
export class PersistentObjectAttributeWithReference extends PersistentObjectAttribute {
    #canAddNewReference: boolean;
    #displayAttribute: string;
    #lookup: Query;
    #objectId: string;
    #selectInPlace: boolean;

    /**
     * Initializes a new instance of the PersistentObjectAttributeWithReference class.
     * @param service - The service instance.
     * @param attr - The attribute data transfer object.
     * @param parent - The parent persistent object.
     */
    constructor(service: Service, attr: Dto.PersistentObjectAttributeWithReferenceDto, parent: PersistentObject) {
        super(service, attr, parent);

        if (attr.lookup) {
            this.#lookup = this.service.hooks.onConstructQuery(service, attr.lookup, parent, false, 1);
            _internal(this.#lookup).setOwnerAttributeWithReference(this);
        }
        else
            this.#lookup = null;

        this.#objectId = typeof attr.objectId === "undefined" ? null : attr.objectId;
        this.#displayAttribute = attr.displayAttribute;
        this.#canAddNewReference = !!attr.canAddNewReference;
        this.#selectInPlace = !!attr.selectInPlace;
        this.options = attr.options;
    }

    /**
     * Gets a value indicating whether a new reference can be added.
     */
    get canAddNewReference(): boolean {
        return this.#canAddNewReference;
    }

    /**
     * Gets the display attribute of the reference.
     */
    get displayAttribute(): string {
        return this.#displayAttribute;
    }

    /**
     * Gets the lookup query for this attribute.
     */
    get lookup(): Query {
        return this.#lookup;
    }

    /**
     * Gets the object id of the reference.
     */
    get objectId(): string {
        return this.#objectId;
    }

    /**
     * Gets a value indicating whether the reference should be selected in place.
     */
    get selectInPlace(): boolean {
        return this.#selectInPlace;
    }

    /**
     * Adds a new reference through the associated lookup query.
     * Opens the resulting persistent object as a dialog.
     * @returns A promise that resolves when the operation is complete.
     */
    async addNewReference(): Promise<void> {
        if (this.isReadOnly)
            return;

        try {
            const po = await this.service.executeAction("Query.New", this.parent, this.lookup, null, { PersistentObjectAttributeId: this.id });
            po.ownerAttributeWithReference = this;
            po.stateBehavior = (po.stateBehavior || "") + " OpenAsDialog";

            this.service.hooks.onOpen(po, false);
        }
        catch (e) {
            this.parent.setNotification(e);
        }
    }

    /**
     * Changes the reference to the selected items.
     * @param selectedItems - The items to set as the new reference.
     * @returns A promise that resolves to true when the reference has been changed.
     */
    changeReference(selectedItems: QueryResultItem[] | string[]): Promise<boolean> {
        return this.parent.queueWork(async () => {
            if (this.isReadOnly)
                throw "Attribute is read-only.";

            _internal(this.parent).prepareAttributesForRefresh(this);
            if (selectedItems.length && selectedItems.length > 0 && typeof selectedItems[0] === "string") {
                const selectedObjectIds = <string[]>selectedItems;
                selectedItems = selectedObjectIds.map(id => this.service.hooks.onConstructQueryResultItem(this.service, { id: id }, null));
            }

            const result = await this.service.executeAction("PersistentObject.SelectReference", this.parent, this.lookup, <QueryResultItem[]>selectedItems, { PersistentObjectAttributeId: this.id });
            if (result)
                _internal(this.parent).refreshFromResult(result, true);

            return true;
        });
    }

    /**
     * Gets the persistent object that this attribute references.
     * @returns A promise that resolves to the referenced persistent object, or null if none exists.
     */
    getPersistentObject(): Promise<PersistentObject> {
        if (!this.objectId)
            return Promise.resolve(null);

        return this.parent.queueWork(() => this.service.getPersistentObject(this.parent, this.lookup.persistentObject.id, this.objectId));
    }

    /**
     * Refreshes this attribute from a result attribute.
     * @param resultAttr - The result attribute to refresh from.
     * @param resultWins - Whether the result attribute takes precedence over local changes.
     * @returns True if the attribute's visibility changed.
     */
    protected _refreshFromResult(resultAttr: Dto.PersistentObjectAttributeWithReferenceDto, resultWins: boolean, snapshotDto?: Dto.PersistentObjectAttributeDto): boolean {
        const { objectId, isValueChanged, displayAttribute, canAddNewReference, selectInPlace } = this;

        if (resultWins || this.objectId !== resultAttr.objectId) {
            this.#objectId = resultAttr.objectId;
            this.isValueChanged = resultAttr.isValueChanged;
        }

        const visibilityChanged = super._refreshFromResult(resultAttr, resultWins, snapshotDto);

        this.#displayAttribute = resultAttr.displayAttribute;
        this.#canAddNewReference = resultAttr.canAddNewReference;
        this.#selectInPlace = resultAttr.selectInPlace;

        // Notify property changes if any of the relevant properties have changed
        const propertyChanges: Array<[string, any, any]> = [
            ["objectId", this.#objectId, objectId],
            ["isValueChanged", resultAttr.isValueChanged, isValueChanged],
            ["displayAttribute", this.#displayAttribute, displayAttribute],
            ["canAddNewReference", this.#canAddNewReference, canAddNewReference],
            ["selectInPlace", this.#selectInPlace, selectInPlace]
        ];

        for (const [prop, newValue, oldValue] of propertyChanges) {
            if (newValue !== oldValue)
                this.notifyPropertyChanged(prop, newValue, oldValue);
        }

        return visibilityChanged;
    }

    /**
     * Converts this attribute to a service object.
     * @returns The service object representation of this attribute.
     */
    protected _toServiceObject(): any {
        return super._toServiceObject({
            "objectId": this.objectId,
            "displayAttribute": this.displayAttribute,
        });
    }
}