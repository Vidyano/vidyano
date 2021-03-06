import type * as Dto from "./typings/service.js"
import { PersistentObject } from "./persistent-object.js"
import type { Service } from "./service.js"
import { ProgramUnit } from "./program-unit.js"

export class Application extends PersistentObject {
    private _userId: string;
    private _friendlyUserName: string;
    private _feedbackId: string;
    private _userSettingsId: string;
    private _globalSearchId: string;
    private _analyticsKey: string;
    private _userSettings: any;
    private _canProfile: boolean;
    private _hasManagement: boolean;
    private _session: PersistentObject;
    private _routes: IRoutes;
    private _poRe: RegExp;
    private _queryRe: RegExp;
    readonly programUnits: ProgramUnit[];
    readonly hasSensitive: boolean;

    constructor(service: Service, { application, hasSensitive }: Dto.ApplicationResponse) {
        super(service, application);

        this._userId = this.getAttributeValue("UserId");
        this._friendlyUserName = this.getAttributeValue("FriendlyUserName") || service.userName;
        this._feedbackId = this.getAttributeValue("FeedbackId");
        this._userSettingsId = this.getAttributeValue("UserSettingsId");
        this._globalSearchId = this.getAttributeValue("GlobalSearchId");
        this._analyticsKey = this.getAttributeValue("AnalyticsKey");
        this._setRoutes(JSON.parse(this.getAttributeValue("Routes")));

        const puRoutes = "^((" + Object.keys(this._routes.programUnits).join("|") + ")/)?";
        const poTypes = Object.keys(this._routes.persistentObjects).concat(this._routes.persistentObjectKeys);
        this._poRe = poTypes.length === 0 ? /$ ^/ : new RegExp(puRoutes + "(" + poTypes.join("|") + ")(/.+)?$");
        const queryNames = Object.keys(this._routes.queries).concat(this._routes.queryKeys);
        this._queryRe = queryNames.length === 0 ? /$ ^/ : new RegExp(puRoutes + "(" + queryNames.join("|") + ")$");

        const userSettings = this.getAttributeValue("UserSettings");
        this._userSettings = JSON.parse(String.isNullOrEmpty(userSettings) ? (localStorage["UserSettings"] || "{}") : userSettings);

        this._canProfile = this.getAttributeValue("CanProfile");

        const pus = <{ hasManagement: boolean; units: any[] }>JSON.parse(this.getAttributeValue("ProgramUnits"));
        this._hasManagement = pus.hasManagement;
        this.programUnits = pus.units.map(unit => new ProgramUnit(this.service, this.routes, unit));

        this.hasSensitive = !!hasSensitive;
    }

    get userId(): string {
        return this._userId;
    }

    get friendlyUserName(): string {
        return this._friendlyUserName;
    }

    get feedbackId(): string {
        return this._feedbackId;
    }

    get userSettingsId(): string {
        return this._userSettingsId;
    }

    get globalSearchId(): string {
        return this._globalSearchId;
    }

    get analyticsKey(): string {
        return this._analyticsKey;
    }

    get userSettings(): any {
        return this._userSettings;
    }

    get canProfile(): boolean {
        return this._canProfile;
    }

    get hasManagement(): boolean {
        return this._hasManagement;
    }

    get session(): PersistentObject {
        return this._session;
    }

    get routes(): IRoutes {
        return this._routes;
    }

    private _setRoutes(routes: IRoutes) {
        const queryKeys = Object.keys(routes.queries);
        const persistentObjectKeys = Object.keys(routes.persistentObjects);
        this._routes = {
            queries: Object.assign({}, ...queryKeys.map(q => ({[q.toKebabCase()]: routes.queries[q]}))),
            queryKeys: queryKeys,
            persistentObjects: Object.assign({}, ...Object.keys(routes.persistentObjects).map(po => ({[po.toKebabCase()]: routes.persistentObjects[po]}))),
            persistentObjectKeys: persistentObjectKeys,
            programUnits: Object.assign(routes.programUnits, ...Object.keys(routes.programUnits).map(pu => ({[pu.toKebabCase()]: routes.programUnits[pu]})))
        };
    }

    get poRe(): RegExp {
        return this._poRe;
    }

    get queryRe(): RegExp {
        return this._queryRe;
    }

    async saveUserSettings(): Promise<any> {
        if (this.userSettingsId !== "00000000-0000-0000-0000-000000000000") {
            const po = await this.service.getPersistentObject(null, this.userSettingsId, null);
            po.attributes["Settings"].value = JSON.stringify(this.userSettings);

            await po.save();
        }
        else
            localStorage["UserSettings"] = JSON.stringify(this.userSettings);

        return this.userSettings;
    }

    _updateSession(session: any) {
        const oldSession = this._session;

        if (!session) {
            if (this._session)
                this._session = null;
        } else {
            if (this._session)
                this._session.refreshFromResult(new PersistentObject(this.service, session));
            else
                this._session = new PersistentObject(this.service, session);
        }

        if (oldSession !== this._session)
            this.notifyPropertyChanged("session", this._session, oldSession);
    }
}

export interface IRoutes {
    programUnits: { [name: string]: string };
    persistentObjects: { [type: string]: string };
    persistentObjectKeys: string[];
    queries: { [type: string]: string };
    queryKeys: string[];
}