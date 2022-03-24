import * as Polymer from "../libs/polymer/polymer.js";
import { App } from "../web-components/app/app";
import QueryPresenter from "../web-components/query-presenter/query-presenter";

export async function init(url: string = "", htmlFile?: string) {
    document.body.querySelectorAll("iframe").forEach(f => f.parentElement.removeChild(f));
    
    const appFrame = document.createElement("iframe");
    appFrame.id = "app";
    appFrame.src = `${new URL(document.querySelector("base").href).origin}/${url}`;
    
    document.body.appendChild(appFrame);

    if (htmlFile) {
        await waitFor(() => {
            if (appFrame.contentDocument.body == null)
                return;

            if (appFrame.contentDocument.body.innerHTML?.indexOf("vi-app") >= 0)
                return true;
        });

        appFrame.contentDocument.body.innerHTML = "";
        await waitFor(() => appFrame.contentDocument.body.innerHTML.length == 0);

        appFrame.contentDocument.body.innerHTML = (await (await fetch(htmlFile)).text());
    }

    return await waitFor(async () => {
        const app = appFrame.contentDocument?.querySelector("vi-app") as App;
        if (!app?.initialize)
            return;

        await app.initialize;
        return app;
    });
}

export function rightClick(element: Node) {
    element.dispatchEvent(new MouseEvent("contextmenu", {
        button: 2
    }));
}

export async function waitForPolymerAsync(fnc: () => void) {
    return new Promise(resolve => {
        Polymer.Async.microTask.run(() => {
            resolve(fnc());
        });
    });
}

export async function querySelectorDeep(selector: string, ...deepSelectors: string[]);
export async function querySelectorDeep(onElement: ParentNode, ...selector: string[]);
export async function querySelectorDeep(onElementOrSeletor: ParentNode | string, ...selector: string[]) {
    let onElement: ParentNode;
    if (typeof onElementOrSeletor === "string") {
        onElement = null;
        selector.splice(0, 0, onElementOrSeletor);
    }
    else
        onElement = onElementOrSeletor;

    const select = selector[0];
    const result = await waitFor(() => (onElement || (document.getElementById("app") as HTMLIFrameElement).contentWindow.document).querySelector(select));

    if (selector.length === 1)
        return result;

    await waitFor(() => result.shadowRoot);
    return await querySelectorDeep(result.shadowRoot, ...selector.slice(1));
}

export async function waitFor<T>(callback: () => T | Promise<T>, timeBetween: number = 200, timeout: number = 30000) {
    const timeoutHandle = setTimeout(() => {
        throw new Error("Timeout");
    }, timeout);

    try {
        do {
            const result = callback();
            if (result instanceof Promise) {
                const promiseResult = await result;
                if (promiseResult)
                    return promiseResult;
            }
            else if (!!result)
                return result;

            await sleep(timeBetween);
        }
        while (true);
    }
    finally {
        clearTimeout(timeoutHandle);
    }
}

export async function waitForQuery(queryName: string): Promise<QueryPresenter> {
    return await waitFor(async () => {
        const queryPresenter = await querySelectorDeep("vi-app", "vi-app-route-presenter vi-app-route.active vi-query-presenter") as QueryPresenter;
        if (!queryPresenter)
            return;

        if ((queryPresenter).query?.name === queryName)
            return queryPresenter;
    });
}

export function sleep(milliseconds: number) {
    return new Promise(resolve => {
        setTimeout(resolve, milliseconds);
    });
}