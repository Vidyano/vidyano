import type * as Dto from "./typings/service.js"
import { Observable } from "./common/observable.js"
import "./common/array.js" // NOTE: We need the side effect from this import
import type { Application } from "./application.js"
import type { IClientOperation } from "./client-operations.js"
import { Language } from "./language.js"
import { PersistentObject } from "./persistent-object.js"
import { PersistentObjectAttribute } from "./persistent-object-attribute.js"
import { PersistentObjectAttributeAsDetail } from "./persistent-object-attribute-as-detail.js"
import { ActionDefinition } from "./action-definition.js"
import { ServiceHooks } from "./service-hooks.js"
import { cookie, cookiePrefix } from "./cookie.js"
import { NoInternetMessage } from "./no-internet-message.js"
import type { Query } from "./query.js"
import type { QueryResultItem } from "./query-result-item.js"
import { CultureInfo } from "./cultures.js"
import { ExecuteActionArgs } from "./execute-action-args.js"
import { DataType } from "./service-data-type.js"
import Boolean from "./common/boolean.js"
import "./actions.js"
import { sleep } from "./common/sleep.js"
import { fetchEventSource, EventSourceMessage } from '@microsoft/fetch-event-source'

export let version = "vidyano-latest-version";

export declare type NotificationType = Dto.NotificationType;

export type GetQueryOptions = {
    asLookup?: boolean;
    columnOverrides?: { 
        name: string;
        includes?: string[];
        excludes?: string[];
    }[];
    parent?: PersistentObject;
    textSearch?: string;
    sortOptions?: string;
};

export class Service extends Observable<Service> {
    private static _token: string;
    private _lastAuthTokenUpdate: Date = new Date();
    private _isUsingDefaultCredentials: boolean;
    private _clientData: Dto.ClientData;
    private _language: Language;
    private _languages: Language[];
    private _windowsAuthentication: boolean;
    private _providers: { [name: string]: Dto.ProviderParameters };
    private _isSignedIn: boolean;
    private _application: Application;
    private _userName: string;
    private _authToken: string;
    private _profile: boolean;
    private _profiledRequests: Dto.ProfilerRequest[];
    private _queuedClientOperations: IClientOperation[] = [];
    private _initial: PersistentObject;
    staySignedIn: boolean;
    icons: Record<string, string>;
    actionDefinitions: Record<string, ActionDefinition> = {};
    environment: string = "Web";
    environmentVersion: string = "3";
    clearSiteData: boolean;

    constructor(public serviceUri: string, public hooks: ServiceHooks = new ServiceHooks(), public readonly isTransient: boolean = false) {
        super();

        (<any>this.hooks)._service = this;

        if (!isTransient)
            this.staySignedIn = cookie("staySignedIn", { force: true }) === "true";
    }

    static set token(token: string) {
        Service._token = token;
    }

    private _createUri(method: string) {
        let uri = this.serviceUri;
        if (!String.isNullOrEmpty(uri) && !uri.endsWith("/"))
            uri += "/";
        return uri + method;
    }

    private _createData(method: string, data?: any) {
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

    private async _fetch(request: Request): Promise<Response> {
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

    private async _getJSON(url: string, headers?: any): Promise<any> {
        const request = new Request(url, {
            method: "GET",
            headers: headers != null ? new Headers(headers) : undefined
        });

        try {
            const response = await this._fetch(request);
            if (response.ok)
                return await response.json();

            throw response.text;
        }
        catch (e) {
            throw e || (NoInternetMessage.messages[navigator.language.split("-")[0].toLowerCase()] || NoInternetMessage.messages["en"]).message;
        }
    }

    private async _postJSON(url: string, data: any): Promise<any> {
        const createdRequest = new Date();
        let requestStart: number;
        let requestMethod: string;

        if (this.profile) {
            requestStart = window.performance.now();
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
        }
        else {
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
                        while(true) {
                            await awaiter;

                            while (messages.length > 0) {
                                const message = messages.shift();
                                if (!!message.data) // Ignore keep-alive messages
                                    yield message.data;
                            }
                        }
                    }
                    catch { /* Ignore */ }
                };

                this.hooks.onStreamingAction(action, iterator, () => abortController.abort());

                fetchEventSource(url, {
                    method: "POST",
                    headers: Array.from(headers.entries()).reduce((headers, [key, value]) => {
                        headers[key] = value;
                        return headers;
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

                return;
            }
        }

        // Normal post
        try {
            const response = await this._fetch(new Request(url, {
                method: "POST",
                headers: headers,
                body: body
            }));

            if (!response.ok)
                throw response.statusText;

            let result: any;
            if (response.headers.get("content-type")?.contains("application/json"))
                result = await response.json();
            else if (response.headers.get("content-type") === "text/html") {
                const regex = /({(.*)+)</gm;
                result = JSON.parse(regex.exec(await response.text())[1]);
            }   
            else
                throw "Invalid content-type";

            try {
                if (result.exception == null)
                    result.exception = result.ExceptionMessage;

                if (result.exception == null) {
                    if (createdRequest > this._lastAuthTokenUpdate && this.authTokenType !== "JWT") {
                        this.authToken = result.authToken;
                        this._lastAuthTokenUpdate = createdRequest;
                    }

                    if (this.application)
                        this.application._updateSession(result.session);

                    return result;
                } else if (result.exception === "Session expired") {
                    this.authToken = null;
                    delete data.authToken;

                    if (this.defaultUserName && this.defaultUserName === this.userName) {
                        delete data.password;
                        return await this._postJSON(url, data);
                    } else if (!await this.hooks.onSessionExpired())
                        throw result.exception;
                    else if (this.defaultUserName) {
                        delete data.password;
                        data.userName = this.defaultUserName;

                        return await this._postJSON(url, data);
                    }
                    else
                        throw result.exception;
                }
                else
                    throw result.exception;
            }
            finally {
                this._postJSONProcess(data, result, requestMethod, createdRequest, requestStart, result.profiler ? response.headers.get("X-ElapsedMilliseconds") : undefined);
            }
        }
        catch (e) {
            throw e || (NoInternetMessage.messages[navigator.language.split("-")[0].toLowerCase()] || NoInternetMessage.messages["en"]).message;
        }
    }

    private _postJSONProcess(data: any, result: any, requestMethod: string, createdRequest: Date, requestStart: number, elapsedMs: string) {
        if (this.profile && result.profiler) {
            const requestEnd = window.performance.now();

            if (!result.profiler) {
                result.profiler = { elapsedMilliseconds: -1 };
                if (result.exception)
                    result.profiler.exceptions = [result.exception];
            }

            if (elapsedMs)
                result.profiler.elapsedMilliseconds = Service.fromServiceString(elapsedMs, "Int32");

            const request: Dto.ProfilerRequest = {
                when: createdRequest,
                profiler: result.profiler,
                transport: Math.round(requestEnd - requestStart - result.profiler.elapsedMilliseconds),
                method: requestMethod,
                request: data,
                response: result
            };

            const requests = this.profiledRequests || [];
            requests.unshift(request);

            this._setProfiledRequests(requests.slice(0, 20));
        }

        if (result.operations) {
            this._queuedClientOperations.push(...result.operations);
            result.operations = null;
        }

        if (this._queuedClientOperations.length > 0) {
            setTimeout(() => {
                let operation: IClientOperation;
                while (operation = this._queuedClientOperations.splice(0, 1)[0])
                    this.hooks.onClientOperation(operation);
            }, 0);
        }
    }

    get queuedClientOperations(): IClientOperation[] {
        return this._queuedClientOperations;
    }

    get application(): Application {
        return this._application;
    }

    private _setApplication(application: Application) {
        if (this._application === application)
            return;

        const oldApplication = this._application;
        this.notifyPropertyChanged("application", this._application = application, oldApplication);

        if (this._application && this._application.canProfile)
            this.profile = !!Boolean.parse(cookie("profile"));
        else
            this.profile = false;
    }

    get initial(): PersistentObject {
        return this._initial;
    }

    get language(): Language {
        return this._language;
    }

    set language(l: Language) {
        if (this._language === l)
            return;

        const oldLanguage = this._language;
        this.notifyPropertyChanged("language", this._language = l, oldLanguage);
    }

    get requestedLanguage(): string {
        return cookie("requestedLanguage");
    }

    set requestedLanguage(val: string) {
        if (this.requestedLanguage === val)
            return;

        cookie("requestedLanguage", val);
    }

    get isSignedIn(): boolean {
        return this._isSignedIn;
    }

    private _setIsSignedIn(val: boolean) {
        const oldIsSignedIn = this._isSignedIn;
        this._isSignedIn = val;

        const oldIsUsingDefaultCredentials = this._isUsingDefaultCredentials;
        this._isUsingDefaultCredentials = this.defaultUserName && this.userName && this.defaultUserName.toLowerCase() === this.userName.toLowerCase();

        if (oldIsSignedIn !== this._isSignedIn)
            this.notifyPropertyChanged("isSignedIn", this._isSignedIn, oldIsSignedIn);

        if (oldIsSignedIn !== this._isUsingDefaultCredentials)
            this.notifyPropertyChanged("isUsingDefaultCredentials", this._isUsingDefaultCredentials, oldIsUsingDefaultCredentials);
    }

    get languages(): Language[] {
        return this._languages;
    }

    get windowsAuthentication(): boolean {
        return this._windowsAuthentication;
    }

    get providers(): { [name: string]: Dto.ProviderParameters } {
        return this._providers;
    }

    get isUsingDefaultCredentials(): boolean {
        return this._isUsingDefaultCredentials;
    }

    get userName(): string {
        return !this.isTransient ? cookie("userName") : this._userName;
    }

    private set userName(val: string) {
        const oldUserName = this.userName;
        if (oldUserName === val)
            return;

        if (!this.isTransient)
            cookie("userName", val, { expires: this.staySignedIn ? 365 : 30 });
        else
            this._userName = val;

        this.notifyPropertyChanged("userName", val, oldUserName);
    }

    get defaultUserName(): string {
        return !!this._clientData ? this._clientData.defaultUser || null : null;
    }

    get registerUserName(): string {
        return !!this._providers && this._providers["Vidyano"] ? this._providers["Vidyano"].registerUser || null : null;
    }

    get authToken(): string {
        return !this.isTransient ? cookie("authToken") : this._authToken;
    }

    set authToken(val: string) {
        if (!this.isTransient) {
            const oldAuthToken = this.authToken;

            if (this.staySignedIn)
                cookie("authToken", val, { expires: 14 });
            else
                cookie("authToken", val);

            if (!oldAuthToken && val) {
                localStorage.setItem("vi-setAuthToken", JSON.stringify({ cookiePrefix: cookiePrefix(), authToken: val }));
                localStorage.removeItem("vi-setAuthToken");
            }
        }
        else
            this._authToken = val;
    }

    get authTokenType(): "Basic" | "JWT" | null {
        if (!this.authToken)
            return null;

        return this.authToken.startsWith("JWT:") ? "JWT" : "Basic";
    }

    get profile(): boolean {
        return this._profile;
    }

    set profile(val: boolean) {
        if (this._profile === val)
            return;

        const currentProfileCookie = !!Boolean.parse(cookie("profile"));
        if (currentProfileCookie !== val)
            cookie("profile", String(val));

        const oldValue = this._profile;
        this._profile = val;

        if (!val)
            this._setProfiledRequests([]);

        this.notifyPropertyChanged("profile", val, oldValue);
    }

    get profiledRequests(): Dto.ProfilerRequest[] {
        return this._profiledRequests;
    }

    private _setProfiledRequests(requests: Dto.ProfilerRequest[]) {
        this.notifyPropertyChanged("profiledRequests", this._profiledRequests = requests);
    }

    getTranslatedMessage(key: string, ...params: string[]): string {
        return String.format.apply(null, [this.language.messages[key] || key].concat(params));
    }

    async getCredentialType(userName: string) {
        return this._postJSON("authenticate/GetCredentialType", { userName: userName });
    }

    async initialize(skipDefaultCredentialLogin: boolean = false): Promise<Application> {
        let url = "GetClientData?v=3";
        if (this.requestedLanguage)
            url = `${url}&lang=${this.requestedLanguage}`;

        this._clientData = await this.hooks.onInitialize(await (this._getJSON(this._createUri(url))));

        if (this._clientData.exception)
            throw this._clientData.exception;

        const languages = Object.keys(this._clientData.languages).map(culture => new Language(this._clientData.languages[culture], culture));
        this.hooks.setDefaultTranslations(languages);

        this._languages = languages;
        this.language = this._languages.find(l => l.isDefault) || this._languages[0];

        this._providers = {};
        for (const provider in this._clientData.providers) {
            this._providers[provider] = this._clientData.providers[provider].parameters;
        }
        this._windowsAuthentication = this._clientData.windowsAuthentication;

        if (Service._token) {
            if (!Service._token.startsWith("JWT:")) {
                const tokenParts = Service._token.split("/", 2);

                this.userName = atob(tokenParts[0]);
                this.authToken = tokenParts[1].replace("_", "/");
            }
            else
                this.authToken = Service._token;

            Service._token = undefined;

            const returnUrl = cookie("returnUrl", { force: true }) || "";
            if (returnUrl)
                cookie("returnUrl", null, { force: true });

            this.hooks.onNavigate(returnUrl, true);

            return this._getApplication();
        }

        this.userName = this.userName || this._clientData.defaultUser;

        let application: Application;
        if (!String.isNullOrEmpty(this.authToken) || ((this._clientData.defaultUser || this.windowsAuthentication) && !skipDefaultCredentialLogin)) {
            try {
                application = await this._getApplication();
            }
            catch (e) {
                application = null;
            }
        }
        else
            this._setIsSignedIn(!!this.application);

        return application;
    }

    signInExternal(providerName: string) {
        if (!this.providers[providerName] || !this.providers[providerName].requestUri)
            throw "Provider not found or not flagged for external authentication.";

        document.location.href = this.providers[providerName].requestUri;
    }

    async signInUsingCredentials(userName: string, password: string, staySignedIn?: boolean): Promise<Application>;
    async signInUsingCredentials(userName: string, password: string, code?: string, staySignedIn?: boolean): Promise<Application>;
    async signInUsingCredentials(userName: string, password: string, codeOrStaySignedIn?: string | boolean, staySignedIn?: boolean): Promise<Application> {
        this.userName = userName;

        const data = this._createData("getApplication");
        data.userName = userName;
        data.password = password;

        if (typeof codeOrStaySignedIn === "string")
            data.code = codeOrStaySignedIn;

        try {
            const application = await this._getApplication(data);
            if (application && this.isSignedIn && !this.isTransient) {
                const ssi = (typeof codeOrStaySignedIn === "boolean" && codeOrStaySignedIn) || (typeof staySignedIn === "boolean" && staySignedIn);
                cookie("staySignedIn", (this.staySignedIn = ssi) ? "true" : null, { force: true, expires: 365 });
            }

            return application;
        }
        catch (e) {
            throw e;
        }
    }

    signInUsingDefaultCredentials(): Promise<Application> {
        this.userName = this.defaultUserName;

        return this._getApplication();
    }

    signOut(skipAcs?: boolean): Promise<boolean> {
        if (this.clearSiteData && !!this.authToken)
            this.executeAction("PersistentObject.viSignOut", this.application, null, null, null, true);

        if (this.userName === this.defaultUserName || this.userName === this.registerUserName || this.clearSiteData)
            this.userName = null;

        this.authToken = null;
        this._setApplication(null);

        if (!skipAcs && this._providers["Acs"] && this._providers["Acs"].signOutUri) {
            return new Promise(resolve => {
                const iframe = document.createElement("iframe");
                iframe.setAttribute("hidden", "");
                iframe.width = "0";
                iframe.height = "0";
                iframe.src = this._providers["Acs"].signOutUri;
                iframe.onload = () => {
                    document.body.removeChild(iframe);
                    this._setIsSignedIn(false);

                    resolve(true);
                };
                iframe.onerror = () => {
                    this._setIsSignedIn(false);
                    resolve(true);
                };

                document.body.appendChild(iframe);
            });
        }

        this.clearSiteData = false;
        this._setIsSignedIn(false);
        return Promise.resolve(true);
    }

    private async _getApplication(data: any = this._createData("")): Promise<Application> {
        if (!(data.authToken || data.accessToken || data.password) && this.userName && this.userName !== this.defaultUserName && this.userName !== this.registerUserName) {
            if (this.defaultUserName)
                this.userName = this.defaultUserName;

            if (!this.userName && !this.hooks.onSessionExpired())
                throw "Session expired";

            data.userName = this.userName;
        }

        const result = await this._postJSON(this._createUri("GetApplication"), data);

        if (!String.isNullOrEmpty(result.exception))
            throw result.exception;

        if (result.application == null)
            throw "Unknown error";

        this._setApplication(this.hooks.onConstructApplication(result));

        const resourcesQuery = this.application.getQuery("Resources");
        this.icons = resourcesQuery ? Object.assign({}, ...resourcesQuery.items.filter(i => i.getValue("Type") === "Icon").map(i => ({ [i.getValue("Key")]: i.getValue("Data") }))) : {};

        Object.assign(this.actionDefinitions, ...this.application.getQuery("Actions").items.map(i => ({ [i.getValue("Name")]: new ActionDefinition(this, i) })));

        this.language = this._languages.find(l => l.culture === result.userLanguage) || this._languages.find(l => l.isDefault);

        const clientMessagesQuery = this.application.getQuery("ClientMessages");
        if (clientMessagesQuery) {
            const newMessages = { ...this.language.messages };
            clientMessagesQuery.items.forEach(msg => newMessages[msg.getValue("Key")] = msg.getValue("Value"));

            this.notifyPropertyChanged("language.messages", this.language.messages = newMessages, this.language.messages);
        }

        Object.keys(this.actionDefinitions).forEach(name => this.language.messages[`Action_${name}`] = this.actionDefinitions[name].displayName);

        CultureInfo.currentCulture = CultureInfo.cultures[result.userCultureInfo] || CultureInfo.cultures[result.userLanguage] || CultureInfo.invariantCulture;

        if (result.initial != null)
            this._initial = this.hooks.onConstructPersistentObject(this, result.initial);

        if (result.userName !== this.registerUserName || result.userName === this.defaultUserName) {
            this.userName = result.userName;

            if (result.session)
                this.application._updateSession(result.session);

            this._setIsSignedIn(true);
        }
        else
            this._setIsSignedIn(false);

        return this.application;
    }

    async getQuery(id: string, options?: GetQueryOptions): Promise<Query>;
    async getQuery(id: string, asLookup?: boolean, parent?: PersistentObject, textSearch?: string, sortOptions?: string): Promise<Query>;
    async getQuery(id: string, arg2?: boolean | GetQueryOptions, parent?: PersistentObject, textSearch?: string, sortOptions?: string): Promise<Query> {
        const data = this._createData("getQuery");
        data.id = id;

        const options = typeof arg2 === "object" ? arg2 : {
            asLookup: arg2,
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

        const result = await this._postJSON(this._createUri("GetQuery"), data);
        if (result.exception)
            throw result.exception;

        return this.hooks.onConstructQuery(this, result.query, null, options.asLookup);
    }

    async getPersistentObject(parent: PersistentObject, id: string, objectId?: string, isNew?: boolean): Promise<PersistentObject> {
        const data = this._createData("getPersistentObject");
        data.persistentObjectTypeId = id;
        data.objectId = objectId;
        if (isNew)
            data.isNew = isNew;
        if (parent != null)
            data.parent = parent.toServiceObject();

        const result = await this._postJSON(this._createUri("GetPersistentObject"), data);
        if (result.exception)
            throw result.exception;
        else if (result.result && result.result.notification) {
            if (result.result.notificationDuration) {
                this.hooks.onShowNotification(result.result.notification, result.result.notificationType, result.result.notificationDuration);
                result.result.notification = null;
                result.result.notificationDuration = 0;
            }
            else if (result.result.notificationType === "Error")
                throw result.result.notification;
        }

        return this.hooks.onConstructPersistentObject(this, result.result);
    }

    async executeQuery(parent: PersistentObject, query: Query, asLookup: boolean = false, throwExceptions?: boolean): Promise<Dto.QueryResult> {
        const data = this._createData("executeQuery");
        data.query = query._toServiceObject();

        if (parent != null)
            data.parent = parent.toServiceObject();
        if (asLookup)
            data.asLookup = asLookup;
        if (query.ownerAttributeWithReference)
            data.forReferenceAttribute = query.ownerAttributeWithReference.name;

        try {
            const result = await this._postJSON(this._createUri("ExecuteQuery"), data);
            if (result.exception)
                throw result.exception;

            const queryResult = <Dto.QueryResult>result.result;
            if (queryResult.continuation) {
                const wanted = <number>data.query.top || queryResult.pageSize;

                while (queryResult.continuation && queryResult.items.length < wanted) {
                    data.query.continuation = queryResult.continuation;
                    data.query.top = wanted - queryResult.items.length;

                    const innerResult = await this._postJSON(this._createUri("ExecuteQuery"), data);
                    if (innerResult.exception)
                        throw innerResult.exception;

                    const innerQueryResult = <Dto.QueryResult>innerResult.result;
                    queryResult.items.push(...innerQueryResult.items);
                    queryResult.continuation = innerQueryResult.continuation;
                }

                if (!queryResult.continuation)
                    queryResult.totalItems = query.items.length + queryResult.items.length;
            }

            return queryResult;
        }
        catch (e) {
            query.setNotification(e);

            if (throwExceptions)
                throw e;
        }
    }

    async executeAction(action: string, parent: PersistentObject, query: Query, selectedItems: Array<QueryResultItem>, parameters?: any, skipHooks: boolean = false): Promise<PersistentObject> {
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
                if (args.isHandled)
                    return args.result;

                return await this.executeAction(action, parent, query, selectedItems, args.parameters, true);
            }
            catch (e) {
                targetServiceObject.setNotification(e);
                throw e;
            }
        }

        const isFreezingAction = isObjectAction && action !== "PersistentObject.Refresh";
        const data = this._createData("executeAction");
        data.action = action;
        if (parent != null)
            data.parent = parent.toServiceObject();
        if (query != null)
            data.query = query._toServiceObject();
        if (selectedItems != null)
            data.selectedItems = selectedItems.map(item => item && item._toServiceObject());
        if (parameters != null)
            data.parameters = parameters;

        const executeThen: (result: any) => Promise<PersistentObject> = async result => {
            if (!result)
                return;

            if (result.operations) {
                this._queuedClientOperations.push(...result.operations);
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

            const retryResult = await this._postJSON(this._createUri("ExecuteAction"), data);
            return await executeThen(retryResult);
        };

        try {
            if (isFreezingAction)
                parent?.freeze();

            const getInputs = (result: [attributeName: string, input: HTMLInputElement][], attribute: PersistentObjectAttribute) => {
                if (attribute.input != null && attribute.isValueChanged) {
                    result.push([
                        !attribute.parent.ownerDetailAttribute ? attribute.name : `${attribute.parent.ownerDetailAttribute.name}.${attribute.parent.ownerDetailAttribute.objects.indexOf(attribute.parent)}.${attribute.name}`,
                        attribute.input
                    ]);
                }
                else if (attribute instanceof PersistentObjectAttributeAsDetail)
                    attribute.objects?.flatMap(parent => parent.attributes).reduce(getInputs, result);

                return result;
            };

            const inputs = parent?.attributes.reduce(getInputs, []);
            if (inputs?.length > 0) {
                const formData = new FormData();
                inputs.forEach(i => {
                    const [attributeName, input] = i;
                    formData.set(attributeName, input.files[0]);
                });

                data.__form_data = formData;
            }

            const result = await this._postJSON(this._createUri("ExecuteAction"), data);
            return await executeThen(result);
        }
        catch (e) {
            targetServiceObject.setNotification(e);

            throw e;
        }
        finally {
            if (isFreezingAction)
                parent?.unfreeze();
        }
    }

    async getStream(obj: PersistentObject, action?: string, parent?: PersistentObject, query?: Query, selectedItems?: Array<QueryResultItem>, parameters?: any) {
        const data = this._createData("getStream");
        data.action = action;
        if (obj != null)
            data.id = obj.objectId;
        if (parent != null)
            data.parent = parent.toServiceObject();
        if (query != null)
            data.query = query._toServiceObject();
        if (selectedItems != null)
            data.selectedItems = selectedItems.map(si => si._toServiceObject());
        if (parameters != null)
            data.parameters = parameters;

        const formData = new FormData();
        formData.append("data", JSON.stringify(data));

        const response = await this._fetch(new Request(this._createUri("GetStream"), {
            body: formData,
            method: "POST"
        }));

        if (response.ok) {
            const blob = await response.blob();
            
            const a = document.createElement("a");
            a.style.display = "none";
            
            const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
            const matches = filenameRegex.exec(response.headers.get("Content-Disposition"));
            if (matches != null && matches[1])
                a.download = matches[1].replace(/['"]/g, '');

            a.href = URL.createObjectURL(blob);
            document.body.appendChild(a);
            a.dispatchEvent(new MouseEvent("click", { bubbles: false }));
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
        }
    }

    async getReport(token: string, { filter = "", orderBy, top, skip, hideIds, hideType = true }: IReportOptions = {}): Promise<any[]> {
        let uri = this._createUri(`GetReport/${token}?format=json&$filter=${encodeURIComponent(filter)}`);

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

        return (await this._getJSON(uri)).d;
    }

    async getInstantSearch(search: string): Promise<IInstantSearchResult[]> {
        const uri = this._createUri(`Instant?q=${encodeURIComponent(search)}`);

        let authorization: string;
        if (this.authTokenType !== "JWT") {
            const userName = encodeURIComponent(this.userName);
            const authToken = this.authToken ? this.authToken.replace("/", "_") : "";

            authorization = `${userName}/${authToken}`;
        }
        else
            authorization = this.authToken.substr(4);

        return (await this._getJSON(uri, {
            "Authorization": `Bearer ${authorization}`
        })).d;
    }

    forgotPassword(userName: string): Promise<IForgotPassword> {
        return this._postJSON(this._createUri("forgotpassword"), { userName: userName });
    }

    static fromServiceString(value: string, typeName: string): any {
        return DataType.fromServiceString(value, typeName);
    }

    static toServiceString(value: any, typeName: string): string {
        return DataType.toServiceString(value, typeName);
    }
}

export interface IForgotPassword {
    notification: string;
    notificationType: NotificationType;
    notificationDuration: number;
}

export interface IReportOptions {
    filter?: string;
    orderBy?: string;
    top?: number;
    skip?: number;
    hideIds?: boolean;
    hideType?: boolean;
}

export interface IInstantSearchResult {
    id: string;
    label: string;
    objectId: string;
    breadcrumb: string;
}