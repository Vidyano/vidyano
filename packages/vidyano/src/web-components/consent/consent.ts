import { html, nothing, unsafeCSS } from "lit";
import { state } from "lit/decorators.js";
import { WebComponent, listener } from "components/web-component/web-component";
import styles from "./consent.css";

/**
 * The pending OAuth authorization as `connect/consent/{requestId}` describes it to a caller that accepts JSON.
 */
export interface ConsentRequest {
    requestId: string;
    clientId: string;
    clientName: string;
    redirectUri: string;
    redirectHost: string;
    isLoopback: boolean;
    resource: string;
    scopes: { name: string; description: string; }[];
}

type Phase = "loading" | "ready" | "deciding" | "done" | "error";

const translations = {
    ConsentTitle: { en: "Authorize {0}", nl: "{0} toegang geven" },
    ConsentIntro: { en: "{0} wants to access this application on your behalf and will return to {1}.", nl: "{0} wil namens u toegang tot deze toepassing en keert daarna terug naar {1}." },
    ConsentLocalhostWarning: { en: "The application runs on this computer. Only continue if you started this yourself.", nl: "De toepassing draait op deze computer. Ga alleen verder als u dit zelf hebt gestart." },
    ConsentSignedInAs: { en: "Signed in as {0}.", nl: "Aangemeld als {0}." },
    ConsentPermissions: { en: "The application asks permission to:", nl: "De toepassing vraagt toestemming om:" },
    ConsentAllow: { en: "Allow", nl: "Toestaan" },
    ConsentDeny: { en: "Deny", nl: "Weigeren" },
    ConsentReturning: { en: "Returning to the application…", nl: "Terug naar de toepassing…" },
    ConsentExpired: { en: "This authorization request has expired. Start again from the application.", nl: "Deze aanvraag is verlopen. Begin opnieuw vanuit de toepassing." },
    ConsentFailed: { en: "The request could not be completed.", nl: "De aanvraag kon niet worden voltooid." },
};

/**
 * OAuth consent screen for the authorization server built into Vidyano.Service, which redirects here when
 * `AuthorizationServer:UseWebsiteConsentPage` is on.
 */
export class Consent extends WebComponent<typeof translations> {
    static styles = unsafeCSS(styles);

    @state() private phase: Phase = "loading";
    @state() private request: ConsentRequest | null = null;
    @state() private error: string | null = null;

    constructor() {
        super({ translations });
    }

    @listener("app-route-activate")
    private async _activate(e: CustomEvent) {
        const { requestId } = (e.detail.parameters || {}) as { requestId?: string };

        this.phase = "loading";
        this.request = null;
        this.error = null;

        if (!requestId) {
            this.#fail(this.translations.ConsentExpired);
            return;
        }

        try {
            const response = await this.#send("GET", requestId);
            const body = await response.json();
            if (!response.ok) {
                this.#fail(body?.error === "expired" ? this.translations.ConsentExpired : body?.error_description || this.translations.ConsentFailed);
                return;
            }

            this.request = body as ConsentRequest;
            this.phase = "ready";
        }
        catch {
            this.#fail(this.translations.ConsentFailed);
        }
    }

    render() {
        return html`<div class="card">${this.#renderPhase()}</div>`;
    }

    #renderPhase() {
        switch (this.phase) {
            case "loading":
                return html`<vi-spinner></vi-spinner>`;

            case "error":
                return html`<p class="error">${this.error}</p>`;

            case "done":
                return html`<p>${this.translations.ConsentReturning}</p>`;

            default: {
                const request = this.request!;
                const deciding = this.phase === "deciding";

                return html`
                    <h1>${String.format(this.translations.ConsentTitle, request.clientName)}</h1>
                    <p class="muted">${String.format(this.translations.ConsentIntro, request.clientName, request.redirectHost)}</p>
                    ${request.isLoopback ? html`<p class="warning">${this.translations.ConsentLocalhostWarning}</p>` : nothing}
                    <p class="user">${String.format(this.translations.ConsentSignedInAs, this.service.application?.friendlyUserName || this.service.userName)} <a href="#" @click=${this.#notYou}>${this.translations.NotYou}</a></p>
                    <p>${this.translations.ConsentPermissions}</p>
                    <ul>${request.scopes.map(scope => html`<li>${scope.description}</li>`)}</ul>
                    ${this.error ? html`<p class="error">${this.error}</p>` : nothing}
                    <div class="actions">
                        <vi-button id="deny" inverse .label=${this.translations.ConsentDeny} ?disabled=${deciding} @click=${() => this.#decide("deny")}></vi-button>
                        <vi-button id="allow" .label=${this.translations.ConsentAllow} ?disabled=${deciding} ?busy=${deciding} @click=${() => this.#decide("allow")}></vi-button>
                    </div>`;
            }
        }
    }

    async #decide(decision: "allow" | "deny") {
        if (this.phase !== "ready" || !this.request)
            return;

        this.phase = "deciding";
        this.error = null;

        try {
            const response = await this.#send("POST", this.request.requestId, { decision });
            const body = await response.json();

            if (body?.redirectUri) {
                this.phase = "done";
                document.location.replace(body.redirectUri);
                return;
            }

            if (response.status === 401) {
                this.app.redirectToSignIn();
                return;
            }

            this.error = body?.error_description || body?.error || this.translations.ConsentFailed;
            this.phase = body?.error === "expired" ? "error" : "ready";
        }
        catch {
            this.error = this.translations.ConsentFailed;
            this.phase = "ready";
        }
    }

    #notYou(e: Event) {
        e.preventDefault();
        this.app.redirectToSignOut();
    }

    #fail(message: string) {
        this.error = message;
        this.phase = "error";
    }

    #send(method: "GET" | "POST", requestId: string, body?: object): Promise<Response> {
        const serviceUri = this.service.serviceUri || "";
        const url = `${serviceUri && !serviceUri.endsWith("/") ? serviceUri + "/" : serviceUri}connect/consent/${encodeURIComponent(requestId)}`;

        const headers: Record<string, string> = { "Accept": "application/json" };
        if (body) {
            headers["Content-Type"] = "application/json";
            // The token's slashes become underscores, as in the sign-in hash.
            headers["Authorization"] = `Bearer ${encodeURIComponent(this.service.userName)}/${(this.service.authToken || "").replace(/\//g, "_")}`;
        }

        return this.service.hooks.onFetch(new Request(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            credentials: "same-origin",
        }));
    }
}

customElements.define("vi-consent", Consent);
