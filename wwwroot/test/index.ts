import { AppRoute } from "../web-components/app-route/app-route";
import QueryPresenter from "../web-components/query-presenter/query-presenter";

const appFrame = document.getElementById("app") as HTMLIFrameElement;

function init(url: string = "") {
    appFrame.src = `../${url}`;
}

QUnit.module("Routing tests", hooks => {
    QUnit.test("Automatically open first program unit", async assert => {
        init();

        const activeRoute = await querySelectorDeep("vi-app", "vi-app-route-presenter vi-app-route.active") as AppRoute;
        assert.equal(activeRoute.route, ":programUnitName/query.:id");
    });

    QUnit.test("Go to other route", async assert => {
        init();

        await waitFor(async () => {
            const appRoute = await querySelectorDeep("vi-app", "vi-app-route-presenter vi-app-route.active") as AppRoute;
            if (!appRoute)
                return;

            appRoute.app.changePath("home/employees");

            const queryPresenter = appRoute.querySelector("vi-query-presenter") as QueryPresenter;
            if (!queryPresenter)
                return;

            if ((queryPresenter).query?.name === "Employees") {
                assert.ok(true);
                return true;
            }
        });
    });
});

async function querySelectorDeep(selector: string, ...deepSelectors: string[]);
async function querySelectorDeep(onElement: ParentNode, ...selector: string[]);
async function querySelectorDeep(onElementOrSeletor: ParentNode | string, ...selector: string[]) {
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

async function waitFor<T>(callback: () => T | Promise<T>, timeBetween: number = 200, timeout: number = 30000) {
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

function sleep(milliseconds: number) {
    return new Promise(resolve => {
        setTimeout(resolve, milliseconds);
    });
}