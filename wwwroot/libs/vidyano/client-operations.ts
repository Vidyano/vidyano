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

export class ClientOperations {
    navigate(hooks: ServiceHooks, path: string, replaceCurrent?: boolean): void {
        hooks.onNavigate(path, replaceCurrent);
    }

    openUrl(hooks: ServiceHooks, url: string) {
        if (!url.startsWith("http"))
            url = `http://${url}`;

        window.open(url, "_blank");
    }

    refreshForUpdate(hooks: ServiceHooks, path: string, replaceCurrent?: boolean): void {
        hooks.onUpdateAvailable();
    }

    reloadPage(): void {
        document.location.reload();
    }

    showMessageBox(hooks: ServiceHooks, title: string, message: string, rich: boolean = false, delay: number = 0): void {
        setTimeout(function () {
            hooks.onMessageDialog(title, message, rich, hooks.service.getTranslatedMessage("OK"));
        }, delay);
    }
}