import type { ServiceHooks } from "./service-hooks.js";

/**
 * Represents a generic client operation.
 */
export interface IClientOperation {
    type: string;
}

/**
 * Represents a refresh operation for the client.
 */
export interface IRefreshOperation extends IClientOperation {
    delay?: number;
    queryId?: string;
    fullTypeName?: string;
    objectId?: string;
}

/**
 * Represents an execute method operation.
 */
export interface IExecuteMethodOperation extends IClientOperation {
    name: string;
    arguments: any[];
}

/**
 * Represents an open operation for a persistent object.
 */
export interface IOpenOperation extends IClientOperation {
    persistentObject: any;
    replace?: boolean;
}

/**
 * Provides various client-side operations that can be triggered by the service.
 */
export const ClientOperations = {
    /**
     * Enables Datadog RUM for the application.
     * @param hooks The service hooks.
     * @param applicationId The Datadog application ID.
     * @param clientToken The Datadog client token.
     * @param site The Datadog site (e.g., "datadoghq.com").
     * @param service The name of the service.
     * @param version Optional version of the application.
     * @param environment Optional environment (e.g., "production", "development").
     */
    enableDatadog: function(hooks: ServiceHooks, applicationId: string, clientToken: string, site: string, service: string, version?: string, environment?: string) {
        const _enableDatadog = (h,o,u,n,d) => {
            h=h[d]=h[d]||{q:[],onReady:function(c){h.q.push(c)}}
            d=o.createElement(u);d.async=1;d.src=n
            n=o.getElementsByTagName(u)[0];n.parentNode.insertBefore(d,n)
        };

        _enableDatadog(window,document,'script','https://www.datadoghq-browser-agent.com/datadog-rum.js','DD_RUM');
        window["DD_RUM"].onReady(function() {
            window["DD_RUM"].init({
                applicationId: applicationId,
                clientToken: clientToken,
                site: site,
                service: service,
                sampleRate: 100,
                trackInteractions: true,
                version: version,
                env: environment
            });

            window["DD_RUM"].setUser({
                id: hooks.service.application.userId,
                name: hooks.service.userName
            });
        });
    },

    /**
     * Navigates to a given path.
     * @param hooks The service hooks.
     * @param path The path to navigate to.
     * @param replaceCurrent Whether to replace the current history entry.
     */
    navigate: function (hooks: ServiceHooks, path: string, replaceCurrent?: boolean) {
        hooks.onNavigate(path, replaceCurrent);
    },

    /**
     * Opens a URL in a new browser tab.
     * @param hooks The service hooks.
     * @param url The URL to open.
     */
    openUrl: function (hooks: ServiceHooks, url: string) {
        if (!url.startsWith("http"))
            url = `http://${url}`;

        window.open(url, "_blank");
    },

    /**
     * Notifies that an update is available and triggers the update handler.
     * @param hooks The service hooks.
     * @param path The path related to the update.
     * @param replaceCurrent Whether to replace the current history entry.
     */
    refreshForUpdate: function (hooks: ServiceHooks, path: string, replaceCurrent?: boolean) {
        hooks.onUpdateAvailable();
    },

    /**
     * Reloads the current page.
     */
    reloadPage: function () {
        document.location.reload();
    },
    
    /**
     * Shows a message dialog to the user.
     * @param hooks The service hooks.
     * @param title The dialog title.
     * @param message The dialog message.
     * @param rich Whether the message is rich text.
     * @param delay Delay in milliseconds before showing the dialog.
     */
    showMessageBox: function(hooks: ServiceHooks, title: string, message: string, rich: boolean = false, delay: number = 0) {
        setTimeout(function () {
            hooks.onMessageDialog(title, message, rich, hooks.service.getTranslatedMessage("OK"));
        }, delay);
    }
};