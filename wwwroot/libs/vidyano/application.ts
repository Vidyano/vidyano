import { PersistentObject } from "./persistent-object.js";
import { ProgramUnit } from "./program-unit.js";
import { _internal } from "./_internals.js";
import type * as Dto from "./typings/service.js";
import type { Service } from "./service.js";

/**
 * Represents the application object that manages user settings, routes, and program units.
 */
export class Application extends PersistentObject {
    readonly #userId: string;
    readonly #friendlyUserName: string;
    readonly #feedbackId: string;
    readonly #userSettingsId: string;
    readonly #globalSearchId: string;
    readonly #analyticsKey: string;
    #userSettings: any;
    #canProfile: boolean;
    #hasManagement: boolean;
    #session: PersistentObject | null = null;
    #routes: IRoutes;
    #poRe: RegExp;
    #queryRe: RegExp;

    readonly #programUnits: ProgramUnit[];
    readonly #hasSensitive: boolean;

    /**
     * Initializes a new instance of the Application class.
     * @param service - The associated service.
     * @param application - The application response data.
     * @param hasSensitive - Indicates if the application has sensitive data.
     */
    constructor(service: Service, { application, hasSensitive }: Dto.ApplicationResponse) {
        super(service, application);

        this.#userId = this.getAttributeValue("UserId");
        this.#friendlyUserName = this.getAttributeValue("FriendlyUserName") || service.userName;
        this.#feedbackId = this.getAttributeValue("FeedbackId");
        this.#userSettingsId = this.getAttributeValue("UserSettingsId");
        this.#globalSearchId = this.getAttributeValue("GlobalSearchId");
        this.#analyticsKey = this.getAttributeValue("AnalyticsKey");
        this.#setRoutes(JSON.parse(this.getAttributeValue("Routes")));

        const puRoutes = "^((" + Object.keys(this.#routes.programUnits).join("|") + ")/)?";
        const poTypes = Object.keys(this.#routes.persistentObjects).concat(this.#routes.persistentObjectKeys);
        this.#poRe = poTypes.length === 0 ? /$ ^/ : new RegExp(puRoutes + "(" + poTypes.join("|") + ")(/.+)?$");
        const queryNames = Object.keys(this.#routes.queries).concat(this.#routes.queryKeys);
        this.#queryRe = queryNames.length === 0 ? /$ ^/ : new RegExp(puRoutes + "(" + queryNames.join("|") + ")$");

        const userSettings = this.getAttributeValue("UserSettings");
        this.#userSettings = JSON.parse(String.isNullOrEmpty(userSettings) ? (localStorage["UserSettings"] || "{}") : userSettings);

        this.#canProfile = this.getAttributeValue("CanProfile");

        const pus = <{ hasManagement: boolean; units: any[] }>JSON.parse(this.getAttributeValue("ProgramUnits"));
        this.#hasManagement = pus.hasManagement;
        this.#programUnits = pus.units.map(unit => new ProgramUnit(this.service, this.routes, unit));

        this.#hasSensitive = !!hasSensitive;
    }

    /**
     * Gets the program units.
     */
    get programUnits(): ProgramUnit[] {
        return this.#programUnits;
    }

    /**
     * Gets whether the application has sensitive data.
     */
    get hasSensitive(): boolean {
        return this.#hasSensitive;
    }

    /**
     * Gets the user ID.
     */
    get userId(): string {
        return this.#userId;
    }

    /**
     * Gets the friendly user name.
     */
    get friendlyUserName(): string {
        return this.#friendlyUserName;
    }

    /**
     * Gets the feedback ID.
     */
    get feedbackId(): string {
        return this.#feedbackId;
    }

    /**
     * Gets the user settings ID.
     */
    get userSettingsId(): string {
        return this.#userSettingsId;
    }

    /**
     * Gets the global search ID.
     */
    get globalSearchId(): string {
        return this.#globalSearchId;
    }

    /**
     * Gets the analytics key.
     */
    get analyticsKey(): string {
        return this.#analyticsKey;
    }

    /**
     * Gets the user settings.
     */
    get userSettings(): any {
        return this.#userSettings;
    }

    /**
     * Gets whether the user can profile.
     */
    get canProfile(): boolean {
        return this.#canProfile;
    }

    /**
     * Gets whether the application has the Vidyano management active.
     */
    get hasManagement(): boolean {
        return this.#hasManagement;
    }

    /**
     * Gets the session for the application.
     */
    get session(): PersistentObject {
        return this.#session;
    }

    /**
     * Gets the routes for the application.
     */
    get routes(): IRoutes {
        return this.#routes;
    }
    /**
     * Sets the routes for the application.
     * @param routes - The routes to set.
     */
    #setRoutes(routes: IRoutes) {
        const queryKeys = Object.keys(routes.queries);
        const persistentObjectKeys = Object.keys(routes.persistentObjects);
        this.#routes = {
            queries: Object.assign({}, ...queryKeys.map(q => ({ [q.toKebabCase()]: routes.queries[q] }))),
            queryKeys: queryKeys,
            persistentObjects: Object.assign({}, ...Object.keys(routes.persistentObjects).map(po => ({ [po.toKebabCase()]: routes.persistentObjects[po] }))),
            persistentObjectKeys: persistentObjectKeys,
            programUnits: Object.assign(routes.programUnits, ...Object.keys(routes.programUnits).map(pu => ({ [pu.toKebabCase()]: routes.programUnits[pu] })))
        };
    }

    /**
     * Gets the regular expression for the persistent object.
     */
    get poRe(): RegExp {
        return this.#poRe;
    }

    /**
     * Gets the regular expression for the query.
     */
    get queryRe(): RegExp {
        return this.#queryRe;
    }

    /**
     * Saves the user settings to the persistent object or local storage.
     * @returns A promise that resolves to the user settings.
     */
    async saveUserSettings(): Promise<any> {
        if (this.userSettingsId !== "00000000-0000-0000-0000-000000000000") {
            const po = await this.service.getPersistentObject(null, this.userSettingsId, null);
            po.attributes["Settings"].value = JSON.stringify(this.userSettings);

            await po.save();
        } else
            localStorage["UserSettings"] = JSON.stringify(this.userSettings);

        return this.userSettings;
    }

    /**
     * Updates the session with the provided session data.
     * @param session - The session data to update.
     */
    _updateSession(session: any) {
        const oldSession = this.#session;

        if (!session) {
            if (this.#session)
                this.#session = null;
        } else {
            if (this.#session)
                _internal(this.#session).refreshFromResult(new PersistentObject(this.service, session));
            else
                this.#session = new PersistentObject(this.service, session);
        }

        if (oldSession !== this.#session)
            this.notifyPropertyChanged("session", this.#session, oldSession);
    }
}

/**
 * Represents the routes for the application.
 */
export interface IRoutes {
    /**
     * The program units.
     */
    programUnits: { [name: string]: string };

    /**
     * The persistent objects.
     */
    persistentObjects: { [type: string]: string };

    /**
     * The keys for the persistent objects.
     */
    persistentObjectKeys: string[];

    /**
     * The queries.
     */
    queries: { [type: string]: string };

    /**
     * The keys for the queries.
     */
    queryKeys: string[];
}