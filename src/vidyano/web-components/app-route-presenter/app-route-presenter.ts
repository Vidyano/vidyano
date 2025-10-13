import * as Vidyano from "vidyano"
import * as Polymer from "polymer"
import { Path } from "libs/pathjs/pathjs"
import { AppRoute } from "components/app-route/app-route"
import { AppServiceHooks } from "components/app-service-hooks/app-service-hooks"
import { Dialog } from "components/dialog/dialog"
import "components/error/error"
import { WebComponent } from "components/web-component/web-component"

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
}, "vi-app-route-presenter")
export class AppRoutePresenter extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="app-route-presenter.html">`; }

    private _routesObserver: Polymer.FlattenedNodesObserver;
    private _path: string;
    private _pathListener: Vidyano.ISubjectDisposer;
    private _routeMap: { [key: string]: AppRoute } = {};
    private _routeUpdater: Promise<any> = Promise.resolve();
    readonly currentRoute: AppRoute; private _setCurrentRoute: (route: AppRoute) => void;
    path: string;
    notFound: boolean;

    connectedCallback() {
        super.connectedCallback();

        Polymer.Async.microTask.run(() => this.dispatchEvent(new CustomEvent("app-route-presenter:connected", { detail: { presenter: this }, bubbles: true, composed: true })));

        // FlattenedNodesObserver also flattens slots that have other slots assigned to them.
        // We need this to make sure additional routes defined in the app are also added.
        this._routesObserver = new Polymer.FlattenedNodesObserver(this.$.routes, this._routesChanged.bind(this));
    }
    disconnectedCallback() {
        super.disconnectedCallback();

        this._routesObserver.disconnect();

        if (this._pathListener) {
            this._pathListener();
            this._pathListener = null;
        }
    }

    private _routesChanged(info: Polymer.FlattenedNodesObserverInfo) {
        info.addedNodes.filter(node => node instanceof AppRoute).forEach((appRoute: AppRoute) => {
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
        route = Path.removeRootPath(route);
        if (this._routeMap[route])
            return;

        this._routeMap[route] = appRoute;
        Path.map(Path.routes.rootPath + route).to(() => {
            Vidyano.ServiceBus.send(this, "path-changed", { path: Path.removeRootPath(Path.routes.current) });
        });
    }

    private async _pathChanged(path: string, oldPath: string) {
        await this.app.initialize;

        this._routeUpdater = this._routeUpdater.then(async () => {
            const initial: Vidyano.PersistentObject = this.service.initial;
            if (initial != null)
                await (<AppServiceHooks>this.service.hooks).onInitial(initial);

            if (path !== this._path)
                return;

            const mappedPathRoute = path != null ? Path.match(Path.routes.rootPath + path, true) : null;
            const newRoute = mappedPathRoute ? this._routeMap[Path.removeRootPath(mappedPathRoute.path)] : null;

            if (!this.service.isSignedIn && !newRoute?.allowSignedOut) {
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