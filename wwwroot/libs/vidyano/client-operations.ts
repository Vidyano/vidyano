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