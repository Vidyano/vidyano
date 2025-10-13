import * as Polymer from "polymer"
import * as Vidyano from "vidyano";
import { AppServiceHooks } from "components/app-service-hooks/app-service-hooks"
import { WebComponent } from "components/web-component/web-component"

export interface IAppRouteActivatedArgs {
    route: AppRoute;
    parameters: { [key: string]: string };
}

export interface IAppRouteDeactivateArgs {
    route: AppRoute;
    cancel: boolean;
}

@WebComponent.register({
    properties: {
        route: {
            type: String,
            reflectToAttribute: true
        },
        routeAlt: {
            type: String,
            reflectToAttribute: true
        },
        active: {
            type: Boolean,
            readOnly: true,
            observer: "_activeChanged"
        },
        path: {
            type: String,
            readOnly: true
        },
        allowSignedOut: Boolean,
        preserveContent: {
            type: Boolean,
            reflectToAttribute: true
        }
    },
    listeners: {
        "title-changed": "_titleChanged"
    }
}, "vi-app-route")
export class AppRoute extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="app-route.html">`; }

    private _hasChildren: boolean;
    private _parameters: { [key: string]: string } = {};
    private _documentTitle: string;
    readonly active: boolean; private _setActive: (val: boolean) => void;
    readonly path: string; private _setPath: (val: string) => void;
    allowSignedOut: boolean;
    deactivator: (result: boolean) => void;
    preserveContent: boolean;
    routeAlt: string;

    constructor(public route: string) {
        super();
    }

    matchesParameters(parameters: { [key: string]: string } = {}): boolean {
        return this._parameters && JSON.stringify(this._parameters) === JSON.stringify(parameters);
    }

    async activate(parameters: { [key: string]: string } = {}): Promise<any> {
        if (this.active && this.matchesParameters(parameters))
            return;

        this._parameters = parameters;

        if (this.preserveContent && this._hasChildren)
            this.shadowRoot.querySelector("slot").assignedElements().forEach(this._fireActivate.bind(this));
        else {
            this._clearChildren();

            const template = this.querySelector("template");
            if (!template) {
                console.error(`Missing template on route "${this.path}"`);
                return;
            }

            template.setAttribute("slot", "none");

            const templateClass = Polymer.Templatize.templatize(template);
            const templateInstance = new templateClass({ app: this.app });
            this.appendChild(templateInstance.root);
            this.shadowRoot.querySelector("slot").assignedElements().forEach(this._fireActivate.bind(this));

            this._hasChildren = true;
        }

        this._setActive(true);
        this._setPath(this.app.path);

        if (this._documentTitle)
            document.title = this._documentTitle;

        (<AppServiceHooks>this.service.hooks).trackPageView(this.app.path);
    }

    private _fireActivate(target: WebComponent) {
        target.dispatchEvent(new CustomEvent("app-route-activate", {
            detail: { route: this, parameters: this._parameters },
            bubbles: true,
            composed: true
        }));
    }

    private _clearChildren() {
        if (!this._hasChildren)
            return;

        this.shadowRoot.querySelector("slot").assignedElements().forEach(c => this.removeChild(c));
        this._hasChildren = false;
    }

    deactivate(nextRoute?: AppRoute): Promise<boolean> {
        const component = <WebComponent>this.shadowRoot.querySelector("slot").assignedElements()[0];

        return new Promise<boolean>(resolve => {
            const deactivate: IAppRouteDeactivateArgs = { route: this, cancel: false };
            Vidyano.ServiceBus.send(this, "app-route:deactivate", deactivate);

            if (deactivate.cancel)
                resolve(false);

            this.deactivator = resolve;

            let defaultPrevented = false;
            if (component) {
                const event = new CustomEvent("app-route-deactivate", {
                    detail: null,
                    bubbles: false,
                    cancelable: true,
                    composed: true
                });
                component.dispatchEvent(event);
                defaultPrevented = event.defaultPrevented;
            }

            if (!component || !defaultPrevented)
                resolve(true);
        }).then(result => {
            if (result && (!this.preserveContent || nextRoute !== this))
                this._setActive(false);

            return result;
        });
    }

    get parameters(): any {
        return this._parameters;
    }

    private _activeChanged() {
        this.classList.toggle("active", this.active);

        if (this.activate)
            this.dispatchEvent(new CustomEvent("app-route-activated", { detail: { route: this, parameters: this._parameters }, bubbles: true, composed: true }));
        else
            this.dispatchEvent(new CustomEvent("app-route-deactivated", { detail: { route: this }, bubbles: true, composed: true }));
    }

    private _titleChanged(e: CustomEvent) {
        const { title }: { title: string; } = e.detail;
        this._documentTitle = title;

        if (!this.active || e.defaultPrevented || (e.target as HTMLElement).parentNode !== this)
            return;

        document.title = this._documentTitle;
        e.stopPropagation();
    }
}