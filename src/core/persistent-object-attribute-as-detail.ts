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
     * @param service - The service instance.
     * @param attr - The attribute data.
     * @param parent - The parent persistent object.
     */
    constructor(service: Service, attr: Dto.PersistentObjectAttributeAsDetailDto, parent: PersistentObject) {
        super(service, attr, parent);

        this.#details = attr.details ? this.service.hooks.onConstructQuery(service, attr.details, parent, false, 1) : null;
        this.#lookupAttribute = attr.lookupAttribute;

        const initialObjects = attr.objects ? attr.objects.map(po => {
            const detailObj = this.service.hooks.onConstructPersistentObject(service, po);
            detailObj.parent = parent;
            detailObj.ownerDetailAttribute = this;

            return detailObj;
        }) : [];

        this.#objects = this.#createObservableArray(initialObjects);

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
     * Creates an observable array proxy that notifies about mutations.
     * @param array - The array to wrap.
     * @returns A proxied array that notifies on mutations.
     */
    #createObservableArray(array: PersistentObject[]): PersistentObject[] {
        const self = this;

        return new Proxy(array, {
            set(target, prop, value) {
                // Handle length changes (these come from mutations, not direct length assignment)
                if (prop === 'length') {
                    const oldLength = target.length;
                    const result = Reflect.set(target, prop, value);

                    // If length decreased, items were removed
                    if (value < oldLength) {
                        const removed = target.slice(value, oldLength);
                        self.notifyArrayChanged("objects", value, removed, 0);
                        self.notifyPropertyChanged("objects", target as PersistentObject[], target as PersistentObject[]);
                    }

                    return result;
                }

                // Handle array index assignment
                if (typeof prop === 'string' && /^\d+$/.test(prop)) {
                    const index = parseInt(prop);
                    const oldValue = target[index];
                    const result = Reflect.set(target, prop, value);

                    if (oldValue === undefined) {
                        // New item added
                        self.notifyArrayChanged("objects", index, [], 1);
                    } else {
                        // Item replaced
                        self.notifyArrayChanged("objects", index, [oldValue], 1);
                    }

                    self.notifyPropertyChanged("objects", target as PersistentObject[], target as PersistentObject[]);
                    return result;
                }

                return Reflect.set(target, prop, value);
            },

            get(target, prop) {
                const value = target[prop as keyof typeof target];

                // Intercept mutating array methods
                if (typeof value === 'function') {
                    const methodName = prop as string;

                    // Methods that mutate the array
                    if (['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin'].includes(methodName)) {
                        return function (this: PersistentObject[], ...args: any[]) {
                            const oldLength = target.length;

                            // Execute the original method
                            const result = (value as Function).apply(target, args);

                            // Notify based on the method
                            if (methodName === 'push') {
                                self.notifyArrayChanged("objects", oldLength, [], args.length);
                            } else if (methodName === 'pop') {
                                if (result !== undefined) {
                                    self.notifyArrayChanged("objects", oldLength - 1, [result], 0);
                                }
                            } else if (methodName === 'shift') {
                                if (result !== undefined) {
                                    self.notifyArrayChanged("objects", 0, [result], 0);
                                }
                            } else if (methodName === 'unshift') {
                                self.notifyArrayChanged("objects", 0, [], args.length);
                            } else if (methodName === 'splice') {
                                const [start, _deleteCount = 0, ...items] = args;
                                const actualStart = start < 0 ? Math.max(0, oldLength + start) : Math.min(start, oldLength);
                                self.notifyArrayChanged("objects", actualStart, result as PersistentObject[], items.length);
                            } else if (methodName === 'sort' || methodName === 'reverse') {
                                // For sort/reverse, treat as complete array replacement
                                self.notifyArrayChanged("objects", 0, [], target.length);
                            } else if (methodName === 'fill') {
                                const [_fillValue, start = 0, end = target.length] = args;
                                const actualStart = start < 0 ? Math.max(0, target.length + start) : Math.min(start, target.length);
                                const actualEnd = end < 0 ? Math.max(0, target.length + end) : Math.min(end, target.length);
                                const count = Math.max(0, actualEnd - actualStart);
                                if (count > 0) {
                                    self.notifyArrayChanged("objects", actualStart, [], count);
                                }
                            } else if (methodName === 'copyWithin') {
                                // Treat as mutation of the affected range
                                self.notifyArrayChanged("objects", 0, [], target.length);
                            }

                            // Always notify property changed to trigger forwarder rebinding
                            self.notifyPropertyChanged("objects", target as PersistentObject[], target as PersistentObject[]);

                            return result;
                        };
                    }
                }

                return value;
            }
        });
    }

    /**
     * Handles change events and triggers refresh if allowed.
     * @param allowRefresh - Indicates if refresh is allowed.
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
     * @param objects - The new set of detail objects.
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
        this.#objects = this.#createObservableArray(objects);
        this.notifyPropertyChanged("objects", this.#objects, oldObjects);
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
    protected _refreshFromResult(resultAttr: Dto.PersistentObjectAttributeAsDetailDto, resultWins: boolean, snapshotDto?: Dto.PersistentObjectAttributeDto): boolean {
        const visibilityChanged = super._refreshFromResult(resultAttr, resultWins, snapshotDto);

        if (resultAttr.objects != null) {
            const newObjects = resultAttr.objects.map(po => {
                const detailObj = this.service.hooks.onConstructPersistentObject(this.service, po);
                detailObj.parent = this.parent;
                detailObj.ownerDetailAttribute = this;

                if (this.parent.isEditing)
                    detailObj.beginEdit();

                return detailObj;
            });

            this.#setObjects(newObjects);
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