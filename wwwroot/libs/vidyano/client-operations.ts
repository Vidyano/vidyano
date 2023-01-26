import type { ServiceHooks } from "./service-hooks.js"

export interface IClientOperation {
    type: string;
}

export interface IRefreshOperation extends IClientOperation {
    delay?: number;
    queryId?: string;
    fullTypeName?: string;
    objectId?: string;
}

export interface IExecuteMethodOperation extends IClientOperation {
    name: string;
    arguments: any[];
}

export interface IOpenOperation extends IClientOperation {
    persistentObject: any;
    replace?: boolean;
}

export const ClientOperations = {
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
    navigate: function (hooks: ServiceHooks, path: string, replaceCurrent?: boolean): void {
        hooks.onNavigate(path, replaceCurrent);
    },
    openUrl: function (hooks: ServiceHooks, url: string) {
        if (!url.startsWith("http"))
            url = `http://${url}`;

        window.open(url, "_blank");
    },
    refreshForUpdate: function (hooks: ServiceHooks, path: string, replaceCurrent?: boolean): void {
        hooks.onUpdateAvailable();
    },
    reloadPage: function (): void {
        document.location.reload();
    },
    showMessageBox: function(hooks: ServiceHooks, title: string, message: string, rich: boolean = false, delay: number = 0): void {
        setTimeout(function () {
            hooks.onMessageDialog(title, message, rich, hooks.service.getTranslatedMessage("OK"));
        }, delay);
    }
}