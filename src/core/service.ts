import { IS_BROWSER } from "./environment.js";
import type * as Dto from "./typings/service.js";
import { Observable } from "./observable";
import type { Application } from "./application.js";
import type { IClientOperation } from "./client-operations.js";
import { Language } from "./language.js";
import { PersistentObject } from "./persistent-object.js";
import { PersistentObjectAttribute } from "./persistent-object-attribute.js";
import { PersistentObjectAttributeAsDetail } from "./persistent-object-attribute-as-detail.js";
import { ActionDefinition } from "./action-definition.js";
import { ServiceHooks } from "./service-hooks.js";
import { cookie, cookiePrefix } from "./cookie.js";
import { NoInternetMessage } from "./no-internet-message.js";
import type { Query } from "./query.js";
import type { QueryResultItem } from "./query-result-item.js";
import { CultureInfo } from "./cultures.js";
import { ExecuteActionArgs } from "./execute-action-args.js";
import { DataType } from "./service-data-type.js";
import Boolean from "./common/boolean.js";
import "./actions.js";
import { sleep } from "./common/sleep.js";
import { fetchEventSource, EventSourceMessage } from "@microsoft/fetch-event-source";
import { _internal } from "./_internals.js";

export { NotificationType } from "./typings/service.js";

/**
 * The current version of the Vidyano client.
 */
export let version = "vidyano-latest-version";

/**
 * Options for retrieving a query.
 */
export type GetQueryOptions = {
    /**
     * If true, the query is treated as a lookup query.
     * @defaultValue false
     */
    asLookup?: boolean;

    /**
     * Optional overrides for specific columns in the query.
     * Each override can specify which columns to include or exclude.
     */
    columnOverrides?: {
        /**
         * The name of the column to override.
         */
        name: string;

        /**
         * Optional list of includes.
         */
        includes?: string[];

        /**
         * Optional list excludes.
         */
        excludes?: string[];
    }[];

    /**
     * Optional parent persistent object if this is a detail query.
     */
    parent?: PersistentObject;

    /**
     * Optional text search string to filter query results.
     */
    textSearch?: string;

    /**
     * Optional sort options string to apply to the query results.
     */
    sortOptions?: string;
};

/**
 * Options for retrieving a stream associated with an action or persistent object.
 */
export type GetStreamOptions = {
    /**
     * Optional action name that produces the stream.
     */
    action?: string;

    /**
     * Optional parent persistent object context.
     */
    parent?: PersistentObject;

    /**
     * Optional query context for the stream.
     */
    query?: Query;

    /**
     * Optional selected items coming from a query.
     */
    selectedItems?: Array<QueryResultItem> | null;

    /**
     * Optional parameters payload for the action producing the stream.
     */
    parameters?: any;

    /**
     * Optional callback invoked when the stream is successfully retrieved.
     */
    onSuccess?: (blob: Blob, filename: string) => Promise<void> | void;

    /**
     * Optional callback invoked when an error occurs while retrieving the stream.
     */
    onError?: (error: Error) => Promise<void> | void;
};

/**
 * Represents the service layer for interacting with the Vidyano backend.
 * Manages authentication, data fetching, and action execution.
 */
export class Service extends Observable<Service> {
    readonly #useCookieStore: boolean;
    #lastAuthTokenUpdate: Date = new Date();
    #isUsingDefaultCredentials: boolean;
    #clientData: Dto.ClientDataDto;
    #language: Language;
    #languages: Language[];
    #windowsAuthentication: boolean;
    #providers: { [name: string]: Dto.ProviderParametersDto };
    #isSignedIn: boolean;
    #application: Application;
    #userName: string;
    #authToken: string;
    #profile: boolean;
    #profiledRequests: Dto.ProfilerRequestDto[];
    #queuedClientOperations: IClientOperation[] = [];
    #initial: PersistentObject;
    #requestedLanguage: string;

    /**
     * Gets or sets a flag indicating whether to stay signed in.
     * This value is persisted in a cookie if not in transient mode.
     */
    public staySignedIn: boolean;

    /**
     * Gets or sets a record of icon keys to their data (e.g., SVG content).
     * Populated after application initialization.
     */
    public icons: Record<string, string>;

    /**
     * Gets or sets a record of action definitions, keyed by action name.
     * Populated after application initialization.
     */
    public actionDefinitions: Record<string, ActionDefinition> = {};

    /**
     * Gets or sets the environment string sent to the backend (e.g., "Web").
     * @defaultValue "Web"
     */
    public environment: string = "Web";

    /**
     * Gets or sets the environment version string sent to the backend.
     * @defaultValue "3"
     */
    // TEMPORARY: Change this back to version.match(/^(\d+)/)?.[1] || "3";
    //            when the backend supports version to be greater than 3.
    public environmentVersion: string = "3";

    /**
     * Gets or sets a flag indicating whether site data should be cleared on sign-out.
     */
    public clearSiteData: boolean;

    /**
     * Initializes a new instance of the Service class.
     * @param serviceUri - The base URI of the Vidyano service.
     * @param hooks - Optional service hooks for customizing behavior.
     * @param isTransient - Optional flag indicating if the service is transient (true) or uses cookies for state (false). Defaults to false.
     */
    constructor(public serviceUri: string, public hooks: ServiceHooks = new ServiceHooks(), public readonly isTransient: boolean = false) {
        super();

        this.#useCookieStore = !isTransient && IS_BROWSER;

        _internal(this.hooks).setService(this);

        if (!isTransient && IS_BROWSER)
            this.staySignedIn = cookie("staySignedIn", { force: true }) === "true";
    }

    /**
     * Gets the array of queued client operations.
     */
    public get queuedClientOperations(): IClientOperation[] {
        return this.#queuedClientOperations;
    }

    /**
     * Gets the current Vidyano application instance.
     * This is populated after successful initialization or sign-in.
     */
    public get application(): Application {
        return this.#application;
    }
    #setApplication(application: Application) {
        if (this.#application === application) {
            return;
        }

        const oldApplication = this.#application;
        this.notifyPropertyChanged("application", this.#application = application, oldApplication);

        if (this.#application && this.#application.canProfile && IS_BROWSER)
            this.profile = !!Boolean.parse(cookie("profile"));
        else
            this.profile = false;
    }

    /**
     * Gets the initial persistent object, if any, defined by the application.
     */
    public get initial(): PersistentObject {
        return this.#initial;
    }

    /**
     * Clears the initial persistent object.
     */
    public clearInitial() {
        const oldInitial = this.#initial;
        this.notifyPropertyChanged("initial", this.#initial = null, oldInitial);
    }

    /**
     * Gets or sets the current language used by the service.
     * Changing this property will notify observers.
     */
    public get language(): Language {
        return this.#language;
    }
    public set language(l: Language) {
        if (this.#language === l)
            return;

        const oldLanguage = this.#language;
        this.notifyPropertyChanged("language", this.#language = l, oldLanguage);
    }

    /**
     * Gets or sets the requested language.
     * This value is persisted in a cookie.
     */
    public get requestedLanguage(): string {
        return this.#useCookieStore ? cookie("requestedLanguage") : (this.#requestedLanguage ?? "");
    }
    public set requestedLanguage(val: string) {
        if (this.requestedLanguage === val)
            return;

        if (this.#useCookieStore)
            cookie("requestedLanguage", val);
        else
            this.#requestedLanguage = val;
    }

    /**
     * Gets a flag indicating whether the user is currently signed in.
     */
    public get isSignedIn(): boolean {
        return this.#isSignedIn;
    }
    #setIsSignedIn(val: boolean) {
        const oldIsSignedIn = this.#isSignedIn;
        this.#isSignedIn = val;

        const oldIsUsingDefaultCredentials = this.#isUsingDefaultCredentials;
        this.#isUsingDefaultCredentials = this.defaultUserName && this.userName && this.defaultUserName.toLowerCase() === this.userName.toLowerCase();

        if (oldIsSignedIn !== this.#isSignedIn)
            this.notifyPropertyChanged("isSignedIn", this.#isSignedIn, oldIsSignedIn);

        // NOTE: This property was not notified before. Added for consistency.
        if (oldIsUsingDefaultCredentials !== this.#isUsingDefaultCredentials) {
            this.notifyPropertyChanged("isUsingDefaultCredentials", this.#isUsingDefaultCredentials, oldIsUsingDefaultCredentials);
        }
    }

    /**
     * Gets the array of available languages.
     */
    public get languages(): Language[] {
        return this.#languages;
    }

    /**
     * Gets a flag indicating whether Windows Authentication is enabled on the server.
     */
    public get windowsAuthentication(): boolean {
        return this.#windowsAuthentication;
    }

    /**
     * Gets a dictionary of external authentication providers and their parameters.
     */
    public get providers(): { [name: string]: Dto.ProviderParametersDto } {
        return this.#providers;
    }

    /**
     * Gets a flag indicating whether the service is currently using default credentials.
     */
    public get isUsingDefaultCredentials(): boolean {
        return this.#isUsingDefaultCredentials;
    }

    /**
     * Gets or sets the current user name.
     */
    public get userName(): string {
        return this.#useCookieStore ? cookie("userName") : this.#userName;
    }
    public set userName(val: string) {
        const oldUserName = this.userName;
        if (oldUserName === val)
            return;

        if (this.#useCookieStore)
            cookie("userName", val, { expires: this.staySignedIn ? 365 : 30 });
        else
            this.#userName = val;

        this.notifyPropertyChanged("userName", val, oldUserName);
    }

    /**
     * Gets the default user name, if configured on the server.
     */
    public get defaultUserName(): string {
        return !!this.#clientData ? this.#clientData.defaultUser || null : null;
    }

    /**
     * Gets the user name, if any, configured to use while registering a new user.
     */
    public get registerUserName(): string {
        return !!this.#providers && this.#providers["Vidyano"] ? this.#providers["Vidyano"].registerUser || null : null;
    }

    /**
     * Gets or sets the authentication token.
     */
    public get authToken(): string {
        return this.#useCookieStore ? cookie("authToken") : this.#authToken;
    }
    public set authToken(val: string) {
        if (this.#useCookieStore) {
            const oldAuthToken = this.authToken;

            if (this.staySignedIn)
                cookie("authToken", val, { expires: 14 });
            else
                cookie("authToken", val);

            if (!oldAuthToken && val && IS_BROWSER) {
                localStorage.setItem("vi-setAuthToken", JSON.stringify({ cookiePrefix: cookiePrefix(), authToken: val }));
                localStorage.removeItem("vi-setAuthToken");
            }
        } else
            this.#authToken = val;
    }

    /**
     * Gets the type of the current authentication token ("Basic", "JWT", or null).
     */
    public get authTokenType(): "Basic" | "JWT" | null {
        if (!this.authToken)
            return null;

        return this.authToken.startsWith("JWT:") ? "JWT" : "Basic";
    }

    /**
     * Gets or sets a flag indicating whether profiling is enabled.
     * If enabled, requests and responses will be logged.
     */
    public get profile(): boolean {
        return this.#profile;
    }
    public set profile(val: boolean) {
        if (this.#profile === val)
            return;

        const currentProfileCookie = this.#useCookieStore ? !!Boolean.parse(cookie("profile")) : false;
        if (this.#useCookieStore && currentProfileCookie !== val)
            cookie("profile", String(val));

        const oldValue = this.#profile;
        this.#profile = val;

        if (!val)
            this.#setProfiledRequests([]);

        this.notifyPropertyChanged("profile", val, oldValue);
    }

    /**
     * Gets the list of profiled requests, if profiling is enabled.
     */
    public get profiledRequests(): Dto.ProfilerRequestDto[] {
        return this.#profiledRequests;
    }
    #setProfiledRequests(requests: Dto.ProfilerRequestDto[]) {
        this.notifyPropertyChanged("profiledRequests", this.#profiledRequests = requests);
    }    

    /**
     * Gets a translated message string for the given key, substituting parameters.
     * @param key - The key of the message to translate.
     * @param params - Optional parameters to substitute into the translated string.
     * @returns The translated string, or the key if no translation is found.
     */
    public getTranslatedMessage(key: string, ...params: string[]): string {
        return String.format.apply(null, [this.language.messages[key] || key].concat(params));
    }

    /**
     * Gets the credential type required for the specified user name.
     * @param userName - The user name to check.
     * @returns A promise resolving to the credential type information.
     */
    public async getCredentialType(userName: string) {
        return this.#postJSON(this.#createUri("authenticate/GetCredentialType"), { userName: userName });
    }

    /**
     * Initializes the service by fetching client data and optionally attempting to sign in.
     * @param skipDefaultCredentialLogin - If true, skips automatic login with default credentials. Defaults to false.
     * @returns A promise resolving to the Application instance if sign-in was successful, otherwise null or throws an error.
     */
    public async initialize(skipDefaultCredentialLogin?: boolean): Promise<Application>;
    /**
     * Initializes the service by fetching client data and signing in with a one-time sign-in token.
     * Passing a token will always skip default credential login.
     * @param oneTimeSignInToken - The one-time sign-in token to use for authentication.
     * @returns A promise resolving to the Application instance if sign-in was successful, otherwise null or throws an error.
     */
    public async initialize(oneTimeSignInToken: string): Promise<Application>;
    public async initialize(arg?: boolean | string): Promise<Application> {
        let skipDefaultCredentialLogin: boolean = false;
        let oneTimeSignInToken: string = null;
        if (typeof arg === "string") {
            oneTimeSignInToken = arg;
            skipDefaultCredentialLogin = true;
        } else if (typeof arg === "boolean") {
            skipDefaultCredentialLogin = arg;
        }

        let url = "GetClientData?v=3";
        if (this.requestedLanguage)
            url = `${url}&lang=${this.requestedLanguage}`;

        this.#clientData = await this.hooks.onInitialize(await (this.#getJSON(this.#createUri(url))));

        if (this.#clientData.exception)
            throw this.#clientData.exception;

        const languages = Object.keys(this.#clientData.languages).map(culture => new Language(this.#clientData.languages[culture], culture));
        this.hooks.setDefaultTranslations(languages);

        this.#languages = languages;
        this.language = this.#languages.find(l => l.isDefault) || this.#languages[0];

        this.#providers = {};
        for (const provider in this.#clientData.providers) {
            this.#providers[provider] = this.#clientData.providers[provider].parameters;
        }
        this.#windowsAuthentication = this.#clientData.windowsAuthentication;

        if (oneTimeSignInToken) {
            if (!oneTimeSignInToken.startsWith("JWT:")) {
                const tokenParts = oneTimeSignInToken.split("/", 2);

                this.userName = atob(tokenParts[0]);
                this.authToken = tokenParts[1].replace("_", "/");
            } else
                this.authToken = oneTimeSignInToken;

            const returnUrl = IS_BROWSER ? cookie("returnUrl", { force: true }) || "" : "";
            if (IS_BROWSER && returnUrl)
                cookie("returnUrl", null, { force: true });

            this.hooks.onNavigate(returnUrl, true);

            return this.#getApplication();
        }

        this.userName = this.userName || this.#clientData.defaultUser;

        let application: Application;
        if (!String.isNullOrEmpty(this.authToken) || ((this.#clientData.defaultUser || this.windowsAuthentication) && !skipDefaultCredentialLogin)) {
            try {
                application = await this.#getApplication();
            } catch (e) {
                application = null;
            }
        } else
            this.#setIsSignedIn(!!this.application);

        return application;
    }

    /**
     * Initiates sign-in via an external authentication provider.
     * Redirects the browser to the provider's sign-in page.
     * @param providerName - The name of the external provider.
     */
    public async signInExternal(providerName: string) {
        if (!this.#clientData)
            await this.initialize(true);

        if (!this.providers[providerName] || !this.providers[providerName].requestUri)
            throw "Provider not found or not flagged for external authentication.";

        if (!IS_BROWSER)
            throw new Error("Cannot sign in using external provider in a non-browser environment.");

        document.location.href = this.providers[providerName].requestUri;
    }

    /**
     * Signs in using user name and password credentials.
     * @param userName - The user name.
     * @param password - The password.
     * @param staySignedIn - Optional: A boolean indicating whether to stay signed in.
     * @returns A promise resolving to the Application instance upon successful sign-in.
     */
    public async signInUsingCredentials(userName: string, password: string, staySignedIn?: boolean): Promise<Application>;
    /**
     * Signs in using user name, password, and a 2FA code.
     * @param userName - The user name.
     * @param password - The password.
     * @param code - The 2FA code.
     * @param staySignedIn - Optional: A boolean indicating whether to stay signed in.
     * @returns A promise resolving to the Application instance upon successful sign-in.
     */
    public async signInUsingCredentials(userName: string, password: string, code: string, staySignedIn?: boolean): Promise<Application>;
    public async signInUsingCredentials(userName: string, password: string, staySignedInOrCode?: string | boolean, staySignedIn?: boolean): Promise<Application> {
        if (!this.#clientData)
            await this.initialize(true);

        this.userName = userName;

        const data = this.#createData("getApplication");
        data.userName = userName;
        data.password = password;

        if (typeof staySignedInOrCode === "string")
            data.code = staySignedInOrCode;

        try {
            const application = await this.#getApplication(data);
            if (application && this.isSignedIn && this.#useCookieStore) {
                const ssi = (typeof staySignedInOrCode === "boolean" && staySignedInOrCode) || (typeof staySignedIn === "boolean" && staySignedIn);
                cookie("staySignedIn", (this.staySignedIn = ssi) ? "true" : null, { force: true, expires: 365 });
            }

            return application;
        } catch (e) {
            throw e;
        }
    }

    /**
     * Signs in using default credentials, if available (e.g., Windows Authentication or pre-configured user).
     * @returns A promise resolving to the Application instance upon successful sign-in.
     */
    public async signInUsingDefaultCredentials(): Promise<Application> {
        if (!this.#clientData) {
            // Initialize and let it handle the default credential login
            return this.initialize(false);
        }

        // If already initialized, proceed with sign in
        this.userName = this.defaultUserName;

        return this.#getApplication();
    }

    /**
     * Signs out the current user.
     * @param skipAcs - Optional flag to skip ACS (Access Control Service) sign-out. Defaults to false.
     * @returns A promise resolving to true if sign-out was successful.
     */
    public async signOut(skipAcs?: boolean): Promise<boolean> {
        if (this.clearSiteData && !!this.authToken)
            this.executeAction("PersistentObject.viSignOut", this.application, null, null, null, true);

        if (this.userName === this.defaultUserName || this.userName === this.registerUserName || this.clearSiteData)
            this.userName = null;

        this.authToken = null;
        this.#setApplication(null);

        if (!skipAcs && this.#providers["Acs"] && this.#providers["Acs"].signOutUri) {
            return new Promise((resolve, reject) => {
                if (!IS_BROWSER) {
                    reject(new Error("Cannot sign out using ACS in a non-browser environment."));
                    return;
                }

                const iframe = document.createElement("iframe");
                iframe.setAttribute("hidden", "");
                iframe.width = "0";
                iframe.height = "0";
                iframe.src = this.#providers["Acs"].signOutUri;
                iframe.onload = () => {
                    document.body.removeChild(iframe);
                    this.#setIsSignedIn(false);

                    resolve(true);
                };
                iframe.onerror = () => {
                    this.#setIsSignedIn(false);
                    resolve(true);
                };

                document.body.appendChild(iframe);
            });
        }

        this.clearSiteData = false;
        this.#setIsSignedIn(false);
        return Promise.resolve(true);
    }

    /**
     * Retrieves a query definition and its initial data.
     * @param id - The ID of the query.
     * @param optionsOrAsLookup - Either an options object or a boolean indicating if the query is for lookup purposes.
     * @param parent - Optional parent persistent object if this is a detail query.
     * @param textSearch - Optional text search string.
     * @param sortOptions - Optional sort options string.
     * @returns A promise resolving to the Query instance.
     */
    public async getQuery(id: string, optionsOrAsLookup?: boolean | GetQueryOptions, parent?: PersistentObject, textSearch?: string, sortOptions?: string): Promise<Query> {
        const data = this.#createData("getQuery");
        data.id = id;

        const options = typeof optionsOrAsLookup === "object" ? optionsOrAsLookup : {
            asLookup: optionsOrAsLookup,
            parent,
            textSearch,
            sortOptions
        };

        if (options.parent != null)
            data.parent = options.parent.toServiceObject();

        if (!!options.textSearch)
            data.textSearch = options.textSearch;

        if (!!options.sortOptions)
            data.sortOptions = options.sortOptions;

        if (!!options.columnOverrides)
            data.columnOverrides = options.columnOverrides;

        const result = await this.#postJSON(this.#createUri("GetQuery"), data);
        if (result.exception)
            throw result.exception;

        return this.hooks.onConstructQuery(this, result.query, null, options.asLookup);
    }

    /**
     * Retrieves a persistent object.
     * @param parent - Optional parent persistent object if this object is a detail.
     * @param id - The type ID of the persistent object.
     * @param objectId - Optional ID of an existing object to load.
     * @param isNew - Optional flag indicating if a new object should be created.
     * @returns A promise resolving to the PersistentObject instance.
     */
    public async getPersistentObject(parent: PersistentObject | null, id: string, objectId?: string, isNew?: boolean): Promise<PersistentObject> {
        const data = this.#createData("getPersistentObject");
        data.persistentObjectTypeId = id;
        data.objectId = objectId;
        if (isNew)
            data.isNew = isNew;
        
        if (parent != null)
            data.parent = parent.toServiceObject();

        const result = await this.#postJSON(this.#createUri("GetPersistentObject"), data);
        if (result.exception) {
            throw result.exception;
        } else if (result.result && result.result.notification) {
            if (result.result.notificationDuration) {
                this.hooks.onShowNotification(result.result.notification, result.result.notificationType, result.result.notificationDuration);
                result.result.notification = null;
                result.result.notificationDuration = 0;
            } else if (result.result.notificationType === "Error") {
                throw result.result.notification;
            }
        }

        return this.hooks.onConstructPersistentObject(this, result.result);
    }

    /**
     * Executes a query to retrieve or refresh its data.
     * @param parent - Optional parent persistent object if this is a detail query.
     * @param query - The query to execute.
     * @param asLookup - Optional flag indicating if the query is for lookup purposes. Defaults to false.
     * @param throwExceptions - Optional flag to throw exceptions instead of setting them as query notifications. Defaults to false.
     * @returns A promise resolving to the query result data.
     */
    public async executeQuery(parent: PersistentObject, query: Query, asLookup: boolean = false, throwExceptions?: boolean): Promise<Dto.QueryResultDto> {
        const data = this.#createData("executeQuery");
        data.query = _internal(query).toServiceObject();

        if (parent != null)
            data.parent = parent.toServiceObject();

        if (asLookup)
            data.asLookup = asLookup;

        if (query.ownerAttributeWithReference)
            data.forReferenceAttribute = query.ownerAttributeWithReference.name;

        try {
            const result = await this.#postJSON(this.#createUri("ExecuteQuery"), data);
            if (result.exception)
                throw result.exception;

            const queryResult = <Dto.QueryResultDto>result.result;
            if (queryResult.continuation) {
                const wanted = <number>data.query.top || queryResult.pageSize;

                while (queryResult.continuation && queryResult.items.length < wanted) {
                    data.query.continuation = queryResult.continuation;
                    data.query.top = wanted - queryResult.items.length;

                    const innerResult = await this.#postJSON(this.#createUri("ExecuteQuery"), data);
                    if (innerResult.exception)
                        throw innerResult.exception;

                    const innerQueryResult = <Dto.QueryResultDto>innerResult.result;
                    queryResult.items.push(...innerQueryResult.items);
                    queryResult.continuation = innerQueryResult.continuation;
                }

                if (!queryResult.continuation)
                    queryResult.totalItems = query.items.length + queryResult.items.length;
            }

            return queryResult;
        } catch (e) {
            query.setNotification(e);

            if (throwExceptions)
                throw e;
        }
    }

    /**
     * Executes an action on a persistent object.
     * @param action - The name of the persistent object action to execute (must start with "PersistentObject.").
     * @param persistentObject - The persistent object to execute the action on.
     * @param query - Optional query context.
     * @param selectedItems - Optional array of selected query result items.
     * @param parameters - Optional parameters for the action.
     * @returns A promise resolving to the resulting PersistentObject, if any.
     */
    public async executeAction(action: `PersistentObject.${string}`, persistentObject: PersistentObject, query?: Query, selectedItems?: Array<QueryResultItem>, parameters?: any): Promise<PersistentObject>;

    /**
     * Executes an action on a query.
     * @param action - The name of the query action to execute (must start with "Query.").
     * @param parent - Optional parent persistent object (for context).
     * @param query - The query to execute the action on.
     * @param selectedItems - An array of selected query result items.
     * @param parameters - Optional parameters for the action.
     * @returns A promise resolving to the resulting PersistentObject, if any.
     */
    public async executeAction(action: `Query.${string}`, parent: PersistentObject | undefined, query: Query, selectedItems: Array<QueryResultItem>, parameters?: any): Promise<PersistentObject>;

    /**
     * Executes an action on a query.
     * @param action - The name of the action to execute.
     * @param parent - The parent persistent object (for context).
     * @param query - The query to execute the action on.
     * @param selectedItems - An array of selected query result items.
     * @param parameters - Optional parameters for the action.
     * @returns A promise resolving to the resulting PersistentObject, if any.
     */
    public async executeAction(action: string, parent: PersistentObject, query: Query, selectedItems: Array<QueryResultItem>, parameters?: any): Promise<PersistentObject>;

    /**
     * @internal
     * Executes an action on a persistent object or query.
     * @param action - The name of the action to execute.
     * @param parent - The parent persistent object (for object actions or context).
     * @param query - The query (for query actions).
     * @param selectedItems - An array of selected query result items (for query actions).
     * @param parameters - Optional parameters for the action.
     * @param skipHooks - Internal flag to skip hooks during retry.
     * @returns A promise resolving to the resulting PersistentObject, if any.
     */
    public async executeAction(action: string, parent: PersistentObject, query: Query, selectedItems: Array<QueryResultItem>, parameters?: any, skipHooks?: boolean): Promise<PersistentObject>;

    /**
     * Executes an action on a persistent object or query.
     * @param action - The name of the action to execute.
     * @param parent - The parent persistent object (for object actions or context).
     * @param query - The query (for query actions).
     * @param selectedItems - An array of selected query result items (for query actions).
     * @param parameters - Optional parameters for the action.
     * @param skipHooks - Internal flag to skip hooks during retry.
     * @returns A promise resolving to the resulting PersistentObject, if any.
     */
    public async executeAction(action: string, parent: PersistentObject, query?: Query, selectedItems?: Array<QueryResultItem>, parameters?: any, skipHooks: boolean = false): Promise<PersistentObject> {
        const isObjectAction = action.startsWith("PersistentObject.") || query == null;
        const targetServiceObject = isObjectAction ? parent : query;

        if (!skipHooks) {
            targetServiceObject.setNotification();

            // Clear selected items if all are selected and not inverse
            if (!isObjectAction && query.selectAll.allSelected && !query.selectAll.inverse)
                selectedItems = [];

            this.hooks.trackEvent(action, parameters ? parameters.MenuLabel || parameters.MenuOption : null, query || parent);

            const args = new ExecuteActionArgs(this, action, parent, query, selectedItems, parameters);
            try {
                await this.hooks.onAction(args);
                if (args.isHandled) {
                    return args.result;
                }

                return await this.executeAction(action, parent, query, selectedItems, args.parameters, true);
            } catch (e) {
                targetServiceObject.setNotification(e);
                throw e;
            }
        }

        const isFreezingAction = isObjectAction && action !== "PersistentObject.Refresh";
        const data = this.#createData("executeAction");
        data.action = action;
        if (parent != null)
            data.parent = parent.toServiceObject();

        if (query != null)
            data.query = _internal(query).toServiceObject();

        if (selectedItems != null)
            data.selectedItems = selectedItems.map(item => item && _internal(item).toServiceObject());

        if (parameters != null)
            data.parameters = parameters;

        const executeThen: (result: any) => Promise<PersistentObject> = async result => {
            if (!result)
                return;

            if (result.operations) {
                this.#queuedClientOperations.push(...result.operations);
                result.operations = null;
            }

            if (!result.retry)
                return result.result ? await this.hooks.onConstructPersistentObject(this, result.result) : null;

            if (result.retry.persistentObject)
                result.retry.persistentObject = this.hooks.onConstructPersistentObject(this, result.retry.persistentObject);

            const option = await this.hooks.onRetryAction(result.retry);
            (data.parameters || (data.parameters = {})).RetryActionOption = option;

            if (result.retry.persistentObject instanceof PersistentObject)
                data.retryPersistentObject = result.retry.persistentObject.toServiceObject();

            const retryResult = await this.#postJSON(this.#createUri("ExecuteAction"), data);
            return await executeThen(retryResult);
        };

        try {
            if (isFreezingAction)
                parent?.freeze();

            const getFiles = (result: [attributeName: string, file: File][], attribute: PersistentObjectAttribute) => {
                if (attribute.file != null && attribute.isValueChanged) {
                    result.push([
                        !attribute.parent.ownerDetailAttribute ? attribute.name : `${attribute.parent.ownerDetailAttribute.name}.${attribute.parent.ownerDetailAttribute.objects.indexOf(attribute.parent)}.${attribute.name}`,
                        attribute.file
                    ]);
                } else if (attribute instanceof PersistentObjectAttributeAsDetail) {
                    attribute.objects?.flatMap(p => p.attributes).reduce(getFiles, result);
                }

                return result;
            };

            const files = parent?.attributes.reduce(getFiles, []);
            if (files?.length > 0) {
                const formData = new FormData();
                files.forEach(f => {
                    const [attributeName, file] = f;
                    formData.set(attributeName, file);
                });

                data.__form_data = formData;
            }

            const result = await this.#postJSON(this.#createUri("ExecuteAction"), data);
            return await executeThen(result);
        } catch (e) {
            targetServiceObject.setNotification(e);

            throw e;
        } finally {
            if (isFreezingAction)
                parent?.unfreeze();
        }
    }

    /**
     * Retrieves a data stream (e.g., a file download) associated with an action or object.
     * @param obj - The persistent object context for the stream.
     * @param options - Optional settings such as action context, parent, query, selected items, parameters, and callback handler.
     * @returns A promise that resolves when the stream download is initiated.
     */
    public async getStream(obj: PersistentObject | null, { action, parent, query, selectedItems, parameters, onSuccess, onError }: GetStreamOptions = {}): Promise<void> {
        const data = this.#createData("getStream");
        data.action = action;

        if (obj != null)
            data.id = obj.objectId;

        if (parent != null)
            data.parent = parent.toServiceObject();

        if (query != null)
            data.query = _internal(query).toServiceObject();

        if (selectedItems != null)
            data.selectedItems = selectedItems.map(si => _internal(si).toServiceObject());

        if (parameters != null)
            data.parameters = parameters;

        const formData = new FormData();
        formData.append("data", JSON.stringify(data));

        try {
            const response = await this.#fetch(new Request(this.#createUri("GetStream"), {
                body: formData,
                method: "POST"
            }));

            if (response.ok) {
                const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                const matches = filenameRegex.exec(response.headers.get("Content-Disposition"));
                const filename = matches?.[1]?.replace(/['"]/g, "");

                const blob = await response.blob();

                if (!onSuccess)
                    this.hooks.onGetStream(blob, filename);
                else
                    await onSuccess(blob, filename);
            } else {
                const error = new Error(`Failed to get stream: ${response.status} ${response.statusText}`);
                if (onError)
                    await onError(error);
                else
                    throw error;
            }
        } catch (error) {
            if (onError)
                await onError(error as Error);
            else
                throw error;
        }
    }

    /**
     * Retrieves data for a report.
     * @param token - The report token.
     * @param options - Optional filtering, sorting, and pagination options for the report.
     * @returns A promise resolving to an array of report data.
     */
    public async getReport(token: string, { filter = "", orderBy, top, skip, hideIds, hideType = true }: IReportOptions = {}): Promise<any[]> {
        let uri = this.#createUri(`GetReport/${token}?format=json&$filter=${encodeURIComponent(filter)}`);

        if (orderBy)
            uri = `${uri}&$orderBy=${orderBy}`;

        if (top)
            uri = `${uri}&$top=${top}`;

        if (skip)
            uri = `${uri}&$skip=${skip}`;

        if (hideIds)
            uri = `${uri}&hideIds=true`;

        if (hideType)
            uri = `${uri}&hideType=true`;

        return (await this.#getJSON(uri)).d;
    }

    /**
     * Performs an instant search across the application.
     * @param search - The search term.
     * @returns A promise resolving to an array of instant search results.
     */
    public async getInstantSearch(search: string): Promise<IInstantSearchResult[]> {
        const uri = this.#createUri(`Instant?q=${encodeURIComponent(search)}`);

        let authorization: string;
        if (this.authTokenType !== "JWT") {
            const userName = encodeURIComponent(this.userName);
            const authToken = this.authToken ? this.authToken.replace("/", "_") : "";

            authorization = `${userName}/${authToken}`;
        } else {
            authorization = this.authToken.substr(4);
        }

        return (await this.#getJSON(uri, {
            "Authorization": `Bearer ${authorization}`
        })).d;
    }

    /**
     * Initiates the "forgot password" process for a user.
     * @param userName - The user name for which to reset the password.
     * @returns A promise resolving to the result of the forgot password request.
     */
    public forgotPassword(userName: string): Promise<IForgotPassword> {
        return this.#postJSON(this.#createUri("forgotpassword"), { userName: userName });
    }

    /**
     * Converts a string value from the service to its appropriate JavaScript type.
     * @param value - The string value from the service.
     * @param typeName - The Vidyano data type name (e.g., "String", "Int32", "DateTimeOffset").
     * @returns The converted JavaScript value.
     */
    public static fromServiceString(value: string, typeName: string): any {
        return DataType.fromServiceString(value, typeName);
    }

    /**
     * Converts a JavaScript value to its string representation for the service.
     * @param value - The JavaScript value.
     * @param typeName - The Vidyano data type name.
     * @returns The string representation for the service.
     */
    public static toServiceString(value: any, typeName: string): string {
        return DataType.toServiceString(value, typeName);
    }

    /**
     * Creates a new service URI for the specified method.
     * @param method - The method name to append to the service URI.
     * @returns The complete service URI for the method.
     */
    #createUri(method: string): string {
        let uri = this.serviceUri;
        if (!String.isNullOrEmpty(uri) && !uri.endsWith("/"))
            uri += "/";

        return uri + method;
    }

    /**
     * Creates a data object for service requests, including common properties.
     * @param method - The method name for which the data is being created.
     * @param data - Optional additional data to include in the request.
     * @returns The complete data object ready for sending to the service.
     */
    #createData(method: string, data?: any): any {
        data = data || {};

        data.clientVersion = version;
        data.environment = this.environment;
        data.environmentVersion = this.environmentVersion;

        if (method !== "getApplication") {
            data.userName = this.userName;
            if (data.userName !== this.defaultUserName)
                data.authToken = this.authToken;
        }

        const requestedLanguage = this.requestedLanguage;
        if (requestedLanguage != null)
            data.requestedLanguage = requestedLanguage;

        if (this.application && this.application.session)
            data.session = this.application.session.toServiceObject(true);

        if (this.profile)
            data.profile = true;

        this.hooks.createData(data);

        return data;
    }

    /**
     * Fetches a request, handling rate limiting (HTTP 429) by retrying after a delay.
     * @param request - The request to fetch.
     * @returns A promise resolving to the Response object.
     */
    async #fetch(request: Request): Promise<Response> {
        let response: Response;

        do {
            response = await this.hooks.onFetch(request);
            if (response.status !== 429)
                return response;

            const retryAfter = response.headers?.get("Retry-After") || "5";
            let seconds = parseInt(retryAfter) * 1000;
            if (Number.isNaN(seconds)) {
                const when = new Date(retryAfter).getTime();
                if (!Number.isNaN(when))
                    seconds = Math.max(0, when - new Date().getTime());
            }

            await sleep(seconds || 5000);
        }
        while (true);
    }

    /**
     * Fetches JSON data from the specified URL, handling errors and network issues.
     * @param url - The URL to fetch JSON data from.
     * @param headers - Optional headers to include in the request.
     * @returns A promise resolving to the parsed JSON data.
     */
    async #getJSON(url: string, headers?: any): Promise<any> {
        const request = new Request(url, {
            method: "GET",
            headers: headers != null ? new Headers(headers) : undefined
        });

        try {
            const response = await this.#fetch(request);
            if (response.ok)
                return await response.json();

            throw response.text;
        } catch (e) {
            throw e || (NoInternetMessage.messages[IS_BROWSER ? navigator.language.split("-")[0].toLowerCase() : "en"] || NoInternetMessage.messages["en"]).message;
        }
    }

    /**
     * Posts JSON data to the specified URL, handling authentication and profiling.
     * @param url - The URL to post JSON data to.
     * @param data - The data to post, which can include a FormData object for file uploads.
     * @returns A promise resolving to the response data from the server.
     */
    async #postJSON(url: string, data: any): Promise<any> {
        const createdRequest = new Date();
        let requestStart: number;
        let requestMethod: string;

        if (this.profile) {
            requestStart = IS_BROWSER ? window.performance.now() : Date.now();
            requestMethod = url.split("/").pop();
        }

        const headers = new Headers();
        if (this.authTokenType === "JWT") {
            headers.set("Authorization", "bearer " + this.authToken.substring(4));

            if (data) {
                delete data.userName;
                delete data.authToken;
            }
        }

        let body: any;
        if (!data.__form_data) {
            headers.append("Content-type", "application/json");
            body = JSON.stringify(data);
        } else {
            const formData = data.__form_data as FormData;
            delete data.__form_data;
            formData.set("data", JSON.stringify(data));
            body = formData;
        }

        // Streaming post
        if (typeof data.action === "string") {
            const action = data.action.split(".", 2).pop();
            const definition = this.actionDefinitions[action];
            if (definition?.isStreaming) {
                let cancel: () => void;
                let signal: (e?: unknown) => void;

                let awaiter = new Promise((resolve, reject) => {
                    signal = resolve;
                    cancel = reject;
                });

                const abortController = new AbortController();
                const messages: EventSourceMessage[] = [];
                const iterator = async function* () {
                    try {
                        while (true) {
                            await awaiter;

                            while (messages.length > 0) {
                                const message = messages.shift();
                                if (!!message.data) { // Ignore keep-alive messages
                                    yield message.data;
                                }
                            }
                        }
                    } catch { /* Ignore */ }
                };

                this.hooks.onStreamingAction(action, iterator, () => abortController.abort());

                fetchEventSource(url, {
                    method: "POST",
                    headers: Array.from(headers.entries()).reduce((h, [key, value]) => {
                        h[key] = value;
                        return h;
                    }, {}),
                    body: body,
                    signal: abortController.signal,
                    onmessage: (e: EventSourceMessage) => {
                        messages.push(e);
                        signal();

                        awaiter = new Promise((resolve, reject) => {
                            signal = resolve;
                            cancel = reject;
                        });
                    },
                    onclose: () => cancel(),
                    onerror: () => {
                        cancel();
                        return null;
                    },
                    openWhenHidden: true
                });

                // Make sure the parent is busy until the first message arrives
                await awaiter;

                return; // This is an async function, returning void (Promise<void>)
            }
        }

        // Normal post
        try {
            const response = await this.#fetch(new Request(url, {
                method: "POST",
                headers: headers,
                body: body
            }));

            if (!response.ok) {
                throw response.statusText;
            }

            let result: any;
            if (response.headers.get("content-type")?.contains("application/json")) {
                result = await response.json();
            } else if (response.headers.get("content-type") === "text/html") {
                const regex = /({(.*)+)</gm;
                result = JSON.parse(regex.exec(await response.text())[1]);
            } else {
                throw "Invalid content-type";
            }

            try {
                if (result.exception == null) {
                    result.exception = result.ExceptionMessage;
                }

                if (result.exception == null) {
                    if (createdRequest > this.#lastAuthTokenUpdate && this.authTokenType !== "JWT") {
                        this.authToken = result.authToken;
                        this.#lastAuthTokenUpdate = createdRequest;
                    }

                    if (this.application) {
                        this.application._updateSession(result.session);
                    }

                    return result;
                } else if (result.exception === "Session expired") {
                    this.authToken = null;
                    delete data.authToken;

                    if (this.defaultUserName && this.defaultUserName === this.userName) {
                        delete data.password;
                        return await this.#postJSON(url, data);
                    } else if (!await this.hooks.onSessionExpired()) {
                        throw result.exception;
                    } else if (this.defaultUserName) {
                        delete data.password;
                        data.userName = this.defaultUserName;

                        return await this.#postJSON(url, data);
                    } else {
                        throw result.exception;
                    }
                } else {
                    throw result.exception;
                }
            } finally {
                this.#postJSONProcess(data, result, requestMethod, createdRequest, requestStart, result.profiler ? response.headers.get("X-ElapsedMilliseconds") : undefined);
            }
        } catch (e) {
            throw e || (NoInternetMessage.messages[navigator.language.split("-")[0].toLowerCase()] || NoInternetMessage.messages["en"]).message;
        }
    }

    /**
     * Processes the result of a JSON post request, handling profiling and client operations.
     * @param data - The data sent in the request.
     * @param result - The result received from the server.
     * @param requestMethod - The method used for the request.
     * @param createdRequest - The timestamp when the request was created.
     * @param requestStart - The start time of the request for profiling.
     * @param elapsedMs - Optional elapsed milliseconds for profiling.
     */
    #postJSONProcess(data: any, result: any, requestMethod: string, createdRequest: Date, requestStart: number, elapsedMs: string) {
        if (this.profile && result.profiler) {
            const requestEnd = IS_BROWSER ? window.performance.now() : Date.now();

            if (!result.profiler) {
                result.profiler = { elapsedMilliseconds: -1 };
                if (result.exception)
                    result.profiler.exceptions = [result.exception];
            }

            if (elapsedMs)
                result.profiler.elapsedMilliseconds = Service.fromServiceString(elapsedMs, "Int32");

            const request: Dto.ProfilerRequestDto = {
                when: createdRequest,
                profiler: result.profiler,
                transport: Math.round(requestEnd - requestStart - result.profiler.elapsedMilliseconds),
                method: requestMethod,
                request: data,
                response: result
            };

            const requests = this.profiledRequests || [];
            requests.unshift(request);

            this.#setProfiledRequests(requests.slice(0, 20));
        }

        if (result.operations) {
            this.#queuedClientOperations.push(...result.operations);
            result.operations = null;
        }

        if (this.#queuedClientOperations.length > 0) {
            setTimeout(() => {
                let operation: IClientOperation;
                while (operation = this.#queuedClientOperations.splice(0, 1)[0]) {
                    this.hooks.onClientOperation(operation);
                }
            }, 0);
        }
    }

    /**
     * Retrieves the application instance.
     * @param data - Optional data to pass to the service when retrieving the application.
     * @returns A promise resolving to the Application instance.
     */
    async #getApplication(data: any = this.#createData("")): Promise<Application> {
        if (!(data.authToken || data.accessToken || data.password) && this.userName && this.userName !== this.defaultUserName && this.userName !== this.registerUserName) {
            if (this.defaultUserName) {
                this.userName = this.defaultUserName;
            }

            if (!this.userName && !await this.hooks.onSessionExpired()) { // Modified to await
                throw "Session expired";
            }

            data.userName = this.userName;
        }

        const result = await this.#postJSON(this.#createUri("GetApplication"), data);

        if (!String.isNullOrEmpty(result.exception))
            throw result.exception;

        if (result.application == null)
            throw "Unknown error";

        this.#setApplication(this.hooks.onConstructApplication(result));

        const resourcesQuery = this.application.getQuery("Resources");
        this.icons = resourcesQuery ? Object.assign({}, ...resourcesQuery.items.filter(i => i.getValue("Type") === "Icon").map(i => ({ [i.getValue("Key")]: i.getValue("Data") }))) : {};

        Object.assign(this.actionDefinitions, ...this.application.getQuery("Actions").items.map(i => ({ [i.getValue("Name")]: new ActionDefinition(this, i) })));

        this.language = this.#languages.find(l => l.culture === result.userLanguage) || this.#languages.find(l => l.isDefault);

        const clientMessagesQuery = this.application.getQuery("ClientMessages");
        if (clientMessagesQuery) {
            const newMessages = { ...this.language.messages };
            clientMessagesQuery.items.forEach(msg => newMessages[msg.getValue("Key")] = msg.getValue("Value"));

            const oldMessages = this.language.messages;
            this.notifyPropertyChanged("language.messages", this.language.messages = newMessages, oldMessages);
        }

        Object.keys(this.actionDefinitions).forEach(name => this.language.messages[`Action_${name}`] = this.actionDefinitions[name].displayName);

        CultureInfo.currentCulture = CultureInfo.cultures[result.userCultureInfo] || CultureInfo.cultures[result.userLanguage] || CultureInfo.invariantCulture;

        if (result.initial != null) {
            this.#initial = this.hooks.onConstructPersistentObject(this, result.initial);
        }

        if (result.userName !== this.registerUserName || result.userName === this.defaultUserName) {
            this.userName = result.userName;

            if (result.session)
                this.application._updateSession(result.session);

            this.#setIsSignedIn(true);
        } else
            this.#setIsSignedIn(false);

        return this.application;
    }
}

/**
 * Interface for the forgot password response.
 */
export interface IForgotPassword {
    /**
     * The user name for which the password reset was requested.
     */
    notification: string;

    /**
     * The type of notification (e.g., "Info", "Error").
     */
    notificationType: Dto.NotificationType;

    /**
     * The duration in milliseconds for which the notification should be displayed.
     */
    notificationDuration: number;
}

/**
 * Interface for report options, allowing filtering, sorting, and pagination.
 */
export interface IReportOptions {
    /**
     * Optional filter string to apply to the report data.
     */
    filter?: string;

    /**
     * Optional order by string to sort the report data.
     */
    orderBy?: string;

    /**
     * Optional top count to limit the number of items returned.
     */
    top?: number;

    /**
     * Optional skip count to skip a number of items in the report data.
     */
    skip?: number;

    /**
     * Optional flag to hide IDs in the report data.
     */
    hideIds?: boolean;

    /**
     * Optional flag to hide the type information in the report data.
     */
    hideType?: boolean;
}

/**
 * Interface for instant search results, providing basic information about each result.
 */
export interface IInstantSearchResult {
    /**
     * The type ID of the result.
     */
    id: string;

    /**
     * The label or display name of the result.
     */
    label: string;

    /**
     * The object ID of the result.
     */
    objectId: string;

    /**
     * The type name of the result.
     */
    breadcrumb: string;
}
