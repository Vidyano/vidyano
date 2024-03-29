import { Observable } from "./common/observable.js"
import type { PersistentObject } from "./persistent-object.js"
import type { PersistentObjectAttribute } from "./persistent-object-attribute.js"
import type { PersistentObjectAttributeGroup } from "./persistent-object-attribute-group.js"
import type { Query } from "./query.js"
import type { Service } from "./service.js"
import type { ServiceObjectWithActions } from "./service-object-with-actions.js"

export class PersistentObjectTab extends Observable<PersistentObjectTab> {
    tabGroupIndex: number;

    constructor(public service: Service, public name: string, public label: string, public target: ServiceObjectWithActions, public parent?: PersistentObject, private _isVisible = true) {
        super();
    }

    get isVisible(): boolean {
        return this._isVisible;
    }

    set isVisible(val: boolean) {
        const oldIsVisible = this._isVisible;
        if (oldIsVisible !== val)
            this.notifyPropertyChanged("isVisible", this._isVisible = val, oldIsVisible);
    }
}

export class PersistentObjectAttributeTab extends PersistentObjectTab {
    private _attributes: PersistentObjectAttribute[];

    constructor(service: Service, private _groups: PersistentObjectAttributeGroup[], public key: string, public id: string, name: string, private _layout: any, po: PersistentObject, public columnCount: number, isVisible: boolean) {
        super(service, name, String.isNullOrEmpty(key) ? po.label : key, po, po, isVisible);
        this.tabGroupIndex = 0;

        // Note: Backward compatibility check for older backend versions
        if (typeof columnCount === "string")
            this.columnCount = parseInt(<any>columnCount);

        this._attributes = this._updateAttributes();
    }

    get isVisible(): boolean {
        return !this.parent.isHidden && super.isVisible;
    }

    set isVisible(val: boolean) {
        super.isVisible = val;
    }

    get layout(): any {
        return this._layout;
    }

    private _setLayout(layout: any) {
        const oldLayout = this._layout;
        this.notifyPropertyChanged("layout", this._layout = layout, oldLayout);
    }

    get attributes(): PersistentObjectAttribute[] {
        return this._attributes;
    }

    get groups(): PersistentObjectAttributeGroup[] {
        return this._groups;
    }

    set groups(groups: PersistentObjectAttributeGroup[]) {
        const oldGroups = this._groups;
        this.notifyPropertyChanged("groups", this._groups = groups, oldGroups);

        const oldAttributes = this._attributes;
        this.notifyPropertyChanged("attributes", this._attributes = this._updateAttributes(), oldAttributes);
    }

    async saveLayout(layout: any): Promise<any> {
        await this.service.executeAction("System.SaveTabLayout", null, null, null, { "Id": this.id, "Layout": layout ? JSON.stringify(layout) : "" });
        this._setLayout(layout);
    }

    private _updateAttributes(): PersistentObjectAttribute[] {
        const attributes = [].concat(...this.groups.map(grp => grp.attributes));
        attributes.forEach(attr => attributes[attr.name] = attr);

        this.isVisible = attributes.some(attr => attr.isVisible);

        return attributes;
    }
}

export class PersistentObjectQueryTab extends PersistentObjectTab {
    constructor(service: Service, public query: Query) {
        super(service, query.name, query.label, query, query.parent, !query.isHidden);
        this.tabGroupIndex = 1;
    }

    get isVisible(): boolean {
        return !this.query.isHidden;
    }
}