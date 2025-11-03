import { html, nothing, unsafeCSS } from "lit";
import { WebComponent } from "components/web-component/web-component";
import * as Vidyano from "vidyano";
import { App } from "components/app/app";
import styles from "./user.css";

export class User extends WebComponent {
    static styles = unsafeCSS(styles);

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

    #toggleSensitive() {
        this.app.sensitive = !this.app.sensitive;
    }

    #showProfiler() {
        this.service.profile = true;
    }

    #renderPrivacyButton() {
        if (!this.service.application?.hasSensitive)
            return nothing;

        return html`<vi-button icon="Invisible" ?inverse=${!this.app.sensitive} title=${this.translations.Privacy} @click=${this.#toggleSensitive}></vi-button>`;
    }

    #renderProfilerButton(isSignedIn: boolean) {
        if (!isSignedIn || !this.service.application.canProfile)
            return nothing;

        return html`<vi-button icon="Profiler" inverse title=${this.translations.Profiler} @click=${this.#showProfiler}></vi-button>`;
    }

    #renderFeedbackButton(isSignedIn: boolean) {
        if (!isSignedIn)
            return nothing;

        const feedbackId = this.service.application.feedbackId;
        if (!feedbackId || feedbackId === "00000000-0000-0000-0000-000000000000")
            return nothing;

        return html`<vi-button icon="UserFeedback" inverse title=${this.translations.Feedback} @click=${this.feedback}></vi-button>`;
    }

    #renderUserSettingsButton(isSignedIn: boolean) {
        if (!isSignedIn)
            return nothing;

        const userSettingsId = this.service.application.userSettingsId;
        if (!userSettingsId || userSettingsId === "00000000-0000-0000-0000-000000000000")
            return nothing;

        return html`<vi-button icon="Configure" inverse title=${this.translations.UserSettings} @click=${this.userSettings}></vi-button>`;
    }

    #renderSignOutButton(isSignedIn: boolean) {
        if (!isSignedIn || this.service.windowsAuthentication)
            return nothing;

        return html`<vi-button icon="SignOut" inverse title=${this.translations.SignOut} @click=${this.signOut}></vi-button>`;
    }

    #renderSignInButton(isSignedIn: boolean) {
        if (isSignedIn)
            return nothing;

        return html`<vi-button class="flex" id="signIn" icon="SignIn" .label=${this.translations.SignIn} inverse .title=${this.translations.SignIn} @click=${this.signIn}></vi-button>`;
    }

    render() {
        const isSignedIn = this.service.isSignedIn && !this.service.isUsingDefaultCredentials;
        const application = this.service.application;

        return html`
            ${isSignedIn ? html`<div class="username"><span>${application.friendlyUserName}</span></div>` : nothing}
            <div class="actions">
                ${this.#renderPrivacyButton()}
                ${this.#renderProfilerButton(isSignedIn)}
                ${this.#renderFeedbackButton(isSignedIn)}
                ${this.#renderUserSettingsButton(isSignedIn)}
                ${this.#renderSignOutButton(isSignedIn)}
                ${this.#renderSignInButton(isSignedIn)}
            </div>
        `;
    }
}

customElements.define("vi-user", User);
