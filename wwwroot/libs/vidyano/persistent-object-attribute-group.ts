import { Observable } from "./common/observable.js"
import type { PersistentObject } from "./persistent-object.js"
import type { PersistentObjectAttribute } from "./persistent-object-attribute.js"
import type { Service } from "./service.js"

export class PersistentObjectAttributeGroup extends Observable<PersistentObjectAttributeGroup> {
    private _attributes: PersistentObjectAttribute[];
    label: string;
    index: number;

    constructor(public service: Service, public key: string, _attributes: PersistentObjectAttribute[], public parent: PersistentObject) {
        super();

        this.label = key || "";
        this.attributes = _attributes;
    }

    get attributes(): PersistentObjectAttribute[] {
        return this._attributes;
    }

    set attributes(attributes: PersistentObjectAttribute[]) {
        const oldAttributes = this._attributes;
        const newAttributes = attributes;
        newAttributes.forEach(attr => newAttributes[attr.name] = attr);

        this.notifyPropertyChanged("attributes", this._attributes = newAttributes, oldAttributes);
    }
}