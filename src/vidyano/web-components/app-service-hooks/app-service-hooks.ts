import * as Vidyano from "vidyano"
import { guid } from "libs/utils/guid"
import { Path } from "libs/pathjs/pathjs"
import type { App } from "components/app/app"
import { AppServiceHooksBase } from "./app-service-hooks-base"
import { AppCacheEntryPersistentObject } from "components/app-cache/app-cache-entry-persistent-object"
import { AppCacheEntryPersistentObjectFromAction } from "components/app-cache/app-cache-entry-persistent-object-from-action"
import { AppCacheEntryQuery } from "components/app-cache/app-cache-entry-query"
import { PersistentObjectDialog } from "components/persistent-object-dialog/persistent-object-dialog"
import { PersistentObjectWizardDialog } from "components/persistent-object-wizard-dialog/persistent-object-wizard-dialog"
import type { PersistentObjectPresenter } from "components/persistent-object-presenter/persistent-object-presenter"
import type { ProgramUnitPresenter } from "components/program-unit-presenter/program-unit-presenter"
import type { QueryPresenter } from "components/query-presenter/query-presenter"

export class AppServiceHooks extends AppServiceHooksBase {
    get app(): App {
        return <App>super.app;
    }

    onSessionExpired(): Promise<boolean> {
        this.app.redirectToSignIn();
        return Promise.resolve(false);
    }

    async onAction(args: Vidyano.ExecuteActionArgs): Promise<Vidyano.PersistentObject> {
        if (args.action === "ShowHelp") {
            // Only pass selected tab for actions on persistent objects
            if (!args.query) {
                let cacheEntry = new AppCacheEntryPersistentObject(args.persistentObject);
                cacheEntry = <AppCacheEntryPersistentObject>this.app.cacheEntries.find(ce => ce.isMatch(cacheEntry));

                if (cacheEntry && cacheEntry.selectedMasterTab) {
                    if (!args.parameters)
                        args.parameters = {};

                    args.parameters["selectedMasterTab"] = cacheEntry.selectedMasterTab.name;
                } else if (args.parameters && args.parameters["selectedMasterTab"])
                    args.parameters["selectedMasterTab"] = undefined;
            }

            return super.onAction(args);
        }
        else if (args.action === "viAudit")
            import("components/audit/audit");

        return super.onAction(args);
    }

    async onOpen(obj: Vidyano.ServiceObject, replaceCurrent: boolean = false, forceFromAction?: boolean) {
        if (obj instanceof Vidyano.PersistentObject) {
            const po = <Vidyano.PersistentObject>obj;

            if (po.stateBehavior.indexOf("AsWizard") >= 0) {
                await this.app.showDialog(new PersistentObjectWizardDialog(po));

                return;
            }
            else if (po.stateBehavior.indexOf("OpenAsDialog") >= 0) {
                await this.app.showDialog(new PersistentObjectDialog(po));

                return;
            }
            else if (!('getUrlForPersistentObject' in this.app))
                return;

            let path: string;
            if (!obj.forceFromAction && !forceFromAction) {
                path = this.app.getUrlForPersistentObject(po.id, po.objectId);

                const cacheEntry = new AppCacheEntryPersistentObject(po);
                const existing = this.app.cachePing(cacheEntry);
                if (existing)
                    this.app.cacheRemove(existing);

                this.app.cache(cacheEntry);
            }
            else {
                const fromActionId = guid();
                path = this.app.getUrlForFromAction(fromActionId);

                if (!po.isNew && po.objectId) {
                    const existingPoCacheEntry = this.app.cachePing(new AppCacheEntryPersistentObject(po));
                    if (existingPoCacheEntry)
                        this.app.cacheRemove(existingPoCacheEntry);
                }
                else if (po.isBulkEdit) {
                    po.bulkObjectIds.forEach(poId => {
                        const existingPoCacheEntry = this.app.cachePing(new AppCacheEntryPersistentObject(po.id, poId));
                        if (existingPoCacheEntry)
                            this.app.cacheRemove(existingPoCacheEntry);
                    });
                }

                this.app.cache(new AppCacheEntryPersistentObjectFromAction(po, fromActionId, this.app.path));
            }

            this.app.changePath(path, replaceCurrent);
        }
    }

    onClose(parent: Vidyano.ServiceObject) {
        if (parent instanceof Vidyano.PersistentObject) {
            const cacheEntry = <AppCacheEntryPersistentObjectFromAction>this.app.cachePing(new AppCacheEntryPersistentObjectFromAction(parent));
            if (cacheEntry instanceof AppCacheEntryPersistentObjectFromAction && cacheEntry.fromActionIdReturnPath) {
                if (Path.removeRootPath(this.app.getUrlForFromAction(cacheEntry.fromActionId)) === Path.removeRootPath(this.app.path))
                    history.back();
            }
        }
    }

    onClientOperation(operation: Vidyano.IClientOperation) {
        switch (operation.type) {
            case "Refresh":
                const refresh = <Vidyano.IRefreshOperation>operation;
                if (refresh.queryId) {
                    const cacheEntry = <AppCacheEntryQuery>this.app.cachePing(new AppCacheEntryQuery(refresh.queryId));
                    if (cacheEntry && cacheEntry.query && cacheEntry.query.hasSearched)
                        cacheEntry.query.search({ delay: refresh.delay });

                    const poCacheEntriesWithQueries = <AppCacheEntryPersistentObject[]>this.app.cacheEntries.filter(e => e instanceof AppCacheEntryPersistentObject && !!e.persistentObject && e.persistentObject.queries.length > 0);
                    poCacheEntriesWithQueries.forEach(poEntry => poEntry.persistentObject.queries.filter(q => q.id === refresh.queryId && q.hasSearched).forEach(q => q.search({ delay: refresh.delay })));
                }
                else {
                    const refreshPersistentObject = async () => {
                        const cacheEntry = <AppCacheEntryPersistentObject>this.app.cachePing(new AppCacheEntryPersistentObject(refresh.fullTypeName, refresh.objectId));
                        if (!cacheEntry || !cacheEntry.persistentObject)
                            return;

                        try {
                            const po = await this.app.service.getPersistentObject(cacheEntry.persistentObject.parent, cacheEntry.persistentObject.id, cacheEntry.persistentObject.objectId);
                            Vidyano._internal(cacheEntry.persistentObject).refreshFromResult(po, true);
                        }
                        catch (e) {
                            cacheEntry.persistentObject.setNotification(e);
                        }
                    };

                    if (refresh.delay)
                        setTimeout(refreshPersistentObject, refresh.delay);
                    else
                        refreshPersistentObject();
                }

                break;

            default:
                super.onClientOperation(operation);
                break;
        }
    }

    async onQueryFileDrop(query: Vidyano.Query, name: string, contents: string): Promise<boolean> {
        const config = this.app.configuration.getQueryConfig(query);
        const fileDropAction = <Vidyano.Action>query.actions[config.fileDropAction];

        const po = await fileDropAction.execute({ skipOpen: true });
        return query.queueWork(async () => {
            const fileDropAttribute = po.getAttribute(config.fileDropAttribute);
            if (!fileDropAttribute)
                return false;

            try {
                await fileDropAttribute.setValue(`${name}|${contents}`);
                return await po.save();
            }
            catch (e) {
                query.setNotification(e);
                return false;
            }
        }, true);
    }

    onRedirectToSignIn(keepUrl: boolean) {
        if (keepUrl && this.app.path.startsWith("sign-in/")) {
            this.app.changePath(this.app.path);
            return;
        }

        this.app.changePath("sign-in" + (keepUrl && this.app.path ? "/" + encodeURIComponent(Path.removeRootPath(this.app.path).replace(/sign-in\/?/, "")).replace(/\./g, "%2E") : ""), true);
    }

    onRedirectToSignOut(keepUrl: boolean) {
        this.app.changePath("sign-out" + (keepUrl && this.app.path ? "/" + encodeURIComponent(Path.removeRootPath(decodeURIComponent(this.app.path)).replace(/sign-in\/?/, "")).replace(/\./g, "%2E") : ""), true);
    }

    /**
     * Called when a persistent object is activated, e.g. when it is opened in a dialog or navigated to.
     * @param persistentObject - The persistent object that was activated.
     * @param details - Additional details about the activation, such as whether it was opened as a dialog or the presenter.
     */
    onPersistentObjectActivated(persistentObject: Vidyano.PersistentObject, details: PersistentObjectActivationDetails = {}): void {
        // Noop
    }

    /**
     * Called when a persistent object is deactivated, e.g. when the dialog is closed or navigated away from.
     * @param persistentObject - The persistent object that was deactivated.
     * @param details - Additional details about the deactivation, such as the presenter.
     */
    onPersistentObjectDeactivated(persistentObject: Vidyano.PersistentObject, details: PersistentObjectActivationDetails = {}): void {
        // Noop
    }

    /**
     * Called when a program unit is activated, e.g. when it is opened in a dialog or navigated to.
     * @param programUnit - The program unit that was activated.
     * @param details - Additional details about the activation, such as the presenter.
     */
    onProgramUnitActivated(programUnit: Vidyano.ProgramUnit, details: ProgramUnitActivationDetails = {}): void {
        // Noop
    }

    /**
     * Called when a program unit is deactivated, e.g. when the dialog is closed or navigated away from.
     * @param programUnit - The program unit that was deactivated.
     * @param details - Additional details about the deactivation, such as the presenter.
     */
    onProgramUnitDeactivated(programUnit: Vidyano.ProgramUnit, details: ProgramUnitActivationDetails = {}): void {
        // Noop
    }

    /**
     * Called when a query is activated, e.g. when it is opened in a dialog or navigated to.
     * @param query - The query that was activated.
     * @param details - Additional details about the activation, such as the presenter.
     */
    onQueryActivated(query: Vidyano.Query, details: QueryActivationDetails = {}): void {
        // Noop
    }

    /**
     * Called when a query is deactivated, e.g. when the dialog is closed or navigated away from.
     * @param query - The query that was deactivated.
     * @param details - Additional details about the deactivation, such as the presenter.
     */
    onQueryDeactivated(query: Vidyano.Query, details: QueryActivationDetails = {}): void {
        // Noop
    }
}

export type PersistentObjectActivationDetails = {
    asDialog?: boolean;
    presenter?: PersistentObjectPresenter;
};

export type ProgramUnitActivationDetails = {
    presenter?: ProgramUnitPresenter;
};

export type QueryActivationDetails = {
    presenter?: QueryPresenter;
};
