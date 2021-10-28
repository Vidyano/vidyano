import * as Vidyano from "../../libs/vidyano/vidyano.js";
import { AppCacheEntry } from "./app-cache-entry.js";

export class AppCacheEntryQuery extends AppCacheEntry {
    query: Vidyano.Query;

    constructor(idOrQuery: string | Vidyano.Query) {
        super(typeof idOrQuery === "string" ? idOrQuery : null);

        if (idOrQuery instanceof Vidyano.Query)
            this.query = idOrQuery;
    }

    isMatch(entry: AppCacheEntryQuery): boolean {
        if (!(entry instanceof AppCacheEntryQuery))
            return false;

        if (entry.query === this.query)
            return true;

        return entry instanceof AppCacheEntryQuery && super.isMatch(entry);
    }
}