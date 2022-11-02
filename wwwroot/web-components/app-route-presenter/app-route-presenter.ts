import * as Vidyano from "../../libs/vidyano/vidyano.js"
import * as Polymer from "../../libs/polymer/polymer.js"
import { Path } from "../../libs/pathjs/pathjs.js"
import { AppBase } from "../app/app-base.js"
import { AppRoute } from "../app-route/app-route.js"
import { AppServiceHooks } from "../app-service-hooks/app-service-hooks.js"
import { Dialog } from "../dialog/dialog.js"
import "../error/error.js"
import { WebComponent } from "../web-component/web-component.js"

@WebComponent.register({
    properties: {
        currentRoute: {
            type: Object,
            notify: true,
            readOnly: true
        },
        notFound: {
            type: Boolean,
            value: false,
            readOnly: true
        }
    }
})
export class AppRoutePresenter extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="app-route-presenter.html">`; }

    private _path: string;
    private _pathListener: Vidyano.ISubjectDisposer;
    private _routeMap: { [key: string]: AppRoute } = {};
    private _routeUpdater: Promise<any> = Promise.resolve();
    readonly currentRoute: AppRoute; private _setCurrentRoute: (route: AppRoute) => void;
    path: string;
    notFound: boolean;

    connectedCallback() {
        super.connectedCallback();

        this.fire("app-route-presenter:connected");
    }
    disconnectedCallback() {
        super.disconnectedCallback();

        if (this._pathListener) {
            this._pathListener();
            this._pathListener = null;
        }
    }

    private _routesChanged() {
        const slot = this.$.routes as HTMLSlotElement;
        const routes = Array.from(slot.assignedElements().filter(node => node instanceof AppRoute)) as AppRoute[];
        routes.forEach(appRoute => {
            this._addRoute(appRoute, appRoute.route);
            if (appRoute.routeAlt)
                this._addRoute(appRoute, appRoute.routeAlt);
        });

        if (this._pathListener)
            this._pathListener();

        this._pathListener = Vidyano.ServiceBus.subscribe("path-changed", (sender, message, details) => {
            if (sender === this)
                return;

            const oldPath = this._path;
            this._pathChanged(this._path = details.path, oldPath);
        }, true);
    }

    private _addRoute(appRoute: AppRoute, route: string) {
        route = AppBase.removeRootPath(route);
        if (this._routeMap[route])
            return;

        this._routeMap[route] = appRoute;
        Path.map(Path.routes.rootPath + route).to(() => {
            Vidyano.ServiceBus.send(this, "path-changed", { path: AppBase.removeRootPath(Path.routes.current) });
        });
    }

    private async _pathChanged(path: string, oldPath: string) {
        await this.app.initialize;

        this._routeUpdater = this._routeUpdater.then(async () => {
            const initial: Vidyano.PersistentObject = this.service["_initial"];
            if (initial != null)
                await (<AppServiceHooks>this.service.hooks).onInitial(initial);

            if (path !== this._path)
                return;

            const mappedPathRoute = path != null ? Path.match(Path.routes.rootPath + path, true) : null;
            const newRoute = mappedPathRoute ? this._routeMap[AppBase.removeRootPath(mappedPathRoute.path)] : null;

            if (!this.service.isSignedIn && (!newRoute || !newRoute.allowSignedOut)) {
                this.app.redirectToSignIn();
                return;
            }

            if (this.currentRoute) {
                if (this.currentRoute === newRoute && this.currentRoute.matchesParameters(mappedPathRoute.params))
                    return;

                if (!await this.currentRoute.deactivate(newRoute))
                    return;
            }

            Array.from(this.shadowRoot.querySelectorAll("[dialog]")).forEach((dialog: Dialog) => dialog.close());

            const redirect = await (<AppServiceHooks>this.app.service.hooks).onAppRouteChanging(newRoute, this.currentRoute);
            if (redirect) {
                this._setCurrentRoute(null);
                Polymer.Async.microTask.run(() => this.app.changePath(redirect));

                return;
            }

            if (!!newRoute)
                await newRoute.activate(mappedPathRoute.params);

            this._setCurrentRoute(newRoute);
            this.notFound = !!path && !this.currentRoute;
        });
    }
}