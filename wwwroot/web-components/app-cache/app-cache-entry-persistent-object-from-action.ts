import * as Vidyano from "../../libs/vidyano/vidyano";
import { AppCacheEntryPersistentObject } from "./app-cache-entry-persistent-object";

export class AppCacheEntryPersistentObjectFromAction extends AppCacheEntryPersistentObject {
    constructor(po: Vidyano.PersistentObject, public fromActionId?: string, public fromActionIdReturnPath?: string) {
        super(po);
    }

    isMatch(entry: AppCacheEntryPersistentObjectFromAction): boolean {
        if (!(entry instanceof AppCacheEntryPersistentObjectFromAction))
            return false;

        return this.fromActionId === entry.fromActionId || entry.persistentObject === this.persistentObject;
    }
}