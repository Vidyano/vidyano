import * as Vidyano from "../../libs/vidyano/vidyano"
import * as Polymer from "../../libs/polymer/polymer"
import { App } from "../app/app"
import { WebComponent } from "../web-component/web-component"
import { Icon } from "../icon/icon";

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
        Vidyano.cookie("userName", null);
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

        this.service.hooks.onOpen(po, false, true);
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

Icon.Add `
<vi-icon name="Profiler">
    <svg viewBox="0 0 32 32">
        <g>
            <path d="M 11.320312 0 L 11.320312 2.5957031 L 12.96875 3.2636719 L 14.669922 3.2636719 L 14.669922 4.21875 C 11.517402 4.611414 8.6883391 6.0558025 6.5488281 8.1953125 L 8.4902344 10.138672 C 10.518005 8.1101999 13.317629 6.8554688 16.404297 6.8554688 C 22.580085 6.8554688 27.603516 11.877997 27.603516 18.052734 C 27.603516 24.227822 22.580085 29.251953 16.404297 29.251953 C 10.966199 29.251953 6.4223706 25.354195 5.4160156 20.205078 L 7.5839844 20.205078 L 3.9785156 13.960938 L 0.375 20.205078 L 2.625 20.205078 C 3.6625296 26.877913 9.4466838 32 16.404297 32 C 24.095397 32 30.351563 25.743133 30.351562 18.052734 C 30.351913 10.950105 25.012919 5.0739319 18.138672 4.2167969 L 18.138672 3.2636719 L 19.839844 3.2636719 L 21.488281 2.5957031 L 21.488281 0 L 11.320312 0 z M 26.701172 2.7753906 L 24.931641 4.5449219 L 25.273438 5.7988281 L 28.601562 9.125 L 29.855469 9.46875 L 31.625 7.6992188 L 26.701172 2.7753906 z M 16.404297 9.1757812 L 16.404297 18.025391 L 25.001953 18.025391 C 25.001953 13.137232 21.153745 9.1757813 16.404297 9.1757812 z " />
        </g>
    </svg>
</vi-icon>
`;