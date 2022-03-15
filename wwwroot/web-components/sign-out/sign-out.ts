import * as Polymer from "../../libs/polymer/polymer"
import * as Vidyano from "../../libs/vidyano/vidyano"
import { AppRoute } from '../app-route/app-route.js'
import { WebComponent } from "../web-component/web-component"

@WebComponent.register({
    listeners: {
        "app-route-activate": "_activate"
    }
})
export class SignOut extends WebComponent {
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