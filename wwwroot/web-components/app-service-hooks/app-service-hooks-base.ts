import * as Vidyano from "../../libs/vidyano/vidyano"
import { AppBase } from "../app/app-base"
import { App } from "../app/app"
import { AppRoute } from "../app-route/app-route"
import { PersistentObjectConfig } from "../app/config/persistent-object-config"
import { PersistentObjectAttributeConfig } from "../app/config/persistent-object-attribute-config"
import { PersistentObjectTabConfig } from "../app/config/persistent-object-tab-config"
import { ProgramUnitConfig } from "../app/config/program-unit-config"
import { QueryConfig } from "../app/config/query-config"
import { QueryChartConfig } from "../app/config/query-chart-config"
import { RetryActionDialog } from "../retry-action-dialog/retry-action-dialog"
import { SelectReferenceDialog } from "../select-reference-dialog/select-reference-dialog"

/* tslint:disable:no-var-keyword */
var _gaq: any[];
/* tslint:enable:no-var-keyword */

export class AppServiceHooksBase extends Vidyano.ServiceHooks {
    constructor(public app: AppBase) {
        super();
    }

    private _initializeGoogleAnalytics() {
        let addScript = false;
        if (typeof (_gaq) === "undefined") {
            _gaq = [];
            addScript = true;
        }

        _gaq.push(["_setAccount", this.app.service.application.analyticsKey]);
        _gaq.push(["_setDomainName", "none"]); // NOTE: Track all domains

        if (addScript) {
            const ga = document.createElement("script");
            ga.type = "text/javascript"; ga.async = true;
            ga.src = ("https:" === document.location.protocol ? "https://ssl" : "http://www") + ".google-analytics.com/ga";

            const script = document.getElementsByTagName("script")[0];
            script.parentNode.insertBefore(ga, script);
        }
    }

    trackEvent(action: string, option: string, owner: Vidyano.ServiceObjectWithActions) {
        if (!this.app || !this.app.service || !this.app.service.application || !this.app.service.application.analyticsKey)
            return;

        this._initializeGoogleAnalytics();

        let page = "Unknown";
        let type = "Unknown";

        if (owner != null) {
            if (owner instanceof Vidyano.Query) {
                page = "Query";
                type = owner.persistentObject.type;
            }
            else if (owner instanceof Vidyano.PersistentObject) {
                page = "PersistentObject";
                type = owner.type;
            }
        }

        _gaq.push(["_setCustomVar", 1, "UserId", this.getTrackUserId(), 1]);
        _gaq.push(["_setCustomVar", 2, "Page", page, 2]);
        _gaq.push(["_setCustomVar", 3, "Type", type, 2]);
        _gaq.push(["_setCustomVar", 4, "Option", option, 2]);

        _gaq.push(["_trackEvent", "Action", action.split(".").pop()]);
    }

    trackPageView(path: string) {
        if (!this.app || !this.app.service || !this.app.service.application || !this.app.service.application.analyticsKey)
            return;

        path = AppBase.removeRootPath(path);
        if (!path || path.startsWith("from-action"))
            return;

        this._initializeGoogleAnalytics();

        _gaq.push(["_setCustomVar", 1, "UserId", this.getTrackUserId(), 1]);
        _gaq.push(["_trackPageview", path]);
    }

    getTrackUserId(): string {
        return ""; // e.g. this.app.service.application.userId
    }

    getPersistentObjectConfig(persistentObject: Vidyano.PersistentObject, persistentObjectConfigs: PersistentObjectConfig[]): PersistentObjectConfig {
        return persistentObjectConfigs.find(c => (c.id === persistentObject.id || c.type === persistentObject.type || c.type === persistentObject.fullTypeName) && c.objectId === persistentObject.objectId) ||
            persistentObjectConfigs.find(c => !c.objectId && (c.id === persistentObject.id || c.type === persistentObject.type || c.type === persistentObject.fullTypeName));
    }

    getAttributeConfig(attribute: Vidyano.PersistentObjectAttribute, attributeConfigs: PersistentObjectAttributeConfig[]): PersistentObjectAttributeConfig {
        return attributeConfigs.find(c => c.parentObjectId === attribute.parent.objectId && c.parentId === attribute.parent.id && (c.name === attribute.name || c.type === attribute.type)) ||
            attributeConfigs.find(c => c.parentId === attribute.parent.id && (c.name === attribute.name || c.type === attribute.type)) ||
            attributeConfigs.find(c => c.name === attribute.name && c.type === attribute.type && !c.parentId) ||
            attributeConfigs.find(c => c.name === attribute.name && !c.parentId && !c.type) ||
            attributeConfigs.find(c => c.type === attribute.type && !c.parentId && !c.name);
    }

    getTabConfig(tab: Vidyano.PersistentObjectTab, tabConfigs: PersistentObjectTabConfig[]): PersistentObjectTabConfig {
        return tabConfigs.find(c => c.name === tab.name && (c.type === tab.parent.type || c.type === tab.parent.fullTypeName || c.id === tab.parent.id) && c.objectId === tab.parent.objectId) ||
            tabConfigs.find(c => c.name === tab.name && (c.type === tab.parent.type || c.type === tab.parent.fullTypeName || c.id === tab.parent.id));
    }

    getProgramUnitConfig(name: string, programUnitConfigs: ProgramUnitConfig[]): ProgramUnitConfig {
        return programUnitConfigs.find(c => c.name === name);
    }

    getQueryConfig(query: Vidyano.Query, queryConfigs: QueryConfig[]): QueryConfig {
        return queryConfigs.find(c => c.id === query.id || c.name === query.name) ||
            queryConfigs.find(c => c.type === query.persistentObject.type) ||
            queryConfigs.find(c => !c.id && !c.name && !c.type);
    }

    getQueryChartConfig(type: string, queryChartConfigs: QueryChartConfig[]): QueryChartConfig {
        return queryChartConfigs.find(c => c.type === type);
    }

    onConstructApplication(application: Vidyano.Dto.ApplicationResponse): Vidyano.Application {
        const app = super.onConstructApplication(application);
        this.app.sensitive = app.hasSensitive && Boolean.parse(Vidyano.cookie("sensitive")) !== false;

        return app;
    }

    onConstructQuery(service: Vidyano.Service, query: any, parent?: Vidyano.PersistentObject, asLookup: boolean = false, maxSelectedItems?: number): Vidyano.Query {
        const newQuery = super.onConstructQuery(service, query, parent, asLookup, maxSelectedItems);

        const queryConfig = this.app.configuration.getQueryConfig(newQuery);
        if (queryConfig) {
            if (queryConfig.defaultChart)
                newQuery.defaultChartName = queryConfig.defaultChart;

            if (queryConfig.selectAll)
                newQuery.selectAll.isAvailable = true;
        }

        return newQuery;
    }

    async onActionConfirmation(action: Vidyano.Action, option: number): Promise<boolean> {
        const result = await this.app.showMessageDialog({
            title: action.displayName,
            titleIcon: "Action_" + action.name,
            message: this.service.getTranslatedMessage(action.definition.confirmation, option >= 0 ? action.options[option] : undefined),
            actions: [action.displayName, this.service.getTranslatedMessage("Cancel")],
            actionTypes: action.name === "Delete" ? ["Danger"] : []
        });

        return result === 0;
    }

    async onAppRouteChanging(newRoute: AppRoute, currentRoute: AppRoute): Promise<string> {
        return Promise.resolve(null);
    }

    async onAction(args: Vidyano.ExecuteActionArgs): Promise<Vidyano.PersistentObject> {
        if (args.action === "AddReference") {
            args.isHandled = true;

            const query = args.query.clone(true);
            query.search();

            const result = await this.app.showDialog(new SelectReferenceDialog(query));
            if (result && result.length > 0) {
                args.selectedItems = result;

                return await args.executeServiceRequest();
            }
            else
                return null;
        }

        return super.onAction(args);
    }

    async onBeforeAppInitialized(): Promise<void> {
        return Promise.resolve();
    }

    async onAppInitializeFailed(message: string): Promise<void> {
        if (message === "Session expired")
            return;

        const noInternet = Vidyano.NoInternetMessage.messages[navigator.language.split("-")[0].toLowerCase()] || Vidyano.NoInternetMessage.messages["en"];
        await this.app.showMessageDialog({
            title: message === noInternet.message ? noInternet.title : (<App>this.app).label || document.title,
            message: message,
            actions: [noInternet.tryAgain],
            actionTypes: ["Danger"],
            noClose: true
        });

        document.location.reload();
    }

    onRedirectToSignIn(keepUrl: boolean) {
        // Noop
    }

    onRedirectToSignOut(keepUrl: boolean) {
        // Noop
    }

    onMessageDialog(title: string, message: string, rich: boolean, ...actions: string[]): Promise<number> {
        return this.app.showMessageDialog({ title: title, message: message, rich: rich, actions: actions });
    }

    onShowNotification(notification: string, type: Vidyano.NotificationType, duration: number) {
        if (!duration || !notification)
            return;

        if (typeof notification === "object")
            notification = notification["message"];

        this.app.showAlert(notification, type, duration);
    }

    async onSelectReference(query: Vidyano.Query): Promise<Vidyano.QueryResultItem[]> {
        if (!query.hasSearched)
            query.search();

        return this.app.showDialog(new SelectReferenceDialog(query, false, false, true));
    }

    async onInitial(initial: Vidyano.PersistentObject) {
        const initialPath = `SignIn/${initial.type}`;
        const currentPathWithoutRoot = AppBase.removeRootPath(this.app.path);

        if (!currentPathWithoutRoot.startsWith(initialPath)) {
            const returnPath = currentPathWithoutRoot && !currentPathWithoutRoot.startsWith("SignIn") ? currentPathWithoutRoot : "";
            this.app.changePath(`${initialPath}/${encodeURIComponent(returnPath)}`);
        }
    }

    async onSessionExpired(): Promise<boolean> {
        if (!(this.app instanceof App)) {
            this.app.redirectToSignIn();
            return false;
        }

        await this.app.service.signOut(true);
        return true;
    }

    onUpdateAvailable() {
        super.onUpdateAvailable();

        this.app.fire("app-update-available", null);
    }

    onNavigate(path: string, replaceCurrent: boolean = false) {
        this.app.changePath(AppBase.removeRootPath(path), replaceCurrent);
    }

    async onRetryAction(retry: Vidyano.Dto.RetryAction): Promise<string> {
        if (retry.persistentObject) {
            return this.app.showDialog(new RetryActionDialog(retry));
        }

        return retry.options[await this.app.showMessageDialog({
            title: retry.title,
            message: retry.message,
            actions: retry.options,
            noClose: retry.cancelOption == null,
            defaultAction: retry.defaultOption,
            cancelAction: retry.cancelOption
        })];
    }
}