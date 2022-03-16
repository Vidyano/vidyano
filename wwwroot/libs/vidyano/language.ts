import type * as Dto from "./typings/service.js"
import { Observable } from "./common/observable.js"
import type { ServiceObject } from "./service-object.js"

export class Language extends Observable<ServiceObject> implements Dto.Language {
    constructor(private _language: Dto.Language, private _culture: string) {
        super();
    }

    get culture(): string {
        return this._culture;
    }

    get name(): string {
        return this._language.name;
    }

    get isDefault(): boolean {
        return this._language.isDefault;
    }

    get messages(): { [key: string]: string; } {
        return this._language.messages;
    }

    set messages(value: { [key: string]: string; }) {
        const oldMessages = this._language.messages;
        this.notifyPropertyChanged("messages", this._language.messages = value, oldMessages);
    }
}