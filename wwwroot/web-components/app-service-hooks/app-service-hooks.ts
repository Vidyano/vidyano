import * as Vidyano from "../../libs/vidyano/vidyano.js"
import { guid } from "../../libs/utils/guid.js"
import { App } from "../app/app.js"
import { AppServiceHooksBase } from "./app-service-hooks-base.js"
import { AppCacheEntryPersistentObject } from "../app-cache/app-cache-entry-persistent-object.js"
import { AppCacheEntryPersistentObjectFromAction } from "../app-cache/app-cache-entry-persistent-object-from-action.js"
import { AppCacheEntryQuery } from "../app-cache/app-cache-entry-query.js"
import { PersistentObjectDialog } from "../persistent-object-dialog/persistent-object-dialog.js"
import { PersistentObjectWizardDialog } from "../persistent-object-wizard-dialog/persistent-object-wizard-dialog.js"

export class AppServiceHooks extends AppServiceHooksBase {
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
            import("../audit/audit");

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
            else if (!(this.app instanceof App))
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
                if (App.removeRootPath(this.app.getUrlForFromAction(cacheEntry.fromActionId)) === App.removeRootPath(this.app.path))
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
                    if (cacheEntry && cacheEntry.query)
                        cacheEntry.query.search({ delay: refresh.delay });

                    const poCacheEntriesWithQueries = <AppCacheEntryPersistentObject[]>this.app.cacheEntries.filter(e => e instanceof AppCacheEntryPersistentObject && !!e.persistentObject && e.persistentObject.queries.length > 0);
                    poCacheEntriesWithQueries.forEach(poEntry => poEntry.persistentObject.queries.filter(q => q.id === refresh.queryId).forEach(q => q.search({ delay: refresh.delay })));
                }
                else {
                    const refreshPersistentObject = async () => {
                        const cacheEntry = <AppCacheEntryPersistentObject>this.app.cachePing(new AppCacheEntryPersistentObject(refresh.fullTypeName, refresh.objectId));
                        if (!cacheEntry || !cacheEntry.persistentObject)
                            return;

                        try {
                            const po = await this.app.service.getPersistentObject(cacheEntry.persistentObject.parent, cacheEntry.persistentObject.id, cacheEntry.persistentObject.objectId);
                            cacheEntry.persistentObject.refreshFromResult(po, true);
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

        this.app.changePath("sign-in" + (keepUrl && this.app.path ? "/" + encodeURIComponent(App.removeRootPath(this.app.path).replace(/sign-in\/?/, "")).replace(/\./g, "%2E") : ""), true);
    }

    onRedirectToSignOut(keepUrl: boolean) {
        this.app.changePath("sign-out" + (keepUrl && this.app.path ? "/" + encodeURIComponent(App.removeRootPath(decodeURIComponent(this.app.path)).replace(/sign-in\/?/, "")).replace(/\./g, "%2E") : ""), true);
    }
}