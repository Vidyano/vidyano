import { html, nothing, unsafeCSS } from "lit";
import { property, state } from "lit/decorators.js";
import { computed, observer, WebComponent } from "components/web-component/web-component";
import * as Vidyano from "vidyano";
import { App } from "components/app/app";
import styles from "./user.css";

export class User extends WebComponent {
    static styles = unsafeCSS(styles);

    @state()
    isSignedIn: boolean = false;

    @state()
    userName: string = null;

    @state()
    hasSensitive: boolean = false;

    @state()
    hasFeedback: boolean = false;

    @state()
    hasUserSettings: boolean = false;

    @state()
    hasProfiler: boolean = false;

    @property({ type: Boolean, reflect: true })
    collapsed: boolean = false;

    @state()
    appSensitive: boolean = false;

    @property({ type: String })
    @computed(function(this: User, isConnected: boolean, collapsed: boolean): string {
        if (!isConnected)
            return;

        return collapsed ? "" : this.translations.SignIn;
    }, "isConnected", "collapsed")
    declare readonly signInLabel: string;

    @observer("service.isSignedIn", "service.isUsingDefaultCredentials")
    private _signedInChanged() {
        const isSignedIn = this.service.isSignedIn && !this.service.isUsingDefaultCredentials;

        this.isSignedIn = isSignedIn;
        this.userName = isSignedIn ? this.service.application.friendlyUserName : null;
        this.hasSensitive = this.service.application && this.service.application.hasSensitive;
        this.hasFeedback = isSignedIn && !!this.service.application.feedbackId && this.service.application.feedbackId !== "00000000-0000-0000-0000-000000000000";
        this.hasUserSettings = isSignedIn && !!this.service.application.userSettingsId && this.service.application.userSettingsId !== "00000000-0000-0000-0000-000000000000";
        this.hasProfiler = isSignedIn && this.service.application.canProfile;
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

    render() {
        return html`
            ${this.isSignedIn ? html`<div class="username"><span>${this.userName}</span></div>` : nothing}
            <div class="actions">
                ${this.hasSensitive ? html`<vi-button icon="Invisible" ?inverse=${!this.appSensitive} title=${this.translations.Privacy} @click=${this._toggleSensitive}></vi-button>` : nothing}
                ${this.isSignedIn ? html`
                    ${this.hasProfiler ? html`<vi-button icon="Profiler" inverse title=${this.translations.Profiler} @click=${this._showProfiler}></vi-button>` : nothing}
                    ${this.hasFeedback ? html`<vi-button icon="UserFeedback" inverse title=${this.translations.Feedback} @click=${this.feedback}></vi-button>` : nothing}
                    ${this.hasUserSettings ? html`<vi-button icon="Configure" inverse title=${this.translations.UserSettings} @click=${this.userSettings}></vi-button>` : nothing}
                    ${!this.service.windowsAuthentication ? html`<vi-button icon="SignOut" inverse title=${this.translations.SignOut} @click=${this.signOut}></vi-button>` : nothing}
                ` : html`<vi-button class="flex" id="signIn" icon="SignIn" .label=${this.signInLabel} inverse .title=${this.signInLabel} @click=${this.signIn}></vi-button>`}
            </div>

            <vi-icon name="Profiler">
                <svg viewBox="0 0 32 32">
                    <g>
                        <path d="M 11.320312 0 L 11.320312 2.5957031 L 12.96875 3.2636719 L 14.669922 3.2636719 L 14.669922 4.21875 C 11.517402 4.611414 8.6883391 6.0558025 6.5488281 8.1953125 L 8.4902344 10.138672 C 10.518005 8.1101999 13.317629 6.8554688 16.404297 6.8554688 C 22.580085 6.8554688 27.603516 11.877997 27.603516 18.052734 C 27.603516 24.227822 22.580085 29.251953 16.404297 29.251953 C 10.966199 29.251953 6.4223706 25.354195 5.4160156 20.205078 L 7.5839844 20.205078 L 3.9785156 13.960938 L 0.375 20.205078 L 2.625 20.205078 C 3.6625296 26.877913 9.4466838 32 16.404297 32 C 24.095397 32 30.351563 25.743133 30.351562 18.052734 C 30.351913 10.950105 25.012919 5.0739319 18.138672 4.2167969 L 18.138672 3.2636719 L 19.839844 3.2636719 L 21.488281 2.5957031 L 21.488281 0 L 11.320312 0 z M 26.701172 2.7753906 L 24.931641 4.5449219 L 25.273438 5.7988281 L 28.601562 9.125 L 29.855469 9.46875 L 31.625 7.6992188 L 26.701172 2.7753906 z M 16.404297 9.1757812 L 16.404297 18.025391 L 25.001953 18.025391 C 25.001953 13.137232 21.153745 9.1757813 16.404297 9.1757812 z " />
                    </g>
                </svg>
            </vi-icon>
        `;
    }
}

customElements.define("vi-user", User);
