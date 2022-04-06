import "tslib"
import * as Vidyano from "../../libs/vidyano/vidyano.js"
import * as Polymer from "../../libs/polymer/polymer.js"
import { Path } from "../../libs/pathjs/pathjs.js"
import { AppBase } from "./app-base.js"
export { AppBase } from "./app-base.js"
import "../menu/menu.js"
import "../sign-in/sign-in.js"
import "../sign-out/sign-out.js"
import "../spinner/spinner.js"
import "../profiler/profiler.js"
import { WebComponent } from "../web-component/web-component.js"
import { AppCacheEntry } from "../app-cache/app-cache-entry.js"
import { AppServiceHooks } from "../app-service-hooks/app-service-hooks.js"
import { AppCacheEntryPersistentObject } from "../app-cache/app-cache-entry-persistent-object.js"
import { PopupMenu } from "../popup-menu/popup-menu.js"

@WebComponent.register({
    properties: {
        cacheSize: {
            type: Number,
            value: 25,
            reflectToAttribute: true
        },
        pathExtended: {
            type: String,
            observer: "_pathExtendedChanged"
        },
        programUnit: {
            type: Object,
            computed: "_computeProgramUnit(service.application, path)"
        },
        noMenu: {
            type: Boolean,
            reflectToAttribute: true,
            value: false
        },
        label: {
            type: String,
            reflectToAttribute: true
        },
        isProfiling: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "op_every(service.isSignedIn, service.profile)"
        },
        signInLogo: String,
        showMenu: {
            type: Boolean,
            computed: "_computeShowMenu(service.application, noMenu)"
        }
    },
    observers: [
        "_hookWindowBeforeUnload(isConnected)"
    ],
    listeners: {
        "contextmenu": "_configureContextmenu"
    },
    forwardObservers: [
        "service.profile"
    ]
})
export class App extends AppBase {
    static get template() {
        const baseTemplate = AppBase.template as HTMLTemplateElement;
        baseTemplate.content.appendChild(Polymer.html`<link rel="import" href="app.html">`.content);

        return baseTemplate;
    }

    private _cache: AppCacheEntry[] = [];
    private _beforeUnloadEventHandler: EventListener;
    programUnit: Vidyano.ProgramUnit;
    noMenu: boolean;
    label: string;
    cacheSize: number;

    private constructor(readonly hooks: AppServiceHooks = new AppServiceHooks()) {
        super(hooks);

        if (!this.label)
            this.label = this.title;
    }

    protected _initPathRescue() {
        Path.rescue(() => {
            const path = App.removeRootPath(Path.routes.current);
            let mappedPath = this._convertPath(this.app.service.application, path);
            if (mappedPath !== path)
                Path["dispatch"](Path.routes.rootPath + mappedPath);
            else if (path.contains("/")) {
                const parts = path.split("/");
                const kebabPath = [parts[0].toKebabCase(), parts[1].toKebabCase(), ...parts.slice(2)].join("/");
                const mappedKebabPath = this._convertPath(this.app.service.application, kebabPath);
                if (kebabPath !== mappedKebabPath) {
                    Polymer.Async.microTask.run(() => this.changePath(kebabPath, true));
                    return;
                }
            }

            this.path = path;
        });
    }

    protected async _pathChanged(path: string) {
        await this.initialize;

        if (path !== this.path)
            return;

        path = App.removeRootPath(this._convertPath(this.service.application, path));
        if (this.service && this.service.isSignedIn && path === "") {
            let programUnit = this.programUnit;
            if (!programUnit && this.service.application.programUnits.length > 0)
                programUnit = this.service.application.programUnits[0];

            if (programUnit) {
                if (programUnit.openFirst && programUnit.path && path !== programUnit.path) {
                    Polymer.Async.microTask.run(() => this.changePath(programUnit.path));
                    return;
                }
                else {
                    const config = this.app.configuration.getProgramUnitConfig(programUnit.name);
                    if (!!config && config.hasTemplate) {
                        Polymer.Async.microTask.run(() => this.changePath(programUnit.path));
                        return;
                    }
                }
            }
        }

        Vidyano.ServiceBus.send(this, "path-changed", { path: path });
    }

    private _pathExtendedChanged(pathExtended: string) {
        this.path = pathExtended;
    }

    private _computeProgramUnit(application: Vidyano.Application, path: string): Vidyano.ProgramUnit {
        path = this._convertPath(application, path);

        const mappedPathRoute = Path.match(Path.routes.rootPath + App.removeRootPath(path), true);
        if (application) {
            if (mappedPathRoute && mappedPathRoute.params && mappedPathRoute.params.programUnitName)
                return application.programUnits.find(pu => pu.nameKebab === mappedPathRoute.params.programUnitName || pu.name === mappedPathRoute.params.programUnitName) || application.programUnits[0];
            else if (application.programUnits.length > 0)
                return application.programUnits[0];
        }

        return null;
    }

    private _computeShowMenu(application: Vidyano.Application, noMenu: boolean): boolean {
        if (!application || noMenu)
            return false;

        return true;
    }

    private _hookWindowBeforeUnload(isConnected: boolean) {
        if (this._beforeUnloadEventHandler) {
            window.removeEventListener("beforeunload", this._beforeUnloadEventHandler);
            this._beforeUnloadEventHandler = null;
        }

        if (isConnected)
            window.addEventListener("beforeunload", this._beforeUnloadEventHandler = this._beforeUnload.bind(this));
    }

    private _beforeUnload(e: Event) {
        if (this._cache.some(entry => entry instanceof AppCacheEntryPersistentObject && !!entry.persistentObject && entry.persistentObject.isDirty && entry.persistentObject.actions.some(a => a.name === "Save" || a.name === "EndEdit")) && this.service) {
            const confirmationMessage = this.service.getTranslatedMessage("PagesWithUnsavedChanges");

            (e || window.event).returnValue = <any>confirmationMessage; // Gecko + IE
            return confirmationMessage; // Webkit, Safari, Chrome etc.
        }
    }

    private _configureContextmenu(e: MouseEvent) {
        if (!this.service || !this.service.application)
            return;

        const configureItems: WebComponent[] = e["vi:configure"];
        if (!this.service.application.hasManagement || !configureItems?.length || window.getSelection().toString()) {
            e.stopImmediatePropagation();
            return;
        }

        const popupMenu = <PopupMenu>this.shadowRoot.querySelector("#viConfigure");
        Array.from(popupMenu.children).forEach(item => popupMenu.removeChild(item));
        configureItems.forEach(item => popupMenu.appendChild(item));
    }

    protected _cleanUpOnSignOut(isSignedIn: boolean) {
        if (isSignedIn === false) {
            this.cacheClear();

            // TODO: check
            //this.appRoutePresenter.clear();

            super._cleanUpOnSignOut(isSignedIn);
        }
    }

    cache(entry: AppCacheEntry): AppCacheEntry {
        // Remove LRU from cache
        if (this._cache.length >= this.cacheSize)
            this._cache.splice(0, this._cache.length - this.cacheSize);

        let cacheEntry = this.cachePing(entry);
        if (!cacheEntry)
            this._cache.push(cacheEntry = entry);

        return cacheEntry;
    }

    cachePing(entry: AppCacheEntry): AppCacheEntry {
        const cacheEntry = this._cache.slice().reverse().find(e => entry.isMatch(e));
        if (cacheEntry) {
            this._cache.remove(cacheEntry);
            this._cache.push(cacheEntry);
        }

        return cacheEntry;
    }

    cacheRemove(key: AppCacheEntry) {
        const entry = this._cache.find(e => key.isMatch(e));
        if (entry)
            this._cache.remove(entry);
    }

    get cacheEntries(): AppCacheEntry[] {
        return this._cache;
    }

    cacheClear() {
        this._cache = [];
    }

    getUrlForPersistentObject(id: string, objectId: string, pu: Vidyano.ProgramUnit = this.programUnit) {
        const persistentObjects = this.service.application.routes.persistentObjects;
        for (const type in persistentObjects) {
            if (persistentObjects[type] === id)
                return (pu ? pu.nameKebab + "/" : "") + type + (objectId ? "/" + objectId : "");
        }

        return (pu ? pu.nameKebab + "/" : "") + `persistent-object.${id}${objectId ? "/" + objectId : ""}`;
    }

    getUrlForQuery(id: string, pu: Vidyano.ProgramUnit = this.programUnit) {
        const queries = this.service.application.routes.persistentObjects;
        for (const name in queries) {
            if (queries[name] === id)
                return (pu ? pu.nameKebab + "/" : "") + `${name}`;
        }

        return (pu ? pu.nameKebab + "/" : "") + `query.${id}`;
    }

    getUrlForFromAction(id: string, pu: Vidyano.ProgramUnit = this.programUnit) {
        return (pu ? pu.nameKebab + "/" : "") + `from-action/${id}`;
    }

    private async _importConfigs(configs: string, isConnected: boolean) {
        if (!configs || !isConnected)
            return;

        // TODO
        // const doc = <HTMLLinkElement>await this.importHref(configs);
        // Array.from(doc.body.childNodes).forEach(c => this.appendChild(c));
    }

    private _convertPath(application: Vidyano.Application, path: string): string {
        if (application) {
            let match = application.poRe.exec(path);
            if (match)
                path = (match[1] || "") + "persistent-object." + application.routes.persistentObjects[match[3].toKebabCase()] + (match[4] || "");
            else {
                match = application.queryRe.exec(path);
                if (match)
                    path = (match[1] || "") + "query." + application.routes.queries[match[3].toKebabCase()];
            }
        }

        return path;
    }
}