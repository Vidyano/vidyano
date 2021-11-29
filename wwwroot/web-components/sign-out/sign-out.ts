import * as Polymer from '../../libs/@polymer/polymer.js'
import * as Vidyano from "../../libs/vidyano/vidyano.js"
import { AppRoute } from '../app-route/app-route.js'
import { WebComponent, WebComponentListener } from "../web-component/web-component.js"

@WebComponent.register({
    listeners: {
        "app-route-activate": "_activate"
    }
})
export class SignOut extends WebComponentListener(WebComponent) {
    static get template() { return Polymer.html`<link rel="import" href="sign-out.html">`; }

    private async _activate(e: CustomEvent) {
        e.preventDefault();

        const signInUsingDefaultCredentials = !this.service.isUsingDefaultCredentials && !!this.service.defaultUserName;
        await this.service.signOut();

        let path: string;
        if (!signInUsingDefaultCredentials)
            path = decodeURIComponent((<AppRoute>this.parentNode).parameters.returnUrl || "SignIn");
        else {
            await this.service.signInUsingDefaultCredentials();
            path = "";
        }

        this.app.changePath(path, true);
    }
}