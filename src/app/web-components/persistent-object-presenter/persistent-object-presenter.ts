import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
import { App, AppBase } from "components/app/app.js"
import { AppCacheEntryPersistentObject } from "components/app-cache/app-cache-entry-persistent-object.js"
import { AppCacheEntryPersistentObjectFromAction } from "components/app-cache/app-cache-entry-persistent-object-from-action.js"
import { AppRoute } from "components/app-route/app-route.js"
import "components/error/error.js"
import { PersistentObject, IPersistentObjectWebComponent } from "components/persistent-object/persistent-object.js"
import { ConfigurableWebComponent } from "components/web-component/web-component-configurable.js"

interface IPersistentObjectPresenterRouteParameters {
    id: string;
    objectId: string;
    fromActionId: string;
}

@ConfigurableWebComponent.register({
    properties: {
        persistentObjectId: {
            type: String,
            reflectToAttribute: true
        },
        persistentObjectObjectId: {
            type: String,
            reflectToAttribute: true
        },
        persistentObject: {
            type: Object,
            observer: "_persistentObjectChanged"
        },
        loading: {
            type: Boolean,
            readOnly: true,
            value: true,
            reflectToAttribute: true
        },
        templated: {
            type: Boolean,
            reflectToAttribute: true,
            readOnly: true
        },
        error: {
            type: String,
            readOnly: true
        }
    },
    observers: [
        "_updatePersistentObject(persistentObjectId, persistentObjectObjectId, isConnected)",
        "_updateTitle(persistentObject.breadcrumb)"
    ],
    forwardObservers: [
        "persistentObject.breadcrumb"
    ],
    listeners: {
        "app-route-activate": "_activate",
        "app-route-deactivate": "_deactivate",
        "vi:configure": "_configure"
    },
    keybindings: {
        "f2": {
            listener: "_edit",
            priority: 10
        },
        "ctrl+s": "_save",
        "esc": "_cancelSave"
    },
    sensitive: true
})
export class PersistentObjectPresenter extends ConfigurableWebComponent {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-presenter.html">`; }

    private _cacheEntry: AppCacheEntryPersistentObject;
    readonly loading: boolean; private _setLoading: (loading: boolean) => void;
    readonly templated: boolean; private _setTemplated: (templated: boolean) => void;
    readonly error: string; private _setError: (error: string) => void;
    persistentObjectId: string;
    persistentObjectObjectId: string;
    persistentObject: Vidyano.PersistentObject;

    private _activate(e: CustomEvent) {
        const { parameters }: { parameters: IPersistentObjectPresenterRouteParameters; } = e.detail;
        if (parameters.fromActionId) {
            if (this._cacheEntry = <AppCacheEntryPersistentObjectFromAction>(<App>this.app).cachePing(new AppCacheEntryPersistentObjectFromAction(undefined, parameters.fromActionId)))
                this.persistentObject = this._cacheEntry.persistentObject;

            if (!this._cacheEntry) {
                this.persistentObject = null;

                this._setLoading(false);
                this._setError(this.translateMessage("NotFound"));

                return;
            }
        } else {
            const cacheEntry = new AppCacheEntryPersistentObject(parameters.id, parameters.objectId);
            this._cacheEntry = <AppCacheEntryPersistentObject>(<App>this.app).cachePing(cacheEntry);
            if (!this._cacheEntry)
                (<App>this.app).cache(this._cacheEntry = cacheEntry);

            if (this._cacheEntry.persistentObject)
                this.persistentObject = this._cacheEntry.persistentObject;
            else {
                this.persistentObject = this.persistentObjectObjectId = this.persistentObjectId = undefined;
                this.persistentObjectObjectId = this._cacheEntry.objectId || "";
                this.persistentObjectId = this._cacheEntry.id;
            }
        }
    }

    private async _deactivate(e: CustomEvent) {
        const route = <AppRoute>this.parentNode;
        const currentPath = AppBase.removeRootPath(route.path);
        const newPath = AppBase.removeRootPath(this.app.path);

        if (this.persistentObject && this.persistentObject.isDirty && this.persistentObject.actions.some(a => a.name === "Save" || a.name === "EndEdit") && currentPath !== newPath) {
            e.preventDefault();

            const result = await this.app.showMessageDialog( {
                title: this.service.getTranslatedMessage("PagesWithUnsavedChanges"),
                noClose: true,
                message: this.service.getTranslatedMessage("ConfirmLeavePage"),
                actions: [
                    this.service.getTranslatedMessage("StayOnThisPage"),
                    this.service.getTranslatedMessage("LeaveThisPage")
                ]
            });

            if (result === 1) {
                (<App>this.app).cacheEntries.forEach(entry => {
                    if (entry instanceof AppCacheEntryPersistentObject && !!entry.persistentObject && entry.persistentObject.isDirty && entry.persistentObject.actions.some(a => a.name === "Save" || a.name === "EndEdit")) {
                        if (entry.persistentObject.isNew)
                            (<App>this.app).cacheRemove(entry);
                        else
                            entry.persistentObject.cancelEdit();
                    }
                });

                this.app.changePath(newPath);
                route.deactivator(true);
            }
            else {
                route.deactivator(false);
                this.app.changePath(currentPath);
            }
        }
    }

    private async _updatePersistentObject(persistentObjectId: string, persistentObjectObjectId: string, isConnected: boolean) {
        this._setError(null);

        if (!this.isConnected || (this.persistentObject && this.persistentObject.id === persistentObjectId && this.persistentObject.objectId === persistentObjectObjectId))
            return;

        if (persistentObjectId != null) {
            this._setLoading(true);

            try {
                const po = await this.service.getPersistentObject(null, persistentObjectId, persistentObjectObjectId);
                const cacheEntry = <AppCacheEntryPersistentObject>(<App>this.app).cache(new AppCacheEntryPersistentObject(persistentObjectId, persistentObjectObjectId));

                cacheEntry.persistentObject = po;

                if (persistentObjectId === this.persistentObjectId && persistentObjectObjectId === this.persistentObjectObjectId) {
                    this.persistentObject = po;
                    this._cacheEntry = cacheEntry;
                }
            }
            catch (e) {
                this._setError(e);
                this._setLoading(false);
            }
        }
        else
            this.persistentObject = null;
    }

    private async _persistentObjectChanged(persistentObject: Vidyano.PersistentObject, oldPersistentObject: Vidyano.PersistentObject) {
        this._setError(null);

        if (oldPersistentObject)
            this.empty();

        if (persistentObject) {
            const config = this.app.configuration.getPersistentObjectConfig(persistentObject);
            this._setTemplated(!!config && config.hasTemplate);

            if (this.templated) {
                this.appendChild(config.stamp(persistentObject, config.as || "persistentObject"));
                this._setLoading(false);
            }
            else
                this._renderPersistentObject(persistentObject);
        }
    }

    private _updateTitle(breadcrumb: string) {
        if (!breadcrumb)
            return;

        this.fire("title-changed", { title: this.persistentObject.isBreadcrumbSensitive && this.isAppSensitive ? null : breadcrumb }, { bubbles: true });
    }

    private async _renderPersistentObject(persistentObject: Vidyano.PersistentObject) {
        if (persistentObject !== this.persistentObject)
            return;

        const persistentObjectComponent = renderCallback ? renderCallback(persistentObject) : new PersistentObject();
        persistentObjectComponent.persistentObject = persistentObject;
        this.appendChild(persistentObjectComponent);

        this._setLoading(false);
    }

    private _edit() {
        if (!this.persistentObject)
            return;

        const action = <Vidyano.Action>this.persistentObject.actions["Edit"];
        if (action)
            action.execute();
    }

    private _save() {
        if (!this.persistentObject)
            return;

        const action = <Vidyano.Action>(this.persistentObject.actions["Save"] || this.persistentObject.actions["EndEdit"]);
        if (action)
            action.execute();
    }

    private _cancelSave() {
        if (!this.persistentObject)
            return;

        const action = <Vidyano.Action>(this.persistentObject.actions["CancelEdit"] || this.persistentObject.actions["CancelSave"]);
        if (action)
            action.execute();
    }

    private _configure(e: CustomEvent) {
        if (!this.persistentObject || this.persistentObject.isSystem)
            return;

        e.detail.push({
            label: `Persistent Object: ${this.persistentObject.type}`,
            icon: "viConfigure",
            action: () => {
                this.app.changePath(`management/persistent-object.316b2486-df38-43e3-bee2-2f7059334992/${this.persistentObject.id}`);
            }
        });
    }

    static registerRenderCallback(callback: (persistentObject: Vidyano.PersistentObject) => IPersistentObjectWebComponent) {
        renderCallback = callback;
    }
}

let renderCallback: (persistentObject: Vidyano.PersistentObject) => IPersistentObjectWebComponent = null;

export default PersistentObjectPresenter;