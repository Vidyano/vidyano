import * as Vidyano from "../../libs/vidyano/vidyano.js"
import * as Polymer from "../../libs/polymer/polymer.js"
import { App } from "../app/app.js"
import { WebComponent } from "../web-component/web-component.js"

@WebComponent.register({
    properties: {
        isSignedIn: {
            type: Boolean,
            reflectToAttribute: true,
            readOnly: true
        },
        userName: {
            type: String,
            readOnly: true
        },
        signInLabel: {
            type: String,
            computed: "_computeSignInLabel(isConnected, collapsed)"
        },
        hasSensitive: {
            type: Boolean,
            readOnly: true
        },
        hasFeedback: {
            type: Boolean,
            readOnly: true
        },
        hasUserSettings: {
            type: Boolean,
            readOnly: true
        },
        hasProfiler: {
            type: Boolean,
            readOnly: true
        },
        collapsed: {
            type: Boolean,
            reflectToAttribute: true,
            value: false
        },
        appSensitive: {
            type: Boolean,
            readOnly: true
        }
    },
    forwardObservers: [
        "_signedInChanged(service.isSignedIn)",
        "_signedInChanged(service.isUsingDefaultCredentials)"
    ],
    sensitive: true
})
export class User extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="user.html">`; }

    readonly service: Vidyano.Service; private _setService: (service: Vidyano.Service) => void;
    readonly isSignedIn: boolean; private _setIsSignedIn: (val: boolean) => void;
    readonly hasSensitive: boolean; private _setHasSensitive: (val: boolean) => void;
    readonly hasFeedback: boolean; private _setHasFeedback: (val: boolean) => void;
    readonly hasUserSettings: boolean; private _setHasUserSettings: (val: boolean) => void;
    readonly hasProfiler: boolean; private _setHasProfiler: (val: boolean) => void;
    readonly userName: string; private _setUserName: (val: string) => void;

    private _computeSignInLabel(isConnected: boolean, collapsed: boolean): string {
        if (!isConnected)
            return;

        return collapsed ? "": this.translateMessage("SignIn");
    }

    signIn() {
        this.app.redirectToSignIn();
    }

    signOut() {
        this.service.clearSiteData = true;
        this.app.redirectToSignOut(false);
    }

    async feedback() {
        const po = await this.service.getPersistentObject(null, this.service.application.feedbackId);
        const commentAttr = po.getAttribute("Comment");
        const commentOptions = ["Browser: " + navigator.userAgent, "Vidyano Client: " + Vidyano.version];
        const location = window.location.toString();
        if (!location.contains("FromAction/"))
            commentOptions.push("Url: " + location);
        commentAttr.options = commentOptions;
        commentAttr.isValueChanged = true;

        this.service.hooks.onOpen(po, false);
    }

    userSettings() {
        this.app.changePath(((<App>this.app).programUnit ? (<App>this.app).programUnit.name + "/" : "") + "PersistentObject." + this.service.application.userSettingsId + "/" + this.service.application.userId);
    }

    private _toggleSensitive() {
        this.app.sensitive = !this.app.sensitive;
    }

    private _showProfiler() {
        this.service.profile = true;
    }

    private _signedInChanged() {
        const isSignedIn = this.service.isSignedIn && !this.service.isUsingDefaultCredentials;

        this._setIsSignedIn(isSignedIn);
        this._setUserName(isSignedIn ? this.service.application.friendlyUserName : null);
        this._setHasSensitive(this.service.application && this.service.application.hasSensitive);
        this._setHasFeedback(isSignedIn && !!this.service.application.feedbackId && this.service.application.feedbackId !== "00000000-0000-0000-0000-000000000000");
        this._setHasUserSettings(isSignedIn && !!this.service.application.userSettingsId && this.service.application.userSettingsId !== "00000000-0000-0000-0000-000000000000");
        this._setHasProfiler(isSignedIn && this.service.application.canProfile);
    }
}