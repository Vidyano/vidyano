import * as Polymer from "../../libs/@polymer/polymer.js"
import * as Vidyano from "../../libs/vidyano/vidyano.js"
import { Path } from "../../libs/pathjs/pathjs.js"
import { AppColor } from "../app-color/app-color.js"
import "../app/config/app-config.js"
import type { AppConfig } from "../app/config/app-config.js"
import { AppRoute } from "../app-route/app-route.js"
import { Alert } from "../alert/alert.js"
import "../alert/alert.js"
import "../app-route-presenter/app-route-presenter.js"
import type { AppRoutePresenter } from "../app-route-presenter/app-route-presenter.js"
import { AppServiceHooksBase } from "../app-service-hooks/app-service-hooks-base.js"
import { Dialog } from "../dialog/dialog.js"
import { MessageDialog, IMessageDialogOptions } from "../message-dialog/message-dialog.js"
import { Keyboard, WebComponent, WebComponentListener } from "../web-component/web-component.js"
import "./style-modules/flex-layout.js"
import "./style-modules/reset-css.js"
import "./style-modules/responsive.js"
import "@polymer/paper-ripple"

declare global {
    interface Window {
        app: AppBase;
    }
}

const hashBangRe = /(.+)#!\/(.*)/;
if (hashBangRe.test(document.location.href)) {
    const hashBangParts = hashBangRe.exec(document.location.href);
    if (hashBangParts[2].startsWith("SignInWithToken/")) {
        history.replaceState(null, null, hashBangParts[1]);
        Vidyano.Service.token = hashBangParts[2].substr(16);
    }
    else if (hashBangParts[2].startsWith("SignInWithAuthorizationHeader/")) {
        history.replaceState(null, null, hashBangParts[1]);
        Vidyano.Service.token = `JWT:${hashBangParts[2].substr(30)}`;
    }
    else
        history.replaceState(null, null, `${hashBangParts[1]}${hashBangParts[2]}`);
}

@WebComponent.register({
    properties: {
        uri: {
            type: String,
            reflectToAttribute: true,
            value: ""
        },
        hooks: {
            type: String,
            reflectToAttribute: true,
            value: null
        },
        base: {
            type: String,
            readOnly: true,
            value: () => {
                return (document.head.querySelector("base") as HTMLBaseElement).href;
            }
        },
        path: {
            type: String,
            reflectToAttribute: true,
            observer: "_pathChanged",
            value: () => {
                const base = document.head.querySelector("base") as HTMLBaseElement;
                const parser = document.createElement("a");
                parser.href = base.href;

                Path.routes.rootPath = parser.pathname;
                Path.root(base.href);
                Path.history.listen();

                return document.location.toString().substr(base.href.length).replace(document.location.hash, "");
            }
        },
        service: {
            type: Object,
            computed: "_computeInitialService(uri, hooks, isConnected)"
        },
        appRoutePresenter: {
            type: Object,
            readOnly: true
        },
        user: {
            type: String,
            reflectToAttribute: true,
            value: null
        },
        keys: {
            type: String,
            readOnly: true
        },
        initializing: {
            type: Boolean,
            readOnly: true,
            reflectToAttribute: true,
            value: true
        },
        isDesktop: {
            type: Boolean,
            reflectToAttribute: true
        },
        isTablet: {
            type: Boolean,
            reflectToAttribute: true
        },
        isPhone: {
            type: Boolean,
            reflectToAttribute: true
        },
        isTracking: {
            type: Boolean,
            reflectToAttribute: true
        },
        cookiePrefix: {
            type: String,
            reflectToAttribute: true,
            observer: "_cookiePrefixChanged"
        },
        themeColor: {
            type: String,
            reflectToAttribute: true,
            value: "#4682B4"
        },
        themeAccentColor: {
            type: String,
            reflectToAttribute: true,
            value: "#009688"
        },
        configs: String,
        updateAvailable: {
            type: Boolean,
            readOnly: true,
            value: false
        },
        sensitive: {
            type: Boolean,
            reflectToAttribute: true,
            observer: "_sensitiveChanged"
        },
        sessionLost: {
            type: Boolean,
            reflectToAttribute: true,
            readOnly: true,
            value: false
        }
    },
    observers: [
        "_cleanUpOnSignOut(service.isSignedIn)",
        "_computeThemeColorVariants(themeColor, 'color', isConnected)",
        "_computeThemeColorVariants(themeAccentColor, 'accent-color', isConnected)",
        "_mediaQueryChanged(isDesktop, isTablet, isPhone)"
    ],
    hostAttributes: {
        "tabindex": "-1"
    },
    listeners: {
        "app-route-presenter-connected": "_appRoutePresenterConnected",
        "click": "_anchorClickHandler",
        "app-update-available": "_updateAvailable"
    },
    forwardObservers: [
        "service.isSignedIn",
        "service.application"
    ]
})
export abstract class AppBase extends WebComponentListener(WebComponent) {
    static get template() { return Polymer.html`<link rel="import" href="app-base.html">`; }

    private _keybindingRegistrations: { [key: string]: Keyboard.IKeybindingRegistration[]; } = {};
    private _activeDialogs: Dialog[] = [];
    private _updateAvailableSnoozeTimer: number;
    private _initializeResolve: (app: Vidyano.Application) => void;
    private _initialize: Promise<Vidyano.Application> = new Promise(resolve => { this._initializeResolve = resolve; });
    private _setInitializing: (initializing: boolean) => void;
    readonly service: Vidyano.Service;
    readonly appRoutePresenter: AppRoutePresenter; private _setAppRoutePresenter: (appRoutePresenter: AppRoutePresenter) => void;
    readonly keys: string; private _setKeys: (keys: string) => void;
    readonly updateAvailable: boolean; private _setUpdateAvailable: (updateAvailable: boolean) => void;
    readonly sessionLost: boolean; private _setSessionLost: (sessionLost: boolean) => void;
    readonly base: string;
    uri: string;
    hooks: string;
    isTracking: boolean;
    sensitive: boolean;
    path: string;

    constructor() {
        super();

        window.app = this;
        window.dispatchEvent(new CustomEvent("app-changed", { detail: { value: this }}));
    }

    async connectedCallback() {
        window.addEventListener("storage", this._onSessionStorage.bind(this), false);

        Vidyano.ServiceBus.subscribe("path-changed", (sender, message, details) => {
            if (sender === this)
                return;

            this.path = details.path;
        }, true);

        this._initPathRescue();

        super.connectedCallback();
    }

    get initialize(): Promise<any> {
        return this._initialize;
    }

    protected _initPathRescue() {
        Path.rescue(() => {
            this.path = AppBase.removeRootPath(Path.routes.current);
        });
    }

    private _appRoutePresenterConnected(e: CustomEvent) {
        const appRoutePresenter = <AppRoutePresenter>e.composedPath()[0];
        this._setAppRoutePresenter(appRoutePresenter);
    }

    protected _createServiceHooks(): Vidyano.ServiceHooks {
        return new AppServiceHooksBase(this);
    }

    private _computeInitialService(uri: string, hooks: string, isAttached: boolean): Vidyano.Service {
        if (this.service) {
            console.warn("Service uri and hooks cannot be altered.");
            return this.service;
        }

        let hooksInstance: Vidyano.ServiceHooks;
        if (hooks) {
            const ctor = this.hooks.split(".").reduce((obj: any, path: string) => obj && obj[path], window);
            if (ctor)
                hooksInstance = new ctor(this);
            else
                console.error(`Service hooks "${this.hooks}" was not found.`);
        }
        else
            hooksInstance = this._createServiceHooks();

        const service = new Vidyano.Service(this.uri, hooksInstance);
        const path = AppBase.removeRootPath(document.location.pathname);
        const skipDefaultCredentialLogin = path.startsWith("sign-in");

        this._setInitializing(true);
        service.initialize(skipDefaultCredentialLogin).then(async () => {
            if (this.service !== service)
                return;

            if (hooksInstance instanceof AppServiceHooksBase)
                await hooksInstance.onBeforeAppInitialized();

            this._initializeResolve(this.service.application);
            this._setInitializing(false);
        }, async e => {
            if (hooksInstance instanceof AppServiceHooksBase)
                await hooksInstance.onAppInitializeFailed(e);
        });

        return service;
    }

    private _onSessionStorage(event: StorageEvent) {
        if (!event)
            event = <StorageEvent>window.event;

        if (event.newValue == null || (!event.newValue.startsWith("{") && Vidyano.cookiePrefix() !== event.newValue))
            return;
        else if (event.newValue.startsWith("{")) {
            const value = JSON.parse(event.newValue);
            if (Vidyano.cookiePrefix() !== value.cookiePrefix)
                return;
        }

        if (event.key === "vi-signOut" && this.service && this.service.isSignedIn)
            this._setSessionLost(true);
        else if (this.sessionLost && event.key === "vi-setAuthToken") {
            const authTokenInfo = JSON.parse(event.newValue);

            this.service.authToken = authTokenInfo.authToken;
            this._setSessionLost(false);
        }
        else if (event.key === "vi-updateAvailable") {
            if (this.service != null)
                this.service.hooks.onUpdateAvailable();
            else
                this._updateAvailable();
        }
    }

    private _reload(e: Polymer.Gestures.TapEvent) {
        e.stopPropagation();

        document.location.reload();
    }

    get configuration(): AppConfig {
        return this.shadowRoot.querySelector("vi-app-config") as AppConfig;
    }

    changePath(path: string, replaceCurrent: boolean = false) {
        while (path[0] === "/")
            path = path.slice(1);

        if (this.path === path)
            return;

        if (!replaceCurrent)
            Path.history.pushState(null, null, Path.routes.rootPath + path);
        else
            Path.history.replaceState(null, null, Path.routes.rootPath + path);
    }

    protected async _pathChanged(path: string) {
        await this.initialize;

        if (path !== this.path)
            return;

        Vidyano.ServiceBus.send(this, "path-changed", { path: path });
    }

    async showDialog(dialog: Dialog): Promise<any> {
        this.shadowRoot.appendChild(dialog);
        this._activeDialogs.push(dialog);

        try {
            return await dialog.open();
        }
        finally {
            this.shadowRoot.removeChild(dialog);
            this._activeDialogs.pop();
        }
    }

    async showMessageDialog(options: IMessageDialogOptions): Promise<any> {
        return this.showDialog(new MessageDialog(options));
    }

    showAlert(notification: string, type: Vidyano.NotificationType = "Notice", duration: number = 3000) {
        (this.$.alert as Alert).log(notification, type, duration);
    }

    redirectToSignIn(keepUrl: boolean = true) {
        (<AppServiceHooksBase>this.service.hooks).onRedirectToSignIn(keepUrl);
    }

    redirectToSignOut(keepUrl: boolean = true) {
        (<AppServiceHooksBase>this.service.hooks).onRedirectToSignOut(keepUrl);
    }

    private _sensitiveChanged(sensitive: boolean) {
        const currentSensitiveCookie = !!Boolean.parse(Vidyano.cookie("sensitive"));
        if (currentSensitiveCookie !== sensitive)
            Vidyano.cookie("sensitive", String(sensitive));

        this.fire("sensitive-changed", sensitive, { bubbles: false });
    }

    private _cookiePrefixChanged(cookiePrefix: string) {
        Vidyano.cookiePrefix(cookiePrefix);
    }

    private _anchorClickHandler(e: MouseEvent) {
        if (e.defaultPrevented)
            return;

        const path = e.composedPath();
        const anchorParent = <HTMLAnchorElement>path.find((el: HTMLElement) => el.tagName === "A");
        if (anchorParent && anchorParent.href.startsWith(Path.routes.root || "") && !anchorParent.hasAttribute("download") && !(anchorParent.getAttribute("rel") || "").contains("external")) {
            e.stopPropagation();
            e.preventDefault();

            let path = anchorParent.href.slice(Path.routes.root.length);
            if (path.startsWith("#!/"))
                path = path.substr(3);

            this.changePath(path);
        }
    }

    private _updateAvailable() {
        if (this._updateAvailableSnoozeTimer)
            return;

        this._setUpdateAvailable(true);

        Polymer.flush();
        // TODO
        // this.async(() => this.shadowRoot.querySelector("#update").classList.add("show"), 100);
    }

    private _refreshForUpdate() {
        document.location.reload();
    }

    private _refreshForUpdateDismiss() {
        if (this._updateAvailableSnoozeTimer)
            clearTimeout(this._updateAvailableSnoozeTimer);

        this._updateAvailableSnoozeTimer = setTimeout(() => {
            this._updateAvailableSnoozeTimer = null;
            this._updateAvailable();
        }, 300000);

        this.shadowRoot.querySelector("#update").classList.remove("show");
        // TODO
        // this.async(() => this._setUpdateAvailable(false), 500);
    }

    private _computeThemeColorVariants(base: string, target: string, isConnected: boolean) {
        if (!isConnected || !base)
            return;

        if (!base.startsWith("#"))
            base = `#${base}`;

        const appColor = new AppColor(base);

        this.style.setProperty(`--theme-${target}`, base);
        this.style.setProperty(`--theme-${target}-light`, appColor.light);
        this.style.setProperty(`--theme-${target}-lighter`, appColor.lighter);
        this.style.setProperty(`--theme-${target}-dark`, appColor.dark);
        this.style.setProperty(`--theme-${target}-darker`, appColor.darker);
        this.style.setProperty(`--theme-${target}-faint`, appColor.faint);
        this.style.setProperty(`--theme-${target}-semi-faint`, appColor.semiFaint);
        this.style.setProperty(`--theme-${target}-rgb`, appColor.rgb);
    }

    protected _cleanUpOnSignOut(isSignedIn: boolean) {
        if (isSignedIn === false) {
            // Trigger sign out across tabs for the same base uri
            localStorage.setItem("vi-signOut", Vidyano.cookiePrefix());
            localStorage.removeItem("vi-signOut");
        }
    }

    private _registerKeybindings(registration: Keyboard.IKeybindingRegistration) {
        const currentKeys = this.keys ? this.keys.split(" ") : [];
        registration.keys.forEach(key => {
            registration.scope = <any>this.findParent(e => e instanceof AppRoute || e instanceof Dialog, registration.element);

            const registrations = this._keybindingRegistrations[key] || (this._keybindingRegistrations[key] = []);
            registrations.push(registration);

            currentKeys.push(key);
        });

        this._setKeys(currentKeys.distinct().join(" "));
    }

    private _unregisterKeybindings(registration: Keyboard.IKeybindingRegistration) {
        const currentKeys = this.keys.split(" ");

        registration.keys.forEach(key => {
            const registrations = this._keybindingRegistrations[key];
            registrations.remove(registration);

            if (registrations.length === 0) {
                this._keybindingRegistrations[key] = undefined;
                currentKeys.remove(key);
            }
        });

        this._setKeys(currentKeys.distinct().join(" "));
    }

    private _mediaQueryChanged(isDesktop: boolean, isTablet: boolean, isPhone: boolean) {
        this.fire("media-query-changed", isDesktop ? "desktop" : (isTablet ? "tablet" : "phone"), { bubbles: false });
    }

    private _keysPressed(e: Keyboard.IKeysEvent) {
        if (!this._keybindingRegistrations[e.detail.combo])
            return;

        if (document.activeElement instanceof HTMLInputElement && !(e.detail.keyboardEvent.ctrlKey || e.detail.keyboardEvent.shiftKey || e.detail.keyboardEvent.altKey) && e.detail.key !== "esc")
            return;

        let combo = e.detail.combo;
        if (e.detail.keyboardEvent.ctrlKey && combo.indexOf("ctrl") < 0)
            combo = "ctrl+" + combo;
        if (e.detail.keyboardEvent.shiftKey && combo.indexOf("shift") < 0)
            combo = "shift+" + combo;
        if (e.detail.keyboardEvent.altKey && combo.indexOf("alt") < 0)
            combo = "alt+" + combo;

        let registrations = this._keybindingRegistrations[combo];
        if (!registrations)
            return;

        if (this._activeDialogs.length > 0) {
            const activeDialog = this._activeDialogs[this._activeDialogs.length - 1];
            registrations = registrations.filter(r => r.scope === activeDialog);
        }

        registrations = registrations.filter(reg => !reg.scope || (reg.scope instanceof AppRoute && (<AppRoute>reg.scope).active));
        const highestPriorityRegs = registrations.groupBy(r => r.priority).orderByDescending(kvp => kvp.key)[0];
        if (!highestPriorityRegs || !highestPriorityRegs.value.length)
            return;

        const regs = highestPriorityRegs;
        if (regs.value.length > 1 && regs.value.some(r => !r.nonExclusive))
            return;

        regs.value.forEach(reg => {
            reg.listener(e);
        });
    }

    static removeRootPath(path: string = ""): string {
        if (path.startsWith(Path.routes.rootPath))
            return path.substr(Path.routes.rootPath.length);

        return path;
    }
}