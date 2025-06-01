import { IS_BROWSER } from "./environment.js";

const STORAGE_TEST_KEY = "__VIDYANO_COOKIE_LIB_STORAGE_TEST__";

let _cookiePrefix: string;

if (IS_BROWSER) {
    if (document.head) {
        const base = document.head.querySelector("base");
        if (base && base.href) {
            const parser = document.createElement("a");
            parser.href = base.href;
            _cookiePrefix = normalizePath(getDirectoryPath(parser.pathname));
        }
    }

    if (typeof _cookiePrefix !== 'string')
        _cookiePrefix = normalizePath(getDirectoryPath(document.location.pathname));
} else
    _cookiePrefix = '/';


const hasStorage = ((): boolean => {
    if (!IS_BROWSER)
        return false;

    try {
        window.localStorage.setItem(STORAGE_TEST_KEY, STORAGE_TEST_KEY);
        window.localStorage.removeItem(STORAGE_TEST_KEY);
        window.sessionStorage.setItem(STORAGE_TEST_KEY, STORAGE_TEST_KEY);
        window.sessionStorage.removeItem(STORAGE_TEST_KEY);

        return true;
    } catch (e) {
        return false;
    }
})();

/**
 * Normalizes a path string to ensure it starts and ends with a slash,
 * and collapses multiple consecutive slashes.
 * @param path - The path string to normalize.
 * @returns Normalized path string.
 */
function normalizePath(path: string | null | undefined): string {
    if (!path || path.trim() === "" || path.trim() === "/")
        return "/";

    let p = path.trim();
    if (!p.startsWith('/'))
        p = '/' + p;

    if (!p.endsWith('/'))
        p = p + '/';

    return p.replace(/\/\/+/g, '/');
}

/**
 * Extracts a directory path from a full path string (e.g., URL pathname).
 * Ensures the path ends with a '/', suitable for use as a cookie path prefix.
 * @param fullPath - The full path string.
 * @returns Normalized directory path.
 */
function getDirectoryPath(fullPath: string): string {
    if (!fullPath || fullPath === '/')
        return '/';

    const lastSlash = fullPath.lastIndexOf('/');

    if (lastSlash === -1)
        return '/';

    if (lastSlash === fullPath.length - 1)
        return fullPath;

    const partAfterLastSlash = fullPath.substring(lastSlash + 1);
    if (partAfterLastSlash.includes('.'))
        return fullPath.substring(0, lastSlash + 1);
    else
        return fullPath + '/';
}

/**
 * Clears a cookie from document.cookie.
 */
function clearActualCookie(name: string, path: string, domain?: string): void {
    if (!IS_BROWSER)
        return;

    let cookieString = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    cookieString += `; path=${path}`;

    if (domain)
        cookieString += `; domain=${domain}`;

    cookieString += `; SameSite=Lax`;
    document.cookie = cookieString;
}

/**
 * Gets or sets the cookie prefix used for storage keys and default cookie paths.
 * @param prefix - Optional prefix to set.
 * @returns The current cookie prefix.
 */
export function cookiePrefix(prefix?: string): string {
    if (prefix !== undefined && prefix !== null)
        _cookiePrefix = normalizePath(prefix);

    if (typeof _cookiePrefix !== 'string')
         if (IS_BROWSER && document.location)
            _cookiePrefix = normalizePath(getDirectoryPath(document.location.pathname));
        else
            _cookiePrefix = '/';

    return _cookiePrefix;
}

// --- Cookie Function Overloads ---

/**
 * Options for getting a cookie or storage value.
 */
export interface CookieGetOptions {
    /** If true, forces reading from document.cookie, bypassing Web Storage. */
    force?: boolean;
    /** If true, does not decode the value (retrieves it as stored). */
    raw?: boolean;
}

/**
 * Options for setting a cookie or storage value.
 */
export interface CookieSetOptions {
    /** If true, forces setting to document.cookie, bypassing Web Storage. */
    force?: boolean;
    /** If true, does not encode the value before storing. */
    raw?: boolean;
    /** The cookie path. Defaults to the current global cookie prefix. */
    path?: string;
    /** The cookie domain. */
    domain?: string;
    /** If true, marks the cookie as Secure (HTTPS only). */
    secure?: boolean;
    /**
     * Expiration time.
     * - Number: Days from now.
     * - Date: Specific expiration date.
     * - Omitted: Session cookie/storage.
     * - Negative number or past date: Deletes the cookie/storage item.
     */
    expires?: number | Date;
    /**
     * The SameSite attribute for the cookie. Defaults to 'Lax'.
     * If 'None', 'secure' must also be true.
     */
    sameSite?: 'Lax' | 'Strict' | 'None';
}

/**
 * Gets a cookie or storage value.
 * @param key - The key for the cookie or storage.
 * @param options - Optional settings for how to retrieve the value.
 * @returns The value string, or an empty string "" if not found/expired.
 */
export function cookie(key: string, options?: CookieGetOptions): string;

/**
 * Sets a cookie or storage value.
 * @param key - The key for the cookie or storage.
 * @param value - The value to set. Use `null` or `undefined` along with a past/negative `expires` to delete.
 * @param options - Additional options for setting the cookie.
 * @returns For Web Storage: The prefixed key. For document.cookie: The full cookie string.
 */
export function cookie(key: string, value: string | null | undefined, options?: CookieSetOptions): string;
/**
 * Gets or sets a cookie or storage value.
 * @param key - The key for the cookie or storage.
 * @param valueOrOptions - Optional value to set or options for getting the value.
 * @param optionsForSet - Optional settings for how to set the value.
 * @returns The value string, or an empty string "" if not found/expired, or the prefixed key/cookie string if setting.
 */
export function cookie(key: string, valueOrOptions?: string | null | undefined | CookieGetOptions, optionsForSet?: CookieSetOptions): string {
    const now = new Date();
    const currentGlobalPrefix = cookiePrefix();

    const isSetOperation =
        optionsForSet !== undefined ||
        (valueOrOptions !== undefined && typeof valueOrOptions !== 'object') ||
        valueOrOptions === null;


    if (isSetOperation) {
        // Set cookie or storage value
        const valueToSet = valueOrOptions as (string | null | undefined);
        let mergedOptions: CookieSetOptions = { ...(optionsForSet || {}) };

        // Intend to delete?
        if (valueToSet == null) {
            const expiresIsInThePast = mergedOptions.expires instanceof Date && mergedOptions.expires.getTime() < now.getTime();
            const expiresIsNegativeNumber = typeof mergedOptions.expires === "number" && mergedOptions.expires < 0;
            const expiresAlreadySetForDeletion = expiresIsInThePast || expiresIsNegativeNumber;

            if (!expiresAlreadySetForDeletion)
                mergedOptions.expires = -1; // Default to deletion if not already specified
        }

        let expiresDate: Date | undefined;
        if (typeof mergedOptions.expires === "number") {
            expiresDate = new Date();
            expiresDate.setDate(now.getDate() + mergedOptions.expires);
        } else if (mergedOptions.expires instanceof Date)
            expiresDate = mergedOptions.expires;

        const stringValue = String(valueToSet);
        const pathForCookie = mergedOptions.path ? normalizePath(mergedOptions.path) : currentGlobalPrefix;

        if (IS_BROWSER && hasStorage && !mergedOptions.force) {
            // Use Web Storage
            clearActualCookie(key, pathForCookie, mergedOptions.domain);

            const storageKey = currentGlobalPrefix + key;
            const itemToStore: { val: string; exp?: string } = {
                val: mergedOptions.raw ? stringValue : encodeURIComponent(stringValue),
            };

            try {
                if (expiresDate)
                    if (expiresDate > now) {
                        itemToStore.exp = expiresDate.toUTCString();
                        window.localStorage.setItem(storageKey, JSON.stringify(itemToStore));
                        window.sessionStorage.removeItem(storageKey);
                    } else {
                        window.localStorage.removeItem(storageKey);
                        window.sessionStorage.removeItem(storageKey);
                    }
                else {
                    window.sessionStorage.setItem(storageKey, JSON.stringify(itemToStore));
                    window.localStorage.removeItem(storageKey);
                }
            } catch (e) {
                console.error("Error interacting with Web Storage:", e);
            }

            return storageKey;
        } else {
            // Use document.cookie
            let cookieString = `${encodeURIComponent(key)}=${mergedOptions.raw ? stringValue : encodeURIComponent(stringValue)}`;

            if (expiresDate)
                cookieString += `; expires=${expiresDate.toUTCString()}`;

            cookieString += `; path=${pathForCookie}`;

            if (mergedOptions.domain)
                cookieString += `; domain=${mergedOptions.domain}`;

            if (mergedOptions.secure)
                cookieString += `; secure`;

            const sameSite = mergedOptions.sameSite || 'Lax';
            if (sameSite === 'None')
                if (!mergedOptions.secure) {
                    console.warn("SameSite=None requires the Secure attribute. Cookie may be rejected or treated as Lax.");
                    cookieString += `; SameSite=Lax`;
                } else
                    cookieString += `; SameSite=None`;
            else
                cookieString += `; SameSite=${sameSite}`;

            if (IS_BROWSER)
                document.cookie = cookieString;

            return cookieString;
        }
    } else {
        // Get cookie
        const readOptions: CookieGetOptions = (valueOrOptions as CookieGetOptions) || {};
        const decode = readOptions.raw ? (s: string) => s : decodeURIComponent;

        if (IS_BROWSER && hasStorage && !readOptions.force) {
            const storageKey = currentGlobalPrefix + key;
            let storedItemJson: string | null = null;
            let itemSource: 'session' | 'local' | null = null;

            try {
                storedItemJson = window.sessionStorage.getItem(storageKey);
                if (storedItemJson !== null)
                    itemSource = 'session';
                else {
                    storedItemJson = window.localStorage.getItem(storageKey);
                    if (storedItemJson !== null)
                        itemSource = 'local';
                }

                if (storedItemJson !== null && itemSource !== null) {
                    const item: { val: string; exp?: string } = JSON.parse(storedItemJson);

                    if (item.exp && itemSource === 'local') {
                        const expiryDate = new Date(item.exp);
                        if (expiryDate < now) {
                            window.localStorage.removeItem(storageKey);
                            return "";
                        }
                    }

                    return decode(item.val);
                }
            } catch (e) {
                console.error(`Error parsing/reading stored item for key '${storageKey}':`, e);

                if (itemSource === 'local' && storageKey)
                    window.localStorage.removeItem(storageKey);
                else if (itemSource === 'session' && storageKey)
                    window.sessionStorage.removeItem(storageKey);

                return "";
            }
        }

        if (IS_BROWSER && document.cookie) {
            const cookies = document.cookie.split('; ');
            for (const cookieStr of cookies) {
                const [namePart, ...valueParts] = cookieStr.split('=');
                if (decodeURIComponent(namePart.trim()) === key) {
                    const cookieValue = valueParts.join('=');
                    return decode(cookieValue);
                }
            }
        }

        return "";
    }
}